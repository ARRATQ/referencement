const express = require('express');
const authMiddleware = require('../middleware/auth');
const { requireMinRole } = require('../middleware/roles');
const jira = require('../services/jira');
const ai = require('../services/ai');
const comp = require('../services/competence');
const scoring = require('../services/scoring');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authMiddleware, requireMinRole('GESTIONNAIRE'));

async function fetchSourceFiles(context, sources) {
  const byId = {};
  for (const role of ['competence', 'intervenant', 'prestataire']) {
    for (const a of (context[role]?.attachments || [])) byId[a.id] = a;
  }
  const files = [];
  for (const s of (sources || [])) {
    const att = byId[s.attachmentId];
    if (!att) continue;
    const buf = await jira.fetchAttachmentBuffer(att.contentUrl);
    files.push({ base64: buf.toString('base64'), mimeType: att.mimeType, filename: att.filename });
  }
  return files;
}

function buildTicketContext(context) {
  return [context.competence, context.intervenant, context.prestataire]
    .filter(Boolean).map(t => `${t.key} — ${t.summary}\n${t.description || ''}`).join('\n\n');
}

// Détail : contexte compétence (intervenant/prestataire liés) + résolution des
// champs Jira + programme déduit + sources CV disponibles + évaluation existante.
router.get('/:key', async (req, res, next) => {
  try {
    const key = req.params.key.toUpperCase();
    const context = await jira.resolveCompetenceContext(key);
    const { resolved: fields, unresolved } = await jira.resolveCompetenceFields(key);

    const actionAReferencer = fields.solutionReferencee?.value || context.competence?.summary || '';
    const programCode = comp.deduceProgramCode(actionAReferencer, key.split('-')[0]);
    const program = programCode ? await prisma.program.findUnique({ where: { code: programCode } }) : null;

    const sources = [];
    for (const role of ['competence', 'intervenant', 'prestataire']) {
      for (const a of (context[role]?.attachments || [])) {
        sources.push({ ticket: context[role].key, ticketRole: role, attachmentId: a.id, filename: a.filename, mimeType: a.mimeType, size: a.size, type: comp.classifySource(a.filename) });
      }
    }

    const existing = await prisma.evaluationCompetence.findFirst({
      where: { jiraKeyCompetence: key }, orderBy: { updatedAt: 'desc' },
      include: { evaluator: { select: { name: true } } }
    });
    const linkedIntervenant = context.intervenant?.key
      ? await prisma.evaluationIntervenant.findFirst({ where: { jiraKey: context.intervenant.key }, orderBy: { updatedAt: 'desc' } })
      : null;

    res.json({
      key, summary: context.competence?.summary, status: context.competence?.status,
      context, fields, unresolved, actionAReferencer, programCode,
      program: program ? { code: program.code, name: program.name, categories: program.categories } : null,
      sources, existing, linkedIntervenant
    });
  } catch (err) { next(err); }
});

router.post('/:key/suggest-category', async (req, res, next) => {
  try {
    const key = req.params.key.toUpperCase();
    const { programCode, webConsulted } = req.body;
    const program = programCode ? await prisma.program.findUnique({ where: { code: programCode } }) : null;
    if (!program?.categories) return res.status(400).json({ error: 'Programme ou catalogue introuvable' });

    const context = await jira.resolveCompetenceContext(key);
    let webInsights = '';
    if (webConsulted) {
      try { webInsights = (await ai.analyzeSpecs({ filesData: [], prestataire: context.prestataire?.summary || '', solution: context.competence?.summary || '', category: '', modules: [] })).webInsights || ''; }
      catch { webInsights = ''; }
    }
    const suggestion = await ai.suggestCompetenceCategory({ categories: program.categories, ticketContext: buildTicketContext(context), webInsights });
    res.json({ suggestion });
  } catch (err) { next(err); }
});

router.post('/:key/score', async (req, res, next) => {
  try {
    const key = req.params.key.toUpperCase();
    const { categoryKey, programCode, sources, webConsulted } = req.body;
    if (!categoryKey || !programCode) return res.status(400).json({ error: 'categoryKey et programCode requis' });

    const program = await prisma.program.findUnique({ where: { code: programCode } });
    const cat = comp.getCategoryCriteria(program, categoryKey);
    if (!cat) return res.status(400).json({ error: 'Catégorie introuvable dans le programme' });

    const context = await jira.resolveCompetenceContext(key);
    const filesData = await fetchSourceFiles(context, sources);

    let webInsights = '';
    if (webConsulted) {
      try { webInsights = (await ai.analyzeSpecs({ filesData: [], prestataire: context.prestataire?.summary || '', solution: context.competence?.summary || '', category: cat.label, modules: [] })).webInsights || ''; }
      catch { webInsights = ''; }
    }

    const { scores, justifs } = await ai.suggestCompetenceScores({ category: cat.label, criteria: cat.criteria, filesData, ticketContext: buildTicketContext(context), webInsights });

    const { resolved: contextFields } = await jira.resolveCompetenceFields(key);

    const existing = await prisma.evaluationCompetence.findFirst({ where: { jiraKeyCompetence: key }, orderBy: { updatedAt: 'desc' } });
    const data = {
      jiraKeyCompetence: key,
      jiraKeyIntervenant: context.intervenant?.key || null,
      jiraKeyPrestataire: context.prestataire?.key || null,
      evaluatorId: req.user.id, programCode, categoryKey,
      sources: sources || [], webInsights, webConsulted: !!webConsulted,
      theoScores: scores, theoJustifs: justifs, status: 'DRAFT'
    };
    if (contextFields.solutionReferencee?.value) data.solutionReferencee = contextFields.solutionReferencee.value;
    if (contextFields.modules?.value) data.modules = contextFields.modules.value.split(', ');
    if (contextFields.secteur?.value) data.secteur = contextFields.secteur.value;
    if (contextFields.modeAcquisition?.value) data.modeAcquisition = contextFields.modeAcquisition.value;
    if (contextFields.origine?.value) data.origine = contextFields.origine.value;
    if (contextFields.natureParticipant?.value) data.natureParticipant = contextFields.natureParticipant.value;
    if (contextFields.typeIntervenant?.value) data.typeIntervenant = contextFields.typeIntervenant.value;
    const saved = existing && existing.status !== 'PUSHED'
      ? await prisma.evaluationCompetence.update({ where: { id: existing.id }, data })
      : await prisma.evaluationCompetence.create({ data });

    res.json({ scores, justifs, webInsights, evaluationId: saved.id });
  } catch (err) { next(err); }
});

async function computePhase({ evaluationId, key, scores, enabled }) {
  const evaln = await prisma.evaluationCompetence.findUnique({ where: { id: evaluationId } });
  if (!evaln || evaln.jiraKeyCompetence !== key) { const e = new Error('Évaluation introuvable'); e.status = 404; throw e; }
  if (evaln.status === 'PUSHED') { const e = new Error('Évaluation déjà envoyée'); e.status = 409; throw e; }
  for (const v of Object.values(scores || {})) {
    if (![0, 1, 2].includes(Number(v))) { const e = new Error('Note invalide (0, 1 ou 2 attendu)'); e.status = 400; throw e; }
  }
  const program = await prisma.program.findUnique({ where: { code: evaln.programCode } });
  const cat = comp.getCategoryCriteria(program, evaln.categoryKey);
  if (!cat) { const e = new Error('Catégorie introuvable'); e.status = 400; throw e; }
  const { pct, verdict } = scoring.computeSolutionScore(scores || {}, cat.criteria, enabled || {});
  return { evaln, pct, verdict };
}

router.put('/:key/theorique', async (req, res, next) => {
  try {
    const key = req.params.key.toUpperCase();
    const { evaluationId, scores, justifs, enabled } = req.body;
    const { pct, verdict } = await computePhase({ evaluationId, key, scores, enabled });
    const saved = await prisma.evaluationCompetence.update({
      where: { id: evaluationId },
      data: { theoScores: scores || {}, theoJustifs: justifs || {}, theoEnabled: enabled || {}, theoScorePct: pct, theoVerdict: verdict, theoById: req.user.id, theoAt: new Date(), status: 'THEORIQUE_DONE' }
    });
    res.json({ evaluationId: saved.id, scorePct: pct, verdict, status: saved.status });
  } catch (err) { next(err); }
});

router.put('/:key/demo', async (req, res, next) => {
  try {
    const key = req.params.key.toUpperCase();
    const { evaluationId, scores, justifs, enabled } = req.body;
    const { evaln, pct, verdict } = await computePhase({ evaluationId, key, scores, enabled });
    if (evaln.status === 'DRAFT') return res.status(409).json({ error: 'Valider d\'abord la phase théorique' });
    const saved = await prisma.evaluationCompetence.update({
      where: { id: evaluationId },
      data: { demoScores: scores || {}, demoJustifs: justifs || {}, demoScorePct: pct, demoVerdict: verdict, demoById: req.user.id, demoAt: new Date(), status: 'DEMO_DONE' }
    });
    res.json({ evaluationId: saved.id, scorePct: pct, verdict, status: saved.status });
  } catch (err) { next(err); }
});

router.post('/:key/briefing', async (req, res, next) => {
  try {
    const key = req.params.key.toUpperCase();
    const { evaluationId } = req.body;
    const evaln = await prisma.evaluationCompetence.findUnique({ where: { id: evaluationId } });
    if (!evaln || evaln.jiraKeyCompetence !== key) return res.status(404).json({ error: 'Évaluation introuvable' });
    const program = evaln.programCode ? await prisma.program.findUnique({ where: { code: evaln.programCode } }) : null;
    const cat = comp.getCategoryCriteria(program, evaln.categoryKey);
    const context = await jira.resolveCompetenceContext(key);

    const briefingText = await ai.generateBriefing({
      prestataire: context.prestataire?.summary || '—',
      solution: evaln.solutionReferencee || context.competence?.summary || '—',
      category: cat?.label || evaln.categoryKey || '—',
      modules: Array.isArray(evaln.modules) ? evaln.modules : [],
      amiText: program?.amiText || '', amiContext: ''
    });

    const saved = await prisma.evaluationCompetence.update({
      where: { id: evaluationId }, data: { briefingText, briefingById: req.user.id, briefingAt: new Date() }
    });
    res.json({ briefingText: saved.briefingText });
  } catch (err) { next(err); }
});

router.post('/:key/push', async (req, res, next) => {
  try {
    const key = req.params.key.toUpperCase();
    const { evaluationId } = req.body;
    const evaln = await prisma.evaluationCompetence.findUnique({ where: { id: evaluationId } });
    if (!evaln || evaln.jiraKeyCompetence !== key) return res.status(404).json({ error: 'Évaluation introuvable' });
    // Règle métier : le push se fait UNIQUEMENT après la démo.
    if (evaln.status !== 'DEMO_DONE') return res.status(409).json({ error: 'Le push n\'est possible qu\'après la validation de la démo' });
    if (evaln.demoScorePct === null || evaln.demoScorePct === undefined) return res.status(400).json({ error: 'Note de démo non calculée' });

    const program = await prisma.program.findUnique({ where: { code: evaln.programCode } });
    const cat = comp.getCategoryCriteria(program, evaln.categoryKey);

    const body = comp.buildPushComment({
      criteria: cat?.criteria || [], scores: evaln.demoScores, justifs: evaln.demoJustifs,
      scorePct: evaln.demoScorePct, verdict: evaln.demoVerdict,
      category: cat?.label || evaln.categoryKey, solution: evaln.solutionReferencee,
      phase: 'DEMO', userName: req.user.name, sources: (evaln.sources || []).map(s => s.filename)
    });

    try {
      await jira.addComment(key, body, { internal: true });
    } catch (e) {
      console.error(`[competences push] commentaire ${key}:`, e.message);
      await prisma.auditLog.create({
        data: { userId: req.user.id, action: 'COMPETENCE_JIRA_PUSH',
          details: { jiraKey: key, phase: 'DEMO', scorePct: evaln.demoScorePct, verdict: evaln.demoVerdict, evaluationId, commentPosted: false }, ipAddress: req.ip }
      });
      return res.status(502).json({ ok: false, commentPosted: false, status: evaln.status, error: 'Échec de l\'envoi du commentaire Jira — réessayez.' });
    }

    try {
      const cfg = await prisma.appConfig.findUnique({ where: { key: 'jira_cf_score_sol' } });
      if (cfg?.value) await jira.updateIssueFields(key, { [cfg.value]: String(evaln.demoScorePct) });
    } catch (e) { console.error(`[competences push] customfield ${key}:`, e.message); }

    const saved = await prisma.evaluationCompetence.update({ where: { id: evaluationId }, data: { status: 'PUSHED', pushedAt: new Date() } });

    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'COMPETENCE_JIRA_PUSH',
        details: { jiraKey: key, phase: 'DEMO', scorePct: evaln.demoScorePct, verdict: evaln.demoVerdict, evaluationId, commentPosted: true }, ipAddress: req.ip }
    });

    res.json({ ok: true, commentPosted: true, status: saved.status });
  } catch (err) { next(err); }
});

module.exports = router;

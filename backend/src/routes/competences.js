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

    const existing = await prisma.evaluationCompetence.findFirst({ where: { jiraKeyCompetence: key }, orderBy: { updatedAt: 'desc' } });
    const data = {
      jiraKeyCompetence: key,
      jiraKeyIntervenant: context.intervenant?.key || null,
      jiraKeyPrestataire: context.prestataire?.key || null,
      evaluatorId: req.user.id, programCode, categoryKey,
      sources: sources || [], webInsights, webConsulted: !!webConsulted,
      theoScores: scores, theoJustifs: justifs, status: 'DRAFT'
    };
    const saved = existing && existing.status !== 'PUSHED'
      ? await prisma.evaluationCompetence.update({ where: { id: existing.id }, data })
      : await prisma.evaluationCompetence.create({ data });

    res.json({ scores, justifs, webInsights, evaluationId: saved.id });
  } catch (err) { next(err); }
});

module.exports = router;

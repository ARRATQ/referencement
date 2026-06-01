const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');
const { requireRole, requireMinRole } = require('../middleware/roles');
const { computeSolutionScore, computeIntegratorScore, computeFinalDecision } = require('../services/scoring');
const jira = require('../services/jira');

const router = express.Router();
const prisma = new PrismaClient();

async function audit(userId, evaluationId, action, details, ip) {
  await prisma.auditLog.create({ data: { userId, evaluationId, action, details, ipAddress: ip } });
}

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const { status, programId } = req.query;
    const where = {};
    if (status) where.status = status;
    if (programId) where.programId = programId;
    const evals = await prisma.evaluation.findMany({
      where,
      include: { program: { select: { code: true, name: true } }, evaluator: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(evals);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const ev = await prisma.evaluation.findUnique({
      where: { id: req.params.id },
      include: { program: true, evaluator: { select: { name: true, email: true } } }
    });
    if (!ev) return res.status(404).json({ error: 'Évaluation introuvable' });
    res.json(ev);
  } catch (err) { next(err); }
});

router.post('/', requireMinRole('GESTIONNAIRE'), async (req, res, next) => {
  try {
    const { programId, referenceType = 'SOLUTION', ...rest } = req.body;
    if (!programId) return res.status(400).json({ error: 'programId requis' });
    const program = await prisma.program.findUnique({ where: { id: programId } });
    if (!program) return res.status(404).json({ error: 'Programme introuvable' });

    const pickedData = pick(rest, ['actionDomain','jiraKeyPrestataire','jiraKeyIntervenant','jiraKeyCompetence',
      'solution','actionLabel','actionDescription','dateDemo','rapporteur','origine','nature',
      'modeAcquisition','secteur','typeIntervenant','modules','category']);
    cleanDates(pickedData, ['dateDemo']);
    const ev = await prisma.evaluation.create({
      data: {
        programId,
        evaluatorId: req.user.id,
        referenceType,
        prestataire: rest.prestataire || '',
        ...pickedData
      }
    });
    await audit(req.user.id, ev.id, 'created', { programId, referenceType }, req.ip);
    res.status(201).json(ev);
  } catch (err) { next(err); }
});

router.put('/:id', requireMinRole('GESTIONNAIRE'), async (req, res, next) => {
  try {
    const ev = await prisma.evaluation.findUnique({ where: { id: req.params.id } });
    if (!ev) return res.status(404).json({ error: 'Évaluation introuvable' });
    if (ev.status === 'SUBMITTED') return res.status(400).json({ error: 'Évaluation déjà soumise' });

    const allowed = ['prestataire','solution','actionLabel','actionDescription','dateDemo','rapporteur',
      'origine','nature','modeAcquisition','secteur','typeIntervenant','modules','category',
      'jiraKeyPrestataire','jiraKeyIntervenant','jiraKeyCompetence','referenceType','actionDomain',
      'solScores','solObservations','solEnabled','intScores','intObservations','intEnabled',
      'finalDecision','decisionDate','decisionMotive','conditions','commissionComments','pvText',
      'cvAnalysis','attestationsAnalysis','briefingText','coherenceCheck',
      'specsAnalysis','demoScenario','webInsights','certifEditeurAnalysis','customCriteria'];

    const data = cleanDates(pick(req.body, allowed), ['dateDemo', 'decisionDate']);

    // Recalcul scores si scores fournis
    if (data.solScores !== undefined) {
      const program = await prisma.program.findUnique({ where: { id: ev.programId } });
      let criteria = [];
      // Priorité : critères personnalisés (grille dynamique) > critères du programme
      const customCriteria = data.customCriteria || ev.customCriteria;
      if (Array.isArray(customCriteria) && customCriteria.length > 0) {
        criteria = customCriteria;
      } else if (ev.referenceType === 'SOLUTION' && ev.category) {
        criteria = program.categories?.[ev.category]?.criteria || [];
      } else if (ev.referenceType === 'ACTION' && ev.actionDomain) {
        criteria = program.actionTypes?.[ev.actionDomain]?.criteria || [];
      }
      const { pct, verdict } = computeSolutionScore(data.solScores, criteria, data.solEnabled || {});
      data.solScorePct = pct;
      data.solVerdict = verdict;
    }

    if (data.intScores !== undefined) {
      const program = await prisma.program.findUnique({ where: { id: ev.programId } });
      const intCrit = program.intCriteria || [];
      const { pct, verdict } = computeIntegratorScore(data.intScores, intCrit, data.intEnabled || {});
      data.intScorePct = pct;
      data.intVerdict = verdict;
    }

    if (data.solScorePct !== undefined && data.intScorePct !== undefined) {
      const { globalPct, decision } = computeFinalDecision(data.solScorePct, data.intScorePct);
      data.finalScorePct = globalPct;
      if (!data.finalDecision) data.finalDecision = decision;
    }

    const updated = await prisma.evaluation.update({ where: { id: req.params.id }, data });
    await audit(req.user.id, req.params.id, 'updated', Object.keys(data), req.ip);
    res.json(updated);
  } catch (err) { next(err); }
});

router.post('/:id/submit', requireMinRole('GESTIONNAIRE'), async (req, res, next) => {
  try {
    const ev = await prisma.evaluation.findUnique({
      where: { id: req.params.id },
      include: { program: true }
    });
    if (!ev) return res.status(404).json({ error: 'Évaluation introuvable' });
    if (ev.status === 'SUBMITTED') return res.status(400).json({ error: 'Déjà soumise' });

    const jiraKey = ev.jiraKeyCompetence || ev.jiraKeyIntervenant || ev.jiraKeyPrestataire;

    if (jiraKey) {
      try {
        const cfg = await prisma.appConfig.findMany({
          where: { key: { in: ['jira_cf_score_sol', 'jira_cf_score_int'] } }
        });
        const cfMap = Object.fromEntries(cfg.map(r => [r.key, r.value]));
        const fields = {};
        if (cfMap.jira_cf_score_sol && ev.solScorePct !== null) fields[cfMap.jira_cf_score_sol] = `${ev.solScorePct}%`;
        if (cfMap.jira_cf_score_int && ev.intScorePct !== null) fields[cfMap.jira_cf_score_int] = `${ev.intScorePct}%`;
        if (Object.keys(fields).length) await jira.updateIssueFields(jiraKey, fields);
        if (ev.pvText) {
          await jira.addComment(jiraKey, `*PV Commission de Référencement — ${ev.program.name}*\n\n${ev.pvText}`);
        }
      } catch (jiraErr) {
        console.error('Jira submit error (non-bloquant):', jiraErr.message);
      }
    }

    const updated = await prisma.evaluation.update({
      where: { id: req.params.id },
      data: { status: 'SUBMITTED', submittedAt: new Date() }
    });
    await audit(req.user.id, req.params.id, 'submitted', { jiraKey, decision: ev.finalDecision }, req.ip);
    res.json(updated);
  } catch (err) { next(err); }
});

router.delete('/:id', requireMinRole('GESTIONNAIRE'), async (req, res, next) => {
  try {
    const ev = await prisma.evaluation.findUnique({ where: { id: req.params.id } });
    if (!ev) return res.status(404).json({ error: 'Évaluation introuvable' });
    if (ev.status === 'SUBMITTED') return res.status(400).json({ error: 'Impossible de supprimer une évaluation soumise' });
    await prisma.auditLog.deleteMany({ where: { evaluationId: req.params.id } });
    await prisma.evaluation.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

function pick(obj, keys) {
  return Object.fromEntries(keys.filter(k => obj[k] !== undefined).map(k => [k, obj[k]]));
}

// Nettoie les champs date : supprime les strings vides pour éviter l'erreur Prisma DateTime
function cleanDates(data, dateFields) {
  for (const f of dateFields) {
    if (data[f] === '' || data[f] === null) delete data[f];
  }
  return data;
}

module.exports = router;

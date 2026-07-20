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

module.exports = router;

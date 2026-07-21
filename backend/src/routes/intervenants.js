const express = require('express');
const authMiddleware = require('../middleware/auth');
const { requireMinRole } = require('../middleware/roles');
const jira = require('../services/jira');
const ai = require('../services/ai');
const { mapIntervenantRow } = require('../services/historique');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authMiddleware, requireMinRole('GESTIONNAIRE'));

// Historique : liste des évaluations intervenant réalisées (toutes, plus récentes d'abord).
router.get('/', async (req, res, next) => {
  try {
    const rows = await prisma.evaluationIntervenant.findMany({
      take: 200,
      orderBy: { createdAt: 'desc' },
      include: { evaluator: { select: { name: true } } }
    });
    res.json(rows.map(mapIntervenantRow));
  } catch (err) { next(err); }
});

// Échappe les pipes Jira wiki markup dans une cellule de tableau.
const escapeCell = v => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

// Commentaire interne (note, invisible côté portail) posté à chaque push :
// trace la proposition IA (valeur + justification) et l'utilisateur ayant
// validé l'envoi vers Jira, pour audit terrain.
function buildPushComment({ pushedFields, resolved, values, proposed, cvFilename, userName }) {
  const date = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Casablanca', dateStyle: 'short', timeStyle: 'short' });
  const rows = pushedFields.map(cle => {
    const justification = proposed?.[cle]?.justification || '—';
    return `|${escapeCell(resolved[cle].jiraName)}|${escapeCell(values[cle])}|${escapeCell(justification)}|`;
  }).join('\n');
  const source = cvFilename ? `CV analysé automatiquement (${cvFilename})` : 'CV analysé automatiquement';
  return [
    '🤖 *Champs intervenant renseignés via extraction IA*',
    '',
    `*Demandé par :* ${userName}`,
    `*Date :* ${date}`,
    `*Source :* ${source}, valeurs relues et validées avant envoi`,
    '',
    '||Champ||Valeur envoyée||Justification IA||',
    rows,
    '',
    '_Commentaire interne — non visible sur le portail client._'
  ].join('\n');
}

// Recherche de tickets intervenant : par clé exacte ou texte du summary.
router.get('/search', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);

    let jiraProject = 'REF';
    const cfg = await prisma.appConfig.findUnique({ where: { key: 'jira_project' } });
    if (cfg) jiraProject = cfg.value;

    // Clé de ticket exacte (ex: REF-123) → recherche directe, sinon texte.
    const isKey = /^[A-Z][A-Z0-9]+-\d+$/i.test(q);
    const jql = isKey
      ? `key = "${q.toUpperCase()}"`
      : `project = ${jiraProject} AND issuetype = "Intervenant" AND summary ~ "${q.replace(/"/g, '')}*" ORDER BY created DESC`;

    const data = await jira.searchIssues(jql, ['summary', 'status', 'issuetype', 'created'], 20);
    res.json((data.issues || []).map(i => ({
      key: i.key,
      summary: i.fields.summary,
      status: i.fields.status?.name,
      issueType: i.fields.issuetype?.name,
      created: i.fields.created
    })));
  } catch (err) { next(err); }
});

// Détail : ticket + pièces jointes + résolution des 11 champs + évaluation existante.
router.get('/:key', async (req, res, next) => {
  try {
    const key = req.params.key.toUpperCase();
    const [issue, fieldsResult, existing] = await Promise.all([
      jira.getIssue(key, ['summary', 'status', 'attachment']),
      jira.resolveIntervenantFields(key),
      prisma.evaluationIntervenant.findFirst({
        where: { jiraKey: key },
        orderBy: { updatedAt: 'desc' },
        include: { evaluator: { select: { name: true } } }
      })
    ]);
    res.json({
      key,
      summary: issue.fields.summary,
      status: issue.fields.status?.name,
      attachments: (issue.fields.attachment || []).map(a => ({
        id: a.id, filename: a.filename, mimeType: a.mimeType, size: a.size
      })),
      fields: fieldsResult.resolved,
      unresolved: fieldsResult.unresolved,
      existing
    });
  } catch (err) { next(err); }
});

// Extraction IA depuis le CV (pièce jointe Jira ou fichier uploadé).
router.post('/:key/extract', async (req, res, next) => {
  try {
    const key = req.params.key.toUpperCase();
    const { attachmentId, fileData } = req.body;
    if (!attachmentId && !fileData?.base64) {
      return res.status(400).json({ error: 'attachmentId ou fileData requis' });
    }

    let file;
    if (attachmentId) {
      const issue = await jira.getIssue(key, ['attachment']);
      const att = (issue.fields.attachment || []).find(a => a.id === String(attachmentId));
      if (!att) return res.status(404).json({ error: 'Pièce jointe introuvable' });
      const buffer = await jira.fetchAttachmentBuffer(att.content);
      file = { base64: buffer.toString('base64'), mimeType: att.mimeType, filename: att.filename };
    } else {
      file = fileData;
    }

    const { resolved, unresolved } = await jira.resolveIntervenantFields(key);
    const propositions = await ai.extractIntervenantFieldsFromCV({ filesData: [file], fields: resolved });

    // Brouillon : une évaluation par intervenant (mise à jour de la plus récente sinon création).
    const existing = await prisma.evaluationIntervenant.findFirst({ where: { jiraKey: key }, orderBy: { updatedAt: 'desc' } });
    const data = {
      jiraKey: key,
      evaluatorId: req.user.id,
      cvSource: attachmentId ? 'jira' : 'upload',
      cvFilename: file.filename || null,
      proposed: propositions,
      status: 'DRAFT'
    };
    const saved = existing
      ? await prisma.evaluationIntervenant.update({ where: { id: existing.id }, data })
      : await prisma.evaluationIntervenant.create({ data });

    res.json({ propositions, unresolved, evaluationId: saved.id });
  } catch (err) { next(err); }
});

// Écriture des valeurs validées dans Jira + enregistrement + audit.
router.post('/:key/push', async (req, res, next) => {
  try {
    const key = req.params.key.toUpperCase();
    const { values, evaluationId } = req.body;
    if (!values || typeof values !== 'object' || !Object.keys(values).length) {
      return res.status(400).json({ error: 'values requis' });
    }

    const { resolved } = await jira.resolveIntervenantFields(key);
    const jiraFields = {};
    const pushedFields = [];
    const skipped = [];
    for (const [cle, value] of Object.entries(values)) {
      const f = resolved[cle];
      if (!f || value === '' || value === null || value === undefined) { skipped.push(cle); continue; }
      // Validation serveur des radios
      if (f.type === 'radio' && !f.options.includes(value)) {
        return res.status(400).json({ error: `Valeur invalide pour "${f.jiraName}" : "${value}". Options : ${f.options.join(', ')}` });
      }
      // Champs Jira « Text Field (single line) » : 255 caractères max
      if (f.type !== 'radio' && String(value).length > 255) {
        return res.status(400).json({ error: `"${f.jiraName}" dépasse 255 caractères (${String(value).length}) — champ Jira monoligne.` });
      }
      // Radio Jira = objet option { value }, texte = chaîne.
      // valueMap : option canonique (« Valide ») → option réelle du champ Jira (« Ok »).
      jiraFields[f.fieldId] = f.type === 'radio' ? { value: f.valueMap?.[value] ?? value } : String(value);
      pushedFields.push(cle);
    }
    if (!pushedFields.length) {
      return res.status(400).json({ error: 'Aucun champ résolu à envoyer' });
    }

    let existing = evaluationId
      ? await prisma.evaluationIntervenant.findUnique({ where: { id: evaluationId } })
      : null;
    if (existing && existing.jiraKey !== key) existing = null;
    if (!existing) {
      existing = await prisma.evaluationIntervenant.findFirst({ where: { jiraKey: key }, orderBy: { updatedAt: 'desc' } });
    }

    await jira.updateIssueFields(key, jiraFields);

    // Note interne (invisible côté portail) : traçabilité de la proposition IA
    // (valeur + justification issues de l'extraction) et de l'utilisateur
    // ayant validé/envoyé les valeurs.
    let commentPosted = true;
    try {
      await jira.addComment(key, buildPushComment({ pushedFields, resolved, values, proposed: existing?.proposed, cvFilename: existing?.cvFilename, userName: req.user.name }), { internal: true });
    } catch (err) {
      commentPosted = false;
      console.error(`[intervenants push] échec commentaire interne ${key}:`, err.message);
    }

    const data = {
      jiraKey: key,
      evaluatorId: req.user.id,
      validated: values,
      status: 'PUSHED',
      pushedAt: new Date()
    };
    const saved = existing
      ? await prisma.evaluationIntervenant.update({ where: { id: existing.id }, data })
      : await prisma.evaluationIntervenant.create({ data });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'INTERVENANT_JIRA_PUSH',
        details: { jiraKey: key, pushedFields, skipped, values },
        ipAddress: req.ip
      }
    });

    res.json({ ok: true, pushedFields, skipped, evaluationId: saved.id, commentPosted });
  } catch (err) { next(err); }
});

module.exports = router;

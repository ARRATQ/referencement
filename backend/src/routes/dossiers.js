const express = require('express');
const authMiddleware = require('../middleware/auth');
const { requireMinRole } = require('../middleware/roles');
const jira = require('../services/jira');

const router = express.Router();
router.use(authMiddleware, requireMinRole('GESTIONNAIRE'));

router.get('/', async (req, res, next) => {
  try {
    const { program, status, maxResults = 50 } = req.query;
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    let jiraProject = 'REF';
    try {
      const cfg = await prisma.appConfig.findUnique({ where: { key: 'jira_project' } });
      if (cfg) jiraProject = cfg.value;
    } finally { await prisma.$disconnect(); }

    let jql = `project = ${jiraProject}`;
    if (status) jql += ` AND status = "${status}"`;
    jql += ' ORDER BY created DESC';

    const data = await jira.searchIssues(jql, ['summary', 'status', 'issuetype', 'assignee', 'created'], Number(maxResults));
    const dossiers = (data.issues || []).map(i => ({
      key: i.key,
      summary: i.fields.summary,
      status: i.fields.status?.name,
      issueType: i.fields.issuetype?.name,
      assignee: i.fields.assignee?.displayName,
      created: i.fields.created
    }));
    res.json(dossiers);
  } catch (err) { next(err); }
});

router.get('/test-connection', async (req, res, next) => {
  try {
    const info = await jira.testConnection();
    res.json({ ok: true, serverTitle: info.serverTitle, version: info.version });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

router.get('/:key', async (req, res, next) => {
  try {
    const issue = await jira.getIssue(req.params.key);
    res.json(issue);
  } catch (err) { next(err); }
});

router.get('/:key/intervenants', async (req, res, next) => {
  try {
    const hierarchy = await jira.resolveHierarchy(req.params.key);
    res.json(hierarchy);
  } catch (err) { next(err); }
});

router.get('/:key/attachments', async (req, res, next) => {
  try {
    const issue = await jira.getIssue(req.params.key, ['attachment']);
    const attachments = (issue.fields.attachment || []).map(a => ({
      id: a.id, filename: a.filename, mimeType: a.mimeType,
      size: a.size, contentUrl: a.content
    }));
    res.json(attachments);
  } catch (err) { next(err); }
});

router.get('/:key/extract-intervenant', async (req, res, next) => {
  try {
    const data = await jira.extractIntervenantData(req.params.key);
    res.json(data);
  } catch (err) { next(err); }
});

router.get('/:key/extract-competence', async (req, res, next) => {
  try {
    const data = await jira.extractCompetenceData(req.params.key);
    res.json(data);
  } catch (err) { next(err); }
});

router.get('/:key/attachment/:attId', async (req, res, next) => {
  try {
    const issue = await jira.getIssue(req.params.key, ['attachment']);
    const att = (issue.fields.attachment || []).find(a => a.id === req.params.attId);
    if (!att) return res.status(404).json({ error: 'Pièce jointe introuvable' });

    const buffer = await jira.fetchAttachmentBuffer(att.content);
    res.setHeader('Content-Type', att.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${att.filename}"`);
    res.send(buffer);
  } catch (err) { next(err); }
});

module.exports = router;

const fetch = require('node-fetch');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

async function getConfig() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.appConfig.findMany({
      where: { key: { in: ['jira_url', 'jira_auth', 'jira_pat', 'jira_user', 'jira_pass', 'jira_project'] } }
    });
    const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]));
    return cfg;
  } finally {
    await prisma.$disconnect();
  }
}

function buildAuthHeader(cfg) {
  if (cfg.jira_auth === 'basic') {
    return 'Basic ' + Buffer.from(`${cfg.jira_user}:${cfg.jira_pass}`).toString('base64');
  }
  return `Bearer ${cfg.jira_pat}`;
}

async function jiraFetch(path, options = {}) {
  const cfg = await getConfig();
  if (!cfg.jira_url) throw new Error('URL Jira non configurée');
  const url = cfg.jira_url.replace(/\/$/, '') + path;
  const res = await fetch(url, {
    ...options,
    agent,
    headers: {
      'Authorization': buildAuthHeader(cfg),
      'Content-Type': 'application/json',
      'X-Atlassian-Token': 'no-check',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function searchIssues(jql, fields = [], maxResults = 50) {
  const f = fields.length ? fields.join(',') : 'summary,status,issuetype,assignee,created,issuelinks,attachment';
  return jiraFetch(`/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=${f}`);
}

async function getIssue(key, fields = []) {
  const f = fields.length ? `?fields=${fields.join(',')}` : '?fields=summary,status,issuetype,assignee,created,issuelinks,attachment,description';
  return jiraFetch(`/rest/api/2/issue/${key}${f}`);
}

async function resolveHierarchy(prestataireKey) {
  const prestataire = await getIssue(prestataireKey);
  const links = prestataire.fields.issuelinks || [];

  const intervenantKeys = links
    .filter(l => l.outwardIssue && (l.type.outward?.toLowerCase().includes('intervenant') || l.type.name?.toLowerCase().includes('intervenant')))
    .map(l => l.outwardIssue.key);

  const intervenants = await Promise.all(intervenantKeys.map(async key => {
    const issue = await getIssue(key, ['summary', 'attachment', 'issuelinks', 'status', 'description']);
    const compLinks = (issue.fields.issuelinks || [])
      .filter(l => l.outwardIssue && (l.type.outward?.toLowerCase().includes('comp') || l.type.name?.toLowerCase().includes('comp')))
      .map(l => l.outwardIssue.key);

    const competences = await Promise.all(compLinks.map(async ck => {
      const ci = await getIssue(ck, ['summary', 'attachment', 'status', 'description']);
      return {
        key: ck,
        summary: ci.fields.summary,
        status: ci.fields.status?.name,
        description: ci.fields.description,
        attachments: (ci.fields.attachment || []).map(a => ({
          id: a.id, filename: a.filename, mimeType: a.mimeType,
          size: a.size, contentUrl: a.content
        }))
      };
    }));

    return {
      key,
      summary: issue.fields.summary,
      status: issue.fields.status?.name,
      description: issue.fields.description,
      attachments: (issue.fields.attachment || []).map(a => ({
        id: a.id, filename: a.filename, mimeType: a.mimeType,
        size: a.size, contentUrl: a.content
      })),
      competences
    };
  }));

  return {
    key: prestataireKey,
    summary: prestataire.fields.summary,
    status: prestataire.fields.status?.name,
    intervenants
  };
}

async function fetchAttachmentBuffer(contentUrl) {
  const cfg = await getConfig();
  const res = await fetch(contentUrl, {
    agent,
    headers: { Authorization: buildAuthHeader(cfg) }
  });
  if (!res.ok) throw new Error(`Attachment fetch ${res.status}`);
  return res.buffer();
}

async function updateIssueFields(key, fields) {
  return jiraFetch(`/rest/api/2/issue/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ fields })
  });
}

async function addComment(key, body) {
  return jiraFetch(`/rest/api/2/issue/${key}/comment`, {
    method: 'POST',
    body: JSON.stringify({ body })
  });
}

async function testConnection() {
  return jiraFetch('/rest/api/2/serverInfo');
}

module.exports = {
  searchIssues, getIssue, resolveHierarchy,
  fetchAttachmentBuffer, updateIssueFields, addComment, testConnection
};

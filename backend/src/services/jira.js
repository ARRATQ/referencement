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
  // Les mises à jour (PUT issue) répondent 204 No Content : pas de JSON à parser.
  const body = await res.text();
  return body ? JSON.parse(body) : null;
}

async function searchIssues(jql, fields = [], maxResults = 50) {
  const f = fields.length ? fields.join(',') : 'summary,status,issuetype,assignee,created,issuelinks,attachment';
  return jiraFetch(`/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=${f}`);
}

async function getIssue(key, fields = []) {
  const f = fields.length ? `?fields=${fields.join(',')}` : '?fields=summary,status,issuetype,assignee,created,issuelinks,attachment,description';
  return jiraFetch(`/rest/api/2/issue/${key}${f}`);
}

function extractFieldValue(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.map(extractFieldValue).filter(x => x !== null);
  if (typeof v === 'object') {
    if (v.value !== undefined) return v.value;
    if (v.displayName !== undefined) return v.displayName;
    if (v.name !== undefined) return v.name;
    return null;
  }
  return null;
}

async function getFieldsMeta() {
  try {
    const data = await jiraFetch('/rest/api/2/field');
    const map = {};
    for (const f of data) {
      if (f.id.startsWith('customfield_')) {
        map[f.id] = f.name;
      }
    }
    return map;
  } catch {
    return {};
  }
}

function normalizeKey(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findByName(fields, rawValues, ...namePatterns) {
  for (const pattern of namePatterns) {
    const norm = normalizeKey(pattern);
    for (const [id, name] of Object.entries(fields)) {
      const normName = normalizeKey(name);
      if (normName.includes(norm) || norm.includes(normName)) {
        const v = rawValues[id];
        const extracted = extractFieldValue(v);
        if (extracted !== null && extracted !== undefined && extracted !== '') return extracted;
      }
    }
  }
  return null;
}

async function extractIntervenantData(key) {
  const [issue, fieldsMeta] = await Promise.all([
    jiraFetch(`/rest/api/2/issue/${key}?fields=*all`),
    getFieldsMeta()
  ]);
  const f = issue.fields;
  const custom = {};
  for (const [k, v] of Object.entries(f)) {
    if (k.startsWith('customfield_') && v !== null && v !== undefined) {
      const name = fieldsMeta[k] || k;
      custom[name] = extractFieldValue(v);
    }
  }
  const rawById = {};
  for (const [k, v] of Object.entries(f)) {
    if (k.startsWith('customfield_')) rawById[k] = v;
  }

  return {
    key,
    summary: f.summary,
    status: f.status?.name,
    allCustomFields: custom,
    parsed: {
      nom: findByName(fieldsMeta, rawById, "nom de l'intervenant", 'nom intervenant', 'lastname', 'nom') || null,
      prenom: findByName(fieldsMeta, rawById, "prénom de l'intervenant", 'prenom intervenant', 'firstname', 'prénom') || null,
      cin: findByName(fieldsMeta, rawById, 'cin', 'passeport', 'cin/passeport', 'identifiant') || null,
      gsm: findByName(fieldsMeta, rawById, 'gsm', 'téléphone', 'telephone', 'mobile') || null,
      email: findByName(fieldsMeta, rawById, 'e-mail', 'email', 'mail') || null,
      typeFormation: findByName(fieldsMeta, rawById, 'type de formation', 'typeformation', 'formation') || null,
      niveauFormation: findByName(fieldsMeta, rawById, 'niveau de formation', 'niveau', 'education', 'diplôme') || null,
      permanent: findByName(fieldsMeta, rawById, 'permanent') || null,
      totalActionCount: findByName(fieldsMeta, rawById, 'total action', 'action count') || null,
      etablissement: findByName(fieldsMeta, rawById, 'établissement', 'etablissement', 'école', 'ecole', 'université', 'universite') || null,
      experienceTotale: findByName(fieldsMeta, rawById, 'expérience totale', 'experience totale', "années d'expérience", "nombre d'années d'expérience") || null,
      experienceSolution: findByName(fieldsMeta, rawById, 'expérience sur la solution', 'expérience solution', 'experience solution') || null,
      posteOccupe: findByName(fieldsMeta, rawById, 'poste occupé', 'poste actuel', 'fonction') || null,
      tailleEquipe: findByName(fieldsMeta, rawById, "taille de l'équipe", 'taille équipe', 'taille de l equipe') || null,
      certifications: findByName(fieldsMeta, rawById, 'certification', 'certifications') || null,
      references: findByName(fieldsMeta, rawById, 'référence', 'references clients', 'références clients') || null,
    }
  };
}

async function extractCompetenceData(key) {
  const [issue, fieldsMeta] = await Promise.all([
    jiraFetch(`/rest/api/2/issue/${key}?fields=*all`),
    getFieldsMeta()
  ]);
  const f = issue.fields;
  const custom = {};
  for (const [k, v] of Object.entries(f)) {
    if (k.startsWith('customfield_') && v !== null && v !== undefined) {
      const name = fieldsMeta[k] || k;
      custom[name] = extractFieldValue(v);
    }
  }
  const rawById = {};
  for (const [k, v] of Object.entries(f)) {
    if (k.startsWith('customfield_')) rawById[k] = v;
  }

  return {
    key,
    summary: f.summary,
    status: f.status?.name,
    allCustomFields: custom,
    parsed: {
      raisonSociale: findByName(fieldsMeta, rawById, 'raison sociale') || null,
      nomIntervenant: findByName(fieldsMeta, rawById, 'nom de l\'intervenant', 'nom intervenant') || null,
      prenomIntervenant: findByName(fieldsMeta, rawById, 'prénom de l\'intervenant', 'prenom intervenant') || null,
      niveauFormation: findByName(fieldsMeta, rawById, 'niveau de formation', 'niveau') || null,
      typeFormation: findByName(fieldsMeta, rawById, 'type de formation') || null,
      typeAction: findByName(fieldsMeta, rawById, "type d'action", 'type action') || null,
      action: findByName(fieldsMeta, rawById, 'action à référencer', 'action a referencer', 'action') || null,
      profil: findByName(fieldsMeta, rawById, 'profil') || null,
      secteurs: findByName(fieldsMeta, rawById, "secteur(s) d'activité", 'secteurs', 'secteur') || null,
      domaine: findByName(fieldsMeta, rawById, "domaine d'accompagnement", 'domaine') || null,
      solutionsInformatiques: findByName(fieldsMeta, rawById, 'solution informatique', 'solutions informatiques') || null,
      autreSolution: findByName(fieldsMeta, rawById, 'autre solution informatique', 'autre solution') || null,
      modulesInformatiques: findByName(fieldsMeta, rawById, 'modules informatiques', 'modules') || null,
    }
  };
}

async function getEditMeta(key) {
  return jiraFetch(`/rest/api/2/issue/${key}/editmeta`);
}

// Les 11 champs du ticket intervenant à renseigner depuis le CV.
const INTERVENANT_FIELDS = [
  { key: 'formation',               jiraName: 'Formation',                             type: 'text' },
  { key: 'evaluationFormation',     jiraName: 'Évaluation formation',                  type: 'radio' },
  { key: 'diplome',                 jiraName: 'Diplôme',                               type: 'text' },
  { key: 'evaluationDiplome',       jiraName: 'Évaluation diplôme',                    type: 'radio' },
  { key: 'experiencePro',           jiraName: 'Expérience professionnelle',            type: 'text' },
  { key: 'evaluationExperiencePro', jiraName: 'Évaluation expérience professionnelle', type: 'radio' },
  { key: 'principalPoste',          jiraName: 'Principal poste occupé',                type: 'text' },
  { key: 'secteurPoste',            jiraName: 'Secteur poste',                         type: 'text' },
  { key: 'experienceConseil',       jiraName: 'Expérience conseil',                    type: 'radio' },
  { key: 'secteurConseil',          jiraName: 'Secteur conseil',                       type: 'text' },
  { key: 'evaluationCv',            jiraName: 'Évaluation CV',                         type: 'radio' },
];

// Options par défaut des champs radio intervenant : l'editmeta/createmeta de cette
// instance Jira n'expose pas ces champs (écrans), donc leurs options ne sont pas
// découvrables par l'API.
const DEFAULT_RADIO_OPTIONS = ['Valide', 'Non Valide'];

// Certains contextes Jira exposent ces radios avec des options en plus ou à la
// place de « Valide »/« Non Valide » (ex. « Ok »/« Ko » historiques, ou les trois
// à la fois : Valide / Non Valide / Ok). Convention validée avec la commission :
// l'application ne propose et n'envoie jamais que « Valide »/« Non Valide ».
const NEGATIVE_OPTION_RE = /non|\bko\b|nok|invalide/i;

// Retourne { options, valueMap } : options canoniques pour l'UI/IA, et
// correspondance canonique → option Jira réelle pour l'écriture.
// Si la paire réelle n'est pas identifiable sans ambiguïté, on garde les
// options Jira telles quelles (pas de traduction hasardeuse).
function canonicalizeRadioOptions(jiraOptions) {
  if (!jiraOptions.length) return { options: DEFAULT_RADIO_OPTIONS, valueMap: null };

  // « Valide » et « Non Valide » existent déjà tels quels côté Jira (même si
  // d'autres options obsolètes comme « Ok » sont aussi présentes) : on les
  // restreint à ces deux-là, sans traduction nécessaire.
  if (DEFAULT_RADIO_OPTIONS.every(o => jiraOptions.includes(o))) {
    return { options: DEFAULT_RADIO_OPTIONS, valueMap: null };
  }

  // Paire à deux options sans « Valide »/« Non Valide » exacts : on tente de
  // reconnaître une paire positive/négative (« Ok »/« Ko », « Oui »/« Non »…)
  // et on la traduit au moment du push.
  if (jiraOptions.length === 2) {
    const negatives = jiraOptions.filter(o => NEGATIVE_OPTION_RE.test(o));
    if (negatives.length === 1) {
      const negative = negatives[0];
      const positive = jiraOptions.find(o => o !== negative);
      return { options: DEFAULT_RADIO_OPTIONS, valueMap: { 'Valide': positive, 'Non Valide': negative } };
    }
  }
  return { options: jiraOptions, valueMap: null };
}

// Résout les 11 champs : editmeta du ticket d'abord (options radios incluses),
// puis liste globale /rest/api/2/field en secours pour les champs que les écrans
// Jira n'exposent pas. Un customfield n'est jamais attribué deux fois.
async function resolveIntervenantFields(key) {
  const meta = await getEditMeta(key);
  const metaFields = Object.entries(meta.fields || {})
    .filter(([id]) => id.startsWith('customfield_'))
    .map(([id, f]) => ({ id, name: f.name || '', norm: normalizeKey(f.name), allowedValues: f.allowedValues || [] }));

  const resolved = {};
  const usedIds = new Set();

  const assign = (fieldDef, mf) => {
    const jiraOptions = (mf.allowedValues || []).map(v => v.value ?? v.name).filter(Boolean);
    const { options, valueMap } = fieldDef.type === 'radio'
      ? canonicalizeRadioOptions(jiraOptions)
      : { options: jiraOptions, valueMap: null };
    resolved[fieldDef.key] = {
      fieldId: mf.id,
      jiraName: mf.name,
      type: fieldDef.type,
      options,
      valueMap
    };
    usedIds.add(mf.id);
  };

  // Égalité exacte du nom normalisé uniquement : les 11 champs existent sous leur
  // nom exact dans l'instance, et le matching par inclusion produit des faux
  // positifs (« formation » ⊂ « MF : Informations Intervenant »).
  for (const fd of INTERVENANT_FIELDS) {
    const norm = normalizeKey(fd.jiraName);
    const mf = metaFields.find(m => !usedIds.has(m.id) && m.norm === norm);
    if (mf) assign(fd, mf);
  }

  // Secours : champs absents de l'editmeta → liste globale des champs
  // (égalité exacte seulement : l'inclusion sur tous les champs de l'instance
  // produirait des faux positifs).
  if (INTERVENANT_FIELDS.some(fd => !resolved[fd.key])) {
    const all = await jiraFetch('/rest/api/2/field');
    const globalFields = (Array.isArray(all) ? all : [])
      .filter(f => f.id?.startsWith('customfield_'))
      .map(f => ({ id: f.id, name: f.name || '', norm: normalizeKey(f.name), allowedValues: [] }));
    for (const fd of INTERVENANT_FIELDS) {
      if (resolved[fd.key]) continue;
      const norm = normalizeKey(fd.jiraName);
      const mf = globalFields.find(m => !usedIds.has(m.id) && m.norm === norm);
      if (mf) assign(fd, mf);
    }
  }

  const unresolved = INTERVENANT_FIELDS.filter(fd => !resolved[fd.key]).map(fd => fd.key);
  return { resolved, unresolved };
}

async function resolveHierarchy(prestataireKey) {
  const prestataire = await getIssue(prestataireKey, ['summary', 'status', 'attachment', 'issuelinks', 'description', 'reporter']);
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
    reporter: prestataire.fields.reporter?.displayName || '',
    attachments: (prestataire.fields.attachment || []).map(a => ({
      id: a.id, filename: a.filename, mimeType: a.mimeType,
      size: a.size, contentUrl: a.content
    })),
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
  fetchAttachmentBuffer, updateIssueFields, addComment, testConnection,
  extractIntervenantData, extractCompetenceData,
  getEditMeta, resolveIntervenantFields, INTERVENANT_FIELDS
};

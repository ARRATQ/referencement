const fetch = require('node-fetch');
const pdfParse = require('pdf-parse');

async function getAIConfig() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.appConfig.findMany({
      where: { key: { in: ['ai_key', 'ai_model', 'ai_temp', 'ai_lang'] } }
    });
    const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]));
    return {
      key: cfg.ai_key || '',
      model: cfg.ai_model || 'anthropic/claude-sonnet-4-6',
      temp: parseFloat(cfg.ai_temp || '0.3'),
      lang: cfg.ai_lang || 'fr'
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function getDocs() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.appConfig.findMany({
      where: { key: { in: ['doc_ami', 'doc_cv_canvas'] } }
    });
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  } finally {
    await prisma.$disconnect();
  }
}

async function getPrompts() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.appConfig.findMany({
      where: { key: { startsWith: 'prompt_' } }
    });
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  } finally {
    await prisma.$disconnect();
  }
}

async function callAI(messages, opts = {}) {
  const cfg = await getAIConfig();
  if (!cfg.key) throw new Error('Clé API OpenRouter non configurée');

  const proxyUrl = process.env.PROXY_URL || 'http://proxy:3001';
  const res = await fetch(`${proxyUrl}/ai-proxy/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.APP_ORIGIN || 'http://localhost:8090',
      'X-Title': 'Commission de Référencement'
    },
    body: JSON.stringify({
      model: opts.model || cfg.model,
      messages,
      max_tokens: opts.maxTokens || 2000,
      temperature: opts.temp ?? cfg.temp,
      stream: false
    })
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[AI ERROR] status:', res.status, 'body:', text.slice(0, 1000));
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`);
  }
  console.log('[AI OK] model:', opts.model || cfg.model, 'content parts:', messages[0]?.content?.length || 1);

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

function langInstruction(lang) {
  return lang === 'ar' ? 'Réponds en arabe (العربية).' : 'Réponds en français.';
}

// Substitue les variables {{var}} dans un prompt template
function fillTemplate(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] !== undefined ? vars[k] : `{{${k}}}`);
}

const DEFAULT_PROMPTS = {
  prompt_briefing: `Tu es expert en référencement de solutions informatiques.
{{lang}}
{{ami}}
Génère un briefing pré-commission pour :
- Prestataire : {{prestataire}}
- Solution : {{solution}}
- Catégorie : {{category}}
- Modules : {{modules}}

Format : 5 à 7 points concis (questions prioritaires à poser, points techniques à vérifier, contexte marché).`,

  prompt_pv: `Tu es secrétaire officiel de la commission de référencement.
{{lang}}
Rédige le procès-verbal officiel de commission avec :
Programme : {{programName}}
Prestataire : {{prestataire}}
Solution/Action : {{solution}}
Catégorie : {{category}}
Modules : {{modules}}
Score solution : {{solScorePct}}% ({{solVerdict}})
Score intégrateur : {{intScorePct}}% ({{intVerdict}})
Score global : {{finalScorePct}}%
Décision : {{finalDecision}}
{{decisionMotive}}
{{conditions}}
{{commissionComments}}

Structure : en-tête officiel → objet → participants → résultats notation → motivation décision → conditions éventuelles → signature. Ton formel et administratif.`,

  prompt_cv: `Tu es expert RH et évaluateur de commission de référencement.
{{lang}}
{{ami}}
{{canvas}}
Analyse ce CV pour le dossier : Prestataire "{{prestataire}}", Solution "{{solution}}", Programme "{{programName}}".
Fournis :
1. Niveau de formation (diplôme, établissement, année)
2. Expérience totale estimée (années)
3. Expérience sur cette solution (années)
4. Références clients vérifiables
5. Certifications pertinentes
6. Concordances avec les critères AMI
7. Incohérences ou points d'attention
8. Conformité avec le canevas CV officiel (structure, rubriques, signatures)
Sois précis et factuel.`,

  prompt_attestations: `Tu es expert en vérification documentaire pour commission de référencement.
{{lang}}
Analyse ces attestations de référence pour : Consultant "{{intervenant}}", Solution "{{solution}}".
Vérifie pour chaque attestation :
1. Solution/modules mentionnés — concordance avec le dossier ?
2. Présence et rôle du consultant nommé
3. Dates de mission — cohérence avec le CV ?
4. Authenticité apparente (entête, signature, cachet)
5. Entreprise cliente identifiable (secteur, taille)
Conclus sur la solidité des références présentées.`,

  prompt_coherence: `Tu es expert en évaluation de solutions informatiques.
{{lang}}
Analyse la cohérence de cette notation (catégorie: {{category}}) :
{{noteDetails}}
Pour chaque critère qui a un "Attendu", vérifie si la note et l'observation correspondent à ce niveau d'exigence.
Identifie : incohérences entre note et observation · critères où l'observation ne justifie pas la note · écarts avec les attendus de consistance · éléments à reconsidérer. Sois concis (5-8 points max).`,

  prompt_certif_editeur: `Tu es expert en vérification documentaire pour commission de référencement.
{{lang}}
{{ami}}
Analyse ce certificat de référence éditeur pour : Prestataire "{{prestataire}}", Solution "{{solution}}", Programme "{{programName}}".
Vérifie :
1. Identité de l'éditeur — nom officiel, logo, entête reconnaissable
2. Prestataire désigné — nom correspondant au dossier ?
3. Solution/produit certifié — concordance avec le dossier ?
4. Niveau de certification (partenaire, revendeur, intégrateur agréé…)
5. Validité de la certification (dates, expiration)
6. Authenticité apparente (signature, cachet, format officiel)
7. Périmètre géographique (Maroc mentionné ?)
Conclus sur la conformité du certificat pour le référencement.`,

  prompt_suggest_scores: `Tu es évaluateur expert pour la commission de référencement.
{{lang}}
Domaine évalué : {{category}}
Contexte du dossier :
{{dossierContext}}

Grille de notation (note 0, 1 ou 2 par critère) :
{{criteriaList}}

Pour chaque critère, propose :
- une note (0, 1 ou 2)
- une observation courte justifiant la note en lien avec le contexte fourni et les attendus

Réponds UNIQUEMENT en JSON valide avec cette structure exacte (rien d'autre) :
{
  "scores": { "0": 0, "1": 1, "2": 2, ... },
  "observations": { "0": "...", "1": "...", "2": "...", ... }
}`
};

async function generateBriefing({ prestataire, solution, category, modules, amiText, amiContext }) {
  const docs = await getDocs();
  const prompts = await getPrompts();
  const cfg = await getAIConfig();
  const ami = amiText || docs.doc_ami || '';
  const tpl = prompts.prompt_briefing || DEFAULT_PROMPTS.prompt_briefing;

  // Contexte dossier supplémentaire pour enrichir le briefing
  let dossierContext = '';
  if (amiContext) {
    const parts = [];
    if (amiContext.nature) parts.push(`Nature prestataire : ${amiContext.nature}`);
    if (amiContext.origine) parts.push(`Origine : ${amiContext.origine}`);
    if (amiContext.modeAcquisition) parts.push(`Mode acquisition : ${amiContext.modeAcquisition}`);
    if (amiContext.secteur) parts.push(`Secteur cible : ${amiContext.secteur}`);
    if (amiContext.intervenantInfo) parts.push(`Intervenant : ${amiContext.intervenantInfo}`);
    if (parts.length) dossierContext = `\n--- Contexte dossier ---\n${parts.join('\n')}\n---\n`;
  }

  const prompt = fillTemplate(tpl, {
    lang: langInstruction(cfg.lang),
    ami: ami ? `\n--- AMI / Cadre officiel ---\n${ami.slice(0, 3000)}\n---\n${dossierContext}` : dossierContext,
    prestataire,
    solution: solution || '—',
    category: category || '—',
    modules: modules?.join(', ') || '—'
  });
  return callAI([{ role: 'user', content: prompt }]);
}

async function generatePV({ prestataire, solution, category, solScorePct, intScorePct, finalScorePct, finalDecision, solVerdict, intVerdict, decisionMotive, conditions, commissionComments, modules, programName, cvAnalysis, attestationsAnalysis, certifEditeurAnalysis }) {
  const prompts = await getPrompts();
  const cfg = await getAIConfig();
  const tpl = prompts.prompt_pv || DEFAULT_PROMPTS.prompt_pv;

  // Synthèse des analyses documentaires disponibles
  const analysesParts = [];
  if (cvAnalysis) analysesParts.push(`Analyse CV intervenant :\n${cvAnalysis.slice(0, 600)}`);
  if (attestationsAnalysis) analysesParts.push(`Attestations de référence :\n${attestationsAnalysis.slice(0, 600)}`);
  if (certifEditeurAnalysis) analysesParts.push(`Certificat éditeur :\n${certifEditeurAnalysis.slice(0, 600)}`);
  const analysesBlock = analysesParts.length ? `\n--- Synthèse documentaire ---\n${analysesParts.join('\n\n')}\n---` : '';

  const prompt = fillTemplate(tpl, {
    lang: langInstruction(cfg.lang),
    programName: programName || '—',
    prestataire,
    solution: solution || '—',
    category: category || '—',
    modules: modules?.join(', ') || '—',
    solScorePct: solScorePct ?? '—',
    solVerdict: solVerdict || '—',
    intScorePct: intScorePct ?? '—',
    intVerdict: intVerdict || '—',
    finalScorePct: finalScorePct ?? '—',
    finalDecision: finalDecision || '—',
    decisionMotive: decisionMotive ? `Motivation : ${decisionMotive}` : '',
    conditions: conditions ? `Conditions : ${conditions}` : '',
    commissionComments: commissionComments ? `Observations : ${commissionComments}` : ''
  }) + analysesBlock;
  return callAI([{ role: 'user', content: prompt }], { maxTokens: 3000 });
}

async function checkCoherence({ category, criteria, solScores, solObs, context }) {
  const prompts = await getPrompts();
  const cfg = await getAIConfig();
  const noteDetails = criteria.map((c, i) => {
    const consistanceLine = c.consistance ? `\n     Attendu: "${c.consistance}"` : '';
    return `- ${c.n} [poids ${c.w}] : note ${solScores[i] ?? 'N/A'}/2${solObs[i] ? ` — obs: "${solObs[i]}"` : ''}${consistanceLine}`;
  }).join('\n');

  // Ajout du contexte documentaire si disponible
  let contextBlock = '';
  if (context) {
    const parts = [];
    if (context.cvAnalysis) parts.push(`Analyse CV :\n${context.cvAnalysis.slice(0, 1000)}`);
    if (context.attestationsAnalysis) parts.push(`Attestations intervenant :\n${context.attestationsAnalysis.slice(0, 800)}`);
    if (context.certifEditeurAnalysis) parts.push(`Certificat éditeur :\n${context.certifEditeurAnalysis.slice(0, 800)}`);
    if (parts.length) contextBlock = `\n\n--- Contexte documentaire disponible ---\n${parts.join('\n\n')}\n---`;
  }

  const tpl = prompts.prompt_coherence || DEFAULT_PROMPTS.prompt_coherence;
  const prompt = fillTemplate(tpl, {
    lang: langInstruction(cfg.lang),
    category: category || '—',
    noteDetails
  }) + contextBlock;
  return callAI([{ role: 'user', content: prompt }]);
}

async function suggestScores({ category, criteria, dossierContext }) {
  const prompts = await getPrompts();
  const cfg = await getAIConfig();
  const criteriaList = criteria.map((c, i) => {
    const consistanceLine = c.consistance ? `\n   Attendu pour bien noter: ${c.consistance}` : '';
    return `${i}. ${c.n} [poids ${c.w}]${c.d ? ` — ${c.d}` : ''}${consistanceLine}`;
  }).join('\n');
  const tpl = prompts.prompt_suggest_scores || DEFAULT_PROMPTS.prompt_suggest_scores;
  const prompt = fillTemplate(tpl, {
    lang: langInstruction(cfg.lang),
    category: category || '—',
    dossierContext: dossierContext || '',
    criteriaList
  });
  const raw = await callAI([{ role: 'user', content: prompt }], { temp: 0.2, maxTokens: 1500 });
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

async function analyzeCV({ filesData, prestataire, solution, programName, amiText, intervenantContext }) {
  const docs = await getDocs();
  const prompts = await getPrompts();
  const cfg = await getAIConfig();
  // Priorité : amiText du programme passé explicitement, sinon doc global
  const ami = amiText || docs.doc_ami || '';
  const canvas = docs.doc_cv_canvas || '';

  // Contexte intervenant issu des données Jira
  let intervenantBlock = '';
  if (intervenantContext) {
    const parts = [];
    if (intervenantContext.nom || intervenantContext.prenom) parts.push(`Nom : ${intervenantContext.prenom || ''} ${intervenantContext.nom || ''}`.trim());
    if (intervenantContext.typeFormation) parts.push(`Type de formation Jira : ${intervenantContext.typeFormation}`);
    if (intervenantContext.niveauFormation) parts.push(`Niveau de formation Jira : ${intervenantContext.niveauFormation}`);
    if (parts.length) intervenantBlock = `\n--- Données intervenant (Jira) ---\n${parts.join('\n')}\n---\n`;
  }

  const tpl = prompts.prompt_cv || DEFAULT_PROMPTS.prompt_cv;
  const textPrompt = fillTemplate(tpl, {
    lang: langInstruction(cfg.lang),
    ami: ami ? `--- Critères AMI officiel ---\n${ami.slice(0, 2000)}\n---\n${intervenantBlock}` : intervenantBlock,
    canvas: canvas ? `--- Canevas CV officiel ---\n${canvas.slice(0, 1500)}\n---\n` : '',
    prestataire,
    solution: solution || '—',
    programName: programName || '—'
  });

  // filesData = [{ base64, mimeType, filename }]
  const imagesParts = [];
  const pdfTexts = [];

  for (const f of filesData) {
    if (f.mimeType === 'application/pdf') {
      try {
        const buf = Buffer.from(f.base64, 'base64');
        const parsed = await pdfParse(buf);
        if (parsed.text?.trim()) pdfTexts.push(`--- ${f.filename} ---\n${parsed.text.slice(0, 8000)}`);
      } catch {
        // PDF illisible, on l'ignore silencieusement
      }
    } else {
      imagesParts.push({ type: 'image_url', image_url: { url: `data:${f.mimeType};base64,${f.base64}` } });
    }
  }

  // Fusionner PDF + prompt en un seul bloc text pour éviter "too many function arguments"
  const fullText = pdfTexts.length > 0
    ? `Contenu des documents PDF :\n\n${pdfTexts.join('\n\n')}\n\n---\n\n${textPrompt}`
    : textPrompt;

  const content = [...imagesParts, { type: 'text', text: fullText }];
  return callAI([{ role: 'user', content }], { maxTokens: 2500 });
}

async function analyzeAttestations({ filesData, solution, intervenant }) {
  const prompts = await getPrompts();
  const cfg = await getAIConfig();
  const tpl = prompts.prompt_attestations || DEFAULT_PROMPTS.prompt_attestations;
  const textPrompt = fillTemplate(tpl, {
    lang: langInstruction(cfg.lang),
    intervenant: intervenant || '—',
    solution: solution || '—'
  });

  const imagesParts = [];
  const pdfTexts = [];
  for (const f of filesData) {
    if (f.mimeType === 'application/pdf') {
      try {
        const buf = Buffer.from(f.base64, 'base64');
        const parsed = await pdfParse(buf);
        if (parsed.text?.trim()) pdfTexts.push(`--- ${f.filename} ---\n${parsed.text.slice(0, 5000)}`);
      } catch {}
    } else {
      imagesParts.push({ type: 'image_url', image_url: { url: `data:${f.mimeType};base64,${f.base64}` } });
    }
  }
  const fullText = pdfTexts.length > 0
    ? `Contenu des attestations PDF :\n\n${pdfTexts.join('\n\n')}\n\n---\n\n${textPrompt}`
    : textPrompt;
  const content = [...imagesParts, { type: 'text', text: fullText }];
  return callAI([{ role: 'user', content }], { maxTokens: 2000 });
}

async function analyzeCertifEditeur({ filesData, solution, prestataire, programName }) {
  const docs = await getDocs();
  const prompts = await getPrompts();
  const cfg = await getAIConfig();
  const ami = docs.doc_ami || '';

  const tpl = prompts.prompt_certif_editeur || DEFAULT_PROMPTS.prompt_certif_editeur;
  const textPrompt = fillTemplate(tpl, {
    lang: langInstruction(cfg.lang),
    ami: ami ? `--- Critères AMI officiel ---\n${ami.slice(0, 2000)}\n---\n` : '',
    solution: solution || '—',
    prestataire: prestataire || '—',
    programName: programName || '—'
  });

  const imagesParts = [];
  const pdfTexts = [];
  for (const f of filesData) {
    if (f.mimeType === 'application/pdf') {
      try {
        const buf = Buffer.from(f.base64, 'base64');
        const parsed = await pdfParse(buf);
        if (parsed.text?.trim()) pdfTexts.push(`--- ${f.filename} ---\n${parsed.text.slice(0, 5000)}`);
      } catch {}
    } else {
      imagesParts.push({ type: 'image_url', image_url: { url: `data:${f.mimeType};base64,${f.base64}` } });
    }
  }
  const fullText = pdfTexts.length > 0
    ? `Contenu du certificat PDF :\n\n${pdfTexts.join('\n\n')}\n\n---\n\n${textPrompt}`
    : textPrompt;
  const content = [...imagesParts, { type: 'text', text: fullText }];
  return callAI([{ role: 'user', content }], { maxTokens: 2000 });
}

async function autoFillFromCV({ cvAnalysis, criteria, intCriteria }) {
  const prompt = `À partir de cette analyse de CV :
${cvAnalysis}

Génère un JSON avec exactement cette structure (rien d'autre) :
{
  "diplome": "...",
  "etablissement": "...",
  "exp": <nombre années total>,
  "expSol": <nombre années sur la solution>,
  "poste": "...",
  "certif": "...",
  "intScores": { "0": 0|1|2, "1": 0|1|2, "2": 0|1|2, "5": 0|1|2 }
}
Règles intScores :
- 0 (formation): bac+2=1, bac+3/4=1, bac+5+=2, autre=0
- 1 (exp générale): <5ans=0, 5-10ans=1, >10ans=2
- 2 (exp solution): <2ans=0, 2-5ans=1, >5ans=2
- 5 (équipe): individuel=0, 2-4=1, 5+=2`;

  const raw = await callAI([{ role: 'user', content: prompt }], { temp: 0.1, maxTokens: 600 });
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

module.exports = { generateBriefing, generatePV, checkCoherence, suggestScores, analyzeCV, analyzeAttestations, analyzeCertifEditeur, autoFillFromCV, DEFAULT_PROMPTS };

const fetch = require('node-fetch');

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

async function callAI(messages, opts = {}) {
  const cfg = await getAIConfig();
  if (!cfg.key) throw new Error('Clé API OpenRouter non configurée');

  const proxyUrl = process.env.PROXY_URL || 'http://proxy:3001';
  const res = await fetch(`${proxyUrl}/ai-proxy/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://marocpme.gov.ma',
      'X-Title': 'Commission Référencement Maroc PME'
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
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

function langInstruction(lang) {
  return lang === 'ar' ? 'Réponds en arabe (العربية).' : 'Réponds en français.';
}

async function generateBriefing({ prestataire, solution, category, modules, amiText }) {
  const docs = await getDocs();
  const ami = amiText || docs.doc_ami || '';
  const cfg = await getAIConfig();
  const prompt = `Tu es expert en référencement de solutions informatiques pour PME marocaines.
${langInstruction(cfg.lang)}
${ami ? `\n--- AMI / Cadre officiel ---\n${ami.slice(0, 3000)}\n---\n` : ''}
Génère un briefing pré-commission pour :
- Prestataire : ${prestataire}
- Solution : ${solution || '—'}
- Catégorie : ${category || '—'}
- Modules : ${modules?.join(', ') || '—'}

Format : 5 à 7 points concis (questions prioritaires à poser, points techniques à vérifier, contexte marché Maroc).`;

  return callAI([{ role: 'user', content: prompt }]);
}

async function generatePV({ prestataire, solution, category, solScorePct, intScorePct, finalScorePct, finalDecision, solVerdict, intVerdict, decisionMotive, conditions, commissionComments, modules, programName }) {
  const cfg = await getAIConfig();
  const prompt = `Tu es secrétaire officiel de la commission de référencement Maroc PME.
${langInstruction(cfg.lang)}
Rédige le procès-verbal officiel de commission avec :
Programme : ${programName || 'Maroc PME'}
Prestataire : ${prestataire}
Solution/Action : ${solution || '—'}
Catégorie : ${category || '—'}
Modules : ${modules?.join(', ') || '—'}
Score solution : ${solScorePct ?? '—'}% (${solVerdict || '—'})
Score intégrateur : ${intScorePct ?? '—'}% (${intVerdict || '—'})
Score global : ${finalScorePct ?? '—'}%
Décision : ${finalDecision || '—'}
${decisionMotive ? `Motivation : ${decisionMotive}` : ''}
${conditions ? `Conditions : ${conditions}` : ''}
${commissionComments ? `Observations : ${commissionComments}` : ''}

Structure : en-tête officiel → objet → participants → résultats notation → motivation décision → conditions éventuelles → signature. Ton formel et administratif.`;

  return callAI([{ role: 'user', content: prompt }], { maxTokens: 3000 });
}

async function checkCoherence({ category, criteria, solScores, solObs }) {
  const cfg = await getAIConfig();
  const noteDetails = criteria.map((c, i) => {
    const consistanceLine = c.consistance ? `\n     Attendu: "${c.consistance}"` : '';
    return `- ${c.n} [poids ${c.w}] : note ${solScores[i] ?? 'N/A'}/2${solObs[i] ? ` — obs: "${solObs[i]}"` : ''}${consistanceLine}`;
  }).join('\n');
  const prompt = `Tu es expert en évaluation de solutions informatiques.
${langInstruction(cfg.lang)}
Analyse la cohérence de cette notation (catégorie: ${category}) :
${noteDetails}
Pour chaque critère qui a un "Attendu", vérifie si la note et l'observation correspondent à ce niveau d'exigence.
Identifie : incohérences entre note et observation · critères où l'observation ne justifie pas la note · écarts avec les attendus de consistance · éléments à reconsidérer. Sois concis (5-8 points max).`;

  return callAI([{ role: 'user', content: prompt }]);
}

async function suggestScores({ category, criteria, dossierContext }) {
  const cfg = await getAIConfig();
  const criteriaList = criteria.map((c, i) => {
    const consistanceLine = c.consistance ? `\n   Attendu pour bien noter: ${c.consistance}` : '';
    return `${i}. ${c.n} [poids ${c.w}]${c.d ? ` — ${c.d}` : ''}${consistanceLine}`;
  }).join('\n');
  const prompt = `Tu es évaluateur expert pour la commission de référencement Maroc PME.
${langInstruction(cfg.lang)}
Domaine évalué : ${category}
Contexte du dossier :
${dossierContext}

Grille de notation (note 0, 1 ou 2 par critère) :
${criteriaList}

Pour chaque critère, propose :
- une note (0, 1 ou 2)
- une observation courte justifiant la note en lien avec le contexte fourni et les attendus

Réponds UNIQUEMENT en JSON valide avec cette structure exacte (rien d'autre) :
{
  "scores": { "0": 0, "1": 1, "2": 2, ... },
  "observations": { "0": "...", "1": "...", "2": "...", ... }
}`;

  const raw = await callAI([{ role: 'user', content: prompt }], { temp: 0.2, maxTokens: 1500 });
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

async function analyzeCV({ imageBase64List, mimeType, prestataire, solution, programName }) {
  const docs = await getDocs();
  const cfg = await getAIConfig();
  const ami = docs.doc_ami || '';
  const canvas = docs.doc_cv_canvas || '';

  const content = [
    ...imageBase64List.map(b64 => ({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${b64}` } })),
    {
      type: 'text',
      text: `${langInstruction(cfg.lang)}
Tu es expert RH et évaluateur de commission de référencement Maroc PME.
${ami ? `--- Critères AMI officiel ---\n${ami.slice(0, 2000)}\n---\n` : ''}
${canvas ? `--- Canevas CV officiel ---\n${canvas.slice(0, 1500)}\n---\n` : ''}
Analyse ce CV pour le dossier : Prestataire "${prestataire}", Solution "${solution || '—'}", Programme "${programName || '—'}".
Fournis :
1. Niveau de formation (diplôme, établissement, année)
2. Expérience totale estimée (années)
3. Expérience sur cette solution (années)
4. Références clients vérifiables au Maroc
5. Certifications pertinentes
6. Concordances avec les critères AMI
7. Incohérences ou points d'attention
8. Conformité avec le canevas CV officiel (structure, rubriques, signatures)
Sois précis et factuel.`
    }
  ];

  return callAI([{ role: 'user', content }], { maxTokens: 2500 });
}

async function analyzeAttestations({ imageBase64List, solution, intervenant }) {
  const cfg = await getAIConfig();
  const content = [
    ...imageBase64List.map(b64 => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } })),
    {
      type: 'text',
      text: `${langInstruction(cfg.lang)}
Tu es expert en vérification documentaire pour commission de référencement.
Analyse ces attestations de référence pour : Consultant "${intervenant || '—'}", Solution "${solution || '—'}".
Vérifie pour chaque attestation :
1. Solution/modules mentionnés — concordance avec le dossier ?
2. Présence et rôle du consultant nommé
3. Dates de mission — cohérence avec le CV ?
4. Authenticité apparente (entête, signature, cachet)
5. Entreprise cliente identifiable (secteur, taille)
Conclus sur la solidité des références présentées.`
    }
  ];

  return callAI([{ role: 'user', content }], { maxTokens: 2000 });
}

async function autoFillFromCV({ cvAnalysis, criteria, intCriteria }) {
  const cfg = await getAIConfig();
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

module.exports = { generateBriefing, generatePV, checkCoherence, suggestScores, analyzeCV, analyzeAttestations, autoFillFromCV };

const fetch = require('node-fetch');
const pdfParse = require('pdf-parse');
const XLSX = require('xlsx');

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

// Structure synthèse/détail imposée aux analyses IA — le frontend (AiText.vue)
// parse ces balises pour afficher la synthèse seule avec détail dépliable.
const SYNTH_INSTRUCTION = `

IMPORTANT — Structure ta réponse EXACTEMENT comme suit (les deux balises sont obligatoires, telles quelles) :
===SYNTHESE===
3 à 5 puces maximum : l'essentiel actionnable pour l'évaluateur (verdict global, points forts, points de vigilance). Pas de tableau dans cette section.
===DETAIL===
L'analyse complète et détaillée.`;

const DEMO_TABLE_INSTRUCTION = `

Le scénario dans la section DETAIL doit être un tableau markdown ENTIÈREMENT REMPLI avec exactement ces colonnes :
| N° | Fonctionnalité clé (Domaine) | Action concrète à demander au prestataire | Résultat attendu | Signe d'alerte |
Génère entre 8 et 12 lignes. Chaque cellule doit contenir un contenu concret et spécifique à la solution évaluée — ne rends JAMAIS un tableau vide, des cellules "à compléter" ou de simples en-têtes sans lignes.`;

// Retire les balises de structure avant réinjection d'une analyse comme contexte d'un autre prompt
function stripMarkers(text) {
  return (text || '').replace(/===\s*(SYNTHESE|DETAIL)\s*===/gi, '').trim();
}

function isPdf(f) {
  if (f.mimeType === 'application/pdf') return true;
  const ext = (f.filename || '').split('.').pop()?.toLowerCase();
  return ext === 'pdf';
}

function isImage(f) {
  if (f.mimeType?.startsWith('image/')) return true;
  const ext = (f.filename || '').split('.').pop()?.toLowerCase();
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext);
}

function isDocx(f) {
  if (f.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return true;
  const ext = (f.filename || '').split('.').pop()?.toLowerCase();
  return ext === 'docx';
}

// Texte extrait d'un PDF scanné avec couche OCR corrompue : majorité de
// caractères illisibles → inutilisable comme contexte IA.
function looksGarbled(text) {
  const t = (text || '').replace(/\s+/g, '');
  if (!t.length) return true;
  const readable = t.match(/[a-zA-Z0-9À-ÿ.,;:()\/'’%€-]/g) || [];
  return readable.length / t.length < 0.7;
}

// Convertit les pages d'un PDF en images JPEG via poppler (pdftoppm).
// Utilisé pour les PDF scannés : les modèles vision lisent les scans en image,
// alors que l'envoi du PDF inline est souvent rejeté ("The document has no pages").
async function pdfToImages(base64, maxPages = 8) {
  const { execFile } = require('child_process');
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdfimg-'));
  try {
    const pdfPath = path.join(dir, 'doc.pdf');
    fs.writeFileSync(pdfPath, Buffer.from(base64, 'base64'));
    await new Promise((resolve, reject) =>
      execFile('pdftoppm', ['-jpeg', '-r', '150', '-l', String(maxPages), pdfPath, path.join(dir, 'p')],
        err => err ? reject(err) : resolve()));
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.jpg'))
      .sort()
      .map(f => fs.readFileSync(path.join(dir, f)).toString('base64'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Construit la liste de parts multimodales à partir d'un tableau de fichiers.
// PDFs avec texte propre → pdfTexts (extrait) ; PDFs scannés ou au texte corrompu →
// pages converties en images (pdftoppm), avec repli inline application/pdf ; images → part image_url.
async function buildFileParts(filesData, maxPdfChars = 8000) {
  const imagesParts = [];
  const pdfTexts = [];
  const pushScannedPdf = async (f, reason) => {
    try {
      const pages = await pdfToImages(f.base64);
      if (!pages.length) throw new Error('aucune page convertie');
      console.warn(`[buildFileParts] PDF ${reason}, converti en ${pages.length} image(s):`, f.filename);
      for (const img of pages) {
        imagesParts.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img}` } });
      }
    } catch (e) {
      console.warn(`[buildFileParts] PDF ${reason}, conversion image échouée (${e.message}), envoyé en application/pdf:`, f.filename);
      imagesParts.push({ type: 'image_url', image_url: { url: `data:application/pdf;base64,${f.base64}` } });
    }
  };
  for (const f of filesData) {
    if (isPdf(f)) {
      try {
        const buf = Buffer.from(f.base64, 'base64');
        const parsed = await pdfParse(buf);
        if (parsed.text?.trim() && !looksGarbled(parsed.text)) {
          pdfTexts.push(`--- ${f.filename} ---\n${parsed.text.slice(0, maxPdfChars)}`);
        } else {
          await pushScannedPdf(f, parsed.text?.trim() ? 'au texte corrompu (OCR)' : 'scanné');
        }
      } catch (e) {
        await pushScannedPdf(f, 'illisible');
      }
    } else if (isImage(f)) {
      const mime = f.mimeType?.startsWith('image/') ? f.mimeType : 'image/jpeg';
      imagesParts.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${f.base64}` } });
    } else if (isDocx(f)) {
      // Document Word : extraire le texte (mammoth) — l'envoi binaire est rejeté par les modèles.
      try {
        const mammoth = require('mammoth');
        const { value } = await mammoth.extractRawText({ buffer: Buffer.from(f.base64, 'base64') });
        if (value?.trim()) {
          pdfTexts.push(`--- ${f.filename} ---\n${value.slice(0, maxPdfChars)}`);
        } else {
          console.warn('[buildFileParts] DOCX sans texte extractible, ignoré:', f.filename);
        }
      } catch (e) {
        console.warn('[buildFileParts] DOCX illisible, ignoré:', f.filename, e.message);
      }
    } else {
      // Type inconnu : tenter parse PDF, sinon envoyer en application/pdf
      try {
        const buf = Buffer.from(f.base64, 'base64');
        const parsed = await pdfParse(buf);
        if (parsed.text?.trim()) pdfTexts.push(`--- ${f.filename} ---\n${parsed.text.slice(0, maxPdfChars)}`);
        else imagesParts.push({ type: 'image_url', image_url: { url: `data:application/pdf;base64,${f.base64}` } });
      } catch {
        imagesParts.push({ type: 'image_url', image_url: { url: `data:application/pdf;base64,${f.base64}` } });
      }
    }
  }
  return { imagesParts, pdfTexts };
}

const DEFAULT_PROMPTS = {
  prompt_briefing: `Tu es expert technique en référencement de solutions informatiques.
{{lang}}
{{ami}}
Génère un briefing pré-commission centré sur les aspects TECHNIQUES et FONCTIONNELS pour :
- Prestataire : {{prestataire}}
- Solution : {{solution}}
- Catégorie : {{category}}
- Modules : {{modules}}

Concentre-toi exclusivement sur :
• Les fonctionnalités clés de la solution et leur niveau de maturité
• Les points techniques à vérifier lors de la démo (intégrations, architecture, performances)
• La couverture fonctionnelle des modules déclarés vs exigences du programme
• Les capacités d'interfaçage et d'interopérabilité (API, connecteurs, formats)
• Les prérequis techniques et contraintes d'infrastructure

Évite tout élément d'ordre stratégique, commercial ou de positionnement marché.
Format : 5 à 7 points concis et actionnables pour la commission technique.`,

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
Le contenu complet du CV est fourni ci-dessus (documents PDF/images joints). Base-toi EXCLUSIVEMENT sur ce contenu pour ton analyse — ne suppose rien qui n'y figure pas.
Analyse ce CV pour le dossier : Prestataire "{{prestataire}}", Solution "{{solution}}", Programme "{{programName}}".
Fournis :
1. Niveau de formation (diplôme exact, établissement, année) — citer le document
2. Expérience totale calculée (années, depuis quelle date)
3. Expérience sur cette solution spécifique (années, missions concernées)
4. Références clients vérifiables au Maroc (nom entreprise, durée, mission)
5. Certifications pertinentes
6. Concordances avec les critères AMI / programme
7. Incohérences ou points d'attention (dates qui se chevauchent, lacunes, etc.)
8. Conformité avec le canevas CV officiel (structure, rubriques, signature, cachet dirigeant)
Sois précis et factuel. Cite les données exactes du document.`,

  prompt_cv_action: `Tu es expert RH et évaluateur de commission de référencement.
{{lang}}
{{ami}}
{{canvas}}
Le contenu complet du CV est fourni ci-dessus (documents PDF/images joints). Base-toi EXCLUSIVEMENT sur ce contenu pour ton analyse — ne suppose rien qui n'y figure pas.

Action objet de l'évaluation : "{{actionLabel}}"
{{actionDescription}}
{{actionConsistance}}
Programme : "{{programName}}" — Prestataire : "{{prestataire}}"

Évalue ce CV par rapport à cette action spécifique. Fournis :
1. Niveau de formation (diplôme exact, établissement, année) — citer le document
2. Expérience totale calculée (années, depuis quelle date)
3. Adéquation directe avec l'action "{{actionLabel}}" : missions, réalisations, compétences démontrées dans le CV qui correspondent à la description et à la consistance attendue
4. Références clients vérifiables au Maroc pour ce type d'action (nom entreprise, durée, mission)
5. Certifications ou accréditations pertinentes pour cette action
6. Verdict d'adéquation : le profil répond-il aux exigences de la consistance attendue ? Points forts / points de vigilance
7. Incohérences ou lacunes à signaler (dates, contradictions, etc.)
8. Conformité avec le canevas CV officiel (structure, rubriques, signature, cachet dirigeant)
Sois précis et factuel. Cite les données exactes du document.`,

  prompt_attestations: `Tu es expert en vérification documentaire pour commission de référencement.
{{lang}}
Les attestations de référence sont fournies ci-dessus (documents PDF/images). Base-toi EXCLUSIVEMENT sur leur contenu.
Analyse ces attestations pour : Consultant "{{intervenant}}", Solution "{{solution}}".
Pour chaque attestation identifiée :
1. Entreprise cliente — nom, secteur, taille si mentionné
2. Solution/modules mentionnés — concordance avec le dossier ?
3. Nom et rôle du consultant dans la mission
4. Dates de mission (début/fin) — cohérence avec le CV ?
5. Authenticité apparente (entête officiel, signature, cachet, coordonnées)
6. Vérifiabilité (contacts, RC, ICE mentionnés ?)
Conclus sur la solidité et la crédibilité des références présentées.`,

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

  prompt_specs_analysis: `Tu es expert en évaluation de solutions informatiques pour une commission de référencement.
{{lang}}
Prestataire : {{prestataire}} | Solution : {{solution}} | Catégorie : {{category}}

Voici les spécifications fonctionnelles déclarées par le prestataire :
{{specsContent}}

Analyse ces spécifications et fournis :
1. Liste structurée des fonctionnalités déclarées (par module/domaine)
2. Fonctionnalités clés qui méritent une vérification approfondie en démo
3. Points d'attention : fonctionnalités vagues, trop génériques, ou difficiles à vérifier
4. Questions prioritaires à poser avant/pendant la démo
Sois précis et factuel.`,

  prompt_demo_scenario: `Tu es expert en évaluation de solutions informatiques.
{{lang}}
Prestataire : {{prestataire}} | Solution : {{solution}} | Catégorie : {{category}}

Fonctionnalités déclarées (extrait de l'analyse) :
{{specsAnalysis}}

Génère un scénario de démonstration structuré permettant de VÉRIFIER ces fonctionnalités.
Format : tableau markdown ENTIÈREMENT REMPLI (8 à 12 lignes), colonnes :
| N° | Fonctionnalité clé (Domaine) | Action concrète à demander au prestataire (ex: "Montrez la création d'une facture avec...") | Résultat attendu si la fonctionnalité est réelle | Signe d'alerte si simulée ou absente |
Chaque cellule doit être renseignée avec un contenu concret et spécifique — jamais de tableau vide ni de cellules à compléter. Très concis, orienté vérification terrain.`,

  prompt_criteria_from_specs: `Tu es expert en évaluation de solutions informatiques pour une commission de référencement.
{{lang}}
Prestataire : {{prestataire}} | Solution : {{solution}} | Catégorie : {{category}}

Voici les spécifications fonctionnelles déclarées par le prestataire :
{{specsContent}}

Ta mission : générer une grille d'évaluation fonctionnelle personnalisée basée sur ces spécifications.
Crée entre 6 et 15 critères d'évaluation couvrant les fonctionnalités clés déclarées.

Pour chaque critère :
- "n" : nom court et clair (max 60 caractères)
- "d" : description de ce qui doit être vérifié lors de la démo (1-2 phrases)
- "w" : poids (1 = standard, 2 = prioritaire / fonctionnalité critique)

Réponds UNIQUEMENT en JSON valide, rien d'autre :
{
  "criteria": [
    { "n": "Nom critère", "d": "Description vérification", "w": 1 },
    ...
  ]
}`,

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
}`,

  prompt_intervenant_fields: `Tu es expert RH pour une commission de référencement.
{{lang}}
Le CV complet de l'intervenant est fourni ci-dessus (PDF/images). Base-toi EXCLUSIVEMENT sur son contenu.

Renseigne les champs suivants du ticket intervenant :
{{fieldsList}}

Règles :
- Champs texte : synthèse factuelle courte (1-2 phrases, 200 caractères MAXIMUM — champ Jira monoligne limité) citant les éléments du CV.
- Champs à choix : choisis STRICTEMENT une des options listées pour ce champ, à l'identique.
- Si le CV ne permet pas de renseigner un champ, mets "" en value et explique en justification.

Réponds UNIQUEMENT en JSON valide (sans markdown, sans texte autour) :
{
{{jsonShape}}
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
  return callAI([{ role: 'user', content: prompt + SYNTH_INSTRUCTION }]);
}

async function generatePV({ prestataire, solution, category, solScorePct, intScorePct, finalScorePct, finalDecision, solVerdict, intVerdict, decisionMotive, conditions, commissionComments, modules, programName, cvAnalysis, attestationsAnalysis, certifEditeurAnalysis }) {
  const prompts = await getPrompts();
  const cfg = await getAIConfig();
  const tpl = prompts.prompt_pv || DEFAULT_PROMPTS.prompt_pv;

  // Synthèse des analyses documentaires disponibles
  const analysesParts = [];
  if (cvAnalysis) analysesParts.push(`Analyse CV intervenant :\n${stripMarkers(cvAnalysis).slice(0, 600)}`);
  if (attestationsAnalysis) analysesParts.push(`Attestations de référence :\n${stripMarkers(attestationsAnalysis).slice(0, 600)}`);
  if (certifEditeurAnalysis) analysesParts.push(`Certificat éditeur :\n${stripMarkers(certifEditeurAnalysis).slice(0, 600)}`);
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
    if (context.cvAnalysis) parts.push(`Analyse CV :\n${stripMarkers(context.cvAnalysis).slice(0, 1000)}`);
    if (context.attestationsAnalysis) parts.push(`Attestations intervenant :\n${stripMarkers(context.attestationsAnalysis).slice(0, 800)}`);
    if (context.certifEditeurAnalysis) parts.push(`Certificat éditeur :\n${stripMarkers(context.certifEditeurAnalysis).slice(0, 800)}`);
    if (parts.length) contextBlock = `\n\n--- Contexte documentaire disponible ---\n${parts.join('\n\n')}\n---`;
  }

  const tpl = prompts.prompt_coherence || DEFAULT_PROMPTS.prompt_coherence;
  const prompt = fillTemplate(tpl, {
    lang: langInstruction(cfg.lang),
    category: category || '—',
    noteDetails
  }) + contextBlock;
  return callAI([{ role: 'user', content: prompt + SYNTH_INSTRUCTION }]);
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

async function analyzeCV({ filesData, prestataire, solution, actionLabel, actionDescription, actionConsistance, refType, modules, programName, amiText, intervenantContext }) {
  const docs = await getDocs();
  const prompts = await getPrompts();
  const cfg = await getAIConfig();
  const ami = amiText || docs.doc_ami || '';
  const canvas = docs.doc_cv_canvas || '';

  let intervenantBlock = '';
  if (intervenantContext) {
    const parts = [];
    if (intervenantContext.nom || intervenantContext.prenom) parts.push(`Nom : ${intervenantContext.prenom || ''} ${intervenantContext.nom || ''}`.trim());
    if (intervenantContext.typeFormation) parts.push(`Type de formation Jira : ${intervenantContext.typeFormation}`);
    if (intervenantContext.niveauFormation) parts.push(`Niveau de formation Jira : ${intervenantContext.niveauFormation}`);
    if (parts.length) intervenantBlock = `\n--- Données intervenant (Jira) ---\n${parts.join('\n')}\n---\n`;
  }

  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const isAction = refType === 'ACTION';
  const tplKey = isAction ? 'prompt_cv_action' : 'prompt_cv';
  const tpl = prompts[tplKey] || DEFAULT_PROMPTS[tplKey];
  const temporalCtx = `[Contexte : nous sommes le ${today}. Toute date antérieure à cette date est dans le passé. Pour les tableaux du CV : lis chaque ligne indépendamment — les dates d'une ligne n'appartiennent pas aux lignes voisines.]\n\n`;
  const textPrompt = temporalCtx + fillTemplate(tpl, {
    lang: langInstruction(cfg.lang),
    ami: ami ? `--- Critères AMI officiel ---\n${ami.slice(0, 2000)}\n---\n${intervenantBlock}` : intervenantBlock,
    canvas: canvas ? `--- Canevas CV officiel ---\n${canvas.slice(0, 1500)}\n---\n` : '',
    prestataire,
    solution: solution || '—',
    actionLabel: actionLabel || solution || '—',
    actionDescription: actionDescription ? `Description : ${actionDescription}\n` : '',
    actionConsistance: actionConsistance ? `Consistance attendue : ${actionConsistance}\n` : '',
    programName: programName || '—',
    modules: Array.isArray(modules) && modules.length ? modules.join(', ') : (modules || '—')
  });

  // filesData = [{ base64, mimeType, filename }]
  const { imagesParts, pdfTexts } = await buildFileParts(filesData, 8000);
  console.log(`[analyzeCV] ${filesData.length} fichier(s) — ${pdfTexts.length} PDF(s) parsés, ${imagesParts.length} part(s) inline`);
  if (pdfTexts.length === 0 && imagesParts.length === 0) {
    throw new Error(`Aucun fichier lisible parmi les ${filesData.length} fichier(s) fourni(s).`);
  }
  const fullText = (pdfTexts.length > 0
    ? `Contenu des documents PDF :\n\n${pdfTexts.join('\n\n')}\n\n---\n\n${textPrompt}`
    : textPrompt) + SYNTH_INSTRUCTION;

  const content = [...imagesParts, { type: 'text', text: fullText }];
  return callAI([{ role: 'user', content }], { maxTokens: 2500 });
}

async function analyzeAttestations({ filesData, solution, actionLabel, refType, intervenant, cvAnalysis }) {
  const prompts = await getPrompts();
  const cfg = await getAIConfig();
  const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const tpl = prompts.prompt_attestations || DEFAULT_PROMPTS.prompt_attestations;
  const isAction = refType === 'ACTION';
  const sujet = isAction ? (actionLabel || '—') : (solution || '—');
  const cvBlock = cvAnalysis
    ? `\n--- Analyse CV du consultant (contexte de concordance) ---\n${stripMarkers(cvAnalysis).slice(0, 2000)}\n---\nNote sur la concordance CV/attestation : l'analyse CV est une interprétation automatique d'un document parfois scanné — les dates extraites peuvent être imprécises (colonnes de tableau mal alignées, années tronquées). Lorsque tu constates un écart de dates entre le CV et une attestation pour le même client et la même ${isAction ? 'action' : 'solution'}, signale-le comme un point à vérifier sur les documents originaux plutôt que comme une incohérence certaine. En revanche, si l'écart porte sur des éléments structurels (client différent, ${isAction ? 'action différente' : 'solution différente'}, consultant non mentionné), signale-le comme incohérence réelle.\n---\n`
    : '';
  const temporalCtx = `[Contexte : nous sommes le ${today}. Toute date antérieure à cette date est dans le passé — ne qualifie jamais une mission passée de "future" ou "à venir".]\n\n`;
  const textPrompt = temporalCtx + fillTemplate(tpl, {
    lang: langInstruction(cfg.lang),
    intervenant: intervenant || '—',
    solution: sujet
  }) + cvBlock;

  console.log('[analyzeAttestations] today:', today, '| textPrompt tail:', textPrompt.slice(-200));
  const { imagesParts, pdfTexts } = await buildFileParts(filesData, 5000);
  console.log(`[analyzeAttestations] ${filesData.length} fichier(s) — ${pdfTexts.length} PDF(s), ${imagesParts.length} part(s) inline`);
  if (pdfTexts.length === 0 && imagesParts.length === 0) {
    throw new Error(`Aucun fichier lisible parmi les ${filesData.length} fichier(s) fourni(s). Vérifiez que les attestations sont des PDF avec texte sélectionnable ou des images (PNG/JPG).`);
  }
  const fullText = (pdfTexts.length > 0
    ? `Contenu des attestations PDF :\n\n${pdfTexts.join('\n\n')}\n\n---\n\n${textPrompt}`
    : textPrompt) + SYNTH_INSTRUCTION;
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

  const { imagesParts, pdfTexts } = await buildFileParts(filesData, 5000);
  console.log(`[analyzeCertifEditeur] ${filesData.length} fichier(s) — ${pdfTexts.length} PDF(s), ${imagesParts.length} part(s) inline`);
  const fullText = (pdfTexts.length > 0
    ? `Contenu du certificat PDF :\n\n${pdfTexts.join('\n\n')}\n\n---\n\n${textPrompt}`
    : textPrompt) + SYNTH_INSTRUCTION;
  const content = [...imagesParts, { type: 'text', text: fullText }];
  return callAI([{ role: 'user', content }], { maxTokens: 2000 });
}

async function autoFillFromCV({ cvAnalysis, intCriteria, solCriteria }) {
  const hasSol = solCriteria?.length > 0;
  const hasInt = intCriteria?.length > 0;

  const solCriteriaBlock = hasSol
    ? `\n\nGrille fonctionnelle (critères solution) :\n${solCriteria.map((c, i) => `${i}. ${c.n} [poids ${c.w}]${c.consistance ? ` — Attendu: ${c.consistance}` : ''}`).join('\n')}`
    : '';

  const solJsonFields = hasSol
    ? `,\n  "solScores": { ${solCriteria.map((_, i) => `"${i}": 0|1|2`).join(', ')} },\n  "solObservations": { ${solCriteria.map((_, i) => `"${i}": "justification 1-2 phrases"`).join(', ')} }`
    : '';

  const intObsField = hasInt
    ? `,\n  "intObservations": { "0": "...", "1": "...", "2": "...", "5": "..." }`
    : '';

  const prompt = `À partir de cette analyse de CV :
${stripMarkers(cvAnalysis)}
${solCriteriaBlock}

Réponds uniquement avec ce JSON (sans markdown, sans texte autour) :
{
  "diplome": "...",
  "etablissement": "...",
  "exp": <nombre années total>,
  "expSol": <nombre années sur la solution>,
  "poste": "...",
  "certif": "...",
  "intScores": { "0": 0|1|2, "1": 0|1|2, "2": 0|1|2, "5": 0|1|2 }${intObsField}${solJsonFields}
}
Règles intScores :
- 0 (formation): bac+2=1, bac+3/4=1, bac+5+=2, autre=0
- 1 (exp générale): <5ans=0, 5-10ans=1, >10ans=2
- 2 (exp solution): <2ans=0, 2-5ans=1, >5ans=2
- 5 (équipe): individuel=0, 2-4=1, 5+=2
${hasSol ? 'Pour solScores : note chaque critère d\'après le contenu du CV (0=absent/insuffisant, 1=partiel, 2=pleinement satisfait).\nPour solObservations : 1-2 phrases citant les éléments du CV qui fondent la note.' : ''}`;

  const raw = await callAI([{ role: 'user', content: prompt }], { temp: 0.1, maxTokens: 1600 });
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

// fields: { <clé>: { jiraName, type, options } } — issu de resolveIntervenantFields (jira.js)
// Limite Jira des champs « Text Field (single line) »
const JIRA_TEXT_MAX = 255;

async function extractIntervenantFieldsFromCV({ filesData, fields }) {
  const prompts = await getPrompts();
  const cfg = await getAIConfig();

  const entries = Object.entries(fields);
  if (!entries.length) throw new Error('Aucun champ Jira résolu pour ce ticket.');

  const fieldsList = entries.map(([key, f]) =>
    f.type === 'radio'
      ? `- ${key} ("${f.jiraName}") — choix parmi : ${f.options.map(o => `"${o}"`).join(' | ')}`
      : `- ${key} ("${f.jiraName}") — texte libre`
  ).join('\n');

  const jsonShape = entries.map(([key]) =>
    `  "${key}": { "value": "...", "justification": "..." }`
  ).join(',\n');

  const tpl = prompts.prompt_intervenant_fields || DEFAULT_PROMPTS.prompt_intervenant_fields;
  const textPrompt = fillTemplate(tpl, {
    lang: langInstruction(cfg.lang),
    fieldsList,
    jsonShape
  });

  const { imagesParts, pdfTexts } = await buildFileParts(filesData, 8000);
  console.log(`[extractIntervenantFields] ${filesData.length} fichier(s) — ${pdfTexts.length} PDF(s), ${imagesParts.length} part(s) inline`);
  if (pdfTexts.length === 0 && imagesParts.length === 0) {
    throw new Error(`Aucun fichier lisible parmi les ${filesData.length} fichier(s) fourni(s).`);
  }
  const fullText = pdfTexts.length > 0
    ? `Contenu du CV :\n\n${pdfTexts.join('\n\n')}\n\n---\n\n${textPrompt}`
    : textPrompt;
  const content = [...imagesParts, { type: 'text', text: fullText }];

  const parse = raw => {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  };

  // Un réessai en cas de JSON invalide, puis erreur explicite (spec : saisie manuelle possible).
  let data = parse(await callAI([{ role: 'user', content }], { temp: 0.1, maxTokens: 2000 }));
  if (!data) data = parse(await callAI([{ role: 'user', content }], { temp: 0.1, maxTokens: 2000 }));
  if (!data) throw new Error("Réponse IA invalide après réessai — renseignez les champs manuellement.");

  // Normalisation : chaque clé attendue présente, radios contraintes aux options.
  const result = {};
  for (const [key, f] of entries) {
    const item = data[key] || {};
    let value = typeof item.value === 'string' ? item.value.trim() : (item.value != null ? String(item.value) : '');
    if (f.type === 'radio' && value && !f.options.includes(value)) {
      const found = f.options.find(o => o.toLowerCase() === value.toLowerCase());
      value = found || '';
    }
    // Champs Jira « Text Field (single line) » : 255 caractères max.
    if (f.type !== 'radio' && value.length > JIRA_TEXT_MAX) {
      value = value.slice(0, JIRA_TEXT_MAX - 1) + '…';
    }
    result[key] = { value, justification: typeof item.justification === 'string' ? item.justification : '' };
  }
  return result;
}

// Extrait le texte d'un fichier Excel (xlsx/xls/csv) en base64
function extractExcelText(base64, filename) {
  try {
    const buf = Buffer.from(base64, 'base64');
    const workbook = XLSX.read(buf, { type: 'buffer' });
    const lines = [];
    for (const sheetName of workbook.SheetNames) {
      lines.push(`=== Feuille : ${sheetName} ===`);
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      lines.push(csv.slice(0, 6000));
    }
    return lines.join('\n');
  } catch (e) {
    console.warn('[extractExcelText] Erreur lecture Excel:', filename, e.message);
    return '';
  }
}

function isExcel(f) {
  const ext = (f.filename || '').split('.').pop()?.toLowerCase();
  return ['xlsx', 'xls', 'csv'].includes(ext);
}

async function analyzeSpecs({ filesData, prestataire, solution, category, modules }) {
  const prompts = await getPrompts();
  const cfg = await getAIConfig();

  // Extraire le contenu textuel de chaque fichier
  const textParts = [];
  for (const f of filesData) {
    if (isExcel(f)) {
      const text = extractExcelText(f.base64, f.filename);
      if (text) textParts.push(`--- ${f.filename} ---\n${text}`);
    } else if (isPdf(f)) {
      try {
        const buf = Buffer.from(f.base64, 'base64');
        const parsed = await pdfParse(buf);
        if (parsed.text?.trim()) textParts.push(`--- ${f.filename} ---\n${parsed.text.slice(0, 8000)}`);
      } catch {}
    }
  }

  if (!textParts.length) throw new Error('Aucun contenu lisible dans les fichiers de spécifications.');

  const specsContent = textParts.join('\n\n').slice(0, 15000);
  const langInstr = langInstruction(cfg.lang);

  // Étape 1 — analyse des specs déclarées
  const tplSpecs = prompts.prompt_specs_analysis || DEFAULT_PROMPTS.prompt_specs_analysis;
  const promptSpecs = fillTemplate(tplSpecs, {
    lang: langInstr,
    prestataire: prestataire || '—',
    solution: solution || '—',
    category: category || '—',
    specsContent
  });
  const specsAnalysis = await callAI([{ role: 'user', content: promptSpecs + SYNTH_INSTRUCTION }], { maxTokens: 2500 });

  // Étape 2 — scénario de démo
  const tplDemo = prompts.prompt_demo_scenario || DEFAULT_PROMPTS.prompt_demo_scenario;
  const promptDemo = fillTemplate(tplDemo, {
    lang: langInstr,
    prestataire: prestataire || '—',
    solution: solution || '—',
    category: category || '—',
    specsAnalysis: stripMarkers(specsAnalysis).slice(0, 3000)
  });
  const demoScenario = await callAI([{ role: 'user', content: promptDemo + DEMO_TABLE_INSTRUCTION + SYNTH_INSTRUCTION }], { maxTokens: 3000 });

  // Étape 3 — génération grille fonctionnelle personnalisée
  let suggestedCriteria = [];
  try {
    const tplCriteria = prompts.prompt_criteria_from_specs || DEFAULT_PROMPTS.prompt_criteria_from_specs;
    const promptCriteria = fillTemplate(tplCriteria, {
      lang: langInstr,
      prestataire: prestataire || '—',
      solution: solution || '—',
      category: category || '—',
      specsContent: specsContent.slice(0, 12000)
    });
    const criteriaRaw = await callAI([{ role: 'user', content: promptCriteria }], { maxTokens: 2000 });
    const jsonMatch = criteriaRaw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.criteria)) suggestedCriteria = parsed.criteria;
    }
  } catch (e) {
    console.warn('[analyzeSpecs] Criteria generation failed:', e.message);
  }

  // Étape 4 — comparaison avec les fonctionnalités réelles connues (web search via perplexity)
  let webInsights = '';
  try {
    const webPrompt = `Tu es expert en solutions informatiques B2B. Recherche des informations sur la solution "${solution || prestataire}" dans la catégorie "${category || 'logiciel de gestion'}".

Voici les fonctionnalités déclarées par le prestataire (extrait) :
${specsContent.slice(0, 3000)}

Sur la base de tes connaissances et des sources disponibles :
1. Quelles fonctionnalités de cette solution sont bien documentées et reconnues ?
2. Y a-t-il des fonctionnalités déclarées qui semblent exagérées, inhabituelles ou non standard pour ce type de solution ?
3. Quelle est la réputation générale de cette solution sur le marché (éditeur, maturité, présence au Maroc) ?
4. Points de vigilance à avoir lors de la démo.
Sois factuel et cite tes sources si possible.${SYNTH_INSTRUCTION}`;

    webInsights = await callAI(
      [{ role: 'user', content: webPrompt }],
      { model: 'perplexity/sonar', maxTokens: 2000 }
    );
  } catch (e) {
    console.warn('[analyzeSpecs] Web search failed:', e.message);
    webInsights = `Recherche web non disponible (${e.message.slice(0, 100)}).`;
  }

  return { specsAnalysis, demoScenario, webInsights, suggestedCriteria };
}

module.exports = { generateBriefing, generatePV, checkCoherence, suggestScores, analyzeCV, analyzeAttestations, analyzeCertifEditeur, autoFillFromCV, analyzeSpecs, extractIntervenantFieldsFromCV, DEFAULT_PROMPTS };

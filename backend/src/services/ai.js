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

// Construit la liste de parts multimodales à partir d'un tableau de fichiers.
// PDFs avec texte → pdfTexts (extrait), PDFs scannés → part inline PDF, images → part image_url.
async function buildFileParts(filesData, maxPdfChars = 8000) {
  const imagesParts = [];
  const pdfTexts = [];
  for (const f of filesData) {
    if (isPdf(f)) {
      try {
        const buf = Buffer.from(f.base64, 'base64');
        const parsed = await pdfParse(buf);
        if (parsed.text?.trim()) {
          pdfTexts.push(`--- ${f.filename} ---\n${parsed.text.slice(0, maxPdfChars)}`);
        } else {
          // PDF scanné : envoyer en natif application/pdf (supporté par Gemini)
          console.warn('[buildFileParts] PDF scanné, envoyé en application/pdf:', f.filename);
          imagesParts.push({ type: 'image_url', image_url: { url: `data:application/pdf;base64,${f.base64}` } });
        }
      } catch (e) {
        console.warn('[buildFileParts] PDF illisible, envoyé en application/pdf:', f.filename, e.message);
        imagesParts.push({ type: 'image_url', image_url: { url: `data:application/pdf;base64,${f.base64}` } });
      }
    } else if (isImage(f)) {
      const mime = f.mimeType?.startsWith('image/') ? f.mimeType : 'image/jpeg';
      imagesParts.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${f.base64}` } });
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

Génère un scénario de démonstration structuré permettant de VÉRIFIER ces fonctionnalités. Pour chaque fonctionnalité clé :
1. Action concrète à demander au prestataire (ex: "Montrez la création d'une facture avec...")
2. Résultat attendu si la fonctionnalité est réelle
3. Signe d'alerte si la fonctionnalité est simulée ou absente
Format : tableau ou liste numérotée, très concis, orienté vérification terrain.`,

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
  const fullText = pdfTexts.length > 0
    ? `Contenu des documents PDF :\n\n${pdfTexts.join('\n\n')}\n\n---\n\n${textPrompt}`
    : textPrompt;

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
    ? `\n--- Analyse CV du consultant (contexte de concordance) ---\n${cvAnalysis.slice(0, 2000)}\n---\nNote sur la concordance CV/attestation : l'analyse CV est une interprétation automatique d'un document parfois scanné — les dates extraites peuvent être imprécises (colonnes de tableau mal alignées, années tronquées). Lorsque tu constates un écart de dates entre le CV et une attestation pour le même client et la même ${isAction ? 'action' : 'solution'}, signale-le comme un point à vérifier sur les documents originaux plutôt que comme une incohérence certaine. En revanche, si l'écart porte sur des éléments structurels (client différent, ${isAction ? 'action différente' : 'solution différente'}, consultant non mentionné), signale-le comme incohérence réelle.\n---\n`
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

  const { imagesParts, pdfTexts } = await buildFileParts(filesData, 5000);
  console.log(`[analyzeCertifEditeur] ${filesData.length} fichier(s) — ${pdfTexts.length} PDF(s), ${imagesParts.length} part(s) inline`);
  const fullText = pdfTexts.length > 0
    ? `Contenu du certificat PDF :\n\n${pdfTexts.join('\n\n')}\n\n---\n\n${textPrompt}`
    : textPrompt;
  const content = [...imagesParts, { type: 'text', text: fullText }];
  return callAI([{ role: 'user', content }], { maxTokens: 2000 });
}

async function autoFillFromCV({ cvAnalysis, intCriteria, solCriteria }) {
  const solBlock = solCriteria?.length
    ? `\n\nGrille fonctionnelle (critères sol) :\n${solCriteria.map((c, i) => `${i}. ${c.n} [poids ${c.w}]${c.consistance ? ` — Attendu: ${c.consistance}` : ''}`).join('\n')}\n\nAjoute "solScores": { "0": 0|1|2, ... } dans le JSON en notant chaque critère sol d'après le contenu du CV.`
    : '';

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
- 5 (équipe): individuel=0, 2-4=1, 5+=2${solBlock}`;

  const raw = await callAI([{ role: 'user', content: prompt }], { temp: 0.1, maxTokens: 800 });
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
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
  const specsAnalysis = await callAI([{ role: 'user', content: promptSpecs }], { maxTokens: 2000 });

  // Étape 2 — scénario de démo
  const tplDemo = prompts.prompt_demo_scenario || DEFAULT_PROMPTS.prompt_demo_scenario;
  const promptDemo = fillTemplate(tplDemo, {
    lang: langInstr,
    prestataire: prestataire || '—',
    solution: solution || '—',
    category: category || '—',
    specsAnalysis: specsAnalysis.slice(0, 3000)
  });
  const demoScenario = await callAI([{ role: 'user', content: promptDemo }], { maxTokens: 2000 });

  // Étape 3 — comparaison avec les fonctionnalités réelles connues (web search via perplexity)
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
Sois factuel et cite tes sources si possible.`;

    webInsights = await callAI(
      [{ role: 'user', content: webPrompt }],
      { model: 'perplexity/sonar', maxTokens: 2000 }
    );
  } catch (e) {
    console.warn('[analyzeSpecs] Web search failed:', e.message);
    webInsights = `Recherche web non disponible (${e.message.slice(0, 100)}).`;
  }

  return { specsAnalysis, demoScenario, webInsights };
}

module.exports = { generateBriefing, generatePV, checkCoherence, suggestScores, analyzeCV, analyzeAttestations, analyzeCertifEditeur, autoFillFromCV, analyzeSpecs, DEFAULT_PROMPTS };

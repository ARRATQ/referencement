const express = require('express');
const authMiddleware = require('../middleware/auth');
const { requireMinRole } = require('../middleware/roles');
const ai = require('../services/ai');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authMiddleware, requireMinRole('GESTIONNAIRE'));

router.post('/briefing', async (req, res, next) => {
  try {
    const { prestataire, solution, category, modules, programCode, amiContext } = req.body;
    let amiText = '';
    if (programCode) {
      const prog = await prisma.program.findUnique({ where: { code: programCode }, select: { amiText: true } });
      if (prog) amiText = prog.amiText;
    }
    const text = await ai.generateBriefing({ prestataire, solution, category, modules, amiText, amiContext });
    res.json({ text });
  } catch (err) { next(err); }
});

router.post('/generate-pv', async (req, res, next) => {
  try {
    const text = await ai.generatePV(req.body);
    res.json({ text });
  } catch (err) { next(err); }
});

router.post('/check-coherence', async (req, res, next) => {
  try {
    const { category, criteria, solScores, solObs } = req.body;
    const text = await ai.checkCoherence({ category, criteria, solScores, solObs });
    res.json({ text });
  } catch (err) { next(err); }
});

// filesData: [{ base64, mimeType, filename }]
router.post('/analyze-cv', async (req, res, next) => {
  try {
    const { filesData, prestataire, solution, actionLabel, actionDescription, actionConsistance, refType, modules, programCode, intervenantContext } = req.body;
    if (!filesData?.length) return res.status(400).json({ error: 'Fichiers requis' });
    let programName = '', amiText = '';
    if (programCode) {
      const prog = await prisma.program.findUnique({ where: { code: programCode }, select: { name: true, amiText: true } });
      if (prog) { programName = prog.name; amiText = prog.amiText || ''; }
    }
    const text = await ai.analyzeCV({ filesData, prestataire, solution, actionLabel, actionDescription, actionConsistance, refType, modules, programName, amiText, intervenantContext });
    res.json({ text });
  } catch (err) { next(err); }
});

router.post('/analyze-attestations', async (req, res, next) => {
  try {
    const { filesData, imageBase64List, solution, actionLabel, refType, intervenant, cvAnalysis } = req.body;
    // Accepte soit filesData (nouveau format) soit imageBase64List (legacy)
    const files = filesData?.length ? filesData : (imageBase64List || []).map(b64 => ({ base64: b64, mimeType: 'image/jpeg', filename: 'attestation' }));
    if (!files.length) return res.status(400).json({ error: 'Fichiers requis' });
    const text = await ai.analyzeAttestations({ filesData: files, solution, actionLabel, refType, intervenant, cvAnalysis });
    res.json({ text });
  } catch (err) { next(err); }
});

router.post('/analyze-certif-editeur', async (req, res, next) => {
  try {
    const { filesData, solution, prestataire, programCode } = req.body;
    if (!filesData?.length) return res.status(400).json({ error: 'Fichiers requis' });
    let programName = '';
    if (programCode) {
      const prog = await prisma.program.findUnique({ where: { code: programCode }, select: { name: true } });
      if (prog) programName = prog.name;
    }
    const text = await ai.analyzeCertifEditeur({ filesData, solution, prestataire, programName });
    res.json({ text });
  } catch (err) { next(err); }
});

router.post('/analyze-specs', async (req, res, next) => {
  try {
    const { filesData, prestataire, solution, category, modules, programCode } = req.body;
    if (!filesData?.length) return res.status(400).json({ error: 'Fichiers requis' });
    const result = await ai.analyzeSpecs({ filesData, prestataire, solution, category, modules });
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/suggest-scores', async (req, res, next) => {
  try {
    const { category, criteria, dossierContext } = req.body;
    if (!criteria?.length) return res.status(400).json({ error: 'criteria requis' });
    const data = await ai.suggestScores({ category, criteria, dossierContext: dossierContext || '' });
    if (!data) return res.status(502).json({ error: 'Réponse IA invalide' });
    res.json(data);
  } catch (err) { next(err); }
});

router.post('/auto-fill', async (req, res, next) => {
  try {
    const { cvAnalysis, programCode, category } = req.body;
    if (!cvAnalysis) return res.status(400).json({ error: 'cvAnalysis requis' });
    let intCriteria = [], solCriteria = [];
    if (programCode) {
      const prog = await prisma.program.findUnique({ where: { code: programCode } });
      if (prog) {
        intCriteria = prog.intCriteria;
        if (category && prog.categories?.[category]) {
          solCriteria = prog.categories[category].criteria || [];
        }
      }
    }
    const data = await ai.autoFillFromCV({ cvAnalysis, intCriteria, solCriteria });
    res.json(data);
  } catch (err) { next(err); }
});

// Prompts — lecture (GESTIONNAIRE+) / écriture (ADMIN seulement via admin route)
router.get('/prompts', async (req, res, next) => {
  try {
    const rows = await prisma.appConfig.findMany({ where: { key: { startsWith: 'prompt_' } } });
    const stored = Object.fromEntries(rows.map(r => [r.key, r.value]));
    // Fusionner avec les défauts pour retourner tous les prompts
    const result = {};
    for (const [key, def] of Object.entries(ai.DEFAULT_PROMPTS)) {
      result[key] = stored[key] !== undefined ? stored[key] : def;
    }
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/test', async (req, res, next) => {
  try {
    const text = await ai.generateBriefing({ prestataire: 'Test', solution: 'Test', category: 'erp', modules: [] });
    res.json({ ok: true, preview: text.slice(0, 100) });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

module.exports = router;

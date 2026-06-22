const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const programs = await prisma.program.findMany({
      where: req.user.role === 'ADMIN' ? {} : { active: true },
      select: { id: true, code: true, name: true, version: true, amiText: true, cvTemplate: true, active: true, createdAt: true, categories: true, actionTypes: true, intCriteria: true }
    });
    res.json(programs);
  } catch (err) { next(err); }
});

router.get('/:code', async (req, res, next) => {
  try {
    const program = await prisma.program.findUnique({ where: { code: req.params.code } });
    if (!program) return res.status(404).json({ error: 'Programme introuvable' });
    res.json(program);
  } catch (err) { next(err); }
});

router.post('/', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { code, name, version, amiText, cvTemplate, categories, intCriteria, actionTypes } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'code et name requis' });
    const program = await prisma.program.create({
      data: { code, name, version: version || '1', amiText: amiText || '', cvTemplate: cvTemplate || '', categories: categories || {}, intCriteria: intCriteria || [], actionTypes: actionTypes || {} }
    });
    res.status(201).json(program);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Code programme déjà utilisé' });
    next(err);
  }
});

router.put('/:code', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { name, version, amiText, cvTemplate, categories, intCriteria, actionTypes, active } = req.body;
    const program = await prisma.program.update({
      where: { code: req.params.code },
      data: {
        ...(name !== undefined && { name }),
        ...(version !== undefined && { version }),
        ...(amiText !== undefined && { amiText }),
        ...(cvTemplate !== undefined && { cvTemplate }),
        ...(categories !== undefined && { categories }),
        ...(intCriteria !== undefined && { intCriteria }),
        ...(actionTypes !== undefined && { actionTypes }),
        ...(active !== undefined && { active })
      }
    });
    res.json(program);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Programme introuvable' });
    next(err);
  }
});

router.delete('/:code', requireRole('ADMIN'), async (req, res, next) => {
  try {
    await prisma.program.delete({ where: { code: req.params.code } });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Programme introuvable' });
    next(err);
  }
});

module.exports = router;

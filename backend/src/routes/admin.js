const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authMiddleware, requireRole('ADMIN'));

// Users
router.get('/users', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true }
    });
    res.json(users);
  } catch (err) { next(err); }
});

router.post('/users', async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'email, password, name requis' });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email: email.toLowerCase(), passwordHash, name, role: role || 'PARTICIPANT' },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true }
    });
    res.status(201).json(user);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Email déjà utilisé' });
    next(err);
  }
});

router.put('/users/:id', async (req, res, next) => {
  try {
    const { name, role, active, password } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (role !== undefined) data.role = role;
    if (active !== undefined) data.active = active;
    if (password) data.passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, email: true, name: true, role: true, active: true }
    });
    res.json(user);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Utilisateur introuvable' });
    next(err);
  }
});

// Stats
router.get('/stats', async (req, res, next) => {
  try {
    const [total, byStatus, byDecision, byProgram] = await Promise.all([
      prisma.evaluation.count(),
      prisma.evaluation.groupBy({ by: ['status'], _count: true }),
      prisma.evaluation.groupBy({ by: ['finalDecision'], _count: true }),
      prisma.evaluation.groupBy({ by: ['programId'], _count: true })
    ]);
    const programs = await prisma.program.findMany({ select: { id: true, code: true, name: true } });
    const programMap = Object.fromEntries(programs.map(p => [p.id, p]));
    res.json({
      total,
      byStatus: Object.fromEntries(byStatus.map(r => [r.status, r._count])),
      byDecision: Object.fromEntries(byDecision.map(r => [r.finalDecision || 'pending', r._count])),
      byProgram: byProgram.map(r => ({ ...programMap[r.programId], count: r._count }))
    });
  } catch (err) { next(err); }
});

// Audit log
router.get('/audit-log', async (req, res, next) => {
  try {
    const { userId, evaluationId, limit = 100 } = req.query;
    const where = {};
    if (userId) where.userId = userId;
    if (evaluationId) where.evaluationId = evaluationId;
    const logs = await prisma.auditLog.findMany({
      where,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true } } }
    });
    res.json(logs);
  } catch (err) { next(err); }
});

// Config Jira & IA
router.get('/config', async (req, res, next) => {
  try {
    const configs = await prisma.appConfig.findMany();
    // masquer les valeurs sensibles
    const safe = configs.map(c => ({
      key: c.key,
      value: ['jira_pat', 'jira_pass', 'ai_key'].includes(c.key) ? (c.value ? '***' : '') : c.value,
      encrypted: c.encrypted,
      updatedAt: c.updatedAt
    }));
    res.json(safe);
  } catch (err) { next(err); }
});

router.put('/config', async (req, res, next) => {
  try {
    const updates = req.body; // { key: value, ... }
    const ops = Object.entries(updates).map(([key, value]) =>
      prisma.appConfig.upsert({
        where: { key },
        create: { key, value: String(value) },
        update: { value: String(value) }
      })
    );
    await Promise.all(ops);
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'config_updated', details: { keys: Object.keys(updates) }, ipAddress: req.ip }
    });
    res.json({ ok: true, updated: Object.keys(updates) });
  } catch (err) { next(err); }
});

module.exports = router;

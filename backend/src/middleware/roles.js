const ROLE_RANK = { PARTICIPANT: 0, GESTIONNAIRE: 1, ADMIN: 2 };

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès interdit pour ce rôle' });
    }
    next();
  };
}

function requireMinRole(minRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
    if ((ROLE_RANK[req.user.role] ?? -1) < (ROLE_RANK[minRole] ?? 99)) {
      return res.status(403).json({ error: 'Accès interdit pour ce rôle' });
    }
    next();
  };
}

module.exports = { requireRole, requireMinRole };

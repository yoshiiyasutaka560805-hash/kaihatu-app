'use strict';

function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: '認証が必要です' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: '認証が必要です' });
    }
    if (!roles.includes(req.session.role)) {
      return res.status(403).json({ error: 'この操作を行う権限がありません' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };

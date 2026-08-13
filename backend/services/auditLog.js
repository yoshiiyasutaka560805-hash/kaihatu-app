'use strict';

const { getDb } = require('../database/db');

function recordAudit(req, { action, entityType, entityId = null, before = null, after = null }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_json, after_json, ip_address, user_agent)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(
    req.session?.userId ?? null,
    action,
    entityType,
    entityId,
    before ? JSON.stringify(before) : null,
    after ? JSON.stringify(after) : null,
    req.ip || null,
    req.headers['user-agent'] || null,
  );
}

module.exports = { recordAudit };

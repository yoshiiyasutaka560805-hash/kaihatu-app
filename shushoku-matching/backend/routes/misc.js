'use strict';

// 提案書・タスク・帳簿/報告・苦情
const express = require('express');
const { getDb, audit } = require('../database/db');
const specs = require('../models/specs');
const { validate, columnsOf, ah } = require('../utils/validate');
const { createProposal, markProposed } = require('../services/proposals');
const { todayTasks } = require('../services/tasks');
const { jobLedger, seekerLedger, feeLedger } = require('../services/ledgers');
const { businessReport, disclosure, pipelineStats } = require('../services/reports');
const { currentOperator } = require('../middleware/context');
const { todayJst } = require('../utils/dates');

// ── 提案書 ──
const proposals = express.Router();
proposals.post('/', ah(async (req, res) => {
  const ids = (req.body.match_ids || []).map(Number).filter(Boolean);
  const r = await createProposal(Number(req.body.seeker_id), ids, req.body.language || 'ja', req.body.override_reason || null);
  if (req.body.mark_proposed) markProposed(ids);
  res.json(r);
}));
proposals.get('/', (req, res) => {
  res.json(getDb().prepare('SELECT id, seeker_id, language, match_ids, operator, created_at FROM proposals WHERE seeker_id = ? ORDER BY id DESC').all(req.query.seekerId));
});
proposals.get('/:id', (req, res) => {
  const p = getDb().prepare('SELECT * FROM proposals WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: '提案書が見つかりません' });
  res.json({ ...p, content: JSON.parse(p.content), match_ids: JSON.parse(p.match_ids) });
});

// ── 今日のタスク ──
const tasks = express.Router();
tasks.get('/today', (req, res) => res.json(todayTasks()));
tasks.post('/', (req, res) => {
  const o = validate(req.body, specs.task, { required: ['title'] });
  const r = getDb().prepare('INSERT INTO tasks (title, due_date, seeker_id, operator) VALUES (?,?,?,?)').run(o.title, o.due_date, o.seeker_id, currentOperator());
  res.json({ id: r.lastInsertRowid });
});
tasks.put('/:id/done', (req, res) => {
  getDb().prepare("UPDATE tasks SET done_at = datetime('now','localtime') WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ── 帳簿・報告 ──
const reports = express.Router();
const fyOf = q => Number(q.fy) || (() => { const t = todayJst(); const y = Number(t.slice(0, 4)); return t.slice(5, 7) < '04' ? y - 1 : y; })();
reports.get('/business', (req, res) => res.json(businessReport(fyOf(req.query))));
reports.get('/disclosure', (req, res) => res.json(disclosure(fyOf(req.query))));
reports.get('/pipeline', (req, res) => res.json(pipelineStats(fyOf(req.query))));
reports.get('/ledger/:type', (req, res) => {
  const fn = { job: jobLedger, seeker: seekerLedger, fee: feeLedger }[req.params.type];
  if (!fn) return res.status(404).json({ error: '帳簿の種類が不正です' });
  const range = validate(req.query, { from: 'date', to: 'date' });
  audit('ledger_export', req.params.type, range);
  const name = { job: '求人管理簿', seeker: '求職管理簿', fee: '手数料管理簿' }[req.params.type];
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`${name}_${todayJst()}.csv`)}`);
  res.send(fn(range));
});

// ── 苦情受付簿 ──
const complaints = express.Router();
complaints.get('/', (req, res) => {
  res.json(getDb().prepare(`SELECT c.*, s.name AS seeker_name, e.name AS employer_name FROM complaints c
    LEFT JOIN job_seekers s ON s.id = c.seeker_id LEFT JOIN employers e ON e.id = c.employer_id ORDER BY c.received_date DESC`).all());
});
complaints.post('/', (req, res) => {
  const o = validate({ received_date: todayJst(), ...req.body }, specs.complaint, { required: ['from_type', 'content'] });
  const cols = columnsOf(o, specs.complaint);
  const r = getDb().prepare(`INSERT INTO complaints (${cols.join(',')}) VALUES (${cols.map(c => '@' + c).join(',')})`).run(o);
  audit('complaint_create', r.lastInsertRowid);
  res.json({ id: r.lastInsertRowid });
});
complaints.put('/:id', (req, res) => {
  const o = validate(req.body, specs.complaint);
  const cols = columnsOf(o, specs.complaint);
  if (cols.length) getDb().prepare(`UPDATE complaints SET ${cols.map(c => `${c} = @${c}`).join(', ')} WHERE id = @id`).run({ ...o, id: req.params.id });
  audit('complaint_update', req.params.id);
  res.json({ ok: true });
});

module.exports = { proposals, tasks, reports, complaints };

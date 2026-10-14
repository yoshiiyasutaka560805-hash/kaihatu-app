'use strict';

// Claude API 呼び出しの共通部
// ・月額予算の上限チェック（ai_requests の当月合計）
// ・送信前に ai_requests へ記録（送信項目・入力ハッシュ・操作者）し、結果を追記
// ・構造化出力（json_schema）と拒否・途中終了の扱い

const crypto = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');
const { getDb, getSettings, audit } = require('../../database/db');
const { currentOperator } = require('../../middleware/context');

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
// 1Mトークンあたり米ドル（入力, 出力）。概算の費用管理用
const PRICING = {
  'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10], 'claude-haiku-5-5': [0.1, 0.5], 'claude-fable-5-1': [10, 50],
};

// APIキーの読込元
//   RIANET_ANTHROPIC_API_KEY … 推奨。クラウド作業環境では ANTHROPIC_ で始まる変数が Claude 自身の設定と衝突し反映されないことがあるため
//   ANTHROPIC_API_KEY        … 事務所PCなど通常の環境ではこちらでも可
// 接続先は RIANET_ANTHROPIC_BASE_URL（任意）→ 既定 https://api.anthropic.com。
//   ※ RIANET_ キー使用時は、環境に設定された ANTHROPIC_BASE_URL（他用途のプロキシ等）を使わない
const DEFAULT_BASE_URL = 'https://api.anthropic.com';

function apiKey() {
  return process.env.RIANET_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || null;
}

function newClient(timeout) {
  const own = process.env.RIANET_ANTHROPIC_API_KEY;
  const opts = { timeout, maxRetries: 2 };
  if (own) Object.assign(opts, { apiKey: own, baseURL: process.env.RIANET_ANTHROPIC_BASE_URL || DEFAULT_BASE_URL });
  return new Anthropic(opts);
}

let injectedClient = null;
function setClientForTest(c) { injectedClient = c; }

function isAvailable() {
  return Boolean(injectedClient || apiKey() || process.env.ANTHROPIC_AUTH_TOKEN);
}

function monthSpent() {
  const ym = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 7);
  return getDb().prepare("SELECT COALESCE(SUM(cost_usd),0) s FROM ai_requests WHERE substr(at,1,7) = ?").get(ym).s;
}

function cost(model, usage) {
  const [i, o] = PRICING[model] || PRICING['claude-opus-5-5'];
  return ((usage?.input_tokens || 0) * i + (usage?.output_tokens || 0) * o) / 1e6;
}

class AiUnavailableError extends Error { constructor(m) { super(m); this.status = 409; } }

function ensureUsable() {
  const s = getSettings();
  if (s.ai_enabled !== '1') throw new AiUnavailableError('AI機能は設定で無効です');
  if (!isAvailable()) throw new AiUnavailableError('APIキー（RIANET_ANTHROPIC_API_KEY または ANTHROPIC_API_KEY）が未設定です');
  const budget = Number(s.ai_monthly_budget_usd || 0);
  if (budget > 0 && monthSpent() >= budget) throw new AiUnavailableError(`今月のAI利用額が予算（$${budget}）に達しました`);
}

/**
 * 構造化出力で1回呼び出す
 * @param {object} o { purpose, system, content (string|array), schema, seekerId, fieldsSent, maxTokens, effort }
 */
async function callStructured(o) {
  ensureUsable();
  const db = getDb();
  const contentText = typeof o.content === 'string' ? o.content : JSON.stringify(o.content).slice(0, 200000);
  const req = db.prepare(`INSERT INTO ai_requests (purpose, model, seeker_id, fields_sent, input_hash, operator)
    VALUES (?,?,?,?,?,?)`).run(o.purpose, MODEL, o.seekerId ?? null, o.fieldsSent ? JSON.stringify(o.fieldsSent) : null,
    crypto.createHash('sha256').update(contentText).digest('hex'), currentOperator());
  audit('ai_send', o.seekerId ?? null, { purpose: o.purpose, model: MODEL, request_id: req.lastInsertRowid });
  const finish = (fields) => {
    const cols = Object.keys(fields);
    db.prepare(`UPDATE ai_requests SET ${cols.map(c => `${c} = @${c}`).join(', ')} WHERE id = @id`).run({ ...fields, id: req.lastInsertRowid });
  };

  const client = injectedClient || newClient(120000);
  let response;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: o.maxTokens || 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: o.effort || 'medium', format: { type: 'json_schema', schema: o.schema } },
      system: o.system,
      messages: [{ role: 'user', content: o.content }],
    });
  } catch (e) {
    finish({ status: 'error', error: String(e.message).slice(0, 500) });
    throw new Error(`AI呼び出しに失敗しました: ${e.message}`);
  }
  const usage = response.usage || {};
  const base = { input_tokens: usage.input_tokens || 0, output_tokens: usage.output_tokens || 0, cost_usd: cost(MODEL, usage) };
  if (response.stop_reason === 'refusal') { finish({ ...base, status: 'error', error: 'refusal' }); throw new Error('AIが応答を辞退しました'); }
  if (response.stop_reason === 'max_tokens') { finish({ ...base, status: 'error', error: 'max_tokens' }); throw new Error('AI応答が上限で途切れました'); }
  const text = (response.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  try {
    const parsed = JSON.parse(text);
    finish({ ...base, status: 'success' });
    return parsed;
  } catch {
    finish({ ...base, status: 'error', error: 'invalid json' });
    throw new Error('AI応答を解析できませんでした');
  }
}

// サーバーツール（Web検索・Web取得）＋提出用ツールでのループ呼び出し
// ・pause_turn は同じ会話を再送して継続（最大 maxContinuations 回）
// ・結果は submitTool の入力として受け取る（構造化出力は検索の引用と併用できないため）
async function callWithTools(o) {
  ensureUsable();
  const db = getDb();
  const req = db.prepare(`INSERT INTO ai_requests (purpose, model, seeker_id, fields_sent, input_hash, operator)
    VALUES (?,?,?,?,?,?)`).run(o.purpose, MODEL, o.seekerId ?? null, o.fieldsSent ? JSON.stringify(o.fieldsSent) : null,
    crypto.createHash('sha256').update(String(o.content)).digest('hex'), currentOperator());
  audit('ai_send', o.seekerId ?? null, { purpose: o.purpose, model: MODEL, request_id: req.lastInsertRowid });
  const totals = { input_tokens: 0, output_tokens: 0, searches: 0 };
  const finish = (status, error = null) => db.prepare(`UPDATE ai_requests SET status = ?, error = ?, input_tokens = ?, output_tokens = ?, cost_usd = ? WHERE id = ?`)
    .run(status, error, totals.input_tokens, totals.output_tokens,
      cost(MODEL, totals) + totals.searches * 0.01, req.lastInsertRowid);

  const client = injectedClient || newClient(300000);
  const messages = [{ role: 'user', content: o.content }];
  const tools = [...o.serverTools, { name: o.submitTool.name, description: o.submitTool.description, strict: true, input_schema: o.submitTool.schema }];
  let nudged = false;
  try {
    for (let i = 0; i < (o.maxContinuations || 6); i++) {
      const response = await client.beta.messages.create({
        model: MODEL, max_tokens: o.maxTokens || 32000,
        betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
        output_config: { effort: o.effort || 'medium' },
        system: o.system, tools, tool_choice: { type: 'auto' }, messages,
      });
      const u = response.usage || {};
      totals.input_tokens += u.input_tokens || 0;
      totals.output_tokens += u.output_tokens || 0;
      totals.searches += u.server_tool_use?.web_search_requests || 0;
      if (response.stop_reason === 'refusal') throw new Error('AIが応答を辞退しました');
      const submit = (response.content || []).find(b => b.type === 'tool_use' && b.name === o.submitTool.name);
      if (submit) { finish('success'); return submit.input; }
      messages.push({ role: 'assistant', content: response.content });
      if (response.stop_reason === 'pause_turn') continue;
      if (response.stop_reason === 'max_tokens') throw new Error('AI応答が上限で途切れました');
      if (nudged) throw new Error('AIが結果を提出しませんでした');
      nudged = true;
      messages.push({ role: 'user', content: `調べた結果を ${o.submitTool.name} ツールで提出してください。見つからなかった場合は空の配列で提出してください。` });
    }
    throw new Error('AIの処理が規定回数内に終わりませんでした');
  } catch (e) {
    finish('error', String(e.message).slice(0, 500));
    throw new Error(e.message.startsWith('AI') ? e.message : `AI呼び出しに失敗しました: ${e.message}`);
  }
}

function usageSummary() {
  const db = getDb();
  return {
    model: MODEL,
    available: isAvailable(),
    monthSpentUsd: Math.round(monthSpent() * 100) / 100,
    budgetUsd: Number(getSettings().ai_monthly_budget_usd || 0),
    recent: db.prepare('SELECT id, at, purpose, model, seeker_id, status, input_tokens, output_tokens, cost_usd, error, operator FROM ai_requests ORDER BY id DESC LIMIT 100').all(),
  };
}

module.exports = { callStructured, callWithTools, isAvailable, ensureUsable, usageSummary, setClientForTest, MODEL, AiUnavailableError };

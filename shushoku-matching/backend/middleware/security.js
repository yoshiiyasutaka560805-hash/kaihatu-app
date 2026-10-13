'use strict';

// ローカル運用向けの防御
// 1) Host ヘッダ検査：DNSリバインディング（外部サイトから 127.0.0.1 を同一オリジン扱いで呼ぶ攻撃）を防ぐ
// 2) /api は独自ヘッダ X-Rianet-App 必須：他サイトからの form 送信・単純リクエスト（CSRF）を防ぐ
//    （独自ヘッダ付きのクロスオリジン要求はプリフライトとなり、CORS を許可していないため失敗する）
// 3) Origin ヘッダがあれば自ホスト以外を拒否

const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

function hostname(h) {
  if (!h) return null;
  if (h.startsWith('[')) return h.slice(0, h.indexOf(']') + 1);
  return h.split(':')[0].toLowerCase();
}

function securityMiddleware(req, res, next) {
  const extra = (process.env.ALLOWED_HOSTS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = h => ALLOWED_HOSTS.has(h) || extra.includes(h);
  if (!ok(hostname(req.get('host')))) return res.status(403).send('Forbidden host');

  const origin = req.get('origin');
  if (origin && origin !== 'null') {
    let oh;
    try { oh = hostname(new URL(origin).host); } catch { oh = null; }
    if (!ok(oh)) return res.status(403).json({ error: 'Forbidden origin' });
  }

  if (req.path.startsWith('/api/') && req.get('X-Rianet-App') !== '1') {
    return res.status(403).json({ error: 'Missing app header' });
  }

  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'no-referrer');
  next();
}

module.exports = { securityMiddleware };

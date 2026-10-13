// API クライアント
// ・全リクエストに独自ヘッダ X-Rianet-App を付与（サーバ側のCSRF対策と対）
// ・操作者名（画面左下で選択）を X-Operator で送信し、監査ログ・履歴に記録

const BASE = '/api';
const OP_KEY = 'rianet.operator';

export function getOperator() {
  try { return localStorage.getItem(OP_KEY) || ''; } catch { return ''; }
}
export function setOperator(name) {
  try { localStorage.setItem(OP_KEY, name); } catch { /* ignore */ }
}

function headers(extra = {}) {
  return { 'X-Rianet-App': '1', 'X-Operator': encodeURIComponent(getOperator() || '未選択'), ...extra };
}

async function handle(res) {
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const err = new Error((body && body.error) || res.statusText);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handle(res);
}

export const get = (path, params) => {
  const qs = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString() : '';
  return request('GET', `${path}${qs ? `?${qs}` : ''}`);
};
export const post = (path, body = {}) => request('POST', path, body);
export const put = (path, body = {}) => request('PUT', path, body);
export const del = (path) => request('DELETE', path);

// multipart アップロード（CSV・求人票）
export async function upload(path, file, fields = {}) {
  const form = new FormData();
  form.append('file', file);
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: headers(), body: form });
  return handle(res);
}

// CSV 等のダウンロード（独自ヘッダが必要なため fetch → Blob で保存）
export async function download(path, fallbackName = 'download.csv') {
  const res = await fetch(`${BASE}${path}`, { headers: headers() });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  const cd = res.headers.get('Content-Disposition') || '';
  const m = cd.match(/filename\*=UTF-8''([^;]+)/);
  const name = m ? decodeURIComponent(m[1]) : fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

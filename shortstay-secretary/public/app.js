'use strict';
let token = sessionStorage.getItem('t') || '';
let me = null;
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DAYS = ['日', '月', '火', '水', '木', '金', '土'];
const LV = { overdue: ['期限切れ', 'b-overdue'], urgent: ['至急', 'b-urgent'], warn: ['要準備', 'b-warn'], missing: ['未登録', 'b-missing'] };
let OPTS = null;
const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 2500); };

async function api(method, url, body, raw) {
  const r = await fetch('/api' + url, { method, headers: { ...(body && !raw ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: raw ? body : body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && token) { logoutLocal(); throw new Error(j.error || '再ログインしてください'); }
  if (!r.ok) { const e = new Error(j.error || (j.errors || []).join(' / ') || '失敗しました'); e.data = j; throw e; }
  return j;
}
const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message); } };

function logoutLocal() { token = ''; sessionStorage.removeItem('t'); me = null; render(); }
$('#logout').onclick = guard(async () => { await api('POST', '/logout'); logoutLocal(); });
document.querySelectorAll('#tabs button').forEach((b) => { b.onclick = () => go(b.dataset.tab); });

let idleTimer; // 無操作15分で自動ログアウト（紛失・置き忘れ対策。サーバー側は30分で失効）
['click', 'keydown', 'touchstart'].forEach((ev) => addEventListener(ev, () => {
  clearTimeout(idleTimer); if (token) idleTimer = setTimeout(() => { logoutLocal(); toast('無操作のためログアウトしました'); }, 15 * 60000);
}, { passive: true }));

async function render() {
  const app = $('#app'); $('#tabs').hidden = !token; $('#logout').hidden = !token;
  $('#who').textContent = me ? me.display_name : '';
  if (!token) return renderLogin(app);
  if (!me) me = await api('GET', '/me').catch(() => null);
  if (!me) return renderLogin(app);
  $('#who').textContent = me.display_name; go(sessionStorage.getItem('tab') || 'home');
}
async function renderLogin(app) {
  const { needed } = await api('GET', '/setup-needed');
  app.innerHTML = `<div class="card"><h2>${needed ? '初期設定（管理者登録）' : 'ログイン'}</h2>
    <label>ID<input id="u" autocomplete="username"></label>
    ${needed ? '<label>表示名<input id="dn"></label>' : ''}
    <label>パスワード${needed ? '（10文字以上）' : ''}<input id="p" type="password" autocomplete="${needed ? 'new-password' : 'current-password'}"></label>
    <p><button id="go">${needed ? '登録' : 'ログイン'}</button></p>
    <p class="muted">このアプリは施設LAN/VPN内専用です。個人情報を含むため、画面の撮影・共有にご注意ください。</p></div>`;
  $('#go').onclick = guard(async () => {
    if (needed) { await api('POST', '/setup', { username: $('#u').value, display_name: $('#dn').value, password: $('#p').value }); toast('登録しました。ログインしてください'); return render(); }
    const r = await api('POST', '/login', { username: $('#u').value, password: $('#p').value });
    token = r.token; me = r.user; sessionStorage.setItem('t', token); render();
  });
}

function go(tab) {
  sessionStorage.setItem('tab', tab);
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  guard(({ home, clients, transport, admin }[tab]))($('#app'));
}

const badge = (lv) => `<span class="badge ${LV[lv][1]}">${LV[lv][0]}</span>`;

async function home(app) {
  const d = await api('GET', '/dashboard');
  const todo = d.todo.length ? d.todo.map((t) => `<li>${esc(t)}</li>`).join('') : '<li>至急の対応はありません</li>';
  app.innerHTML = `<h2>今日（${esc(d.date)}）やること</h2><div class="card"><ul>${todo}</ul></div>
    <h2>今日の送迎（固定）</h2>${d.pickups.map((p) => `<div class="card"><b>${esc(p.time)}</b> ${esc(p.client)}さん ${esc(p.kind)}${p.wheelchair ? ' ♿' + esc(p.wheelchair_type) : ''} ${esc(p.gait)}
      <div>${p.tags.map((t) => `<span class="badge b-warn">${esc(t)}</span>`).join(' ')}</div>
      <div class="muted">立会: ${esc(p.escort)}　${esc(p.attention)}</div>
      <div class="muted">車両: ${esc(p.vehicle || '未指定')} / 運転手: ${esc(p.driver || '未指定')}</div>
      ${p.warnings.map((w) => `<div class="warn">⚠ ${esc(w)}</div>`).join('')}</div>`).join('') || '<div class="card muted">送迎予定はありません</div>'}
    <h2>書類の期限アラート</h2>${d.document_alerts.map((a) => `<div class="card">${badge(a.level)} ${esc(a.message)}</div>`).join('') || '<div class="card muted">期限が近い書類はありません</div>'}
    <h2>未登録の必須書類（${d.missing_documents.length}件）</h2>${d.missing_documents.slice(0, 20).map((a) => `<div class="card">${badge('missing')} ${esc(a.message)}</div>`).join('')}`;
}

async function clients(app) {
  const list = await api('GET', '/clients');
  app.innerHTML = `<div class="row"><h2>利用者（${list.length}名）</h2><button class="fit" id="new">＋ 新規登録</button></div>` +
    list.map((c) => `<div class="card" data-id="${c.id}" style="cursor:pointer">${esc(c.name)} ${c.wheelchair_type ? '♿' + esc(c.wheelchair_type === '車椅子' ? '' : '(リクライニング)') : ''} ${esc(c.gait)} ${c.tags.map((t) => `<span class="badge b-missing">${esc(t)}</span>`).join(' ')} <span class="muted">（表示用: ${esc(c.masked_name)}）</span></div>`).join('') +
    `<div id="detail"></div>`;
  $('#new').onclick = () => clientForm();
  app.querySelectorAll('.card[data-id]').forEach((el) => { el.onclick = guard(() => clientDetail(el.dataset.id)); });
}
async function clientForm(c = {}) {
  OPTS = OPTS || await api('GET', '/profile-options');
  const opt = (list, cur, blank) => `<option value="">${blank}</option>` + list.filter(Boolean).map((x) => `<option ${x === cur ? 'selected' : ''}>${esc(x)}</option>`).join('');
  $('#detail').innerHTML = `<div class="card"><h2>${c.id ? '利用者情報の編集' : '新規登録'}</h2>
    <div class="row"><label>姓<input id="f_s" value="${esc(c.surname)}"></label><label>名<input id="f_g" value="${esc(c.given)}"></label>
    <label>姓のイニシャル（英字・外部共有用）<input id="f_i" value="${esc(c.surname_initial)}" maxlength="2"></label></div>
    <label>電話<input id="f_p" value="${esc(c.phone)}" inputmode="tel"></label><label>住所<input id="f_a" value="${esc(c.address)}"></label>
    <label>緊急連絡先<input id="f_e" value="${esc(c.emergency)}"></label>
    <div class="row"><label>車椅子<select id="f_wt">${opt(OPTS.wheelchair_types, c.wheelchair_type, 'なし')}</select></label>
    <label>歩行状態<select id="f_gt">${opt(OPTS.gaits, c.gait, '未設定')}</select></label>
    <label>車種指定<input id="f_vh" value="${esc(c.vehicle_hint)}" placeholder="例: タント / バネット"></label></div>
    <label>注意タグ</label><div>${OPTS.tags.map((t) => `<label style="display:inline-block;margin-right:12px"><input type="checkbox" name="f_tag" value="${esc(t)}" ${(c.tags || []).includes(t) ? 'checked' : ''} style="min-height:auto"> ${esc(t)}</label>`).join('')}</div>
    <label>入所・退所時の立会者（例: ヘルパー / 夫 / 息子・LINEあり）<input id="f_es" value="${esc(c.escort)}"></label>
    <label>注意事項（自由記述）<textarea id="f_at">${esc(c.attention)}</textarea></label>
    <label>キーボックス暗証番号（暗号化・表示時のみ確認）<input id="f_kb" value="${esc(c.keybox)}" autocomplete="off"></label>
    <label>メモ<textarea id="f_n">${esc(c.note)}</textarea></label>
    <p><button id="save">保存</button></p></div>`;
  $('#save').onclick = guard(async () => {
    const body = { surname: $('#f_s').value, given: $('#f_g').value, surname_initial: $('#f_i').value, phone: $('#f_p').value,
      address: $('#f_a').value, emergency: $('#f_e').value, note: $('#f_n').value, wheelchair_type: $('#f_wt').value, gait: $('#f_gt').value,
      vehicle_hint: $('#f_vh').value, tags: [...document.querySelectorAll('[name=f_tag]:checked')].map((x) => x.value),
      escort: $('#f_es').value, attention: $('#f_at').value, keybox: $('#f_kb').value };
    if (c.id) await api('PUT', '/clients/' + c.id, body); else await api('POST', '/clients', body);
    toast('保存しました'); go('clients');
  });
}
async function clientDetail(id) {
  const [c, types, vehicles, drivers] = await Promise.all([api('GET', '/clients/' + id), api('GET', '/doc-types'), api('GET', '/vehicles'), api('GET', '/drivers')]);
  const byType = Object.fromEntries(c.documents.map((d) => [d.doc_type_id, d]));
  $('#detail').innerHTML = `<div class="card"><h2>${esc(c.name)}</h2>
    <div>電話: <span class="secret" id="ph">${esc(c.phone)}</span> / 住所: <span class="secret" id="ad">${esc(c.address)}</span>
    <button class="sub fit" id="peek">表示/非表示</button></div><div class="muted">緊急連絡先: ${esc(c.emergency)}　${esc(c.note)}</div>
    <div>${c.wheelchair_type ? '♿' + esc(c.wheelchair_type) : ''} ${esc(c.gait)} ${c.vehicle_hint ? '車種:' + esc(c.vehicle_hint) : ''} ${c.tags.map((t) => `<span class="badge b-warn">${esc(t)}</span>`).join(' ')}</div>
    <div class="muted">立会: ${esc(c.escort)}　${esc(c.attention)}${c.keybox ? '　キーボックス: <span class="secret" id="kb">' + esc(c.keybox) + '</span>' : ''}</div>
    <p class="row"><button class="sub fit" id="edit">編集</button><button class="danger fit" id="del">利用終了にする</button></p></div>
    <h2>書類</h2><div class="card"><table><tr><th>種別</th><th>期限</th><th>ファイル</th><th></th></tr>${types.map((t) => {
      const d = byType[t.id]; return `<tr><td>${esc(t.name)}</td><td>${d ? esc(d.expires_on || '-') : '<span class="badge b-missing">未登録</span>'}</td>
      <td>${d && d.file_name ? `<a href="#" data-dl="${d.id}">${esc(d.file_name)}</a>` : '-'}</td>
      <td><button class="sub" data-doc="${t.id}">登録/更新</button></td></tr>`; }).join('')}</table><div id="docform"></div></div>
    <h2>固定送迎</h2><div class="card">${c.patterns.map((p) => `<div>${DAYS[p.weekday]}曜 ${esc(p.kind)} ${esc(p.time)} <button class="sub" data-delp="${p.id}">削除</button></div>`).join('') || '<span class="muted">未登録</span>'}
    <div class="row"><select id="pw">${DAYS.map((d, i) => `<option value="${i}">${d}曜</option>`).join('')}</select>
    <select id="pk"><option>迎え</option><option>送り</option></select><input id="pt" type="time" value="09:00">
    <select id="pv"><option value="">車両(既定)</option>${vehicles.map((v) => `<option value="${v.id}">${esc(v.name)}</option>`).join('')}</select>
    <select id="pd"><option value="">運転手(既定)</option>${drivers.map((v) => `<option value="${v.id}">${esc(v.name)}</option>`).join('')}</select>
    <button class="fit" id="addp">追加</button></div></div>`;
  $('#detail').scrollIntoView();
  $('#peek').onclick = () => { $('#ph').classList.toggle('show'); $('#ad').classList.toggle('show'); $('#kb')?.classList.toggle('show'); };
  $('#edit').onclick = () => clientForm(c);
  $('#del').onclick = guard(async () => { if (confirm('利用終了として一覧から外します。よろしいですか？')) { await api('DELETE', '/clients/' + id); go('clients'); } });
  $('#addp').onclick = guard(async () => { await api('POST', `/clients/${id}/patterns`, { weekday: +$('#pw').value, kind: $('#pk').value, time: $('#pt').value,
    default_vehicle_id: +$('#pv').value || null, default_driver_id: +$('#pd').value || null }); toast('追加しました'); clientDetail(id); });
  document.querySelectorAll('[data-delp]').forEach((b) => { b.onclick = guard(async () => { await api('DELETE', '/patterns/' + b.dataset.delp); clientDetail(id); }); });
  document.querySelectorAll('[data-dl]').forEach((a) => { a.onclick = guard(async (e) => { e.preventDefault();
    const r = await fetch(`/api/documents/${a.dataset.dl}/file`, { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) throw new Error('取得できません'); window.open(URL.createObjectURL(await r.blob())); }); });
  document.querySelectorAll('[data-doc]').forEach((b) => { b.onclick = () => {
    const t = types.find((x) => x.id == b.dataset.doc), d = byType[t.id] || {};
    $('#docform').innerHTML = `<h3>${esc(t.name)}</h3><div class="row"><label>期限/更新日<input id="de" type="date" value="${esc(d.expires_on || '')}"></label>
      <label>スキャン(PDF/JPG/PNG)<input id="df" type="file" accept="application/pdf,image/jpeg,image/png"></label></div><button id="ds">保存</button>`;
    $('#ds').onclick = guard(async () => { const fd = new FormData(); fd.append('doc_type_id', t.id); fd.append('expires_on', $('#de').value);
      if ($('#df').files[0]) fd.append('file', $('#df').files[0]); await api('POST', `/clients/${id}/documents`, fd, true); toast('登録しました'); clientDetail(id); });
  }; });
}

async function transport(app) {
  const [d, vehicles, drivers, list] = await Promise.all([api('GET', '/dashboard'), api('GET', '/vehicles'), api('GET', '/drivers'), api('GET', '/clients')]);
  app.innerHTML = `<h2>送迎ルート案（${esc(d.date)}）</h2><div class="card">
    <div class="row"><select id="tk"><option>迎え</option><option>送り</option></select>
    <select id="tv">${vehicles.map((v) => `<option value="${v.id}">${esc(v.name)}${v.wheelchair ? ' ♿' : ''}（${v.capacity}名）</option>`).join('')}</select>
    <select id="td">${drivers.map((v) => `<option value="${v.id}">${esc(v.name)}</option>`).join('')}</select></div>
    <p class="muted">固定送迎のある利用者を1〜3名選択（原則1便1名。同方向のみ同乗を検討）</p>
    ${d.pickups.map((p) => `<label><input type="checkbox" name="pp" value="${p.pattern_id}" data-kind="${esc(p.kind)}" style="min-height:auto"> ${esc(p.time)} ${esc(p.client)} ${esc(p.kind)}${p.wheelchair ? ' ♿' : ''}</label>`).join('') || '<p class="muted">本日の固定送迎はありません</p>'}
    <p><button id="plan">ルート案を作成</button></p><div id="planout"></div>
    <p class="muted">Googleへ送るのは住所のみです（氏名・電話は送信しません）。最終判断は担当者が行ってください。</p></div>
    <h2>車両・運転手の登録</h2><div class="card"><div class="row"><input id="vn" placeholder="車両名（例: バネット1号）"><label class="fit"><input type="checkbox" id="vw" style="min-height:auto"> 車椅子対応</label>
    <input id="vc" type="number" value="3" min="1" max="8"><button class="fit" id="vadd">車両追加</button></div>
    <div class="row"><input id="dn2" placeholder="運転手名"><button class="fit" id="dadd">運転手追加</button></div></div>`;
  $('#plan').onclick = guard(async () => {
    const ids = [...document.querySelectorAll('[name=pp]:checked')].map((x) => +x.value);
    try {
      const r = await api('POST', '/transport/plan', { date: d.date, kind: $('#tk').value, vehicle_id: +$('#tv').value, driver_id: +$('#td').value, pattern_ids: ids });
      $('#planout').innerHTML = `<div class="card"><b>${esc(r.vehicle)} / ${esc(r.driver)}</b><ol>${r.stops.map((s) => `<li>${esc(s.time)} ${esc(s.label)}</li>`).join('')}</ol>
        <div>所要時間: ${r.total_minutes == null ? '未計算' : r.total_minutes + '分'}</div>${r.warnings.map((w) => `<div class="warn">⚠ ${esc(w)}</div>`).join('')}
        <p><a href="${esc(r.maps_url)}" target="_blank" rel="noopener noreferrer">Googleマップで開く</a></p></div>`;
    } catch (e) { $('#planout').innerHTML = `<div class="card warn">${esc(e.message)}</div>`; }
  });
  $('#vadd').onclick = guard(async () => { await api('POST', '/vehicles', { name: $('#vn').value, wheelchair: $('#vw').checked, capacity: +$('#vc').value }); transport(app); });
  $('#dadd').onclick = guard(async () => { await api('POST', '/drivers', { name: $('#dn2').value }); transport(app); });
}

async function admin(app) {
  if (me.role !== 'admin') { app.innerHTML = `<div class="card"><h2>アカウント</h2><button id="lo">ログアウト</button></div>`; $('#lo').onclick = guard(async () => { await api('POST', '/logout'); logoutLocal(); }); return; }
  const [types, sessions, audit] = await Promise.all([api('GET', '/doc-types'), api('GET', '/admin/sessions'), api('GET', '/admin/audit')]);
  app.innerHTML = `<h2>CSV取込（姓,名,姓イニシャル,電話,住所,緊急連絡先,車椅子,歩行状態,注意事項）</h2><div class="card"><textarea id="csv" rows="4" style="width:100%"></textarea>
    <input type="file" id="csvf" accept=".csv"><button id="imp">取込</button><div id="impout" class="muted"></div></div>
    <h2>書類種別とアラート日数</h2><div class="card">${types.map((t) => `<div class="row"><span>${esc(t.name)}</span><input data-t="${t.id}" value="${esc(t.alert_days)}"><button class="sub fit" data-st="${t.id}">保存</button></div>`).join('')}</div>
    <h2>ログイン端末（紛失時は無効化）</h2><div class="card"><button class="danger" id="rv">自分を含む全端末を無効化</button><table><tr><th>端末</th><th>最終</th><th>状態</th></tr>${sessions.map((s) => `<tr><td>${esc((s.device || '').slice(0, 40))}<br><span class="muted">${esc(s.ip)}</span></td><td>${esc(s.last_seen)}</td><td>${s.revoked ? '無効' : `有効 <button class="sub" data-rv="${s.id}">無効化</button>`}</td></tr>`).join('')}</table></div>
    <h2>職員アカウント追加</h2><div class="card"><div class="row"><input id="nu" placeholder="ID"><input id="nd" placeholder="表示名"><input id="np" type="password" placeholder="パスワード(10文字以上)"><button class="fit" id="nadd">追加</button></div></div>
    <h2>バックアップ</h2><div class="card"><button id="bk">暗号化バックアップを作成</button> <span class="muted">暗号鍵(data/.key)は別媒体で保管</span></div>
    <h2>操作ログ（直近）</h2><div class="card"><table>${audit.slice(0, 50).map((a) => `<tr><td>${esc(a.at)}</td><td>${esc(a.username || '-')}</td><td>${esc(a.action)} ${esc(a.target || '')}</td></tr>`).join('')}</table></div>`;
  $('#csvf').onchange = () => { const f = $('#csvf').files[0]; if (f) f.text().then((t) => { $('#csv').value = t; }); };
  $('#imp').onclick = guard(async () => { const r = await api('POST', '/import/clients', { csv: $('#csv').value });
    $('#impout').innerHTML = `登録${r.created}件<br>${[...r.skipped, ...r.errors].map(esc).join('<br>')}`; });
  document.querySelectorAll('[data-st]').forEach((b) => { b.onclick = guard(async () => { await api('PUT', '/doc-types/' + b.dataset.st, { alert_days: document.querySelector(`[data-t="${b.dataset.st}"]`).value }); toast('保存しました'); }); });
  document.querySelectorAll('[data-rv]').forEach((b) => { b.onclick = guard(async () => { await api('POST', `/admin/sessions/${b.dataset.rv}/revoke`); admin(app); }); });
  $('#rv').onclick = guard(async () => { if (confirm('全端末（この端末も）を無効化します')) { await api('POST', `/admin/users/${me.id}/revoke-all`); logoutLocal(); } });
  $('#nadd').onclick = guard(async () => { await api('POST', '/admin/users', { username: $('#nu').value, display_name: $('#nd').value, password: $('#np').value }); toast('追加しました'); });
  $('#bk').onclick = guard(async () => { const r = await api('POST', '/admin/backup'); toast('作成: ' + r.file); });
}

render();

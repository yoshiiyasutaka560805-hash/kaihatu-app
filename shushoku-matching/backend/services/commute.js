'use strict';

// 通勤時間：手入力 または Google Maps Distance Matrix API（GOOGLE_MAPS_API_KEY 設定時のみ）
// 外部APIへ送るのは「求職者の最寄り駅（または市区町村）」と「求人の勤務地住所」のみ。求職者の住所は送らない

const fetch = require('node-fetch');
const { getDb, audit } = require('../database/db');

function setManual(seekerId, postingId, minutes, mode = null) {
  getDb().prepare(`INSERT INTO commute_cache (seeker_id, posting_id, minutes, mode, source) VALUES (?,?,?,?, 'manual')
    ON CONFLICT(seeker_id, posting_id) DO UPDATE SET minutes = excluded.minutes, mode = excluded.mode, source = 'manual',
    updated_at = datetime('now','localtime')`).run(seekerId, postingId, minutes, mode);
}

function clear(seekerId, postingId) {
  getDb().prepare('DELETE FROM commute_cache WHERE seeker_id = ? AND posting_id = ?').run(seekerId, postingId);
}

const MODE = { 公共交通: 'transit', 車: 'driving', 自転車: 'bicycling', 徒歩: 'walking' };

async function estimateViaApi(seeker, postings, { fetchImpl = fetch } = {}) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw Object.assign(new Error('GOOGLE_MAPS_API_KEY が未設定です（通勤時間は手入力してください）'), { status: 409 });
  const origin = seeker.nearest_station ? `${seeker.prefecture || ''}${seeker.nearest_station}駅` : `${seeker.prefecture || ''}${seeker.city || ''}`;
  if (!origin.trim()) throw Object.assign(new Error('求職者の最寄り駅または市区町村を入力してください'), { status: 400 });
  const mode = MODE[(seeker.transport || '公共交通').split(',')[0]] || 'transit';
  const results = [];
  for (let i = 0; i < postings.length; i += 25) {
    const chunk = postings.slice(i, i + 25);
    const dest = chunk.map(p => p.address || `${p.prefecture || ''}${p.city || ''}${p.nearest_station ? p.nearest_station + '駅' : ''}`);
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(dest.join('|'))}&mode=${mode}&language=ja&key=${key}`;
    const res = await fetchImpl(url, { timeout: 15000 });
    const j = await res.json();
    if (j.status !== 'OK') throw new Error(`経路検索に失敗しました（${j.status}）`);
    j.rows[0].elements.forEach((el, k) => {
      if (el.status === 'OK') {
        const minutes = Math.round(el.duration.value / 60);
        getDb().prepare(`INSERT INTO commute_cache (seeker_id, posting_id, minutes, mode, source) VALUES (?,?,?,?, 'api')
          ON CONFLICT(seeker_id, posting_id) DO UPDATE SET minutes = excluded.minutes, mode = excluded.mode, source = 'api',
          updated_at = datetime('now','localtime') WHERE commute_cache.source <> 'manual'`).run(seeker.id, chunk[k].id, minutes, mode);
        results.push({ posting_id: chunk[k].id, minutes });
      }
    });
  }
  audit('commute_api', seeker.id, { origin_type: seeker.nearest_station ? 'station' : 'city', postings: postings.length });
  return results;
}

module.exports = { setManual, clear, estimateViaApi };

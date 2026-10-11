// 送迎ルート案。外部(Google Routes API)へ送るのは「住所文字列のみ」。氏名・電話は含めない。
const { decrypt } = require('./crypto');
const { maskedName } = require('./alerts');

const FACILITY = () => process.env.FACILITY_ADDRESS || '';
const MAX_RIDERS = 3;
const MAX_RIDE_MIN = Number(process.env.MAX_RIDE_MIN || 60);

function validate({ vehicle, driver, clients }) {
  const errors = [];
  if (!vehicle) errors.push('車両を指定してください');
  if (!driver) errors.push('運転手を指定してください');
  if (!clients.length) errors.push('利用者を1名以上選択してください');
  if (vehicle && clients.length > Math.min(MAX_RIDERS, vehicle.capacity)) errors.push(`同乗は最大${Math.min(MAX_RIDERS, vehicle.capacity)}名です`);
  if (vehicle && !vehicle.wheelchair && clients.some((c) => c.wheelchair)) errors.push('車椅子の利用者は車椅子対応車両（バネット等）を指定してください');
  return errors;
}

// 外部送信ペイロード（テストで氏名が含まれないことを検証する）
function buildExternalPayload(origin, stops, destination) {
  return {
    origin: { address: origin },
    destination: { address: destination },
    intermediates: stops.map((s) => ({ address: s.address })),
    travelMode: 'DRIVE', optimizeWaypointOrder: stops.length > 1,
  };
}

async function callGoogle(payload) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'routes.duration,routes.legs.duration,routes.optimizedIntermediateWaypointIndex' },
    body: JSON.stringify({ ...payload, languageCode: 'ja-JP' }),
  });
  if (!res.ok) throw new Error(`Routes API ${res.status}`);
  const j = await res.json();
  return j.routes && j.routes[0];
}

function mapsUrl(origin, stops, destination) {
  const q = new URLSearchParams({ api: '1', origin, destination, travelmode: 'driving' });
  if (stops.length) q.set('waypoints', stops.map((s) => s.address).join('|'));
  return `https://www.google.com/maps/dir/?${q}`;
}

async function planRoute({ kind, vehicle, driver, clients, fetchRoute = callGoogle }) {
  const errors = validate({ vehicle, driver, clients });
  const facility = FACILITY();
  const warnings = [];
  if (!facility) warnings.push('施設住所(FACILITY_ADDRESS)が未設定のためルート計算できません');
  if (errors.length) return { ok: false, errors, warnings };

  const stops = clients.map((c) => ({ client_id: c.id, label: maskedName(c), address: decrypt(c.address_enc), time: c.time }));
  if (stops.some((s) => !s.address)) warnings.push('住所が未登録の利用者がいます');
  const [origin, destination] = kind === '迎え' ? [stops[0].address, facility] : [facility, stops[stops.length - 1].address];
  // 迎え: 施設が終点。経由=最初の利用者以外。送り: 施設が起点。
  const mid = kind === '迎え' ? stops.slice(1) : stops.slice(0, -1);
  const payload = buildExternalPayload(origin, mid, destination);

  let route = null;
  if (facility && !stops.some((s) => !s.address)) {
    try { route = await fetchRoute(payload); }
    catch (e) { warnings.push(`ルート計算に失敗: ${e.message}。Googleマップで手動確認してください`); }
  }
  let totalMin = null;
  if (route) {
    totalMin = Math.round(parseInt(route.duration, 10) / 60);
    if (totalMin > MAX_RIDE_MIN) warnings.push(`所要時間が${totalMin}分です（目安${MAX_RIDE_MIN}分超）。同乗の見直しを検討してください`);
  } else if (!warnings.length) warnings.push('GOOGLE_MAPS_API_KEY未設定のため所要時間は未計算です。下のマップを開いて確認してください');
  if (clients.length > 1) {
    const times = clients.map((c) => c.time).sort();
    warnings.push(`同乗${clients.length}名: 希望時刻は ${times[0]}〜${times[times.length - 1]}。時間に無理がないか最終確認してください（アプリは候補提示のみ）`);
  }
  return { ok: true, kind, vehicle: vehicle.name, driver: driver.name,
    stops: stops.map((s) => ({ client_id: s.client_id, label: s.label, time: s.time })),
    total_minutes: totalMin, warnings, maps_url: mapsUrl(origin, mid, destination), external_payload_preview: payload };
}

module.exports = { planRoute, validate, buildExternalPayload, mapsUrl };

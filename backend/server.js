'use strict';

const express = require('express');
const session = require('express-session');
const path    = require('path');

const app = express();
app.use(express.json());

// DB初期化
const { initDb, seedAll } = require('./database/seed/index');
const db = initDb();
seedAll(db);
db.close();

// セッション（Cookie＋自前SQLiteストア）
const { SqliteSessionStore, cleanupExpiredSessions } = require('./database/sessionStore');
cleanupExpiredSessions();
app.use(session({
  store: new SqliteSessionStore(),
  secret: process.env.SESSION_SECRET || 'kaihatu-app-internal-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // 社内LAN/HTTP前提。HTTPS化する場合はtrueに切替
    maxAge: 8 * 60 * 60 * 1000, // 8時間
  },
}));

// 認証（/api/authと候補者向け適性検査結果送信のみ未認証で許可、以降のAPIはログイン必須）
const { requireAuth } = require('./middleware/auth');
app.use('/api/auth', require('./routes/auth'));
// aptitude-resultsは候補者が受検時に認証なしでPOSTする必要があるため、
// requireAuthより前でマウントする（GET/DELETEはルーター内で個別にrequireAuthを適用済み）
app.use('/api/aptitude-results', require('./routes/aptitudeResults'));
app.use('/api', requireAuth);

// Routes
app.use('/api/dashboard',    require('./routes/dashboard'));
app.use('/api/subsidies',    require('./routes/subsidies'));
app.use('/api/assessments',  require('./routes/assessments'));
app.use('/api',              require('./routes/files'));
app.use('/api/notifications',require('./routes/notifications'));
app.use('/api/monthly',      require('./routes/monthly'));
app.use('/api/law-alerts',   require('./routes/lawAlerts'));
app.use('/api/deductions',   require('./routes/deductions'));
app.use('/api/settings',     require('./routes/settings'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/workers',      require('./routes/workers'));
app.use('/api/residence-alerts', require('./routes/residenceAlerts'));

// 適性検査ツール（静的配信）
app.use('/aptitude-test', express.static(path.join(__dirname, '..', 'aptitude-test')));

// サービス種別一覧
const { getDb } = require('./database/db');
app.get('/api/service-types', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM service_types ORDER BY sort_order').all());
});

// スケジューラー起動
const { startScheduler } = require('./services/lawUpdateChecker');
const { startBackupScheduler } = require('./services/backup');
const { startScheduler: startResidenceAlertScheduler, checkAll: checkResidenceAlerts } = require('./services/residenceAlertChecker');
startScheduler();
startBackupScheduler();
startResidenceAlertScheduler();
checkResidenceAlerts(); // 起動時に一度即時チェック

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend started: http://localhost:${PORT}`);
});

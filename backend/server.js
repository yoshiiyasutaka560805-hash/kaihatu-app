'use strict';

const express = require('express');
const path    = require('path');

const app = express();
app.use(express.json());

// DB初期化
const { initDb, seedAll } = require('./database/seed/index');
const db = initDb();
seedAll(db);
db.close();

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
app.use('/api/aptitude-results', require('./routes/aptitudeResults'));

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
startScheduler();
startBackupScheduler();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend started: http://localhost:${PORT}`);
});

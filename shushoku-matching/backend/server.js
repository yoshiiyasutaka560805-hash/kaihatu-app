'use strict';

const express = require('express');
const path = require('path');
const { getDb } = require('./database/db');
const { startScheduler } = require('./services/scheduler');
const { securityMiddleware } = require('./middleware/security');
const { contextMiddleware } = require('./middleware/context');
const misc = require('./routes/misc');

function createApp() {
  getDb();
  const app = express();
  app.disable('x-powered-by');
  app.use(securityMiddleware);
  app.use(express.json({ limit: '1mb' }));
  app.use(contextMiddleware);

  app.use('/api/seekers',     require('./routes/seekers'));
  app.use('/api/matches',     require('./routes/matches'));
  app.use('/api/commute',     require('./routes/commute'));
  app.use('/api/placements',  require('./routes/placements'));
  app.use('/api/employers',   require('./routes/employers'));
  app.use('/api/postings',    require('./routes/postings'));
  app.use('/api/drafts',      require('./routes/drafts'));
  app.use('/api/intake',      require('./routes/intake'));
  app.use('/api/proposals',   misc.proposals);
  app.use('/api/tasks',       misc.tasks);
  app.use('/api/reports',     misc.reports);
  app.use('/api/complaints',  misc.complaints);
  app.use('/api/settings',    require('./routes/settings'));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // ビルド済みフロントエンド
  const dist = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (req, res, next) => res.sendFile(path.join(dist, 'index.html'), err => err && next()));

  // 共通エラーハンドラ（スタックトレースは返さない）
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || (err.type === 'entity.parse.failed' ? 400 : err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'サーバーエラーが発生しました' : err.message, ...(err.guard ? { guard: err.guard } : {}) });
  });
  return app;
}

if (require.main === module) {
  const app = createApp();
  startScheduler();
  // 求職者の個人情報を扱うため、既定でローカルホストのみで待ち受ける
  const PORT = process.env.PORT || 3101;
  const HOST = process.env.HOST || '127.0.0.1';
  app.listen(PORT, HOST, () => console.log(`求職者マッチング: http://${HOST}:${PORT}`));
}

module.exports = { createApp };

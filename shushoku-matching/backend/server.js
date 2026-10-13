'use strict';

const express = require('express');
const path = require('path');
const { getDb } = require('./database/db');
const { startScheduler } = require('./services/scheduler');

getDb();

const app = express();
app.use(express.json({ limit: '2mb' }));

app.use('/api/seekers',  require('./routes/seekers'));
app.use('/api/matches',  require('./routes/matches'));
app.use('/api/postings', require('./routes/postings'));
app.use('/api/settings', require('./routes/settings'));

// ビルド済みフロントエンド（npm run build 後）
const dist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(dist));
app.get(/^\/(?!api\/).*/, (req, res, next) => res.sendFile(path.join(dist, 'index.html'), err => err && next()));

startScheduler();

// 求職者の個人情報を扱うため、既定でローカルホストのみで待ち受ける
const PORT = process.env.PORT || 3101;
const HOST = process.env.HOST || '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`求職者マッチング backend: http://${HOST}:${PORT}`);
});

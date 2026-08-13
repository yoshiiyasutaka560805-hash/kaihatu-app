'use strict';

const bcrypt = require('bcryptjs');

const INITIAL_ADMIN_USERNAME = 'admin';
const INITIAL_ADMIN_PASSWORD = 'ChangeMe123!';

function seed(db) {
  const existing = db.prepare('SELECT id FROM users').get();
  if (existing) return;

  const hash = bcrypt.hashSync(INITIAL_ADMIN_PASSWORD, 10);
  db.prepare(`
    INSERT INTO users (username, display_name, role, password_hash, must_change_password)
    VALUES (?, '管理者', 'admin', ?, 1)
  `).run(INITIAL_ADMIN_USERNAME, hash);

  console.log(`初期管理者ユーザーを作成しました。username: ${INITIAL_ADMIN_USERNAME} / password: ${INITIAL_ADMIN_PASSWORD}（初回ログイン時に変更が必要です）`);
}

module.exports = { seed };

'use strict';

const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../..', 'data', 'kaihatu.db');
const SCHEMA_PATH = path.join(__dirname, '..', 'schema.sql');

function initDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);

  return db;
}

function seedAll(db) {
  const { seed: seedServiceTypes } = require('./service_types');
  const { seed: seedSubsidies }    = require('./subsidies');
  const { seed: seedRequirements } = require('./requirement_items');
  const { seed: seedEvidence }     = require('./evidence_templates');
  const { seed: seedFacility }     = require('./facility_settings');
  const { seed: seedLawSources }   = require('./law_update_sources');
  const { seed: seedAssessments }  = require('./initial_assessments');

  db.transaction(() => {
    seedServiceTypes(db);
    seedSubsidies(db);
    seedRequirements(db);
    seedEvidence(db);
    seedFacility(db);
    seedLawSources(db);
    seedAssessments(db);
  })();
}

if (require.main === module) {
  console.log('DB初期化を開始します...');
  const db = initDb();
  seedAll(db);
  db.close();
  console.log('完了しました。');
}

module.exports = { initDb, seedAll };

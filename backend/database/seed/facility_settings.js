'use strict';

const DEFAULTS = [
  { key: 'facility_name',   value: '特別養護老人ホーム' },
  { key: 'facility_code',   value: '' },
  { key: 'operator_name',   value: '' },
  { key: 'address',         value: '' },
  { key: 'print_author',    value: '施設長' },
];

function seed(db) {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO facility_settings (key, value) VALUES (?,?)'
  );
  for (const s of DEFAULTS) {
    insert.run(s.key, s.value);
  }
  console.log(`facility_settings: ${DEFAULTS.length}件`);
}

module.exports = { seed };

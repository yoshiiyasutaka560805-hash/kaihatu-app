'use strict';

const SERVICE_TYPES = [
  { id: 1, code: 'unit',          name_ja: 'ユニット型特養',    sort_order: 1 },
  { id: 2, code: 'traditional',   name_ja: '従来型特養',        sort_order: 2 },
  { id: 3, code: 'shortterm',     name_ja: 'ショートステイ',     sort_order: 3 },
  { id: 4, code: 'shortterm_prev',name_ja: 'ショートステイ予防', sort_order: 4 },
];

function seed(db) {
  const insert = db.prepare(
    'INSERT OR REPLACE INTO service_types (id, code, name_ja, sort_order) VALUES (?,?,?,?)'
  );
  for (const t of SERVICE_TYPES) {
    insert.run(t.id, t.code, t.name_ja, t.sort_order);
  }
  console.log(`service_types: ${SERVICE_TYPES.length}件`);
}

module.exports = { seed, SERVICE_TYPES };

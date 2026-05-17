'use strict';

const SOURCES = [
  {
    id: 1,
    source_name: '厚生労働省 介護保険最新情報',
    source_url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/hukushi_kaigo/kaigo_koureisha/index.html',
    check_method: 'content_hash',
    last_known_value: null,
    is_active: 1,
  },
  {
    id: 2,
    source_name: 'WAM NET 介護保険情報',
    source_url: 'https://www.wam.go.jp/content/wamnet/pcpub/kaigo/',
    check_method: 'content_hash',
    last_known_value: null,
    is_active: 1,
  },
  {
    id: 3,
    source_name: '東京都 体制届様式',
    source_url: 'https://www.fukushi.metro.tokyo.lg.jp/kourei/jigyousha/kaigohoken/index.html',
    check_method: 'content_hash',
    last_known_value: null,
    is_active: 1,
  },
];

function seed(db) {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO law_update_sources
      (id, source_name, source_url, check_method, last_known_value, is_active)
    VALUES (?,?,?,?,?,?)
  `);
  for (const s of SOURCES) {
    insert.run(s.id, s.source_name, s.source_url, s.check_method, s.last_known_value, s.is_active);
  }
  console.log(`law_update_sources: ${SOURCES.length}件`);
}

module.exports = { seed };

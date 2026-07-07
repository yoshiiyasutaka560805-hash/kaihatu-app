'use strict';

/**
 * admin.js - HR administrator view: list / detail / delete of saved aptitude results.
 * Served by the kaihatu-app backend at /aptitude-test/admin.html and talks to
 * /api/aptitude-results. Do not show this page to candidates.
 */
(function () {
  var appEl = document.getElementById('app');

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function bi(strObj, tag) {
    tag = tag || 'span';
    var el = document.createElement(tag);
    el.className = 'bi';
    var ja = document.createElement('span');
    ja.className = 'lang-ja';
    ja.textContent = strObj.ja;
    var en = document.createElement('span');
    en.className = 'lang-en';
    en.textContent = strObj.en;
    el.appendChild(ja);
    el.appendChild(en);
    return el;
  }

  function api(path, options) {
    return fetch('/api/aptitude-results' + path, options).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (err) {
          throw new Error(err.error || ('HTTP ' + res.status));
        });
      }
      return res.json();
    });
  }

  function formatDuration(seconds) {
    if (seconds === null || seconds === undefined) return '-';
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return m + '分' + String(s).padStart(2, '0') + '秒 / ' + m + 'm ' + String(s).padStart(2, '0') + 's';
  }

  function disclaimerBlock() {
    var d = document.createElement('div');
    d.className = 'disclaimer';
    d.appendChild(bi(STRINGS.resultsDisclaimer, 'p'));
    return d;
  }

  // ---------------- List view ----------------
  function renderList() {
    clear(appEl);
    var screen = document.createElement('div');
    screen.className = 'screen';

    var h1 = document.createElement('h1');
    h1.appendChild(bi({ ja: '適性検査 結果管理', en: 'Aptitude Screening Results Admin' }));
    screen.appendChild(h1);

    screen.appendChild(disclaimerBlock());

    var loading = document.createElement('p');
    loading.appendChild(bi({ ja: '読み込み中...', en: 'Loading...' }));
    screen.appendChild(loading);
    appEl.appendChild(screen);

    api('').then(function (rows) {
      screen.removeChild(loading);

      if (rows.length === 0) {
        var empty = document.createElement('p');
        empty.appendChild(bi({ ja: '保存された結果はまだありません。', en: 'No results have been saved yet.' }));
        screen.appendChild(empty);
        return;
      }

      var table = document.createElement('table');
      table.className = 'breakdown-table admin-table';
      var thead = document.createElement('thead');
      thead.innerHTML =
        '<tr><th>実施日 / Date</th><th>候補者名 / Candidate</th>' +
        '<th>スコア / Score</th><th>登録日時 / Recorded</th><th></th></tr>';
      table.appendChild(thead);

      var tbody = document.createElement('tbody');
      rows.forEach(function (row) {
        var tr = document.createElement('tr');
        tr.className = 'admin-row';

        var tdDate = document.createElement('td');
        tdDate.textContent = row.test_date;
        var tdName = document.createElement('td');
        tdName.textContent = row.candidate_name;
        var tdScore = document.createElement('td');
        tdScore.textContent = row.correct_count + ' / ' + row.total_questions + '（' + row.percentage + '%）';
        var tdCreated = document.createElement('td');
        tdCreated.textContent = row.created_at;

        var tdActions = document.createElement('td');
        tdActions.className = 'admin-actions';
        var detailBtn = document.createElement('button');
        detailBtn.type = 'button';
        detailBtn.className = 'secondary-btn admin-btn';
        detailBtn.textContent = '詳細 / Detail';
        detailBtn.addEventListener('click', function () { renderDetail(row.id); });
        tdActions.appendChild(detailBtn);

        var deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'secondary-btn admin-btn admin-delete';
        deleteBtn.textContent = '削除 / Delete';
        deleteBtn.addEventListener('click', function () {
          if (!window.confirm('この結果を削除しますか？この操作は取り消せません。\nDelete this result? This cannot be undone.')) return;
          api('/' + row.id, { method: 'DELETE' })
            .then(renderList)
            .catch(function (err) { window.alert('削除に失敗しました / Delete failed: ' + err.message); });
        });
        tdActions.appendChild(deleteBtn);

        tr.appendChild(tdDate);
        tr.appendChild(tdName);
        tr.appendChild(tdScore);
        tr.appendChild(tdCreated);
        tr.appendChild(tdActions);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      screen.appendChild(table);
    }).catch(function (err) {
      screen.removeChild(loading);
      var errEl = document.createElement('p');
      errEl.className = 'unanswered-warning';
      errEl.textContent = '結果を取得できませんでした / Could not load results: ' + err.message;
      screen.appendChild(errEl);
    });
  }

  // ---------------- Detail view ----------------
  function renderDetail(id) {
    clear(appEl);
    var screen = document.createElement('div');
    screen.className = 'screen results-screen';

    var loading = document.createElement('p');
    loading.appendChild(bi({ ja: '読み込み中...', en: 'Loading...' }));
    screen.appendChild(loading);
    appEl.appendChild(screen);

    api('/' + id).then(function (row) {
      screen.removeChild(loading);

      var printHeader = document.createElement('div');
      printHeader.className = 'print-only print-header';
      printHeader.textContent = 'Aptitude Screening Result / 適性検査結果 -- ' + new Date().toLocaleDateString();
      screen.appendChild(printHeader);

      var h1 = document.createElement('h1');
      h1.appendChild(bi({ ja: '結果詳細', en: 'Result Detail' }));
      screen.appendChild(h1);

      var meta = document.createElement('table');
      meta.className = 'breakdown-table';
      var metaRows = [
        ['候補者名 / Candidate', row.candidate_name],
        ['実施日 / Test Date', row.test_date],
        ['登録日時 / Recorded', row.created_at],
        ['所要時間 / Duration', formatDuration(row.duration_seconds)],
        ['制限時間 / Time Limit', row.timer_enabled ? 'あり（25分）/ Yes (25 min)' : 'なし / No'],
        ['総合スコア / Overall', row.correct_count + ' / ' + row.total_questions + '（' + row.percentage + '%）'],
      ];
      var metaBody = document.createElement('tbody');
      metaRows.forEach(function (pair) {
        var tr = document.createElement('tr');
        var th = document.createElement('th');
        th.textContent = pair[0];
        var td = document.createElement('td');
        td.textContent = pair[1];
        tr.appendChild(th);
        tr.appendChild(td);
        metaBody.appendChild(tr);
      });
      meta.appendChild(metaBody);
      screen.appendChild(meta);

      var h2 = document.createElement('h2');
      h2.appendChild(bi({ ja: 'カテゴリ別内訳', en: 'Category Breakdown' }));
      screen.appendChild(h2);

      var table = document.createElement('table');
      table.className = 'breakdown-table';
      var thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>カテゴリ / Category</th><th>正答数 / Correct</th><th>正答率 / %</th><th></th></tr>';
      table.appendChild(thead);
      var tbody = document.createElement('tbody');
      Object.keys(CATEGORIES).forEach(function (catKey) {
        var stat = row.category_breakdown[catKey];
        if (!stat) return;
        var catPct = stat.total ? Math.round((stat.correct / stat.total) * 100) : 0;
        var tr = document.createElement('tr');
        var tdLabel = document.createElement('td');
        tdLabel.appendChild(bi(CATEGORIES[catKey].label));
        var tdCorrect = document.createElement('td');
        tdCorrect.textContent = stat.correct + ' / ' + stat.total;
        var tdPct = document.createElement('td');
        tdPct.textContent = catPct + '%';
        var tdBar = document.createElement('td');
        var barOuter = document.createElement('div');
        barOuter.className = 'bar-outer';
        var barInner = document.createElement('div');
        barInner.className = 'bar-inner';
        barInner.style.width = catPct + '%';
        barOuter.appendChild(barInner);
        tdBar.appendChild(barOuter);
        tr.appendChild(tdLabel);
        tr.appendChild(tdCorrect);
        tr.appendChild(tdPct);
        tr.appendChild(tdBar);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      screen.appendChild(table);

      screen.appendChild(disclaimerBlock());

      var printFooter = document.createElement('div');
      printFooter.className = 'print-only print-footer';
      printFooter.appendChild(bi(STRINGS.printFooter));
      screen.appendChild(printFooter);

      var actions = document.createElement('div');
      actions.className = 'nav-row no-print';

      var backBtn = document.createElement('button');
      backBtn.type = 'button';
      backBtn.className = 'secondary-btn';
      backBtn.appendChild(bi({ ja: '一覧に戻る', en: 'Back to List' }));
      backBtn.addEventListener('click', renderList);
      actions.appendChild(backBtn);

      var printBtn = document.createElement('button');
      printBtn.type = 'button';
      printBtn.className = 'primary-btn';
      printBtn.appendChild(bi({ ja: '印刷して保存', en: 'Print / Save' }));
      printBtn.addEventListener('click', function () { window.print(); });
      actions.appendChild(printBtn);

      screen.appendChild(actions);
    }).catch(function (err) {
      screen.removeChild(loading);
      var errEl = document.createElement('p');
      errEl.className = 'unanswered-warning';
      errEl.textContent = '結果を取得できませんでした / Could not load result: ' + err.message;
      screen.appendChild(errEl);
      var backBtn = document.createElement('button');
      backBtn.type = 'button';
      backBtn.className = 'secondary-btn';
      backBtn.appendChild(bi({ ja: '一覧に戻る', en: 'Back to List' }));
      backBtn.addEventListener('click', renderList);
      screen.appendChild(backBtn);
    });
  }

  document.addEventListener('DOMContentLoaded', renderList);
})();

'use strict';

(function () {
  var appEl = document.getElementById('app');

  var state = {
    screen: 'start',
    candidateName: '',
    testDate: todayISO(),
    timerEnabled: true,
    timeLimitMinutes: 25,
    remainingSeconds: null,
    timerHandle: null,
    currentIndex: 0,
    answers: {},
    order: QUESTIONS.slice(),
  };

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

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

  function makeCellButton(shapeSet, size, onClick, ariaLabel) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'option-btn';
    btn.setAttribute('aria-label', ariaLabel || '');
    Shapes.renderCell(btn, shapeSet, size);
    if (onClick) btn.addEventListener('click', onClick);
    return btn;
  }

  // ---------------- Practice examples (start screen only, not scored, distinct from real items) ----------------
  function s(type, color, fill, size, rotation) {
    return { type: type, color: color, fill: fill || 'solid', size: size || 'md', rotation: rotation || 0 };
  }

  function buildPracticePreview(category) {
    var wrap = document.createElement('div');
    wrap.className = 'practice-preview';
    var cells = [];
    switch (category) {
      case 'matrix':
        cells = [[s('diamond', 'slate', 'solid', 'md', 0)], [s('diamond', 'slate', 'solid', 'md', 90)], null];
        break;
      case 'sequence':
        cells = [[s('star', 'slate', 'solid', 'sm')], [s('star', 'slate', 'solid', 'sm'), s('star', 'slate', 'solid', 'sm')], null];
        break;
      case 'oddOneOut':
        cells = [[s('cross', 'teal', 'solid', 'md')], [s('cross', 'teal', 'solid', 'md')], [s('cross', 'amber', 'solid', 'md')], [s('cross', 'teal', 'solid', 'md')]];
        break;
      case 'analogy':
        cells = [[s('star', 'teal', 'solid', 'md')], [s('star', 'plum', 'solid', 'md')], [s('diamond', 'navy', 'solid', 'md')], null];
        break;
    }
    cells.forEach(function (c, i) {
      var cell = document.createElement('div');
      cell.className = 'practice-cell';
      if (c) Shapes.renderCell(cell, c, 44); else Shapes.renderBlank(cell, 44);
      wrap.appendChild(cell);
      if (category === 'analogy' && i === 1) {
        var sep = document.createElement('span');
        sep.className = 'practice-sep';
        sep.textContent = '::';
        wrap.appendChild(sep);
      }
    });
    return wrap;
  }

  // ---------------- Screen: start ----------------
  function renderStart() {
    clear(appEl);
    var screen = document.createElement('div');
    screen.className = 'screen start-screen';

    var h1 = document.createElement('h1');
    h1.appendChild(bi(STRINGS.appTitle));
    screen.appendChild(h1);

    var disclaimer = document.createElement('div');
    disclaimer.className = 'disclaimer';
    disclaimer.appendChild(bi(STRINGS.introDisclaimer, 'p'));
    screen.appendChild(disclaimer);

    var form = document.createElement('div');
    form.className = 'start-form';

    var nameLabel = document.createElement('label');
    nameLabel.appendChild(bi({ ja: '候補者名', en: 'Candidate Name' }));
    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'candidateName';
    nameInput.value = state.candidateName;
    nameLabel.appendChild(nameInput);
    form.appendChild(nameLabel);

    var dateLabel = document.createElement('label');
    dateLabel.appendChild(bi({ ja: '実施日', en: 'Test Date' }));
    var dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.id = 'testDate';
    dateInput.value = state.testDate;
    dateLabel.appendChild(dateInput);
    form.appendChild(dateLabel);

    var timerLabel = document.createElement('label');
    timerLabel.className = 'timer-toggle';
    var timerCheckbox = document.createElement('input');
    timerCheckbox.type = 'checkbox';
    timerCheckbox.id = 'timerEnabled';
    timerCheckbox.checked = state.timerEnabled;
    timerLabel.appendChild(timerCheckbox);
    timerLabel.appendChild(bi({ ja: '制限時間を設定する（25分）', en: 'Enable time limit (25 min)' }));
    form.appendChild(timerLabel);

    screen.appendChild(form);

    var examplesHeading = document.createElement('h2');
    examplesHeading.appendChild(bi({ ja: '設問の種類（例／採点されません）', en: 'Question Types (Examples -- not scored)' }));
    screen.appendChild(examplesHeading);

    var examplesWrap = document.createElement('div');
    examplesWrap.className = 'examples-wrap';
    Object.keys(CATEGORIES).forEach(function (catKey) {
      var cat = CATEGORIES[catKey];
      var card = document.createElement('div');
      card.className = 'example-card';
      var label = document.createElement('h3');
      label.appendChild(bi(cat.label));
      card.appendChild(label);
      var instr = document.createElement('p');
      instr.appendChild(bi(cat.instructions));
      card.appendChild(instr);
      card.appendChild(buildPracticePreview(catKey));
      examplesWrap.appendChild(card);
    });
    screen.appendChild(examplesWrap);

    var startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.className = 'primary-btn no-print';
    startBtn.appendChild(bi({ ja: '開始する', en: 'Begin' }));
    startBtn.disabled = !nameInput.value.trim();
    nameInput.addEventListener('input', function () {
      startBtn.disabled = !nameInput.value.trim();
    });
    startBtn.addEventListener('click', function () {
      state.candidateName = nameInput.value.trim();
      state.testDate = dateInput.value || todayISO();
      state.timerEnabled = timerCheckbox.checked;
      state.currentIndex = 0;
      state.answers = {};
      if (state.timerEnabled) {
        state.remainingSeconds = state.timeLimitMinutes * 60;
        startTimer();
      }
      goQuestion(0);
    });
    screen.appendChild(startBtn);

    appEl.appendChild(screen);
  }

  // ---------------- Timer ----------------
  function startTimer() {
    stopTimer();
    state.timerHandle = setInterval(function () {
      state.remainingSeconds -= 1;
      var timerEl = document.getElementById('timerDisplay');
      if (timerEl) timerEl.textContent = formatTime(state.remainingSeconds);
      if (state.remainingSeconds <= 0) {
        stopTimer();
        goResults();
      }
    }, 1000);
  }
  function stopTimer() {
    if (state.timerHandle) {
      clearInterval(state.timerHandle);
      state.timerHandle = null;
    }
  }
  function formatTime(totalSeconds) {
    var s = Math.max(0, totalSeconds);
    var m = Math.floor(s / 60);
    var sec = s % 60;
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }

  // ---------------- Screen: question ----------------
  function goQuestion(index) {
    state.currentIndex = index;
    state.screen = 'question';
    renderQuestion();
  }

  function renderQuestion() {
    clear(appEl);
    var item = state.order[state.currentIndex];
    var cat = CATEGORIES[item.category];

    var screen = document.createElement('div');
    screen.className = 'screen question-screen';

    var header = document.createElement('div');
    header.className = 'question-header no-print';
    var progressText = document.createElement('span');
    progressText.className = 'progress-text';
    progressText.textContent = '質問 ' + (state.currentIndex + 1) + ' / ' + state.order.length +
      ' -- Question ' + (state.currentIndex + 1) + ' of ' + state.order.length;
    header.appendChild(progressText);

    if (state.timerEnabled) {
      var timerDisplay = document.createElement('span');
      timerDisplay.id = 'timerDisplay';
      timerDisplay.className = 'timer-display';
      timerDisplay.textContent = formatTime(state.remainingSeconds);
      header.appendChild(timerDisplay);
    }
    screen.appendChild(header);

    var progressBar = document.createElement('div');
    progressBar.className = 'progress-bar no-print';
    var progressFill = document.createElement('div');
    progressFill.className = 'progress-fill';
    progressFill.style.width = Math.round(((state.currentIndex) / state.order.length) * 100) + '%';
    progressBar.appendChild(progressFill);
    screen.appendChild(progressBar);

    var catLabel = document.createElement('div');
    catLabel.className = 'category-label';
    catLabel.appendChild(bi(cat.label));
    screen.appendChild(catLabel);

    var instr = document.createElement('p');
    instr.className = 'instructions';
    instr.appendChild(bi(cat.instructions));
    screen.appendChild(instr);

    var stimulusArea = document.createElement('div');
    stimulusArea.className = 'stimulus-area';
    screen.appendChild(stimulusArea);

    var optionsArea = document.createElement('div');
    optionsArea.className = 'options-area';
    screen.appendChild(optionsArea);

    var selectedIndex = state.answers[item.id];

    function markSelection(idx) {
      state.answers[item.id] = idx;
      nextBtn.disabled = false;
      Array.prototype.forEach.call(optionsArea.querySelectorAll('.option-btn'), function (b, i) {
        b.classList.toggle('selected', i === idx);
      });
      if (item.category === 'oddOneOut') {
        Array.prototype.forEach.call(stimulusArea.querySelectorAll('.option-btn'), function (b, i) {
          b.classList.toggle('selected', i === idx);
        });
      }
    }

    if (item.category === 'matrix') {
      var grid = document.createElement('div');
      grid.className = 'matrix-grid';
      item.grid.forEach(function (cellSet) {
        var cell = document.createElement('div');
        cell.className = 'matrix-cell';
        if (cellSet) Shapes.renderCell(cell, cellSet, 64); else Shapes.renderBlank(cell, 64);
        grid.appendChild(cell);
      });
      stimulusArea.appendChild(grid);
      item.options.forEach(function (opt, i) {
        optionsArea.appendChild(makeCellButton(opt, 64, function () { markSelection(i); }, '選択肢' + (i + 1) + ' / Option ' + (i + 1)));
      });
    } else if (item.category === 'sequence') {
      var row = document.createElement('div');
      row.className = 'sequence-row';
      item.sequence.forEach(function (cellSet) {
        var cell = document.createElement('div');
        cell.className = 'sequence-cell';
        Shapes.renderCell(cell, cellSet, 60);
        row.appendChild(cell);
      });
      var blankCell = document.createElement('div');
      blankCell.className = 'sequence-cell';
      Shapes.renderBlank(blankCell, 60);
      row.appendChild(blankCell);
      stimulusArea.appendChild(row);
      item.options.forEach(function (opt, i) {
        optionsArea.appendChild(makeCellButton(opt, 60, function () { markSelection(i); }, '選択肢' + (i + 1) + ' / Option ' + (i + 1)));
      });
    } else if (item.category === 'oddOneOut') {
      var oRow = document.createElement('div');
      oRow.className = 'odd-row';
      item.items.forEach(function (shapeSet, i) {
        var btn = makeCellButton(shapeSet, 60, function () { markSelection(i); }, '図形' + (i + 1) + ' / Shape ' + (i + 1));
        oRow.appendChild(btn);
      });
      stimulusArea.appendChild(oRow);
    } else if (item.category === 'analogy') {
      var aRow = document.createElement('div');
      aRow.className = 'analogy-row';
      var partA = document.createElement('div'); partA.className = 'analogy-cell';
      Shapes.renderCell(partA, item.analogy.a, 56);
      var arrow1 = document.createElement('span'); arrow1.className = 'analogy-arrow'; arrow1.textContent = '→';
      var partB = document.createElement('div'); partB.className = 'analogy-cell';
      Shapes.renderCell(partB, item.analogy.b, 56);
      var sep = document.createElement('span'); sep.className = 'analogy-sep'; sep.textContent = '::';
      var partC = document.createElement('div'); partC.className = 'analogy-cell';
      Shapes.renderCell(partC, item.analogy.c, 56);
      var arrow2 = document.createElement('span'); arrow2.className = 'analogy-arrow'; arrow2.textContent = '→';
      var partD = document.createElement('div'); partD.className = 'analogy-cell';
      Shapes.renderBlank(partD, 56);
      [partA, arrow1, partB, sep, partC, arrow2, partD].forEach(function (n) { aRow.appendChild(n); });
      stimulusArea.appendChild(aRow);
      item.options.forEach(function (opt, i) {
        optionsArea.appendChild(makeCellButton(opt, 56, function () { markSelection(i); }, '選択肢' + (i + 1) + ' / Option ' + (i + 1)));
      });
    }

    if (typeof selectedIndex === 'number') markSelection(selectedIndex);

    var nav = document.createElement('div');
    nav.className = 'nav-row no-print';
    var backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'secondary-btn';
    backBtn.appendChild(bi({ ja: '戻る', en: 'Back' }));
    backBtn.disabled = state.currentIndex === 0;
    backBtn.addEventListener('click', function () { goQuestion(state.currentIndex - 1); });
    nav.appendChild(backBtn);

    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'primary-btn';
    nextBtn.appendChild(bi(state.currentIndex === state.order.length - 1 ? { ja: 'レビューへ', en: 'Review' } : { ja: '次へ', en: 'Next' }));
    nextBtn.disabled = typeof state.answers[item.id] !== 'number';
    nextBtn.addEventListener('click', function () {
      if (state.currentIndex === state.order.length - 1) {
        goReview();
      } else {
        goQuestion(state.currentIndex + 1);
      }
    });
    nav.appendChild(nextBtn);
    screen.appendChild(nav);

    appEl.appendChild(screen);
  }

  // ---------------- Screen: review ----------------
  function goReview() {
    state.screen = 'review';
    renderReview();
  }

  function renderReview() {
    clear(appEl);
    var screen = document.createElement('div');
    screen.className = 'screen review-screen no-print';

    var h2 = document.createElement('h2');
    h2.appendChild(bi({ ja: '回答内容の確認', en: 'Review Your Answers' }));
    screen.appendChild(h2);

    var unanswered = state.order
      .map(function (q, i) { return { q: q, i: i }; })
      .filter(function (x) { return typeof state.answers[x.q.id] !== 'number'; });

    if (unanswered.length > 0) {
      var warn = document.createElement('div');
      warn.className = 'unanswered-warning';
      warn.appendChild(bi({
        ja: '未回答の質問があります: ',
        en: 'You have unanswered questions: ',
      }));
      unanswered.forEach(function (x) {
        var link = document.createElement('button');
        link.type = 'button';
        link.className = 'link-btn';
        link.textContent = '#' + (x.i + 1);
        link.addEventListener('click', function () { goQuestion(x.i); });
        warn.appendChild(link);
        warn.appendChild(document.createTextNode(' '));
      });
      screen.appendChild(warn);
    } else {
      var ok = document.createElement('p');
      ok.appendChild(bi({ ja: '全ての質問に回答しました。', en: 'All questions have been answered.' }));
      screen.appendChild(ok);
    }

    var submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'primary-btn';
    submitBtn.appendChild(bi({ ja: '採点する', en: 'Submit' }));
    submitBtn.addEventListener('click', function () {
      stopTimer();
      goResults();
    });
    screen.appendChild(submitBtn);

    appEl.appendChild(screen);
  }

  // ---------------- Scoring ----------------
  function computeScore() {
    var byCategory = {};
    Object.keys(CATEGORIES).forEach(function (c) { byCategory[c] = { correct: 0, total: 0 }; });
    var correct = 0;
    state.order.forEach(function (q) {
      byCategory[q.category].total += 1;
      if (state.answers[q.id] === q.correctIndex) {
        correct += 1;
        byCategory[q.category].correct += 1;
      }
    });
    return { correct: correct, total: state.order.length, byCategory: byCategory };
  }

  // ---------------- Screen: results ----------------
  function goResults() {
    state.screen = 'results';
    renderResults();
  }

  function renderResults() {
    clear(appEl);
    stopTimer();
    var score = computeScore();
    var pct = Math.round((score.correct / score.total) * 100);

    var screen = document.createElement('div');
    screen.className = 'screen results-screen';

    var printHeader = document.createElement('div');
    printHeader.className = 'print-only print-header';
    printHeader.textContent = 'Aptitude Screening Result / 適性検査結果 -- ' + new Date().toLocaleDateString();
    screen.appendChild(printHeader);

    var h1 = document.createElement('h1');
    h1.appendChild(bi({ ja: '結果', en: 'Results' }));
    screen.appendChild(h1);

    var meta = document.createElement('div');
    meta.className = 'results-meta';
    meta.innerHTML =
      '<div><strong>' + escapeHtml(state.candidateName) + '</strong></div>' +
      '<div>' + escapeHtml(state.testDate) + '</div>';
    screen.appendChild(meta);

    var overall = document.createElement('div');
    overall.className = 'overall-score';
    overall.appendChild(bi({
      ja: '総合正答数: ' + score.correct + ' / ' + score.total + '（' + pct + '%）',
      en: 'Overall score: ' + score.correct + ' / ' + score.total + ' (' + pct + '%)',
    }, 'p'));
    screen.appendChild(overall);

    var table = document.createElement('table');
    table.className = 'breakdown-table';
    var thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>カテゴリ / Category</th><th>正答数 / Correct</th><th>正答率 / %</th><th></th></tr>';
    table.appendChild(thead);
    var tbody = document.createElement('tbody');
    Object.keys(CATEGORIES).forEach(function (catKey) {
      var cat = CATEGORIES[catKey];
      var stat = score.byCategory[catKey];
      var catPct = stat.total ? Math.round((stat.correct / stat.total) * 100) : 0;
      var tr = document.createElement('tr');
      var tdLabel = document.createElement('td');
      tdLabel.appendChild(bi(cat.label));
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

    var disclaimer = document.createElement('div');
    disclaimer.className = 'disclaimer results-disclaimer';
    disclaimer.appendChild(bi(STRINGS.resultsDisclaimer, 'p'));
    screen.appendChild(disclaimer);

    var printFooter = document.createElement('div');
    printFooter.className = 'print-only print-footer';
    printFooter.appendChild(bi(STRINGS.printFooter));
    screen.appendChild(printFooter);

    var actions = document.createElement('div');
    actions.className = 'nav-row no-print';

    var printBtn = document.createElement('button');
    printBtn.type = 'button';
    printBtn.className = 'primary-btn';
    printBtn.appendChild(bi({ ja: '印刷して保存', en: 'Print / Save' }));
    printBtn.addEventListener('click', function () { window.print(); });
    actions.appendChild(printBtn);

    var newBtn = document.createElement('button');
    newBtn.type = 'button';
    newBtn.className = 'secondary-btn';
    newBtn.appendChild(bi({ ja: '新しいテストを開始', en: 'New Test' }));
    newBtn.addEventListener('click', function () {
      if (window.confirm('現在の結果は保存されません。新しいテストを開始しますか？\nCurrent results will not be saved. Start a new test?')) {
        resetState();
        renderStart();
      }
    });
    actions.appendChild(newBtn);

    screen.appendChild(actions);
    appEl.appendChild(screen);
  }

  function resetState() {
    stopTimer();
    state.candidateName = '';
    state.testDate = todayISO();
    state.timerEnabled = true;
    state.remainingSeconds = null;
    state.currentIndex = 0;
    state.answers = {};
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function init() {
    Shapes.injectDefs();
    renderStart();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

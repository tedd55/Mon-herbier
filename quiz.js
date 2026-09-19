(function () {
  const STORAGE_KEY = 'herbier_quiz_stats_v1';

  const quizArea = document.getElementById('quiz-area');
  const modeSelect = document.getElementById('mode-select');
  const groupSelect = document.getElementById('group-select');
  const srsToggle = document.getElementById('srs-mode');
  const resetBtn = document.getElementById('reset-stats');
  const scoreDisplay = document.getElementById('score-display');
  const statsPanel = document.getElementById('stats-panel');

  let session = { correct: 0, total: 0 };
  let current = null; // {sp, options, correctIndex, mode}

  // ---- Pool: species usable for quiz ----
  function pool() {
    const g = groupSelect.value;
    return SPECIES.filter(sp => {
      if (!sp.images || sp.images.length === 0) return false;
      if (sp.common_name_fr === null && modeSelect.value === 'common') return false;
      if (sp.path.length === 0) return false;
      if (g && (sp.path[0] || '') !== g) return false;
      return true;
    });
  }

  const groups = Array.from(new Set(SPECIES.filter(s => s.images.length).map(s => s.path[0] || 'Autre'))).sort();
  for (const g of groups) {
    const opt = document.createElement('option');
    opt.value = g; opt.textContent = g;
    groupSelect.appendChild(opt);
  }

  // ---- Stats (spaced-repetition-lite) ----
  function loadStats() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveStats(stats) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); } catch (e) {}
  }
  function statFor(stats, code) {
    return stats[code] || { seen: 0, correct: 0, wrong: 0 };
  }

  function pickWeighted(candidates, stats) {
    if (!srsToggle.checked) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    // weight = higher for unseen and for wrong-heavy cards
    const weights = candidates.map(sp => {
      const st = statFor(stats, sp.code);
      if (st.seen === 0) return 5;
      const errRate = st.wrong / Math.max(1, st.seen);
      return 1 + errRate * 6;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < candidates.length; i++) {
      r -= weights[i];
      if (r <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }

  function labelFor(sp, mode) {
    if (mode === 'latin') return sp.latin_name;
    if (mode === 'common') return sp.common_name_fr || sp.latin_name;
    if (mode === 'family') return sp.path[sp.path.length - 1] || '(famille inconnue)';
    return sp.latin_name;
  }

  function buildQuestion() {
    const mode = modeSelect.value;
    const candidates = pool();
    if (candidates.length < 4) {
      quizArea.innerHTML = `<div class="empty-state quiz-empty">Pas assez de planches avec photo dans ce filtre pour composer un quiz (minimum 4 nécessaires). Élargis le groupe.</div>`;
      current = null;
      return;
    }
    const stats = loadStats();
    const sp = pickWeighted(candidates, stats);
    const correctLabel = labelFor(sp, mode);

    // distractors: prefer same top-level group, distinct labels
    let sameGroup = candidates.filter(c => c.code !== sp.code && (c.path[0] || '') === (sp.path[0] || ''));
    let others = candidates.filter(c => c.code !== sp.code && !sameGroup.includes(c));
    const labelSet = new Set([correctLabel]);
    const distractorPool = [...shuffle(sameGroup), ...shuffle(others)];
    const distractors = [];
    for (const c of distractorPool) {
      const l = labelFor(c, mode);
      if (labelSet.has(l)) continue;
      labelSet.add(l);
      distractors.push(l);
      if (distractors.length === 3) break;
    }
    while (distractors.length < 3) {
      // fallback: reuse any label to fill (rare, tiny pools)
      const c = candidates[Math.floor(Math.random() * candidates.length)];
      const l = labelFor(c, mode);
      if (!labelSet.has(l)) { labelSet.add(l); distractors.push(l); }
      else if (distractors.length < 3) { distractors.push(l + ' '); }
    }

    const options = shuffle([correctLabel, ...distractors]);
    const correctIndex = options.indexOf(correctLabel);
    const img = sp.images[Math.floor(Math.random() * sp.images.length)];

    current = { sp, options, correctIndex, mode, img };
    renderQuestion();
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function questionLabel(mode) {
    if (mode === 'latin') return 'Quel est le nom latin de cette plante ?';
    if (mode === 'common') return 'Quel est son nom commun ?';
    if (mode === 'family') return 'À quelle famille appartient-elle ?';
    return '';
  }

  function renderQuestion() {
    const { sp, options, img, mode } = current;
    quizArea.innerHTML = `
      <div class="quiz-question-label">${questionLabel(mode)}</div>
      <div class="quiz-photo-wrap"><img src="images/${img}" alt="Photo à identifier"></div>
      <div class="quiz-options">
        ${options.map((o, i) => `<button class="quiz-opt" data-i="${i}">${o}</button>`).join('')}
      </div>
      <div id="quiz-feedback"></div>
    `;
    quizArea.querySelectorAll('.quiz-opt').forEach(btn => {
      btn.addEventListener('click', () => answer(parseInt(btn.dataset.i, 10)));
    });
  }

  function answer(i) {
    if (!current) return;
    const { sp, correctIndex, mode } = current;
    const buttons = quizArea.querySelectorAll('.quiz-opt');
    buttons.forEach(b => b.disabled = true);
    const isCorrect = i === correctIndex;

    buttons[correctIndex].classList.add('correct');
    if (!isCorrect) buttons[i].classList.add('wrong');

    session.total++;
    if (isCorrect) session.correct++;
    scoreDisplay.textContent = `${session.correct} / ${session.total}`;

    const stats = loadStats();
    const st = statFor(stats, sp.code);
    st.seen++;
    if (isCorrect) st.correct++; else st.wrong++;
    stats[sp.code] = st;
    saveStats(stats);

    const feedback = document.getElementById('quiz-feedback');
    feedback.innerHTML = `
      <div class="quiz-feedback">
        <div class="verdict ${isCorrect ? 'ok' : 'bad'}">${isCorrect ? '✓ Bonne réponse' : '✗ Réponse : ' + labelFor(sp, mode)}</div>
        <div class="path">${sp.path.join(' → ')} — ${sp.latin_name}${sp.common_name_fr ? ' (' + sp.common_name_fr + ')' : ''}</div>
        <button class="btn primary" id="next-btn">Question suivante →</button>
      </div>
    `;
    document.getElementById('next-btn').addEventListener('click', buildQuestion);
    renderStatsPanel();
  }

  function renderStatsPanel() {
    const stats = loadStats();
    const codes = Object.keys(stats);
    if (codes.length === 0) { statsPanel.innerHTML = ''; return; }
    let seen = 0, correct = 0, mastered = 0;
    for (const c of codes) {
      seen += stats[c].seen;
      correct += stats[c].correct;
      if (stats[c].seen >= 2 && stats[c].wrong === 0) mastered++;
    }
    const rate = seen ? Math.round((correct / seen) * 100) : 0;
    statsPanel.innerHTML = `<b>${codes.length}</b> cartes travaillées · <b>${rate}%</b> de réussite cumulée · <b>${mastered}</b> maîtrisées`;
  }

  resetBtn.addEventListener('click', () => {
    if (confirm('Effacer toute la progression du quiz enregistrée sur ce navigateur ?')) {
      localStorage.removeItem(STORAGE_KEY);
      session = { correct: 0, total: 0 };
      scoreDisplay.textContent = '0 / 0';
      renderStatsPanel();
      buildQuestion();
    }
  });

  modeSelect.addEventListener('change', buildQuestion);
  groupSelect.addEventListener('change', buildQuestion);
  srsToggle.addEventListener('change', () => {});

  renderStatsPanel();
  buildQuestion();
})();

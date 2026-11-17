  /* ------------------------------------------------------------
     闯关
     ------------------------------------------------------------ */
  const quizModes = [
    ['mix', '混合闯关'], ['province', '地图找省份'],
    ['capital', '省会配对'], ['fact', '地理常识']
  ];
  const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);

  /* 错题本：答错的题记到本地，可以只考这些 */
  const WRONG_KEY = 'cn-geo:wrong:v1';
  const MAX_WRONG = 60;
  function wrongAll() {
    try {
      const raw = localStorage.getItem(WRONG_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((x) => x && x.k) : [];
    } catch (e) { return []; }
  }
  function wrongSave(list) {
    try { localStorage.setItem(WRONG_KEY, JSON.stringify(list.slice(0, MAX_WRONG))); } catch (e) {}
  }
  function wrongAdd(q) {
    if (!q || !q.key) return;
    const list = wrongAll();
    const i = list.findIndex((x) => x.k === q.key);
    const rec = {
      k: q.key, type: q.type, prompt: q.prompt, answer: q.answer || '',
      options: q.options ? [...q.options] : null, why: q.why || '',
      meta: q.meta || '', name: q.name || '',
      misses: i >= 0 ? (list[i].misses || 1) + 1 : 1, ts: Date.now()
    };
    if (i >= 0) list[i] = rec; else list.unshift(rec);
    wrongSave(list);
  }
  function wrongClear(key) {
    const list = wrongAll();
    const i = list.findIndex((x) => x.k === key);
    if (i < 0) return false;
    list.splice(i, 1);
    wrongSave(list);
    return true;
  }
  function wrongCount() { return wrongAll().length; }
  function wrongQuestions() {
    return wrongAll().map((r) => (r.type === 'click'
      ? { type: 'click', key: r.k, name: r.name, label: (PROV_BY_NAME[r.name] || {}).label || '', prompt: `在地图上找到：${r.name}` }
      : { type: 'choice', key: r.k, prompt: r.prompt, answer: r.answer, options: shuffle(r.options && r.options.length ? r.options : [r.answer]), meta: r.meta || '错题', why: r.why || '', name: r.name }));
  }

  function buildQuiz(mode) {
    const qs = [];
    const provs = shuffle(C.provinces.filter((p) => p.pop > 0));
    const clickQs = provs.slice(0, 10).map((p) => ({ type: 'click', key: 'click:' + p.name, name: p.name, label: p.label, prompt: `在地图上找到：${p.name}` }));
    const capQs = shuffle(C.provinces.filter((p) => p.capital !== '—')).slice(0, 10).map((p) => {
      const others = shuffle(C.provinces.filter((x) => x.capital !== '—' && x.capital !== p.capital)).slice(0, 3);
      const options = shuffle([p.capital, ...others.map((o) => o.capital)]);
      return { type: 'choice', key: 'cap:' + p.name, prompt: `${p.name} 的${MUNI.has(p.name) ? '驻地' : '省会'}是？`, answer: p.capital, options, meta: '省会配对', name: p.name };
    });
    const factQs = shuffle(C.facts).slice(0, 10).map((f) => {
      const options = shuffle([f.a, ...f.options]);
      return { type: 'choice', key: 'fact:' + f.q, prompt: f.q, answer: f.a, options, meta: f.tag, why: f.why || '' };
    });
    if (mode === 'wrong') return wrongQuestions();
    if (mode === 'province') return clickQs;
    if (mode === 'capital') return capQs;
    if (mode === 'fact') return factQs;
    return shuffle([...shuffle(clickQs).slice(0, 4), ...shuffle(capQs).slice(0, 3), ...factQs.slice(0, 3)]);
  }

  function startQuiz(mode) {
    if (mode === 'wrong' && !wrongCount()) return;
    state.quiz = {
      mode, qs: buildQuiz(mode).slice(0, 10), i: 0, score: 0,
      answers: [], answered: false, picked: null, startAt: Date.now(), active: true
    };
    state.quizMarks = {};
    state.selected = null;
    state.layers.labels = false;
    state.fill = 'region';
    syncControls();
    renderQuiz();
    requestDraw();
  }

  function currentQ() {
    const q = state.quiz;
    return q && q.qs[q.i];
  }

  function renderQuiz() {
    const q = state.quiz;
    const wn = wrongCount();
    if (!q) {
      panel.innerHTML = `
        <div class="eyebrow">闯关 · 检验一下</div>
        <h2>十道题，走一遍中国</h2>
        <p class="lead">四种玩法：在地图上找省份、给省份配省会、答地理常识，或者混合来一轮。满分 10 分。</p>
        <div class="quiz-mode" id="modePick">
          ${quizModes.map(([m, label]) => `<button data-mode="${m}">${label}</button>`).join('')}
        </div>
        <div class="note-box">找省份时地图会隐藏名称。答错会立刻标出正确位置，答错的题会自动进「错题本」，答对一次就划掉。</div>
        ${wn ? `<div class="quiz-mode" id="wrongPick">
          <button data-mode="wrong">只考错题 · ${wn}</button>
          <button id="clearWrong" class="flat">清空</button>
        </div>` : ''}
        <div class="stat-grid">
          <div class="stat"><span class="k">题型</span><span class="v" style="font-size:14px">点击 / 选择</span></div>
          <div class="stat"><span class="k">题量</span><span class="v">10<small>题</small></span></div>
          <div class="stat"><span class="k">错题本</span><span class="v">${wn}<small>题</small></span></div>
        </div>`;
      panel.querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => startQuiz(b.dataset.mode); });
      const cw = $('#clearWrong');
      if (cw) cw.onclick = () => { wrongSave([]); renderQuiz(); };
      return;
    }

    if (!q.active) return renderQuizResult();
    const cur = currentQ();
    const dots = q.qs.map((_, i) => {
      const a = q.answers[i];
      const cls = a ? (a.ok ? 'ok' : 'bad') : (i === q.i ? 'now' : '');
      return `<i class="${cls}"></i>`;
    }).join('');

    if (!cur) return renderQuizResult();

    panel.innerHTML = `
      <div class="quiz">
        <div class="quiz-top">
          <div class="eyebrow" style="margin:0">第 ${q.i + 1} / ${q.qs.length} 题 · 得分 ${q.score}</div>
          <div class="quiz-dots">${dots}</div>
        </div>
        <div class="quiz-q"><small>${cur.type === 'click' ? '点击地图作答' : '选择一个答案'}</small>${esc(cur.prompt)}</div>
        ${cur.type === 'choice' ? `
          <div class="quiz-opts">
            ${cur.options.map((o, i) => {
              const cls = q.answered ? (o === cur.answer ? 'ok' : (o === q.picked ? 'bad' : '')) : '';
              return `<button data-opt="${esc(o)}" class="${cls}" ${q.answered ? 'disabled' : ''}><span>${String.fromCharCode(65 + i)}</span>${esc(o)}</button>`;
            }).join('')}
          </div>` : `
          <div class="note-box" style="border-left-color:rgba(95,182,217,.6)">在右侧地图上点击你认为正确的省份。${q.answered ? '' : '看不清？可以点下面的提示。'}</div>
          ${!q.answered ? '<button class="btn ghost" id="hintBtn">显示省份名称 3 秒</button>' : ''}`}
        <div class="feedback ${q.answered ? (q.lastOk ? 'ok' : 'bad') : ''}">${q.feedback || ''}</div>
        ${q.answered ? '<button class="btn" id="nextBtn">下一题 →</button>' : '<button class="btn ghost" id="skipBtn">跳过这题</button>'}
        <div class="rule"></div>
        <p style="font-size:10.5px">计时 ${elapsedText(q)} · 答错不扣分，但会记入错题回顾。</p>
      </div>`;

    panel.querySelectorAll('[data-opt]').forEach((b) => {
      b.onclick = () => answerByOption(b.dataset.opt, b);
    });
    const nb = $('#nextBtn'); if (nb) nb.onclick = nextQuestion;
    const sb = $('#skipBtn'); if (sb) sb.onclick = () => answerByProvince(null, true);
    const hb = $('#hintBtn'); if (hb) hb.onclick = () => {
      state.forceLabelsUntil = performance.now() + 3000;
      state.layers.labels = true;
      requestDraw();
      setTimeout(() => { if (state.tab === 'quiz') { state.layers.labels = false; requestDraw(); } }, 3000);
    };
  }

  function elapsedText(q) {
    const s = Math.max(0, Math.round(((q.endAt || Date.now()) - q.startAt) / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function answerByOption(opt, btn) {
    const q = state.quiz;
    if (!q || q.answered) return;
    const cur = currentQ();
    const ok = opt === cur.answer;
    q.answered = true;
    q.lastOk = ok;
    q.picked = opt;
    if (ok) q.score++;
    if (ok) wrongClear(cur.key); else wrongAdd(cur);
    q.answers[q.i] = { ok, q: cur, picked: opt };
    q.feedback = (ok ? '答对了。' : `正确答案是「${cur.answer}」。`) + (cur.why ? ' ' + cur.why : '');
    if (btn) {
      btn.classList.add(ok ? 'ok' : 'bad');
      panel.querySelectorAll('[data-opt]').forEach((b) => {
        b.disabled = true;
        if (b.dataset.opt === cur.answer) b.classList.add('ok');
      });
    }
    state.quizMarks = {};
    renderQuiz();
    requestDraw();
  }

  function answerByProvince(name, skip = false) {
    const q = state.quiz;
    if (!q || q.answered) return;
    const cur = currentQ();
    if (cur.type !== 'click') return;
    const ok = name === cur.name;
    q.answered = true;
    q.lastOk = ok;
    q.picked = skip ? '__skip' : name;
    if (ok) q.score++;
    if (ok) wrongClear(cur.key); else wrongAdd(cur);
    q.answers[q.i] = { ok, q: cur, picked: name };
    q.feedback = ok ? '找对了。' : skip ? `正确答案是「${cur.name}」，已在地图上标出。` : `这里是「${PROV_BY_NAME[name] ? PROV_BY_NAME[name].name : name}」，正确答案是「${cur.name}」。`;
    state.quizMarks = { correct: cur.name, wrong: ok || skip ? null : name };
    q.timer = setTimeout(() => { if (state.quiz === q && q.answered) nextQuestion(); }, 1800);
    renderQuiz();
    requestDraw();
  }

  function nextQuestion() {
    const q = state.quiz;
    if (!q) return;
    if (q.timer) { clearTimeout(q.timer); q.timer = null; }
    if (q.i >= q.qs.length - 1) {
      q.active = false;
      q.endAt = Date.now();
      state.quizMarks = {};
      renderQuizResult();
      requestDraw();
      return;
    }
    q.i++;
    q.answered = false;
    q.picked = null;
    q.feedback = '';
    state.quizMarks = {};
    renderQuiz();
    requestDraw();
  }

  function renderQuizResult() {
    const q = state.quiz;
    const total = q.qs.length;
    const right = q.answers.filter(Boolean).filter((a) => a.ok).length;
    const pct = Math.round((right / total) * 100);
    const grade = pct >= 90 ? '地理达人' : pct >= 70 ? '底子不错' : pct >= 50 ? '还差一点' : '继续加油';
    const wrong = q.answers.filter(Boolean).filter((a) => !a.ok);
    panel.innerHTML = `
      <div class="eyebrow">闯关结果</div>
      <h2>${grade}</h2>
      <div class="score-big">${right}<small> / ${total}</small></div>
      <p>正确率 ${pct}% · 用时 ${elapsedText(q)}</p>
      <div class="bars">
        <div class="bar-row"><span class="lab"><span>正确率</span><b>${pct}%</b></span>
          <span class="bar-track"><span class="bar-fill" style="width:${pct}%;background:linear-gradient(90deg,rgba(95,191,163,.5),var(--jade))"></span></span></div>
      </div>
      ${wrong.length ? `<div class="rule"></div><h3>错题回顾</h3><div class="review">
        ${wrong.map((a) => `<div class="r-item"><b>${esc(a.q.type === 'click' ? a.q.name : a.q.prompt)}</b><br/>
          ${a.q.type === 'click' ? '在地图上找它的位置' : '正确答案：' + esc(a.q.answer)}
          ${a.q.why ? `<small class="why">${esc(a.q.why)}</small>` : ''}</div>`).join('')}
      </div>` : '<div class="note-box">全对。可以试试「地图找省份」模式，把名称藏起来再来一轮。</div>'}
      ${wrongCount() ? `<div class="note-box">错题本已攒下 <b>${wrongCount()}</b> 题，答对一次就会划掉。</div>` : ''}
      <div class="quiz-mode" style="margin-top:6px">
        <button id="again">再玩一次</button>
        ${wrongCount() ? '<button id="reviewWrong">复习错题</button>' : ''}
        <button id="switchMode">换个模式</button>
      </div>`;
    $('#again').onclick = () => startQuiz(q.mode);
    const rw = $('#reviewWrong'); if (rw) rw.onclick = () => startQuiz('wrong');
    $('#switchMode').onclick = () => { state.quiz = null; renderQuiz(); };
  }


/* Fabio-Kurs: Zusammenfassung des Ordners "Fabio Trading" — lesen und Quiz.

   Baut auf orderflow.js auf und muss danach geladen werden: Darstellung
   (orderflowBlocks, orderflowBar, orderflowShuffle) und Speicherung teilen sich
   beide Kurse. Der Fortschritt liegt in derselben Zeile orderflow_progress —
   die IDs tragen ein "f" davor, damit nichts mit dem Bootcamp kollidiert.
   Das Bootcamp zaehlt nur seine eigenen IDs, die Fabio-Eintraege stoeren dort nicht. */

let fabioView = { mode: 'overview' };
let fabioQuiz = null;

/* ---------- Abfragen auf den Inhalt ---------- */

function fabioAllLessons() {
  return FABIO_PARTS.flatMap(part => part.lessons.map(lesson => ({ part, lesson })));
}

function fabioFindLesson(id) {
  return fabioAllLessons().find(entry => entry.lesson.id === id) || null;
}

function fabioQuestion(id) {
  const partId = id.slice(1).split('-')[0];
  return (FABIO_QUIZ[partId] || []).find(q => q.id === id) || null;
}

function fabioStats() {
  const lessons = fabioAllLessons().map(entry => entry.lesson);
  const questions = Object.values(FABIO_QUIZ).flat();
  const answers = orderflowProgress.answers;
  return {
    lessons: lessons.length,
    read: lessons.filter(lesson => orderflowProgress.read[lesson.id]).length,
    questions: questions.length,
    right: questions.filter(q => answers[q.id] === true).length,
    wrong: questions.filter(q => answers[q.id] === false).length,
  };
}

function fabioPartScore(partId) {
  const questions = FABIO_QUIZ[partId] || [];
  return {
    total: questions.length,
    right: questions.filter(q => orderflowProgress.answers[q.id] === true).length,
  };
}

/* Wie beim Bootcamp: weiter nach der zuletzt gelesenen Lektion. */
function fabioNextLesson() {
  const order = fabioAllLessons();
  const unread = entry => !orderflowProgress.read[entry.lesson.id];
  let last = -1;
  order.forEach((entry, i) => {
    if (!unread(entry)) last = i;
  });
  return order.slice(last + 1).find(unread) || order.find(unread) || null;
}

function fabioWrongIds() {
  return Object.values(FABIO_QUIZ)
    .flat()
    .filter(q => orderflowProgress.answers[q.id] === false)
    .map(q => q.id);
}

function fabioLessonNumber(lesson) {
  return lesson.id.slice(1);
}

/* ---------- Darstellung ---------- */

function renderFabioOverview() {
  const stats = fabioStats();
  const next = fabioNextLesson();
  const wrong = fabioWrongIds().length;
  const partCards = FABIO_PARTS.map(part => {
    const readCount = part.lessons.filter(l => orderflowProgress.read[l.id]).length;
    const score = fabioPartScore(part.id);
    const done = readCount === part.lessons.length;
    const lessons = part.lessons
      .map(
        lesson => `<button class="of-lesson-link ${orderflowProgress.read[lesson.id] ? 'read' : ''}"
          onclick="openFabioLesson('${lesson.id}')">
          <span class="of-check">${orderflowProgress.read[lesson.id] ? '✓' : ''}</span>
          <span>${escapeHtml(lesson.title)}</span></button>`,
      )
      .join('');
    const quizButton = score.total
      ? `<button class="btn ${score.right === score.total ? '' : 'primary'}"
          onclick="startFabioQuiz('${part.id}')">Quiz · ${score.right}/${score.total}</button>`
      : '';
    return `<div class="card of-part ${done ? 'done' : ''}">
      <div class="of-part-head">
        <span class="of-part-num">${part.id}</span>
        <div>
          <h3>${escapeHtml(`Teil ${part.id} – ${part.title}`)}</h3>
          <small>${readCount}/${part.lessons.length} gelesen</small>
        </div>
      </div>
      <div class="of-lessons">${lessons}</div>
      ${quizButton ? `<div class="actions">${quizButton}</div>` : ''}
    </div>`;
  }).join('');
  return `
    <div class="card of-hero">
      <div class="of-hero-stats">
        <div><span>Gelesen</span><b>${stats.read}/${stats.lessons}</b>${orderflowBar(stats.read, stats.lessons)}</div>
        <div><span>Quiz richtig</span><b>${stats.right}/${stats.questions}</b>${orderflowBar(stats.right, stats.questions)}</div>
      </div>
      ${
        next
          ? `<p class="of-next-lesson"><span>${stats.read ? 'Als Nächstes' : 'Los geht’s mit'}</span>${escapeHtml(`${fabioLessonNumber(next.lesson)} ${next.lesson.title}`)}</p>`
          : '<p class="of-done-note">Alles gelesen 💪</p>'
      }
      <div class="actions">
        ${
          next
            ? `<button class="btn primary" onclick="openFabioLesson('${next.lesson.id}')">${stats.read ? 'Weiterlesen' : 'Starten'}</button>`
            : ''
        }
        <button class="btn" onclick="startFabioWrongQuiz()" ${wrong ? '' : 'disabled'}>Fehler üben (${wrong})</button>
      </div>
      ${orderflowRemote ? '' : '<p class="of-hint">Fortschritt liegt nur auf diesem Gerät, bis die Tabelle orderflow_progress angelegt ist.</p>'}
    </div>
    <div class="of-parts">${partCards}</div>`;
}

function renderFabioLesson(id) {
  const found = fabioFindLesson(id);
  if (!found) return renderFabioOverview();
  const { part, lesson } = found;
  const all = fabioAllLessons();
  const index = all.findIndex(entry => entry.lesson.id === id);
  const prev = all[index - 1];
  const next = all[index + 1];
  const lastOfPart = !next || next.part.id !== part.id;
  const hasQuiz = (FABIO_QUIZ[part.id] || []).length > 0;
  const intro = part.lessons[0].id === id && part.intro.length ? orderflowBlocks(part.intro) : '';
  return `
    <div class="of-crumbs">
      <button class="btn" onclick="showFabioOverview()">← Übersicht</button>
      <span>${escapeHtml(`Teil ${part.id}`)}</span>
    </div>
    <article class="card of-lesson">
      ${intro ? `<div class="of-intro">${intro}</div>` : ''}
      <h2>${escapeHtml(`${fabioLessonNumber(lesson)} ${lesson.title}`)}</h2>
      ${orderflowBlocks(lesson.blocks)}
    </article>
    <div class="of-pager">
      ${prev ? `<button class="btn" onclick="openFabioLesson('${prev.lesson.id}')">← ${escapeHtml(fabioLessonNumber(prev.lesson))}</button>` : '<span></span>'}
      ${
        lastOfPart && hasQuiz
          ? `<button class="btn primary" onclick="startFabioQuiz('${part.id}')">Quiz zu Teil ${part.id}</button>`
          : next
            ? `<button class="btn primary" onclick="openFabioLesson('${next.lesson.id}')">Weiter: ${escapeHtml(fabioLessonNumber(next.lesson))} →</button>`
            : '<span></span>'
      }
    </div>`;
}

function renderFabioQuestion() {
  const quiz = fabioQuiz;
  const q = fabioQuestion(quiz.ids[quiz.pos]);
  const answered = quiz.answered;
  const options = quiz.options
    .map((option, k) => {
      let cls = '';
      if (answered) {
        if (option.ok) cls = 'right';
        else if (k === answered.pick) cls = 'wrong';
        else cls = 'dim';
      }
      return `<button class="of-opt ${cls}" onclick="answerFabio(${k})" ${answered ? 'disabled' : ''}>
        ${escapeHtml(option.text)}</button>`;
    })
    .join('');
  const last = quiz.pos + 1 >= quiz.ids.length;
  return `
    <div class="of-crumbs">
      <button class="btn" onclick="showFabioOverview()">← Übersicht</button>
      <span>${escapeHtml(quiz.label)} · ${quiz.pos + 1}/${quiz.ids.length}</span>
    </div>
    ${orderflowBar(quiz.pos, quiz.ids.length)}
    <div class="card of-quiz">
      <h3>${escapeHtml(q.q)}</h3>
      <div class="of-opts">${options}</div>
      ${
        answered
          ? `<div class="of-explain ${answered.ok ? 'ok' : 'no'}">
              <b>${answered.ok ? 'Richtig!' : 'Leider falsch.'}</b>${escapeHtml(q.e)}</div>
             <button class="btn primary of-next" onclick="nextFabioQuestion()">${last ? 'Ergebnis' : 'Weiter'}</button>`
          : ''
      }
    </div>`;
}

function renderFabioResult() {
  const quiz = fabioQuiz;
  const pct = Math.round((100 * quiz.right) / quiz.ids.length);
  const msg =
    pct === 100
      ? 'Perfekt, Bro. Weiter zum nächsten Teil!'
      : pct >= 70
        ? 'Stark. Die Fehler kurz nochmal anschauen.'
        : 'Lies die Lektionen nochmal und probier es dann erneut.';
  return `
    <div class="card of-result">
      <small>${escapeHtml(quiz.label)}</small>
      <div class="of-big">${quiz.right}/${quiz.ids.length}</div>
      <p>${msg}</p>
      <div class="actions">
        <button class="btn" onclick="restartFabioQuiz()">Nochmal</button>
        <button class="btn primary" onclick="showFabioOverview()">Übersicht</button>
      </div>
    </div>`;
}

function renderFabio() {
  const root = $('#fabioRoot');
  if (root) {
    const mode = fabioView.mode;
    root.innerHTML =
      mode === 'lesson'
        ? renderFabioLesson(fabioView.id)
        : mode === 'quiz'
          ? renderFabioQuestion()
          : mode === 'result'
            ? renderFabioResult()
            : renderFabioOverview();
  }
  renderFabioTeaser();
}

/* Karte in der Academy, unter der Bootcamp-Karte. */
function renderFabioTeaser() {
  const box = $('#fabioTeaser');
  if (!box) return;
  const stats = fabioStats();
  box.innerHTML = `<div class="card of-teaser" onclick="showPage('fabio')">
    <div>
      <div class="eyebrow">Kurs</div>
      <h3>Fabio Trading</h3>
      <small>${stats.read}/${stats.lessons} Lektionen · ${stats.right}/${stats.questions} Quiz richtig</small>
    </div>
    <button class="btn primary">Öffnen</button>
  </div>`;
}

/* ---------- Aktionen ---------- */

function showFabioOverview() {
  fabioView = { mode: 'overview' };
  renderFabio();
  orderflowScrollTop();
}

async function openFabioLesson(id) {
  fabioView = { mode: 'lesson', id };
  renderFabio();
  orderflowScrollTop();
  if (!orderflowProgress.read[id]) {
    orderflowProgress.read[id] = new Date().toISOString().slice(0, 10);
    await saveOrderflow();
    renderFabioTeaser();
  }
}

function fabioPrepareQuestion() {
  const q = fabioQuestion(fabioQuiz.ids[fabioQuiz.pos]);
  fabioQuiz.options = orderflowShuffle(q.o.map((text, k) => ({ text, ok: k === 0 })));
  fabioQuiz.answered = null;
}

function startFabioQuizWith(ids, label) {
  if (!ids.length) return;
  fabioQuiz = { ids, label, pos: 0, right: 0 };
  fabioPrepareQuestion();
  fabioView = { mode: 'quiz' };
  renderFabio();
  orderflowScrollTop();
}

function startFabioQuiz(partId) {
  const part = FABIO_PARTS.find(p => String(p.id) === String(partId));
  const ids = (FABIO_QUIZ[partId] || []).map(q => q.id);
  startFabioQuizWith(ids, `Teil ${partId}${part ? ` · ${part.title.split(':')[0]}` : ''}`);
}

function startFabioWrongQuiz() {
  startFabioQuizWith(orderflowShuffle(fabioWrongIds()), 'Fehler üben');
}

function restartFabioQuiz() {
  if (fabioQuiz) startFabioQuizWith(fabioQuiz.ids, fabioQuiz.label);
}

async function answerFabio(index) {
  if (!fabioQuiz || fabioQuiz.answered) return;
  const option = fabioQuiz.options[index];
  if (!option) return;
  const id = fabioQuiz.ids[fabioQuiz.pos];
  fabioQuiz.answered = { pick: index, ok: option.ok };
  if (option.ok) fabioQuiz.right++;
  orderflowProgress.answers[id] = option.ok;
  renderFabio();
  await saveOrderflow();
}

function nextFabioQuestion() {
  if (!fabioQuiz) return;
  fabioQuiz.pos++;
  if (fabioQuiz.pos >= fabioQuiz.ids.length) {
    fabioView = { mode: 'result' };
  } else {
    fabioPrepareQuestion();
  }
  renderFabio();
  orderflowScrollTop();
}

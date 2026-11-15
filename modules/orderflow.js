/* Orderflow-Bootcamp: Lektionen lesen, pro Teil ein Quiz, Fehler wiederholen.

   Inhalt steht fest in orderflow-data.js. Gespeichert wird nur der Fortschritt,
   eine Zeile pro Nutzer in orderflow_progress (read + answers als jsonb). Fehlt
   die Tabelle noch, faellt das Modul auf localStorage zurueck — nach dem Muster
   der anderen Module, damit die Seite auch vor der Migration funktioniert. */

const ORDERFLOW_LOCAL_KEY = 'cprb-orderflow-progress';
const ORDERFLOW_IMG_DIR = 'assets/orderflow/';

let orderflowProgress = { read: {}, answers: {} };
let orderflowRemote = true;
let orderflowView = { mode: 'overview' };
let orderflowQuiz = null;

function isMissingOrderflowTable(error) {
  const message =
    `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return (
    message.includes('42p01') ||
    message.includes('pgrst205') ||
    /relation .* does not exist|could not find the table|schema cache/.test(message)
  );
}

function orderflowReadLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(ORDERFLOW_LOCAL_KEY) || '{}');
    return { read: raw.read || {}, answers: raw.answers || {} };
  } catch (err) {
    return { read: {}, answers: {} };
  }
}

function orderflowWriteLocal() {
  try {
    localStorage.setItem(ORDERFLOW_LOCAL_KEY, JSON.stringify(orderflowProgress));
  } catch (err) {
    /* Privater Modus o. Ae. — dann gilt der Fortschritt nur fuer diese Sitzung. */
  }
}

async function loadOrderflow() {
  orderflowRemote = true;
  const { data, error } = await sb
    .from('orderflow_progress')
    .select('read, answers')
    .eq('user_id', currentUser.id)
    .maybeSingle();
  if (error) {
    if (!isMissingOrderflowTable(error)) throw error;
    orderflowRemote = false;
    orderflowProgress = orderflowReadLocal();
    return;
  }
  orderflowProgress = { read: data?.read || {}, answers: data?.answers || {} };
}

async function saveOrderflow() {
  orderflowWriteLocal();
  if (!orderflowRemote) return;
  const { error } = await sb.from('orderflow_progress').upsert(
    {
      user_id: currentUser.id,
      read: orderflowProgress.read,
      answers: orderflowProgress.answers,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) {
    if (isMissingOrderflowTable(error)) {
      orderflowRemote = false;
      return;
    }
    console.error(error);
    alert('Orderflow-Fortschritt konnte nicht gespeichert werden: ' + error.message);
  }
}

/* ---------- Abfragen auf den Inhalt ---------- */

function orderflowCourseParts() {
  return ORDERFLOW_PARTS.filter(part => part.id >= 1 && part.id <= 7);
}

function orderflowAllLessons() {
  return ORDERFLOW_PARTS.flatMap(part => part.lessons.map(lesson => ({ part, lesson })));
}

function orderflowFindLesson(id) {
  return orderflowAllLessons().find(entry => entry.lesson.id === id) || null;
}

function orderflowQuestion(id) {
  const partId = id.split('-')[0];
  return (ORDERFLOW_QUIZ[partId] || []).find(q => q.id === id) || null;
}

function orderflowStats() {
  const courseLessons = orderflowCourseParts().flatMap(part => part.lessons);
  const questions = Object.values(ORDERFLOW_QUIZ).flat();
  const read = courseLessons.filter(lesson => orderflowProgress.read[lesson.id]).length;
  const right = questions.filter(q => orderflowProgress.answers[q.id] === true).length;
  const wrong = questions.filter(q => orderflowProgress.answers[q.id] === false).length;
  return {
    lessons: courseLessons.length,
    read,
    questions: questions.length,
    right,
    wrong,
  };
}

function orderflowPartScore(partId) {
  const questions = ORDERFLOW_QUIZ[partId] || [];
  return {
    total: questions.length,
    right: questions.filter(q => orderflowProgress.answers[q.id] === true).length,
  };
}

/* Weiter geht es nach der zuletzt gelesenen Lektion — nicht bei der ersten
   Luecke, sonst schickt ein uebersprungenes Vorwort ihn ewig zurueck. */
function orderflowNextLesson() {
  const order = orderflowAllLessons().filter(entry => entry.part.id <= 7);
  const unread = entry => !orderflowProgress.read[entry.lesson.id];
  let last = -1;
  order.forEach((entry, i) => {
    if (!unread(entry)) last = i;
  });
  return order.slice(last + 1).find(unread) || order.find(unread) || null;
}

function orderflowLessonLabel(part, lesson) {
  return part.lessons.length === 1 ? lesson.title : `${lesson.id} ${lesson.title}`;
}

function orderflowWrongIds() {
  return Object.values(ORDERFLOW_QUIZ)
    .flat()
    .filter(q => orderflowProgress.answers[q.id] === false)
    .map(q => q.id);
}

/* ---------- Darstellung ---------- */

function orderflowInline(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

function orderflowImage(name, caption = '') {
  const src = `${ORDERFLOW_IMG_DIR}${name}.png`;
  return `<figure class="of-figure">
    <img src="${src}" alt="${escapeHtml(caption || 'Beispiel-Chart')}" loading="lazy"
      onclick="openOrderflowImage('${name}')" />
    ${caption ? `<figcaption>${orderflowInline(caption)}</figcaption>` : ''}
  </figure>`;
}

function orderflowBlocks(blocks) {
  return blocks
    .map(block => {
      if (block.p) return `<p>${orderflowInline(block.p)}</p>`;
      if (block.ul)
        return `<ul>${block.ul.map(i => `<li>${orderflowInline(i)}</li>`).join('')}</ul>`;
      if (block.ol) {
        const start = block.start ? ` start="${Number(block.start)}"` : '';
        return `<ol${start}>${block.ol.map(i => `<li>${orderflowInline(i)}</li>`).join('')}</ol>`;
      }
      if (block.merk)
        return `<div class="of-merk"><span>Merksatz</span>${orderflowInline(block.merk)}</div>`;
      if (block.img) return orderflowImage(block.img, block.cap);
      if (block.table) {
        const [head, ...rows] = block.table;
        return `<div class="of-table-wrap"><table class="of-table">
          <thead><tr>${head.map(c => `<th>${orderflowInline(c)}</th>`).join('')}</tr></thead>
          <tbody>${rows
            .map(r => `<tr>${r.map(c => `<td>${orderflowInline(c)}</td>`).join('')}</tr>`)
            .join('')}</tbody></table></div>`;
      }
      return '';
    })
    .join('');
}

function orderflowBar(value, total) {
  const pct = total ? Math.round((100 * value) / total) : 0;
  return `<div class="of-bar"><i style="width:${pct}%"></i></div>`;
}

function renderOrderflowOverview() {
  const stats = orderflowStats();
  const next = orderflowNextLesson();
  const wrong = orderflowWrongIds().length;
  const partCards = ORDERFLOW_PARTS.map(part => {
    const isCourse = part.id >= 1 && part.id <= 7;
    const readCount = part.lessons.filter(l => orderflowProgress.read[l.id]).length;
    const score = orderflowPartScore(part.id);
    const done = isCourse && readCount === part.lessons.length;
    const lessons = part.lessons
      .map(
        lesson => `<button class="of-lesson-link ${orderflowProgress.read[lesson.id] ? 'read' : ''}"
          onclick="openOrderflowLesson('${lesson.id}')">
          <span class="of-check">${orderflowProgress.read[lesson.id] ? '✓' : ''}</span>
          <span>${escapeHtml(lesson.title)}</span></button>`,
      )
      .join('');
    const quizButton = score.total
      ? `<button class="btn ${score.right === score.total ? '' : 'primary'}"
          onclick="startOrderflowQuiz('${part.id}')">Quiz · ${score.right}/${score.total}</button>`
      : '';
    return `<div class="card of-part ${done ? 'done' : ''}">
      <div class="of-part-head">
        <span class="of-part-num">${isCourse ? part.id : part.id === 0 ? 'i' : '•'}</span>
        <div>
          <h3>${escapeHtml(isCourse ? `Teil ${part.id} – ${part.title}` : part.title)}</h3>
          ${isCourse ? `<small>${readCount}/${part.lessons.length} gelesen</small>` : ''}
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
          ? `<p class="of-next-lesson"><span>${stats.read ? 'Als Nächstes' : 'Los geht’s mit'}</span>${escapeHtml(orderflowLessonLabel(next.part, next.lesson))}</p>`
          : '<p class="of-done-note">Alle Lektionen gelesen 💪</p>'
      }
      <div class="actions">
        ${
          next
            ? `<button class="btn primary" onclick="openOrderflowLesson('${next.lesson.id}')">${stats.read ? 'Weiterlesen' : 'Starten'}</button>`
            : ''
        }
        <button class="btn" onclick="startOrderflowWrongQuiz()" ${wrong ? '' : 'disabled'}>Fehler üben (${wrong})</button>
      </div>
      ${orderflowRemote ? '' : '<p class="of-hint">Fortschritt liegt nur auf diesem Gerät, bis die Tabelle orderflow_progress angelegt ist.</p>'}
    </div>
    <div class="of-parts">${partCards}</div>`;
}

function renderOrderflowLesson(id) {
  const found = orderflowFindLesson(id);
  if (!found) return renderOrderflowOverview();
  const { part, lesson } = found;
  const all = orderflowAllLessons();
  const index = all.findIndex(entry => entry.lesson.id === id);
  const prev = all[index - 1];
  const next = all[index + 1];
  const lastOfPart = !next || next.part.id !== part.id;
  const hasQuiz = (ORDERFLOW_QUIZ[part.id] || []).length > 0;
  const intro = part.lessons[0].id === id && part.intro.length ? orderflowBlocks(part.intro) : '';
  return `
    <div class="of-crumbs">
      <button class="btn" onclick="showOrderflowOverview()">← Übersicht</button>
      <span>${escapeHtml(part.id >= 1 && part.id <= 7 ? `Teil ${part.id}` : part.title)}</span>
    </div>
    <article class="card of-lesson">
      ${intro ? `<div class="of-intro">${intro}</div>` : ''}
      <h2>${escapeHtml(orderflowLessonLabel(part, lesson))}</h2>
      ${orderflowBlocks(lesson.blocks)}
    </article>
    <div class="of-pager">
      ${prev ? `<button class="btn" onclick="openOrderflowLesson('${prev.lesson.id}')">← ${escapeHtml(prev.lesson.id)}</button>` : '<span></span>'}
      ${
        lastOfPart && hasQuiz
          ? `<button class="btn primary" onclick="startOrderflowQuiz('${part.id}')">Quiz zu Teil ${part.id}</button>`
          : next
            ? `<button class="btn primary" onclick="openOrderflowLesson('${next.lesson.id}')">Weiter: ${escapeHtml(next.lesson.id)} →</button>`
            : '<span></span>'
      }
    </div>`;
}

function renderOrderflowQuestion() {
  const quiz = orderflowQuiz;
  const q = orderflowQuestion(quiz.ids[quiz.pos]);
  const answered = quiz.answered;
  const options = quiz.options
    .map((option, k) => {
      let cls = '';
      if (answered) {
        if (option.ok) cls = 'right';
        else if (k === answered.pick) cls = 'wrong';
        else cls = 'dim';
      }
      return `<button class="of-opt ${cls}" onclick="answerOrderflow(${k})" ${answered ? 'disabled' : ''}>
        ${escapeHtml(option.text)}</button>`;
    })
    .join('');
  const last = quiz.pos + 1 >= quiz.ids.length;
  return `
    <div class="of-crumbs">
      <button class="btn" onclick="showOrderflowOverview()">← Übersicht</button>
      <span>${escapeHtml(quiz.label)} · ${quiz.pos + 1}/${quiz.ids.length}</span>
    </div>
    ${orderflowBar(quiz.pos, quiz.ids.length)}
    <div class="card of-quiz">
      ${q.img ? orderflowImage(q.img) : ''}
      <h3>${escapeHtml(q.q)}</h3>
      <div class="of-opts">${options}</div>
      ${
        answered
          ? `<div class="of-explain ${answered.ok ? 'ok' : 'no'}">
              <b>${answered.ok ? 'Richtig!' : 'Leider falsch.'}</b>${escapeHtml(q.e)}</div>
             <button class="btn primary of-next" onclick="nextOrderflowQuestion()">${last ? 'Ergebnis' : 'Weiter'}</button>`
          : ''
      }
    </div>`;
}

function renderOrderflowResult() {
  const quiz = orderflowQuiz;
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
        <button class="btn" onclick="restartOrderflowQuiz()">Nochmal</button>
        <button class="btn primary" onclick="showOrderflowOverview()">Übersicht</button>
      </div>
    </div>`;
}

function renderOrderflow() {
  const root = $('#orderflowRoot');
  if (root) {
    const mode = orderflowView.mode;
    root.innerHTML =
      mode === 'lesson'
        ? renderOrderflowLesson(orderflowView.id)
        : mode === 'quiz'
          ? renderOrderflowQuestion()
          : mode === 'result'
            ? renderOrderflowResult()
            : renderOrderflowOverview();
  }
  renderOrderflowTeaser();
}

/* Kleine Karte oben in der Academy, damit der Kurs dort auffindbar bleibt. */
function renderOrderflowTeaser() {
  const box = $('#orderflowTeaser');
  if (!box) return;
  const stats = orderflowStats();
  box.innerHTML = `<div class="card of-teaser" onclick="showPage('orderflow')">
    <div>
      <div class="eyebrow">Kurs</div>
      <h3>Orderflow-Bootcamp</h3>
      <small>${stats.read}/${stats.lessons} Lektionen · ${stats.right}/${stats.questions} Quiz richtig</small>
    </div>
    <button class="btn primary">Öffnen</button>
  </div>`;
}

/* ---------- Aktionen ---------- */

function orderflowScrollTop() {
  window.scrollTo({ top: 0, left: 0 });
}

function showOrderflowOverview() {
  orderflowView = { mode: 'overview' };
  renderOrderflow();
  orderflowScrollTop();
}

async function openOrderflowLesson(id) {
  orderflowView = { mode: 'lesson', id };
  renderOrderflow();
  orderflowScrollTop();
  if (!orderflowProgress.read[id]) {
    orderflowProgress.read[id] = new Date().toISOString().slice(0, 10);
    await saveOrderflow();
    renderOrderflowTeaser();
  }
}

function orderflowShuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function orderflowPrepareQuestion() {
  const q = orderflowQuestion(orderflowQuiz.ids[orderflowQuiz.pos]);
  /* Die erste Antwort im Datensatz ist die richtige; angezeigt wird gemischt. */
  orderflowQuiz.options = orderflowShuffle(q.o.map((text, k) => ({ text, ok: k === 0 })));
  orderflowQuiz.answered = null;
}

function startOrderflowQuizWith(ids, label) {
  if (!ids.length) return;
  orderflowQuiz = { ids, label, pos: 0, right: 0 };
  orderflowPrepareQuestion();
  orderflowView = { mode: 'quiz' };
  renderOrderflow();
  orderflowScrollTop();
}

function startOrderflowQuiz(partId) {
  const part = ORDERFLOW_PARTS.find(p => String(p.id) === String(partId));
  const ids = (ORDERFLOW_QUIZ[partId] || []).map(q => q.id);
  startOrderflowQuizWith(ids, `Teil ${partId}${part ? ` · ${part.title.split(':')[0]}` : ''}`);
}

function startOrderflowWrongQuiz() {
  startOrderflowQuizWith(orderflowShuffle(orderflowWrongIds()), 'Fehler üben');
}

function restartOrderflowQuiz() {
  if (orderflowQuiz) startOrderflowQuizWith(orderflowQuiz.ids, orderflowQuiz.label);
}

async function answerOrderflow(index) {
  if (!orderflowQuiz || orderflowQuiz.answered) return;
  const option = orderflowQuiz.options[index];
  if (!option) return;
  const id = orderflowQuiz.ids[orderflowQuiz.pos];
  orderflowQuiz.answered = { pick: index, ok: option.ok };
  if (option.ok) orderflowQuiz.right++;
  orderflowProgress.answers[id] = option.ok;
  renderOrderflow();
  await saveOrderflow();
}

function nextOrderflowQuestion() {
  if (!orderflowQuiz) return;
  orderflowQuiz.pos++;
  if (orderflowQuiz.pos >= orderflowQuiz.ids.length) {
    orderflowView = { mode: 'result' };
  } else {
    orderflowPrepareQuestion();
  }
  renderOrderflow();
  orderflowScrollTop();
}

function openOrderflowImage(name) {
  const box = $('#orderflowZoom');
  if (!box) return;
  box.querySelector('img').src = `${ORDERFLOW_IMG_DIR}${name}.png`;
  box.classList.add('open');
}

function closeOrderflowImage() {
  $('#orderflowZoom')?.classList.remove('open');
}

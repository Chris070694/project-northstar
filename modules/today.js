/* Heute — der adaptive Startscreen.
   Liest ausschließlich aus den bestehenden Modulen (focus, trading, fitness, calendar)
   und schreibt nichts eigenes in die Datenbank. Kein neues Schema nötig. */

const TODAY_TRADING_WINDOW = { start: 8, end: 17 };
const TODAY_EVENING_HOUR = 19;
const TODAY_MOMENTUM_DAYS = 14;

function todayDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayGreeting(hour = new Date().getHours()) {
  if (hour < 11) return 'Guten Morgen';
  if (hour < 18) return 'Guten Tag';
  return 'Guten Abend';
}

function todayAnchorTask() {
  return dailyTasks.find(task => task.is_priority) || null;
}

function todayOpenTasks() {
  const anchor = todayAnchorTask();
  return dailyTasks.filter(task => !task.is_completed && task.id !== anchor?.id);
}

function todayEvents() {
  const key = todayDateKey();
  return (calendarEvents || [])
    .filter(event => event.event_date === key)
    .sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')));
}

function todayTrainingSession() {
  const key = todayDateKey();
  return (fitnessSessions || []).find(session => session.session_date === key) || null;
}

function todayTrades() {
  const key = todayDateKey();
  return (trades || []).filter(trade => trade.trade_date === key);
}

function todayRSum(list) {
  return list.reduce((sum, trade) => sum + (Number(trade.r_multiple) || 0), 0);
}

function formatTodayR(value) {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded > 0 ? '+' : ''}${rounded}R`;
}

/* Welcher Zustand gilt gerade? Reihenfolge = Priorität. */
function todayNowState(now = new Date()) {
  const hour = now.getHours();

  if (typeof activeFitnessSession !== 'undefined' && activeFitnessSession) {
    return { kind: 'workout-running', session: activeFitnessSession };
  }

  const training = todayTrainingSession();
  const trades = todayTrades();

  if (hour >= TODAY_EVENING_HOUR) {
    return { kind: 'evening', trades, training };
  }

  if (hour >= TODAY_TRADING_WINDOW.start && hour < TODAY_TRADING_WINDOW.end) {
    return { kind: 'trading', trades, state: getTodayTradingState() };
  }

  if (!training && (fitnessPlans || []).length) {
    return { kind: 'workout-ready' };
  }

  const open = todayOpenTasks();
  if (open.length) return { kind: 'task', task: open[0] };

  return { kind: 'clear' };
}

function todayNowCard(state) {
  if (state.kind === 'workout-running') {
    const total = (fitnessSetLogs || []).filter(log => log.session_id === state.session.id).length;
    const done = (fitnessSetLogs || []).filter(
      log => log.session_id === state.session.id && log.completed_at,
    ).length;
    return {
      accent: 'green',
      eyebrow: 'JETZT — TRAINING LÄUFT',
      title: escapeHtml(state.session.plan_name_snapshot || 'Training'),
      sub: total ? `${done} von ${total} Sätzen abgeschlossen` : 'Sätze eintragen',
      action: 'Training öffnen',
      onclick: "showPage('fitness')",
    };
  }

  if (state.kind === 'trading') {
    const count = state.trades.length;
    if (state.state?.lossLimitReached) {
      return {
        accent: 'red',
        eyebrow: 'JETZT — TAGESLIMIT ERREICHT',
        title: 'Für heute ist Schluss',
        sub: `${formatTodayR(todayRSum(state.trades))} heute · dein Verlustlimit greift`,
        action: 'Trades ansehen',
        onclick: "showPage('trading')",
      };
    }
    if (state.state?.tradeLimitReached) {
      return {
        accent: 'cyan',
        eyebrow: 'JETZT — TRADE-LIMIT ERREICHT',
        title: `${count} von ${state.state.maxTrades} Trades`,
        sub: 'Heute keine weiteren Einstiege — Ausführung auswerten',
        action: 'Journal öffnen',
        onclick: "showPage('trading')",
      };
    }
    if (count) {
      return {
        accent: 'cyan',
        eyebrow: 'JETZT — SESSION LÄUFT',
        title: `${count} ${count === 1 ? 'Trade' : 'Trades'} · ${formatTodayR(todayRSum(state.trades))}`,
        sub: `Noch ${Math.max(0, state.state.maxTrades - count)} Einstiege nach Plan möglich`,
        action: 'Trade erfassen',
        onclick: 'openTrade()',
      };
    }
    return {
      accent: 'cyan',
      eyebrow: 'JETZT — VORBEREITUNG',
      title: 'Noch kein Trade heute',
      sub: 'Bias notieren, Watchlist kürzen, Risiko festlegen',
      action: 'Cockpit öffnen',
      onclick: "showPage('trading')",
    };
  }

  if (state.kind === 'workout-ready') {
    return {
      accent: 'green',
      eyebrow: 'JETZT — TRAINING STEHT AN',
      title: 'Heute noch kein Training',
      sub: 'Plan starten und Sätze mitschreiben',
      action: 'Training starten',
      onclick: "showPage('fitness')",
    };
  }

  if (state.kind === 'evening') {
    const rSum = todayRSum(state.trades);
    const parts = [];
    if (state.trades.length) parts.push(`${state.trades.length} Trades · ${formatTodayR(rSum)}`);
    if (state.training) parts.push(escapeHtml(state.training.plan_name_snapshot || 'Training'));
    return {
      accent: 'violet',
      eyebrow: 'JETZT — TAG ABSCHLIESSEN',
      title: 'Was war heute dein größter Hebel?',
      sub: parts.length ? parts.join(' · ') : 'Halte fest, was den Tag ausgemacht hat',
      action: 'Notiz schreiben',
      onclick: "showPage('notes')",
    };
  }

  if (state.kind === 'task') {
    return {
      accent: 'cyan',
      eyebrow: 'JETZT — NÄCHSTE AUFGABE',
      title: escapeHtml(state.task.title || 'Aufgabe'),
      sub: state.task.category ? escapeHtml(state.task.category) : 'Ohne Kategorie',
      action: 'To-dos öffnen',
      onclick: "showPage('tasks')",
    };
  }

  return {
    accent: 'green',
    eyebrow: 'JETZT',
    title: 'Alles abgehakt',
    sub: 'Nichts Offenes mehr für heute',
    action: 'Woche ansehen',
    onclick: "showPage('weekly')",
  };
}

function renderTodayAnchor() {
  const anchor = todayAnchorTask();
  const box = $('#todayAnchor');
  if (!box) return;
  if (!anchor) {
    box.className = 'card today-anchor today-anchor-empty';
    box.innerHTML = `<span class="pill">DEIN ANKER</span>
      <div class="today-anchor-title">Noch keine Priorität für heute</div>
      <button class="btn" type="button" onclick="showPage('tasks')">Anker setzen</button>`;
    return;
  }
  box.className = 'card today-anchor' + (anchor.is_completed ? ' done' : '');
  box.innerHTML = `<span class="pill">DEIN ANKER</span>
    <div class="today-anchor-title">${escapeHtml(anchor.title || '')}</div>
    ${anchor.is_completed ? '<div class="today-anchor-flag">erledigt</div>' : ''}`;
}

function renderTodayNow(state = todayNowState()) {
  const box = $('#todayNow');
  if (!box) return;
  const card = todayNowCard(state);
  box.className = `card today-now accent-${card.accent}`;
  box.innerHTML = `<div class="today-now-eyebrow">${card.eyebrow}</div>
    <div class="today-now-title">${card.title}</div>
    <div class="today-now-sub">${card.sub}</div>
    <button class="btn today-now-action" type="button" onclick="${card.onclick}">${card.action}</button>`;
}

function renderTodayNext(state = todayNowState()) {
  const box = $('#todayNext');
  if (!box) return;
  const rows = [];
  /* Was schon in der Jetzt-Karte steht, taucht hier nicht nochmal auf. */
  const shownTaskId = state.kind === 'task' ? state.task.id : null;

  todayOpenTasks()
    .filter(task => task.id !== shownTaskId)
    .slice(0, 4)
    .forEach(task => {
      rows.push(
        `<button class="today-row" type="button" onclick="showPage('tasks')"><span class="today-row-mark"></span><b>${escapeHtml(task.title || '')}</b><small>${escapeHtml(task.category || '')}</small></button>`,
      );
    });

  todayEvents()
    .slice(0, 3)
    .forEach(event => {
      const time = String(event.start_time || '').slice(0, 5);
      rows.push(
        `<button class="today-row" type="button" onclick="showPage('calendar')"><span class="today-row-mark cal"></span><b>${escapeHtml(event.title || '')}</b><small>${escapeHtml(time)}</small></button>`,
      );
    });

  box.innerHTML = rows.length
    ? rows.join('')
    : '<div class="today-empty">Nichts mehr offen für heute.</div>';
}

function todayMomentumRow(label, activeDays, color) {
  const today = new Date();
  const cells = [];
  for (let offset = TODAY_MOMENTUM_DAYS - 1; offset >= 0; offset--) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    const on = activeDays.has(todayDateKey(day));
    const delay = (0.08 + (TODAY_MOMENTUM_DAYS - 1 - offset) * 0.028).toFixed(2);
    cells.push(`<i class="${on ? 'on ' + color : ''}" style="animation-delay:${delay}s"></i>`);
  }
  return `<div class="today-streak"><span>${label}</span><div class="today-streak-bar">${cells.join('')}</div></div>`;
}

function renderTodayMomentum() {
  const box = $('#todayMomentum');
  if (!box) return;
  const tradeDays = new Set((trades || []).map(trade => trade.trade_date));
  const trainingDays = new Set(
    (fitnessSessions || []).map(session => session.session_date).filter(Boolean),
  );
  box.innerHTML =
    todayMomentumRow('Journal', tradeDays, 'cyan') +
    todayMomentumRow('Training', trainingDays, 'green');
}

function renderToday() {
  const greeting = $('#todayGreeting');
  if (greeting) greeting.textContent = todayGreeting();
  const dateText = $('#todayDate');
  if (dateText)
    dateText.textContent = new Intl.DateTimeFormat('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    }).format(new Date());
  /* Einmal bestimmen, überall dasselbe Bild. */
  const state = todayNowState();
  renderTodayAnchor();
  renderTodayNow(state);
  renderTodayNext(state);
  renderTodayMomentum();
}

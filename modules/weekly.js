let weeklyReview = null;
let weeklyTasks = [];
let weeklyOffset = 0;
let weeklyReady = true;

function weeklyDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function weeklyBounds() {
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  const dayOffset = (startDate.getDay() + 6) % 7;
  startDate.setDate(startDate.getDate() - dayOffset + weeklyOffset * 7);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  return {
    startDate,
    endDate,
    start: weeklyDateKey(startDate),
    end: weeklyDateKey(endDate),
  };
}

function isMissingWeeklyReviewTable(error) {
  const text = `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return (
    text.includes('42p01') ||
    text.includes('pgrst205') ||
    (text.includes('weekly_reviews') && text.includes('not find'))
  );
}

async function loadWeeklyReview() {
  const bounds = weeklyBounds();
  const [reviewResult, taskResult] = await Promise.all([
    sb
      .from('weekly_reviews')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('week_start', bounds.start)
      .maybeSingle(),
    sb
      .from('daily_tasks')
      .select('*')
      .eq('user_id', currentUser.id)
      .gte('task_date', bounds.start)
      .lte('task_date', bounds.end)
      .order('task_date', { ascending: true }),
  ]);

  if (reviewResult.error) {
    if (!isMissingWeeklyReviewTable(reviewResult.error)) throw reviewResult.error;
    weeklyReady = false;
    weeklyReview = null;
  } else {
    weeklyReady = true;
    weeklyReview = reviewResult.data || null;
  }

  if (taskResult.error) {
    if (
      typeof isMissingDailyTasksTable !== 'function' ||
      !isMissingDailyTasksTable(taskResult.error)
    )
      throw taskResult.error;
    weeklyTasks = [];
  } else {
    weeklyTasks = taskResult.data || [];
  }
}

function weeklyMetrics() {
  const bounds = weeklyBounds();
  const inRange = value => {
    const key = String(value || '').slice(0, 10);
    return key >= bounds.start && key <= bounds.end;
  };
  const weekTrades = trades.filter(trade => inRange(trade.trade_date));
  const weekSessions = fitnessSessions.filter(
    session =>
      session.status === 'completed' && inRange(session.session_date || session.completed_at),
  );
  const wins = weekTrades.filter(trade => Number(trade.pnl_usd) > 0).length;
  const pnl = weekTrades.reduce((sum, trade) => sum + (Number(trade.pnl_usd) || 0), 0);
  const winrate = weekTrades.length ? (wins / weekTrades.length) * 100 : 0;
  const followed = weekTrades.filter(trade => trade.followed_plan === true).length;
  const planRate = weekTrades.length ? (followed / weekTrades.length) * 100 : 0;
  const completedTasks = weeklyTasks.filter(task => task.is_completed).length;
  const taskRate = weeklyTasks.length ? (completedTasks / weeklyTasks.length) * 100 : 0;
  const activeDays = new Set(weeklyTasks.map(task => task.task_date)).size;
  const goalProgress = goals.length
    ? goals.reduce((sum, goal) => {
        const target = Number(goal.target_value) || 1;
        return sum + Math.max(0, Math.min(100, ((Number(goal.current_value) || 0) / target) * 100));
      }, 0) / goals.length
    : 0;
  const scoreParts = [
    Math.min(100, (weekSessions.length / 2) * 100),
    Math.min(100, (activeDays / 5) * 100),
  ];
  if (weekTrades.length) scoreParts.push(planRate);
  if (weeklyTasks.length) scoreParts.push(taskRate);
  const score = Math.round(scoreParts.reduce((sum, value) => sum + value, 0) / scoreParts.length);
  return {
    bounds,
    weekTrades,
    weekSessions,
    wins,
    pnl,
    winrate,
    planRate,
    completedTasks,
    taskRate,
    activeDays,
    goalProgress,
    score,
  };
}

function weeklyRangeLabel(bounds) {
  const start = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short' }).format(
    bounds.startDate,
  );
  const end = new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(bounds.endDate);
  return `${start} – ${end}`;
}

function weeklyInsightMarkup(metrics) {
  const insights = [];
  if (!metrics.weekTrades.length) {
    insights.push({
      icon: '📈',
      tone: 'neutral',
      title: 'Trading bewusst halten',
      copy: 'Noch keine Trades in dieser Woche – Qualität bleibt wichtiger als Aktivität.',
    });
  } else if (metrics.planRate >= 80) {
    insights.push({
      icon: '✓',
      tone: 'positive',
      title: 'Starke Trading-Disziplin',
      copy: `${metrics.planRate.toFixed(0)}% deiner Trades folgten dem Plan.`,
    });
  } else {
    insights.push({
      icon: '◎',
      tone: 'warning',
      title: 'Prozess vor Ergebnis',
      copy: `${metrics.planRate.toFixed(0)}% Plan-Treue – hier liegt dein größter Trading-Hebel.`,
    });
  }

  if (metrics.weekSessions.length >= 2) {
    insights.push({
      icon: '💪',
      tone: 'positive',
      title: 'Trainingsziel erreicht',
      copy: `${metrics.weekSessions.length} Einheiten bringen Konstanz in deine Woche.`,
    });
  } else {
    insights.push({
      icon: '💪',
      tone: 'warning',
      title: 'Training offen',
      copy: `Noch ${Math.max(0, 2 - metrics.weekSessions.length)} Einheit${metrics.weekSessions.length === 1 ? '' : 'en'} bis zum Wochenziel.`,
    });
  }

  if (!weeklyTasks.length) {
    insights.push({
      icon: '○',
      tone: 'neutral',
      title: 'Woche konkreter planen',
      copy: 'Deine To-dos machen den Fortschritt der Woche messbar.',
    });
  } else if (metrics.taskRate >= 80) {
    insights.push({
      icon: '✓',
      tone: 'positive',
      title: 'Fokus sitzt',
      copy: `${metrics.completedTasks} von ${weeklyTasks.length} Aufgaben erledigt.`,
    });
  } else {
    insights.push({
      icon: '◎',
      tone: 'warning',
      title: 'Prioritäten schärfen',
      copy: `${metrics.completedTasks} von ${weeklyTasks.length} Aufgaben erledigt – weniger kann mehr sein.`,
    });
  }

  const leadGoal = goals.find(goal => goal.next_action) || goals[0];
  if (leadGoal) {
    insights.push({
      icon: '🎯',
      tone: 'neutral',
      title: 'Nächster Ziel-Schritt',
      copy: leadGoal.next_action || leadGoal.title,
    });
  }

  return insights
    .map(
      item =>
        `<div class="weekly-insight insight-${item.tone}"><span>${item.icon}</span><div><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.copy)}</small></div></div>`,
    )
    .join('');
}

function renderWeeklyReview() {
  const metrics = weeklyMetrics();
  const scoreTitle =
    metrics.score >= 85
      ? 'Starke Woche'
      : metrics.score >= 65
        ? 'Stabil unterwegs'
        : metrics.score >= 40
          ? 'Im Aufbau'
          : 'Jetzt Kurs setzen';
  const scoreCopy =
    metrics.score >= 65
      ? 'Deine Systeme greifen ineinander. Halte den Prozess einfach und wiederholbar.'
      : 'Der Review zeigt dir klar, wo der nächste kleine Hebel liegt.';

  $('#weeklyRange').textContent = weeklyRangeLabel(metrics.bounds);
  $('#weeklyRangeStatus').textContent =
    weeklyOffset === 0
      ? 'Diese Woche'
      : weeklyOffset === -1
        ? 'Letzte Woche'
        : `${Math.abs(weeklyOffset)} Wochen zurück`;
  $('#weeklyNextBtn').disabled = weeklyOffset >= 0;
  $('#weeklySetupNotice').classList.toggle('hide', weeklyReady);
  $('#weeklyScoreRing').style.setProperty('--weekly-score', metrics.score);
  $('#weeklyScoreValue').textContent = `${metrics.score}%`;
  $('#weeklyScoreTitle').textContent = scoreTitle;
  $('#weeklyScoreCopy').textContent = scoreCopy;
  $('#homeWeeklyPrompt').textContent = `${metrics.score}% System Score · Review öffnen`;

  $('#weeklyPnl').textContent = money(metrics.pnl);
  $('#weeklyPnl').className = 'weekly-metric ' + (metrics.pnl >= 0 ? 'pos' : 'neg');
  $('#weeklyTradeMeta').textContent = metrics.weekTrades.length
    ? `${metrics.weekTrades.length} Trades · ${metrics.winrate.toFixed(0)}% Winrate · ${metrics.planRate.toFixed(0)}% Plan`
    : 'Noch keine Trades';
  $('#weeklyWorkouts').textContent = String(metrics.weekSessions.length);
  $('#weeklyFitnessMeta').textContent =
    metrics.weekSessions.length >= 2 ? 'Wochenziel erreicht' : 'Ziel: 2 Einheiten';
  $('#weeklyTasksDone').textContent = `${metrics.completedTasks}/${weeklyTasks.length}`;
  $('#weeklyTaskMeta').textContent = weeklyTasks.length
    ? `${metrics.taskRate.toFixed(0)}% erledigt`
    : 'Noch keine Aufgaben';
  $('#weeklyFocusDays').textContent = String(metrics.activeDays);
  $('#weeklyFocusMeta').textContent =
    metrics.activeDays === 1 ? '1 Tag mit Aufgaben' : `${metrics.activeDays} Tage mit Aufgaben`;
  $('#weeklyGoalProgress').textContent = goals.length ? `${metrics.goalProgress.toFixed(0)}%` : '–';
  $('#weeklyGoalMeta').textContent = goals.length
    ? `${goals.length} aktive Ziele`
    : 'Noch keine Ziele';
  $('#weeklyInsights').innerHTML = weeklyInsightMarkup(metrics);

  $('#weeklyRating').value = weeklyReview?.rating || 7;
  $('#weeklyRatingValue').textContent = `${weeklyReview?.rating || 7}/10`;
  $('#weeklyWins').value = weeklyReview?.wins || '';
  $('#weeklyChallenges').value = weeklyReview?.challenges || '';
  $('#weeklyLearning').value = weeklyReview?.learning || '';
  $('#weeklyNextFocus').value = weeklyReview?.next_week_focus || '';
  $('#weeklyPriority1').value = weeklyReview?.priority_one || '';
  $('#weeklyPriority2').value = weeklyReview?.priority_two || '';
  $('#weeklyPriority3').value = weeklyReview?.priority_three || '';
  $$('#weeklyForm input,#weeklyForm textarea,#weeklyForm button').forEach(
    field => (field.disabled = !weeklyReady),
  );
}

async function shiftWeeklyReview(direction) {
  const nextOffset = Math.min(0, weeklyOffset + direction);
  if (nextOffset === weeklyOffset) return;
  weeklyOffset = nextOffset;
  $('#weeklyRangeStatus').textContent = 'Wird geladen…';
  try {
    await loadWeeklyReview();
    renderWeeklyReview();
  } catch (error) {
    console.error(error);
    alert('Weekly Review konnte nicht geladen werden: ' + error.message);
  }
}

$('#weeklyRating')?.addEventListener('input', event => {
  $('#weeklyRatingValue').textContent = `${event.target.value}/10`;
});

$('#weeklyForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!weeklyReady) return alert('Bitte zuerst die Weekly-Review-Migration in Supabase ausführen.');
  const bounds = weeklyBounds();
  const submit = $('#weeklySaveBtn');
  submit.disabled = true;
  submit.textContent = 'Wird gespeichert…';
  const payload = {
    user_id: currentUser.id,
    week_start: bounds.start,
    rating: Number($('#weeklyRating').value) || 7,
    wins: $('#weeklyWins').value.trim(),
    challenges: $('#weeklyChallenges').value.trim(),
    learning: $('#weeklyLearning').value.trim(),
    next_week_focus: $('#weeklyNextFocus').value.trim(),
    priority_one: $('#weeklyPriority1').value.trim(),
    priority_two: $('#weeklyPriority2').value.trim(),
    priority_three: $('#weeklyPriority3').value.trim(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb
    .from('weekly_reviews')
    .upsert(payload, { onConflict: 'user_id,week_start' });
  if (error) {
    submit.disabled = false;
    submit.textContent = 'Weekly Review speichern';
    return alert(error.message);
  }
  await loadWeeklyReview();
  renderWeeklyReview();
  submit.textContent = 'Gespeichert ✓';
  setTimeout(() => {
    submit.textContent = 'Weekly Review speichern';
    submit.disabled = false;
  }, 1400);
});

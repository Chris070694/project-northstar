/* Die Version gehoert zum Aufruf, nicht in die Funktion: aendert sich ein
   optionales Modul, muss sie hoch — sonst liefert der Cache die alte Fassung. */
function loadOptionalModule(src, version = 1) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src^="${src}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = `${src}?v=${version}`;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`${src} konnte nicht geladen werden.`));
    document.head.appendChild(script);
  });
}

async function loadAll() {
  try {
    await loadFocus();
    await Promise.all([
      loadTrades(),
      loadFunded(),
      loadGoals(),
      loadFitness(),
      loadNotes(),
      loadAcademy(),
      loadCalendar(),
      loadWeeklyReview(),
      loadReminderSettings(),
      loadLibrary(),
      loadHydration(),
      loadGymBag(),
      loadHabits(),
    ]);
    renderFocus();
    renderTrading();
    renderFunded();
    if (typeof renderTradingPsychology === 'function') renderTradingPsychology();
    await renderGoals();
    renderFitness();
    renderGymBag();
    renderHabits();
    renderNotes();
    await renderAcademy();
    await renderLibrary();
    renderCalendar();
    renderWeeklyReview();
    renderReminderSettings();
    renderHydration();
    renderBackupCenter();
    renderToday();
  } catch (err) {
    console.error(err);
    alert('Daten konnten nicht geladen werden: ' + err.message);
  }
}
async function boot() {
  try {
    await loadOptionalModule('modules/hydration.js', 2);
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (err) {
    $('#authMsg').textContent = err.message || 'config.js konnte nicht geladen werden.';
    return;
  }
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (session) {
    currentUser = session.user;
    showApp();
    await loadAll();
  }
  sb.auth.onAuthStateChange(async (_e, s) => {
    if (s) {
      currentUser = s.user;
      showApp();
      await loadAll();
    } else {
      currentUser = null;
      showAuth();
    }
  });
}
boot();

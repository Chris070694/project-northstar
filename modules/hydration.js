let hydrationReady = true;
let hydrationGoalMl = 2500;
let hydrationAmountMl = 0;

function hydrationDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isMissingHydrationSchema(error) {
  const message =
    `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return (
    message.includes('42p01') ||
    message.includes('pgrst205') ||
    (message.includes('hydration_') && /does not exist|schema cache|not find/i.test(message))
  );
}

function ensureHydrationCard() {
  if (document.getElementById('hydrationCard')) return;
  /* Die Karte hing frueher an #homeFitnessOverview, der Fitness-Kachel des
     Dashboards. Seit Dashboard und Heute zusammengelegt sind, gibt es die nicht
     mehr -- und weil die Funktion damals still ausstieg, verschwand die Karte
     kommentarlos. Jetzt ein eigener, benannter Platz, und eine Meldung, falls
     er fehlt. */
  const slot = document.getElementById('hydrationSlot');
  if (!slot) {
    console.warn('Hydration: #hydrationSlot fehlt im Dokument — die Trinkkarte entfällt.');
    return;
  }
  const card = document.createElement('section');
  card.id = 'hydrationCard';
  card.className = 'card hydration-card';
  card.innerHTML = `
    <div class="hydration-head">
      <div><div class="eyebrow">💧 TRINKEN HEUTE</div><h2>Hydration</h2><p id="hydrationStatus" class="sub">Dein Tagesziel wird geladen…</p></div>
      <button class="btn hydration-goal-btn" type="button" onclick="setHydrationGoal()">Ziel ändern</button>
    </div>
    <div class="hydration-value"><strong id="hydrationAmount">0,00 L</strong><span>/ <b id="hydrationGoal">2,50 L</b></span></div>
    <div class="hydration-track"><span id="hydrationProgress"></span></div>
    <div class="hydration-actions">
      <button class="btn" type="button" onclick="addHydration(250)">+ 250 ml</button>
      <button class="btn primary" type="button" onclick="addHydration(500)">+ 500 ml</button>
      <button class="btn hydration-undo" type="button" onclick="addHydration(-250)">− 250 ml</button>
    </div>
    <div id="hydrationSetupNotice" class="task-setup-notice hide">Hydration muss noch in Supabase eingerichtet werden.</div>`;
  slot.appendChild(card);
}

function ensureHydrationStyles() {
  if (document.getElementById('hydrationStyles')) return;
  const style = document.createElement('style');
  style.id = 'hydrationStyles';
  style.textContent = `
    .hydration-card{margin-top:24px;padding:22px;overflow:hidden;position:relative}
    .hydration-card:after{content:'💧';position:absolute;right:-8px;top:-24px;font-size:110px;opacity:.055;pointer-events:none}
    .hydration-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
    .hydration-head h2{margin:4px 0 4px}.hydration-head p{margin:0}
    .hydration-value{display:flex;align-items:baseline;gap:8px;margin-top:20px}
    .hydration-value strong{font-size:34px;letter-spacing:-1px}.hydration-value span{opacity:.7;font-size:16px}
    .hydration-track{height:10px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;margin:14px 0 18px}
    .hydration-track span{display:block;width:0;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--cyan),#4ea8ff);transition:width .25s ease}
    .hydration-actions{display:flex;gap:10px;flex-wrap:wrap}.hydration-actions .btn{min-width:110px}
    .hydration-undo{opacity:.75}.hydration-goal-btn{position:relative;z-index:1}
    @media(max-width:640px){.hydration-head{align-items:center}.hydration-card{padding:18px}.hydration-value strong{font-size:29px}.hydration-actions{display:grid;grid-template-columns:1fr 1fr}.hydration-actions .btn{min-width:0}.hydration-actions .hydration-undo{grid-column:1/-1}}
  `;
  document.head.appendChild(style);
}

async function loadHydration() {
  ensureHydrationStyles();
  ensureHydrationCard();
  const day = hydrationDateKey();
  const [settingsResult, dayResult] = await Promise.all([
    sb
      .from('hydration_settings')
      .select('daily_goal_ml')
      .eq('user_id', currentUser.id)
      .maybeSingle(),
    sb
      .from('hydration_days')
      .select('amount_ml')
      .eq('user_id', currentUser.id)
      .eq('day', day)
      .maybeSingle(),
  ]);
  const error = settingsResult.error || dayResult.error;
  if (error) {
    if (!isMissingHydrationSchema(error)) throw error;
    hydrationReady = false;
    renderHydration();
    return;
  }
  hydrationReady = true;
  hydrationGoalMl = Number(settingsResult.data?.daily_goal_ml) || 2500;
  hydrationAmountMl = Number(dayResult.data?.amount_ml) || 0;
  renderHydration();
}

function renderHydration() {
  ensureHydrationStyles();
  ensureHydrationCard();
  const amount = document.getElementById('hydrationAmount');
  if (!amount) return;
  const percent = Math.min(100, Math.round((hydrationAmountMl / hydrationGoalMl) * 100));
  amount.textContent = `${(hydrationAmountMl / 1000).toFixed(2).replace('.', ',')} L`;
  document.getElementById('hydrationGoal').textContent =
    `${(hydrationGoalMl / 1000).toFixed(2).replace('.', ',')} L`;
  document.getElementById('hydrationProgress').style.width = `${percent}%`;
  const remaining = Math.max(0, hydrationGoalMl - hydrationAmountMl);
  document.getElementById('hydrationStatus').textContent = !hydrationReady
    ? 'Einmal die Hydration-Migration in Supabase ausführen.'
    : hydrationAmountMl >= hydrationGoalMl
      ? 'Tagesziel erreicht ✓ Stark – jetzt einfach normal weitertrinken.'
      : `Noch ${(remaining / 1000).toFixed(2).replace('.', ',')} L bis zu deinem Tagesziel.`;
  document.getElementById('hydrationSetupNotice').classList.toggle('hide', hydrationReady);
  document
    .querySelectorAll('#hydrationCard button')
    .forEach(button => (button.disabled = !hydrationReady));
}

async function addHydration(delta) {
  if (!hydrationReady) return alert('Bitte zuerst die Hydration-Migration in Supabase ausführen.');
  const next = Math.max(0, Math.min(20000, hydrationAmountMl + delta));
  const { data, error } = await sb
    .from('hydration_days')
    .upsert(
      {
        user_id: currentUser.id,
        day: hydrationDateKey(),
        amount_ml: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,day' },
    )
    .select('amount_ml')
    .single();
  if (error) return alert(error.message);
  hydrationAmountMl = Number(data.amount_ml) || 0;
  renderHydration();
}

async function setHydrationGoal() {
  if (!hydrationReady) return alert('Bitte zuerst die Hydration-Migration in Supabase ausführen.');
  const current = (hydrationGoalMl / 1000).toFixed(1).replace('.', ',');
  const input = prompt('Wie viele Liter möchtest du täglich trinken? (0,5–10 L)', current);
  if (input === null) return;
  const liters = Number(input.replace(',', '.'));
  if (!Number.isFinite(liters) || liters < 0.5 || liters > 10)
    return alert('Bitte einen Wert zwischen 0,5 und 10 Litern eingeben.');
  const goal = Math.round(liters * 1000);
  const { data, error } = await sb
    .from('hydration_settings')
    .upsert(
      {
        user_id: currentUser.id,
        daily_goal_ml: goal,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select('daily_goal_ml')
    .single();
  if (error) return alert(error.message);
  hydrationGoalMl = Number(data.daily_goal_ml) || 2500;
  renderHydration();
}

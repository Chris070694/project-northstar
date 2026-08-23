let editingTradeId = null;
let tradingV2Ready = true;
let tradingCockpitReady = true;
let tradingSettings = {};

const DEFAULT_TRADING_SETTINGS = {
  account_balance: 10000,
  default_risk_percent: 0.25,
  contract_value: 100,
  daily_loss_limit_r: 2,
  max_trades_per_day: 2,
};

/* Mindestzahl an Vorkommen, bevor die Cockpit-Kachel einen "haeufigsten
   Regelbruch" ausruft. Darunter waere es Rauschen mit Ueberschrift. */
const COCKPIT_MIN_TOP_BREAK = 5;

const TRADE_CHECKS = [
  { key: 'scenario', label: 'Long- oder Short-Szenario vorab definiert' },
  { key: 'liquidity', label: 'Ziel-Liquidität klar markiert' },
  { key: 'sweep', label: 'Sweep oder sinnvolles SMT bestätigt' },
  { key: 'structure', label: 'Displacement und MSS vorhanden' },
  { key: 'entry_zone', label: 'Einstieg liegt an der geplanten Zone' },
  { key: 'news', label: 'News und Session-Zeit geprüft' },
  { key: 'invalidation', label: 'Invalidierung und Stop sind logisch' },
  { key: 'emotion', label: 'Ruhig genug, den Verlust zu akzeptieren' },
];

function tradeDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isMissingTradingV2Columns(error) {
  const message = String(error?.message || '');
  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    (/result|followed_plan|setup_tags|mistakes|learning|before_image_path|after_image_path/.test(
      message,
    ) &&
      /column|schema cache|does not exist/i.test(message))
  );
}

function isMissingTradingCockpitSchema(error) {
  const message =
    `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return (
    /42p01|42703|pgrst204|pgrst205/.test(message) ||
    (/trading_settings|pre_trade_checklist|rule_score|position_size|execution_score/.test(
      message,
    ) &&
      /column|schema cache|does not exist|not find/i.test(message))
  );
}

async function loadTrades() {
  const [tradeResult, schemaResult, cockpitResult, settingsResult] = await Promise.all([
    sb.from('trades').select('*').order('trade_date', { ascending: false }),
    sb
      .from('trades')
      .select(
        'id,result,followed_plan,setup_tags,mistakes,learning,before_image_path,after_image_path',
      )
      .limit(1),
    sb
      .from('trades')
      .select(
        'id,pre_trade_checklist,rule_score,rule_breaks,account_balance_snapshot,risk_percent,contract_value,position_size,emotion_after,execution_score',
      )
      .limit(1),
    sb.from('trading_settings').select('*').maybeSingle(),
  ]);
  if (tradeResult.error) throw tradeResult.error;
  trades = tradeResult.data || [];

  if (schemaResult.error) {
    if (!isMissingTradingV2Columns(schemaResult.error)) throw schemaResult.error;
    tradingV2Ready = false;
  } else tradingV2Ready = true;

  const cockpitMissing = cockpitResult.error && isMissingTradingCockpitSchema(cockpitResult.error);
  const settingsMissing =
    settingsResult.error && isMissingTradingCockpitSchema(settingsResult.error);
  if (cockpitResult.error && !cockpitMissing) throw cockpitResult.error;
  if (settingsResult.error && !settingsMissing) throw settingsResult.error;
  tradingCockpitReady = !cockpitMissing && !settingsMissing;
  tradingSettings = {
    ...DEFAULT_TRADING_SETTINGS,
    ...(tradingCockpitReady && settingsResult.data ? settingsResult.data : {}),
  };
}

function deriveTradeResult(pnl) {
  const value = Number(pnl) || 0;
  return value > 0 ? 'win' : value < 0 ? 'loss' : 'breakeven';
}

function tradeResultLabel(result, pnl) {
  const value = result || deriveTradeResult(pnl);
  return { win: 'Win', loss: 'Loss', breakeven: 'Break-even', open: 'Offen' }[value] || 'Offen';
}

function hasTradeChecklist(trade) {
  return Boolean(trade?.pre_trade_checklist && Object.keys(trade.pre_trade_checklist).length);
}

function readTradeChecklist() {
  return Object.fromEntries(
    TRADE_CHECKS.map(item => [item.key, Boolean($(`[data-trade-check="${item.key}"]`)?.checked)]),
  );
}

function tradeRuleScore(checklist) {
  const completed = TRADE_CHECKS.filter(item => checklist?.[item.key]).length;
  return Math.round((completed / TRADE_CHECKS.length) * 100);
}

function tradeRuleBreaks(checklist) {
  return TRADE_CHECKS.filter(item => !checklist?.[item.key]).map(item => item.label);
}

function applyTradeChecklist(checklist = {}) {
  TRADE_CHECKS.forEach(item => {
    const input = $(`[data-trade-check="${item.key}"]`);
    if (input) input.checked = Boolean(checklist[item.key]);
  });
}

function formatTradeNumber(value, maxDigits = 6) {
  if (!Number.isFinite(Number(value))) return '–';
  return Number(value).toLocaleString('de-DE', { maximumFractionDigits: maxDigits });
}

function getTodayTradingState() {
  const todayTrades = trades.filter(trade => trade.trade_date === tradeDateKey());
  const todayR = todayTrades.reduce((sum, trade) => sum + (Number(trade.r_multiple) || 0), 0);
  const maxTrades = Number(tradingSettings.max_trades_per_day) || 2;
  const lossLimit = Number(tradingSettings.daily_loss_limit_r) || 2;
  return {
    todayTrades,
    todayR,
    maxTrades,
    lossLimit,
    tradeLimitReached: todayTrades.length >= maxTrades,
    lossLimitReached: todayR <= -lossLimit,
  };
}

function resetTradePreview(type) {
  const preview = $(`#t${type}Preview`);
  const label = $(`#t${type}Label`);
  preview.src = '';
  preview.classList.add('hide');
  label.textContent = `${type === 'Before' ? 'Vorher' : 'Nachher'}-Screenshot auswählen`;
}

async function setStoredTradePreview(type, path) {
  resetTradePreview(type);
  if (!path) return;
  const url = await signedUrl(path);
  const preview = $(`#t${type}Preview`);
  if (url) {
    preview.src = url;
    preview.classList.remove('hide');
  }
  $(`#t${type}Label`).textContent = 'Bild gespeichert - zum Ersetzen klicken';
}

function previewTradeFile(type, file) {
  if (!file) return resetTradePreview(type);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    alert('Bitte nur JPG, PNG oder WebP verwenden.');
    $(`#t${type}Image`).value = '';
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    alert('Das Bild darf maximal 8 MB groß sein.');
    $(`#t${type}Image`).value = '';
    return;
  }
  const preview = $(`#t${type}Preview`);
  preview.src = URL.createObjectURL(file);
  preview.classList.remove('hide');
  $(`#t${type}Label`).textContent = file.name;
}

$('#tBeforeImage')?.addEventListener('change', event =>
  previewTradeFile('Before', event.target.files[0]),
);
$('#tAfterImage')?.addEventListener('change', event =>
  previewTradeFile('After', event.target.files[0]),
);

function updateExecutionScoreLabel() {
  const value = Number($('#tExecutionScore')?.value) || 7;
  if ($('#tExecutionScoreValue')) $('#tExecutionScoreValue').textContent = `${value}/10`;
}

function updateTradeCockpit() {
  const balance = Number($('#tAccountBalance')?.value) || 0;
  const riskPercent = Number($('#tRiskPercent')?.value) || 0;
  const contractValue = Number($('#tContractValue')?.value) || 0;
  const entryRaw = $('#tEntry')?.value ?? '';
  const stopRaw = $('#tStop')?.value ?? '';
  const targetRaw = $('#tTp')?.value ?? '';
  const entry = entryRaw !== '' ? Number(entryRaw) : Number.NaN;
  const stop = stopRaw !== '' ? Number(stopRaw) : Number.NaN;
  const target = targetRaw !== '' ? Number(targetRaw) : Number.NaN;
  const riskAmount = balance > 0 && riskPercent > 0 ? (balance * riskPercent) / 100 : 0;
  const distance = Number.isFinite(entry) && Number.isFinite(stop) ? Math.abs(entry - stop) : 0;
  const positionSize =
    distance > 0 && contractValue > 0 ? riskAmount / (distance * contractValue) : 0;
  const rewardDistance =
    Number.isFinite(entry) && Number.isFinite(target) ? Math.abs(target - entry) : 0;
  const plannedR = distance > 0 && rewardDistance > 0 ? rewardDistance / distance : 0;

  if ($('#tRisk')) $('#tRisk').value = riskAmount ? riskAmount.toFixed(2) : '';
  if ($('#tPositionSize'))
    $('#tPositionSize').value = positionSize
      ? positionSize.toFixed(8).replace(/0+$/, '').replace(/\.$/, '')
      : '';
  if ($('#tradeRiskAmount'))
    $('#tradeRiskAmount').textContent = riskAmount ? money(riskAmount) : '$0.00';
  if ($('#tradeStopDistance'))
    $('#tradeStopDistance').textContent = distance ? formatTradeNumber(distance) : '–';
  if ($('#tradePositionSize'))
    $('#tradePositionSize').textContent = positionSize ? formatTradeNumber(positionSize, 8) : '–';
  if ($('#tradePlannedR'))
    $('#tradePlannedR').textContent = plannedR ? `${plannedR.toFixed(2)}R` : '–';

  const checklist = readTradeChecklist();
  const score = tradeRuleScore(checklist);
  const missing = TRADE_CHECKS.length - TRADE_CHECKS.filter(item => checklist[item.key]).length;
  const dayState = getTodayTradingState();
  const blockedByDay = !editingTradeId && (dayState.tradeLimitReached || dayState.lossLimitReached);
  const riskValid = riskAmount > 0 && distance > 0 && contractValue > 0 && positionSize > 0;
  const allowed = score === 100 && riskValid && !blockedByDay;
  const gate = $('#tradeGate');

  if ($('#tRuleScore')) $('#tRuleScore').textContent = `${score}%`;
  if ($('#tradeChecklistProgress')) $('#tradeChecklistProgress').style.width = `${score}%`;
  if (gate) {
    gate.classList.toggle('allowed', allowed);
    gate.classList.toggle('blocked', !allowed);
    $('#tradeGateTitle').textContent = allowed ? 'Trade erlaubt' : 'Trade noch nicht freigegeben';
    let reason = 'Alle Regeln erfüllt. Jetzt nur noch sauber ausführen.';
    if (blockedByDay)
      reason = dayState.lossLimitReached
        ? 'Dein Tagesverlust-Limit ist erreicht.'
        : 'Dein maximales Trade-Limit für heute ist erreicht.';
    else if (missing) reason = `Noch ${missing} Checklistenpunkt${missing === 1 ? '' : 'e'} offen.`;
    else if (!riskValid) reason = 'Entry, Stop und Risikodaten vollständig eingeben.';
    $('#tradeGateCopy').textContent = reason;
  }
  if ($('#tradeSubmitHint'))
    $('#tradeSubmitHint').textContent = allowed
      ? 'Freigegebener A-Plan.'
      : 'Du kannst den Trade trotzdem speichern - CPRB dokumentiert den Regelverstoß ehrlich.';
  const hasPnl = $('#tPnl')?.value !== '';
  if ($('#tradeSubmitLabel'))
    $('#tradeSubmitLabel').textContent = editingTradeId
      ? 'Änderungen speichern'
      : hasPnl
        ? 'Trade dokumentieren'
        : 'Trade-Plan speichern';
}

async function openTrade(id = null) {
  if (!tradingV2Ready)
    return alert('Bitte zuerst die Trading-Journal-v2-Migration in Supabase ausführen.');
  if (!tradingCockpitReady)
    return alert('Bitte zuerst die Trading-Cockpit-Migration in Supabase ausführen.');
  const form = $('#tradeForm');
  form.reset();
  editingTradeId = id;
  $('#tDate').value = tradeDateKey();
  if ($('#tFundedPhase') && typeof fundedTradeOptionsHtml === 'function')
    $('#tFundedPhase').innerHTML = fundedTradeOptionsHtml();
  $('#tradeModalTitle').textContent = id ? 'Trade bearbeiten' : 'Trade planen';
  resetTradePreview('Before');
  resetTradePreview('After');
  applyTradeChecklist({});
  $('#tAccountBalance').value = tradingSettings.account_balance;
  $('#tRiskPercent').value = tradingSettings.default_risk_percent;
  $('#tContractValue').value = tradingSettings.contract_value;
  $('#tExecutionScore').value = 7;
  $('#tEmotion').value = 'Ruhig';
  $('#tEmotionAfter').value = 'Ruhig';

  if (id) {
    const trade = trades.find(item => item.id === id);
    if (!trade) return alert('Trade nicht gefunden.');
    $('#tDate').value = trade.trade_date || tradeDateKey();
    if ($('#tFundedPhase') && typeof fundedTradeOptionsHtml === 'function')
      $('#tFundedPhase').innerHTML = fundedTradeOptionsHtml(trade.funded_phase_id);
    $('#tMarket').value = trade.market || '';
    $('#tDirection').value = trade.direction || 'Long';
    $('#tSession').value = trade.session || 'London';
    $('#tSetup').value = trade.setup || '';
    $('#tTags').value = (trade.setup_tags || []).join(', ');
    $('#tPnl').value = trade.result === 'open' ? '' : (trade.pnl_usd ?? '');
    $('#tR').value = trade.result === 'open' ? '' : (trade.r_multiple ?? '');
    $('#tResult').value =
      trade.result === 'open' ? 'auto' : trade.result || deriveTradeResult(trade.pnl_usd);
    $('#tEmotion').value = trade.emotion || 'Ruhig';
    $('#tEmotionAfter').value = trade.emotion_after || 'Ruhig';
    $('#tExecutionScore').value = trade.execution_score || 7;
    $('#tFollowedPlan').checked = Boolean(trade.followed_plan);
    $('#tAccountBalance').value = trade.account_balance_snapshot || tradingSettings.account_balance;
    $('#tRiskPercent').value = trade.risk_percent || tradingSettings.default_risk_percent;
    $('#tContractValue').value = trade.contract_value || tradingSettings.contract_value;
    $('#tEntry').value = trade.entry_price ?? '';
    $('#tStop').value = trade.stop_loss ?? '';
    $('#tTp').value = trade.take_profit ?? '';
    $('#tNotes').value = trade.notes || '';
    $('#tMistakes').value = trade.mistakes || '';
    $('#tLearning').value = trade.learning || '';
    applyTradeChecklist(trade.pre_trade_checklist || {});
    await Promise.all([
      setStoredTradePreview('Before', trade.before_image_path),
      setStoredTradePreview('After', trade.after_image_path),
    ]);
  }
  updateExecutionScoreLabel();
  updateTradeCockpit();
  $('#tradeModal').classList.add('open');
}

function closeTrade() {
  $('#tradeModal').classList.remove('open');
  editingTradeId = null;
}

['tAccountBalance', 'tRiskPercent', 'tContractValue', 'tEntry', 'tStop', 'tTp', 'tPnl'].forEach(
  id => {
    $(`#${id}`)?.addEventListener('input', updateTradeCockpit);
  },
);
$$('.trade-precheck').forEach(input => input.addEventListener('change', updateTradeCockpit));
$('#tExecutionScore')?.addEventListener('input', updateExecutionScoreLabel);

$('#tradingSettingsForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!tradingCockpitReady)
    return alert('Bitte zuerst die Trading-Cockpit-Migration in Supabase ausführen.');
  const button = $('#saveTradingSettingsBtn');
  const payload = {
    user_id: currentUser.id,
    account_balance: Number($('#tradeAccountBalance').value) || 0,
    default_risk_percent: Number($('#tradeDefaultRisk').value) || 0.25,
    contract_value: Number($('#tradeDefaultContract').value) || 100,
    daily_loss_limit_r: Number($('#tradeDailyLossLimit').value) || 2,
    max_trades_per_day: Number($('#tradeMaxTrades').value) || 2,
    updated_at: new Date().toISOString(),
  };
  button.disabled = true;
  button.textContent = 'Wird gespeichert…';
  const { error } = await sb.from('trading_settings').upsert(payload, { onConflict: 'user_id' });
  button.disabled = false;
  button.textContent = 'Cockpit speichern';
  if (error) return alert(error.message);
  tradingSettings = { ...tradingSettings, ...payload };
  renderTrading();
});

$('#tradeForm').onsubmit = async event => {
  event.preventDefault();
  if (!tradingV2Ready)
    return alert('Bitte zuerst die Trading-Journal-v2-Migration in Supabase ausführen.');
  if (!tradingCockpitReady)
    return alert('Bitte zuerst die Trading-Cockpit-Migration in Supabase ausführen.');

  const existing = editingTradeId ? trades.find(item => item.id === editingTradeId) : null;
  const beforeFile = $('#tBeforeImage').files[0];
  const afterFile = $('#tAfterImage').files[0];
  const uploaded = [];

  try {
    const [beforePath, afterPath] = await Promise.all([
      beforeFile
        ? uploadMediaToFolder(beforeFile, 'trades/before')
        : Promise.resolve(existing?.before_image_path || null),
      afterFile
        ? uploadMediaToFolder(afterFile, 'trades/after')
        : Promise.resolve(existing?.after_image_path || null),
    ]);
    if (beforeFile && beforePath) uploaded.push(beforePath);
    if (afterFile && afterPath) uploaded.push(afterPath);

    const risk = Number($('#tRisk').value) || 0;
    const hasPnl = $('#tPnl').value !== '';
    const pnl = hasPnl ? Number($('#tPnl').value) || 0 : 0;
    const selectedResult = $('#tResult').value;
    if (!hasPnl && !['auto', 'open'].includes(selectedResult))
      throw new Error('Für Win, Loss oder Break-even bitte zuerst P&L eintragen.');
    const checklist = readTradeChecklist();
    const score = tradeRuleScore(checklist);
    const tags = [
      ...new Set(
        $('#tTags')
          .value.split(',')
          .map(tag => tag.trim())
          .filter(Boolean),
      ),
    ];
    const payload = {
      user_id: currentUser.id,
      trade_date: $('#tDate').value,
      market: $('#tMarket').value.trim().toUpperCase(),
      direction: $('#tDirection').value,
      session: $('#tSession').value,
      setup: $('#tSetup').value.trim() || 'Ohne Setup',
      setup_tags: tags,
      risk_usd: risk,
      pnl_usd: pnl,
      r_multiple: hasPnl
        ? $('#tR').value !== ''
          ? Number($('#tR').value)
          : risk
            ? pnl / risk
            : 0
        : 0,
      result:
        selectedResult === 'auto' ? (hasPnl ? deriveTradeResult(pnl) : 'open') : selectedResult,
      emotion: $('#tEmotion').value,
      emotion_after: $('#tEmotionAfter').value,
      execution_score: Number($('#tExecutionScore').value) || 7,
      followed_plan: $('#tFollowedPlan').checked,
      pre_trade_checklist: checklist,
      rule_score: score,
      rule_breaks: tradeRuleBreaks(checklist),
      account_balance_snapshot: Number($('#tAccountBalance').value) || null,
      risk_percent: Number($('#tRiskPercent').value) || null,
      contract_value: Number($('#tContractValue').value) || null,
      position_size: Number($('#tPositionSize').value) || null,
      notes: $('#tNotes').value.trim(),
      mistakes: $('#tMistakes').value.trim(),
      learning: $('#tLearning').value.trim(),
      before_image_path: beforePath,
      after_image_path: afterPath,
      ...(typeof fundedTradePayload === 'function' ? fundedTradePayload() : {}),
      updated_at: new Date().toISOString(),
    };
    if ($('#tEntry').value !== '') payload.entry_price = $('#tEntry').value;
    else payload.entry_price = null;
    if ($('#tStop').value !== '') payload.stop_loss = $('#tStop').value;
    else payload.stop_loss = null;
    if ($('#tTp').value !== '') payload.take_profit = $('#tTp').value;
    else payload.take_profit = null;

    const query = editingTradeId
      ? sb.from('trades').update(payload).eq('id', editingTradeId)
      : sb.from('trades').insert(payload);
    const { error } = await query;
    if (error) throw error;

    const replaced = [
      beforeFile && existing?.before_image_path,
      afterFile && existing?.after_image_path,
    ].filter(Boolean);
    if (replaced.length) await sb.storage.from('northstar-media').remove(replaced);

    event.target.reset();
    closeTrade();
    await loadAll();
    showPage('trading');
  } catch (error) {
    if (uploaded.length) await sb.storage.from('northstar-media').remove(uploaded);
    alert(error.message);
  }
};

async function deleteTrade(id) {
  if (!confirm('Trade wirklich löschen?')) return;
  const trade = trades.find(item => item.id === id);
  const { error } = await sb.from('trades').delete().eq('id', id);
  if (error) return alert(error.message);
  const paths = [trade?.before_image_path, trade?.after_image_path].filter(Boolean);
  if (paths.length) await sb.storage.from('northstar-media').remove(paths);
  closeTradeDetail();
  await loadAll();
}

function closeTradeDetail() {
  $('#tradeDetailModal').classList.remove('open');
}

async function showTradeDetail(id) {
  const trade = trades.find(item => item.id === id);
  if (!trade) return;
  $('#tradeDetailTitle').textContent = `${trade.market} · ${trade.direction}`;
  $('#tradeDetailContent').innerHTML = '<div class="empty">Trade wird geladen…</div>';
  $('#tradeDetailModal').classList.add('open');

  const [beforeUrl, afterUrl] = await Promise.all([
    signedUrl(trade.before_image_path),
    signedUrl(trade.after_image_path),
  ]);
  const result = trade.result || deriveTradeResult(trade.pnl_usd);
  const tags = (trade.setup_tags || [])
    .map(tag => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join('');
  const chart = (url, label) =>
    url
      ? `<div class="trade-chart"><span>${label}</span><img src="${url}" alt="${label}"></div>`
      : `<div class="trade-chart empty-chart"><span>${label}</span><div>Kein Screenshot</div></div>`;
  const hasChecklist = hasTradeChecklist(trade);
  const ruleScore = hasChecklist ? Number(trade.rule_score) || 0 : null;
  const breaks = hasChecklist ? trade.rule_breaks || [] : [];

  $('#tradeDetailContent').innerHTML = `
    <div class="trade-detail-summary">
      <span class="trade-result result-${result}">${tradeResultLabel(result, trade.pnl_usd)}</span>
      <span class="badge ${String(trade.direction || 'long').toLowerCase()}">${escapeHtml(trade.direction || '–')}</span>
      <span>${escapeHtml(trade.session || '–')}</span>
      <span>${escapeHtml(trade.trade_date || '–')}</span>
      <span class="${Number(trade.pnl_usd) >= 0 ? 'pos' : 'neg'}"><b>${money(trade.pnl_usd)}</b></span>
      <span><b>${(Number(trade.r_multiple) || 0).toFixed(2)}R</b></span>
    </div>
    <div class="trade-rule-status ${trade.followed_plan ? 'followed' : 'broken'}">${trade.followed_plan ? '✓ Nach Plan gehandelt' : '! Nicht nach Plan gehandelt'}</div>
    <div class="trade-cockpit-detail">
      <div><small>Pre-Trade Score</small><b>${ruleScore === null ? 'Altbestand' : `${ruleScore}%`}</b></div>
      <div><small>Risiko</small><b>${money(trade.risk_usd)}</b><span>${trade.risk_percent ? `${formatTradeNumber(trade.risk_percent, 2)}%` : ''}</span></div>
      <div><small>Positionsgröße</small><b>${trade.position_size ? formatTradeNumber(trade.position_size, 8) : '–'}</b></div>
      <div><small>Ausführung</small><b>${trade.execution_score ? `${trade.execution_score}/10` : '–'}</b><span>${escapeHtml(trade.emotion_after || '')}</span></div>
    </div>
    ${breaks.length ? `<div class="trade-break-list"><small>Nicht erfüllte Regeln</small><div>${breaks.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div></div>` : ''}
    <div class="trade-detail-grid">
      <div class="trade-detail-block"><small>Setup</small><b>${escapeHtml(trade.setup || 'Ohne Setup')}</b><div class="tags">${tags || '<span class="sub">Keine Tags</span>'}</div></div>
      <div class="trade-detail-block"><small>Levels</small><p>Entry: ${escapeHtml(trade.entry_price ?? '–')}<br>Stop: ${escapeHtml(trade.stop_loss ?? '–')}<br>Take Profit: ${escapeHtml(trade.take_profit ?? '–')}</p></div>
    </div>
    <div class="trade-chart-grid">${chart(beforeUrl, 'Chart vorher')}${chart(afterUrl, 'Chart nachher')}</div>
    <div class="trade-review-grid">
      <div class="trade-review-block"><h3>Notizen</h3><p>${escapeHtml(trade.notes || 'Keine Notizen')}</p></div>
      <div class="trade-review-block mistake"><h3>Fehler</h3><p>${escapeHtml(trade.mistakes || 'Keine Fehler notiert')}</p></div>
      <div class="trade-review-block learning"><h3>Learning</h3><p>${escapeHtml(trade.learning || 'Noch kein Learning')}</p></div>
    </div>
    <div class="trade-detail-actions"><button class="btn danger" onclick="deleteTrade('${trade.id}')">Trade löschen</button><button class="btn primary" onclick="closeTradeDetail();openTrade('${trade.id}')">Trade bearbeiten</button></div>
  `;
}

function renderTradingSettings() {
  $('#tradeAccountBalance').value = tradingSettings.account_balance;
  $('#tradeDefaultRisk').value = tradingSettings.default_risk_percent;
  $('#tradeDefaultContract').value = tradingSettings.contract_value;
  $('#tradeDailyLossLimit').value = tradingSettings.daily_loss_limit_r;
  $('#tradeMaxTrades').value = tradingSettings.max_trades_per_day;
}

function renderTradingCockpitStatus() {
  const state = getTodayTradingState();
  const locked = state.tradeLimitReached || state.lossLimitReached;
  const status = $('#cockpitDayStatus');
  status.classList.toggle('ready', !locked);
  status.classList.toggle('locked', locked);
  $('#cockpitDayIcon').textContent = locked ? '■' : '✓';
  $('#cockpitDayTitle').textContent = locked ? 'Tageslimit erreicht' : 'Bereit für deinen Plan';
  $('#cockpitDayCopy').textContent = locked
    ? state.lossLimitReached
      ? `Bei ${state.todayR.toFixed(2)}R ist für heute Schluss.`
      : `${state.todayTrades.length} von ${state.maxTrades} Trades genutzt.`
    : 'Checkliste vollständig machen, Risiko berechnen und nur ein A-Setup ausführen.';
  $('#cockpitTodayTrades').textContent = `${state.todayTrades.length}/${state.maxTrades}`;
  $('#cockpitTodayR').textContent = `${state.todayR.toFixed(2)}R`;
  $('#cockpitTodayR').className = state.todayR >= 0 ? 'pos' : 'neg';
}

function renderTradingAnalytics() {
  const checklistTrades = trades.filter(hasTradeChecklist);
  const reviewedTrades = trades.filter(
    trade => (trade.result || deriveTradeResult(trade.pnl_usd)) !== 'open',
  );
  const avgScore = checklistTrades.length
    ? checklistTrades.reduce((sum, trade) => sum + (Number(trade.rule_score) || 0), 0) /
      checklistTrades.length
    : 0;
  const planRate = reviewedTrades.length
    ? (reviewedTrades.filter(trade => trade.followed_plan).length / reviewedTrades.length) * 100
    : 0;
  const errorCost = Math.abs(
    reviewedTrades
      .filter(trade => !trade.followed_plan && Number(trade.r_multiple) < 0)
      .reduce((sum, trade) => sum + (Number(trade.r_multiple) || 0), 0),
  );
  const breakCounts = {};
  checklistTrades.forEach(trade =>
    (trade.rule_breaks || []).forEach(item => {
      breakCounts[item] = (breakCounts[item] || 0) + 1;
    }),
  );
  const topBreak = Object.entries(breakCounts).sort((a, b) => b[1] - a[1])[0];
  /* Ein Sieger erst ab genug Vorkommen. Bei einem einzigen Cockpit-Trade waere
     jeder Regelbruch "der haeufigste" -- und die Psychologie-Karte direkt
     darunter, die eine Mindestmenge verlangt, saehe es anders. */
  const topBreakZaehlt = topBreak && topBreak[1] >= COCKPIT_MIN_TOP_BREAK;
  $('#cockpitAverageScore').textContent = checklistTrades.length ? `${avgScore.toFixed(0)}%` : '–';
  $('#cockpitPlanRate').textContent = reviewedTrades.length ? `${planRate.toFixed(0)}%` : '–';
  /* Ohne einen einzigen bewerteten Trade ist "0.00R" keine Messung, sondern
     Abwesenheit von Daten -- wie bei den drei Nachbarkacheln also ein Strich. */
  $('#cockpitErrorCost').textContent = reviewedTrades.length ? `${errorCost.toFixed(2)}R` : '–';
  $('#cockpitTopBreak').textContent = topBreakZaehlt ? topBreak[0] : 'Noch keine Daten';
  $('#cockpitTopBreakMeta').textContent = topBreakZaehlt
    ? `${topBreak[1]}x nicht erfüllt`
    : topBreak
      ? `Ab ${COCKPIT_MIN_TOP_BREAK} Vorkommen — bisher höchstens ${topBreak[1]}x`
      : 'Beginnt mit deinem ersten Cockpit-Trade';
}

function renderTrading() {
  if (typeof renderTradingStats === 'function') renderTradingStats();
  const settledTrades = trades.filter(
    trade => (trade.result || deriveTradeResult(trade.pnl_usd)) !== 'open',
  );
  const wins = settledTrades.filter(trade => Number(trade.pnl_usd) > 0);
  const losses = settledTrades.filter(trade => Number(trade.pnl_usd) < 0);
  const grossWins = wins.reduce((sum, trade) => sum + Number(trade.pnl_usd), 0);
  const grossLosses = Math.abs(losses.reduce((sum, trade) => sum + Number(trade.pnl_usd), 0));
  const pnl = settledTrades.reduce((sum, trade) => sum + Number(trade.pnl_usd), 0);
  const winrate = settledTrades.length ? (wins.length / settledTrades.length) * 100 : 0;
  const profitFactor = grossLosses ? grossWins / grossLosses : grossWins ? Infinity : 0;
  const averageR = settledTrades.length
    ? settledTrades.reduce((sum, trade) => sum + (Number(trade.r_multiple) || 0), 0) /
      settledTrades.length
    : 0;

  $('#tradingSetupNotice').classList.toggle('hide', tradingV2Ready);
  $('#tradingCockpitSetupNotice').classList.toggle('hide', tradingCockpitReady);
  $('#openTradeBtn').disabled = !tradingCockpitReady;
  $('#pnl').textContent = money(pnl);
  $('#pnl').className = 'value ' + (pnl >= 0 ? 'pos' : 'neg');
  $('#winrate').textContent = winrate.toFixed(1) + '%';
  $('#profitFactor').textContent = profitFactor === Infinity ? '∞' : profitFactor.toFixed(2);
  $('#tradeCount').textContent = trades.length;
  $('#tpnl').textContent = money(pnl);
  $('#tpnl').className = 'value ' + (pnl >= 0 ? 'pos' : 'neg');
  $('#twinrate').textContent = winrate.toFixed(1) + '%';
  $('#tavgR').textContent = averageR.toFixed(2) + 'R';
  $('#tcount').textContent = trades.length;
  renderTradingSettings();
  renderTradingCockpitStatus();
  renderTradingAnalytics();

  $('#tradeRows').innerHTML =
    trades
      .map(trade => {
        const result = trade.result || deriveTradeResult(trade.pnl_usd);
        const score = hasTradeChecklist(trade) ? `${Number(trade.rule_score) || 0}%` : 'Alt';
        return `<tr>
      <td>${escapeHtml(trade.trade_date)}</td>
      <td><b>${escapeHtml(trade.market)}</b></td>
      <td><span class="badge ${String(trade.direction || 'long').toLowerCase()}">${escapeHtml(trade.direction || '–')}</span></td>
      <td>${escapeHtml(trade.session || '–')}</td>
      <td><div class="trade-setup-cell"><span>${escapeHtml(trade.setup || '–')}</span><small class="${Number(trade.rule_score) >= 100 ? 'good' : ''}">Regeln ${score}</small></div></td>
      <td><span class="trade-result result-${result}">${tradeResultLabel(result, trade.pnl_usd)}</span></td>
      <td class="${Number(trade.pnl_usd) >= 0 ? 'pos' : 'neg'}"><b>${money(trade.pnl_usd)}</b></td>
      <td>${(Number(trade.r_multiple) || 0).toFixed(2)}R</td>
      <td><div class="trade-row-actions"><button class="btn" onclick="showTradeDetail('${trade.id}')">Öffnen</button><button class="btn danger" onclick="deleteTrade('${trade.id}')">Löschen</button></div></td>
    </tr>`;
      })
      .join('') || '<tr><td colspan="9" class="empty">Noch keine Trades.</td></tr>';
}


let editingTradeId=null;
let tradingV2Ready=true;

function tradeDateKey(date=new Date()){
  const year=date.getFullYear();
  const month=String(date.getMonth()+1).padStart(2,'0');
  const day=String(date.getDate()).padStart(2,'0');
  return `${year}-${month}-${day}`;
}

function isMissingTradingV2Columns(error){
  const message=String(error?.message||'');
  return error?.code==='42703'||error?.code==='PGRST204'||(/result|followed_plan|setup_tags|mistakes|learning|before_image_path|after_image_path/.test(message)&&/column|schema cache|does not exist/i.test(message));
}

async function loadTrades(){
  const [tradeResult,schemaResult]=await Promise.all([
    sb.from('trades').select('*').order('trade_date',{ascending:false}),
    sb.from('trades').select('id,result,followed_plan,setup_tags,mistakes,learning,before_image_path,after_image_path').limit(1)
  ]);
  if(tradeResult.error)throw tradeResult.error;
  trades=tradeResult.data||[];
  if(schemaResult.error){
    if(!isMissingTradingV2Columns(schemaResult.error))throw schemaResult.error;
    tradingV2Ready=false;
  }else{
    tradingV2Ready=true;
  }
}

function deriveTradeResult(pnl){
  const value=Number(pnl)||0;
  return value>0?'win':value<0?'loss':'breakeven';
}

function tradeResultLabel(result,pnl){
  const value=result||deriveTradeResult(pnl);
  return ({win:'Win',loss:'Loss',breakeven:'Break-even',open:'Offen'})[value]||'Offen';
}

function resetTradePreview(type){
  const preview=$(`#t${type}Preview`);
  const label=$(`#t${type}Label`);
  preview.src='';
  preview.classList.add('hide');
  label.textContent=`${type==='Before'?'Vorher':'Nachher'}-Screenshot auswählen`;
}

async function setStoredTradePreview(type,path){
  resetTradePreview(type);
  if(!path)return;
  const url=await signedUrl(path);
  const preview=$(`#t${type}Preview`);
  if(url){
    preview.src=url;
    preview.classList.remove('hide');
  }
  $(`#t${type}Label`).textContent='Bild gespeichert – zum Ersetzen klicken';
}

function previewTradeFile(type,file){
  if(!file)return resetTradePreview(type);
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){
    alert('Bitte nur JPG, PNG oder WebP verwenden.');
    $(`#t${type}Image`).value='';
    return;
  }
  if(file.size>8*1024*1024){
    alert('Das Bild darf maximal 8 MB groß sein.');
    $(`#t${type}Image`).value='';
    return;
  }
  const preview=$(`#t${type}Preview`);
  preview.src=URL.createObjectURL(file);
  preview.classList.remove('hide');
  $(`#t${type}Label`).textContent=file.name;
}

$('#tBeforeImage').addEventListener('change',event=>previewTradeFile('Before',event.target.files[0]));
$('#tAfterImage').addEventListener('change',event=>previewTradeFile('After',event.target.files[0]));

async function openTrade(id=null){
  if(!tradingV2Ready)return alert('Bitte zuerst die Trading-Journal-v2-Migration in Supabase ausführen.');
  const form=$('#tradeForm');
  form.reset();
  editingTradeId=id;
  $('#tDate').value=tradeDateKey();
  $('#tradeModalTitle').textContent=id?'Trade bearbeiten':'Trade erfassen';
  $('#tradeSubmitLabel').textContent=id?'Änderungen speichern':'Trade speichern';
  resetTradePreview('Before');
  resetTradePreview('After');

  if(id){
    const trade=trades.find(item=>item.id===id);
    if(!trade)return alert('Trade nicht gefunden.');
    $('#tDate').value=trade.trade_date||tradeDateKey();
    $('#tMarket').value=trade.market||'';
    $('#tDirection').value=trade.direction||'Long';
    $('#tSession').value=trade.session||'London';
    $('#tSetup').value=trade.setup||'';
    $('#tTags').value=(trade.setup_tags||[]).join(', ');
    $('#tRisk').value=trade.risk_usd??'';
    $('#tPnl').value=trade.pnl_usd??'';
    $('#tR').value=trade.r_multiple??'';
    $('#tResult').value=trade.result||deriveTradeResult(trade.pnl_usd);
    $('#tEmotion').value=trade.emotion||'Ruhig';
    $('#tFollowedPlan').checked=Boolean(trade.followed_plan);
    $('#tEntry').value=trade.entry_price??'';
    $('#tStop').value=trade.stop_loss??'';
    $('#tTp').value=trade.take_profit??'';
    $('#tNotes').value=trade.notes||'';
    $('#tMistakes').value=trade.mistakes||'';
    $('#tLearning').value=trade.learning||'';
    await Promise.all([
      setStoredTradePreview('Before',trade.before_image_path),
      setStoredTradePreview('After',trade.after_image_path)
    ]);
  }
  $('#tradeModal').classList.add('open');
}

function closeTrade(){
  $('#tradeModal').classList.remove('open');
  editingTradeId=null;
}

$('#tradeForm').onsubmit=async event=>{
  event.preventDefault();
  if(!tradingV2Ready)return alert('Bitte zuerst die Trading-Journal-v2-Migration in Supabase ausführen.');

  const existing=editingTradeId?trades.find(item=>item.id===editingTradeId):null;
  const beforeFile=$('#tBeforeImage').files[0];
  const afterFile=$('#tAfterImage').files[0];
  const uploaded=[];

  try{
    const [beforePath,afterPath]=await Promise.all([
      beforeFile?uploadMediaToFolder(beforeFile,'trades/before'):Promise.resolve(existing?.before_image_path||null),
      afterFile?uploadMediaToFolder(afterFile,'trades/after'):Promise.resolve(existing?.after_image_path||null)
    ]);
    if(beforeFile&&beforePath)uploaded.push(beforePath);
    if(afterFile&&afterPath)uploaded.push(afterPath);

    const risk=Number($('#tRisk').value)||0;
    const pnl=Number($('#tPnl').value)||0;
    const selectedResult=$('#tResult').value;
    const tags=[...new Set($('#tTags').value.split(',').map(tag=>tag.trim()).filter(Boolean))];
    const payload={
      user_id:currentUser.id,
      trade_date:$('#tDate').value,
      market:$('#tMarket').value.trim().toUpperCase(),
      direction:$('#tDirection').value,
      session:$('#tSession').value,
      setup:$('#tSetup').value.trim()||'Ohne Setup',
      setup_tags:tags,
      risk_usd:risk,
      pnl_usd:pnl,
      r_multiple:$('#tR').value!==''?Number($('#tR').value):(risk?pnl/risk:0),
      result:selectedResult==='auto'?deriveTradeResult(pnl):selectedResult,
      emotion:$('#tEmotion').value,
      followed_plan:$('#tFollowedPlan').checked,
      notes:$('#tNotes').value.trim(),
      mistakes:$('#tMistakes').value.trim(),
      learning:$('#tLearning').value.trim(),
      before_image_path:beforePath,
      after_image_path:afterPath,
      updated_at:new Date().toISOString()
    };
    if($('#tEntry').value!=='')payload.entry_price=$('#tEntry').value;else payload.entry_price=null;
    if($('#tStop').value!=='')payload.stop_loss=$('#tStop').value;else payload.stop_loss=null;
    if($('#tTp').value!=='')payload.take_profit=$('#tTp').value;else payload.take_profit=null;

    const query=editingTradeId
      ?sb.from('trades').update(payload).eq('id',editingTradeId)
      :sb.from('trades').insert(payload);
    const {error}=await query;
    if(error)throw error;

    const replaced=[
      beforeFile&&existing?.before_image_path,
      afterFile&&existing?.after_image_path
    ].filter(Boolean);
    if(replaced.length)await sb.storage.from('northstar-media').remove(replaced);

    event.target.reset();
    closeTrade();
    await loadAll();
    showPage('trading');
  }catch(error){
    if(uploaded.length)await sb.storage.from('northstar-media').remove(uploaded);
    alert(error.message);
  }
};

async function deleteTrade(id){
  if(!confirm('Trade wirklich löschen?'))return;
  const trade=trades.find(item=>item.id===id);
  const {error}=await sb.from('trades').delete().eq('id',id);
  if(error)return alert(error.message);
  const paths=[trade?.before_image_path,trade?.after_image_path].filter(Boolean);
  if(paths.length)await sb.storage.from('northstar-media').remove(paths);
  closeTradeDetail();
  await loadAll();
}

function closeTradeDetail(){
  $('#tradeDetailModal').classList.remove('open');
}

async function showTradeDetail(id){
  const trade=trades.find(item=>item.id===id);
  if(!trade)return;
  $('#tradeDetailTitle').textContent=`${trade.market} · ${trade.direction}`;
  $('#tradeDetailContent').innerHTML='<div class="empty">Trade wird geladen…</div>';
  $('#tradeDetailModal').classList.add('open');

  const [beforeUrl,afterUrl]=await Promise.all([
    signedUrl(trade.before_image_path),
    signedUrl(trade.after_image_path)
  ]);
  const result=trade.result||deriveTradeResult(trade.pnl_usd);
  const tags=(trade.setup_tags||[]).map(tag=>`<span class="tag">${escapeHtml(tag)}</span>`).join('');
  const chart=(url,label)=>url
    ?`<div class="trade-chart"><span>${label}</span><img src="${url}" alt="${label}"></div>`
    :`<div class="trade-chart empty-chart"><span>${label}</span><div>Kein Screenshot</div></div>`;

  $('#tradeDetailContent').innerHTML=`
    <div class="trade-detail-summary">
      <span class="trade-result result-${result}">${tradeResultLabel(result,trade.pnl_usd)}</span>
      <span class="badge ${String(trade.direction||'long').toLowerCase()}">${escapeHtml(trade.direction||'–')}</span>
      <span>${escapeHtml(trade.session||'–')}</span>
      <span>${escapeHtml(trade.trade_date||'–')}</span>
      <span class="${Number(trade.pnl_usd)>=0?'pos':'neg'}"><b>${money(trade.pnl_usd)}</b></span>
      <span><b>${(Number(trade.r_multiple)||0).toFixed(2)}R</b></span>
    </div>
    <div class="trade-rule-status ${trade.followed_plan?'followed':'broken'}">${trade.followed_plan?'✓ Nach Plan gehandelt':'! Nicht nach Plan gehandelt'}</div>
    <div class="trade-detail-grid">
      <div class="trade-detail-block"><small>Setup</small><b>${escapeHtml(trade.setup||'Ohne Setup')}</b><div class="tags">${tags||'<span class="sub">Keine Tags</span>'}</div></div>
      <div class="trade-detail-block"><small>Levels</small><p>Entry: ${escapeHtml(trade.entry_price??'–')}<br>Stop: ${escapeHtml(trade.stop_loss??'–')}<br>Take Profit: ${escapeHtml(trade.take_profit??'–')}</p></div>
    </div>
    <div class="trade-chart-grid">${chart(beforeUrl,'Chart vorher')}${chart(afterUrl,'Chart nachher')}</div>
    <div class="trade-review-grid">
      <div class="trade-review-block"><h3>Notizen</h3><p>${escapeHtml(trade.notes||'Keine Notizen')}</p></div>
      <div class="trade-review-block mistake"><h3>Fehler</h3><p>${escapeHtml(trade.mistakes||'Keine Fehler notiert')}</p></div>
      <div class="trade-review-block learning"><h3>Learning</h3><p>${escapeHtml(trade.learning||'Noch kein Learning')}</p></div>
    </div>
    <div class="trade-detail-actions"><button class="btn danger" onclick="deleteTrade('${trade.id}')">Trade löschen</button><button class="btn primary" onclick="closeTradeDetail();openTrade('${trade.id}')">Trade bearbeiten</button></div>
  `;
}

function renderTrading(){
  const wins=trades.filter(trade=>Number(trade.pnl_usd)>0);
  const losses=trades.filter(trade=>Number(trade.pnl_usd)<0);
  const grossWins=wins.reduce((sum,trade)=>sum+Number(trade.pnl_usd),0);
  const grossLosses=Math.abs(losses.reduce((sum,trade)=>sum+Number(trade.pnl_usd),0));
  const pnl=trades.reduce((sum,trade)=>sum+Number(trade.pnl_usd),0);
  const winrate=trades.length?wins.length/trades.length*100:0;
  const profitFactor=grossLosses?grossWins/grossLosses:(grossWins?Infinity:0);
  const averageR=trades.length?trades.reduce((sum,trade)=>sum+(Number(trade.r_multiple)||0),0)/trades.length:0;

  $('#tradingSetupNotice').classList.toggle('hide',tradingV2Ready);
  $('#pnl').textContent=money(pnl);
  $('#pnl').className='value '+(pnl>=0?'pos':'neg');
  $('#winrate').textContent=winrate.toFixed(1)+'%';
  $('#profitFactor').textContent=profitFactor===Infinity?'∞':profitFactor.toFixed(2);
  $('#tradeCount').textContent=trades.length;
  $('#tpnl').textContent=money(pnl);
  $('#tpnl').className='value '+(pnl>=0?'pos':'neg');
  $('#twinrate').textContent=winrate.toFixed(1)+'%';
  $('#tavgR').textContent=averageR.toFixed(2)+'R';
  $('#tcount').textContent=trades.length;

  $('#tradeRows').innerHTML=trades.map(trade=>{
    const result=trade.result||deriveTradeResult(trade.pnl_usd);
    return `<tr>
      <td>${escapeHtml(trade.trade_date)}</td>
      <td><b>${escapeHtml(trade.market)}</b></td>
      <td><span class="badge ${String(trade.direction||'long').toLowerCase()}">${escapeHtml(trade.direction||'–')}</span></td>
      <td>${escapeHtml(trade.session||'–')}</td>
      <td>${escapeHtml(trade.setup||'–')}</td>
      <td><span class="trade-result result-${result}">${tradeResultLabel(result,trade.pnl_usd)}</span></td>
      <td class="${Number(trade.pnl_usd)>=0?'pos':'neg'}"><b>${money(trade.pnl_usd)}</b></td>
      <td>${(Number(trade.r_multiple)||0).toFixed(2)}R</td>
      <td><div class="trade-row-actions"><button class="btn" onclick="showTradeDetail('${trade.id}')">Öffnen</button><button class="btn danger" onclick="deleteTrade('${trade.id}')">Löschen</button></div></td>
    </tr>`;
  }).join('')||'<tr><td colspan="9" class="empty">Noch keine Trades.</td></tr>';
}

function openGoal(){$('#goalModal').classList.add('open')}
function closeGoal(){$('#goalModal').classList.remove('open')}

function isMissingGoalImageSchema(error){
  const message=`${error?.code||''} ${error?.message||''} ${error?.details||''}`.toLowerCase();
  return message.includes('image_path')&&/column|schema cache|does not exist|not find/.test(message);
}

async function loadGoals(){
  const {data,error}=await sb.from('vision_goals').select('*').order('created_at',{ascending:false});
  if(error)throw error;
  goals=data||[];
}

$('#goalForm').onsubmit=async event=>{
  event.preventDefault();
  let imagePath=null;
  let saved=false;
  try{
    imagePath=await uploadMedia($('#gImage').files[0]);
    const {error}=await sb.from('vision_goals').insert({
      user_id:currentUser.id,
      title:$('#gTitle').value,
      goal_type:$('#gType').value,
      category:$('#gCategory').value||'Persönlich',
      why_text:$('#gWhy').value,
      next_action:$('#gNext').value,
      current_value:+$('#gCurrent').value||0,
      target_value:+$('#gTarget').value||1,
      target_date:$('#gDate').value||null,
      image_path:imagePath
    });
    if(error)throw error;
    saved=true;
    event.target.reset();
    closeGoal();
    await loadAll();
  }catch(error){
    if(imagePath&&!saved){
      const {error:cleanupError}=await sb.storage.from('northstar-media').remove([imagePath]);
      if(cleanupError)console.warn('Goal image cleanup failed',cleanupError);
    }
    alert(isMissingGoalImageSchema(error)
      ?'Die Zielbild-Spalte fehlt noch in Supabase. Bitte die Vision-Goal-Image-Migration ausführen und danach erneut speichern.'
      :error.message);
  }
};

async function deleteGoal(id,path){
  if(!confirm('Ziel löschen?'))return;
  if(path)await sb.storage.from('northstar-media').remove([path]);
  await sb.from('vision_goals').delete().eq('id',id);
  await loadAll();
}

async function goalCard(goal){
  const progress=Math.min(100,(+goal.current_value)/(+goal.target_value||1)*100);
  const imageUrl=await signedUrl(goal.image_path);
  return `<div class="card">${imageUrl?`<img class="goal-image" src="${imageUrl}">`:''}<span class="pill">${goal.category||'Persönlich'}</span><h3 style="margin:10px 0 6px">${goal.title}</h3><p class="sub">${goal.why_text||'Noch kein Warum.'}</p><div class="progress"><div style="width:${progress}%"></div></div><div class="next"><b>Nächster Schritt:</b><br>${goal.next_action||'Noch offen'}</div><button class="btn danger" style="margin-top:10px" onclick="deleteGoal('${goal.id}','${goal.image_path||''}')">Löschen</button></div>`;
}

async function renderGoals(){
  const longGoals=goals.filter(goal=>goal.goal_type==='long');
  const shortGoals=goals.filter(goal=>goal.goal_type==='short');
  const longCards=[];
  const shortCards=[];
  const homeCards=[];
  for(const goal of longGoals)longCards.push(await goalCard(goal));
  for(const goal of shortGoals)shortCards.push(await goalCard(goal));
  for(const goal of goals.slice(0,3))homeCards.push(await goalCard(goal));
  $('#longGoals').innerHTML=longCards.join('')||'<div class="empty">Noch keine Long-Term-Ziele.</div>';
  $('#shortGoals').innerHTML=shortCards.join('')||'<div class="empty">Noch keine Short-Term-Ziele.</div>';
  $('#homeGoals').innerHTML=homeCards.join('')||'<div class="empty">Lege dein erstes Ziel an.</div>';
  if(longGoals[0]){
    const imageUrl=await signedUrl(longGoals[0].image_path);
    $('#heroGoal').style.backgroundImage=imageUrl?`url("${imageUrl}")`:'none';
    $('#heroGoal').innerHTML=`<div class="vision-content"><span class="pill">DEIN NORDSTERN</span><h2>${longGoals[0].title}</h2><p class="sub">${longGoals[0].next_action||longGoals[0].why_text||''}</p></div>`;
  }
}

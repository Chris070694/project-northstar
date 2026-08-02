
let exercises=[];

async function loadFitness(){
  const {data,error}=await sb.from('fitness_exercises').select('*').order('created_at',{ascending:true});
  if(error)throw error;
  exercises=data||[];
}

function openExercise(){ $('#exerciseModal').classList.add('open'); }
function closeExercise(){ $('#exerciseModal').classList.remove('open'); }

$('#exerciseForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const {error}=await sb.from('fitness_exercises').insert({
    user_id:currentUser.id,
    name:$('#exName').value,
    muscle_group:$('#exMuscle').value,
    default_sets:Number($('#exSets').value)||0,
    default_reps:Number($('#exReps').value)||0,
    default_weight:Number($('#exWeight').value)||0
  });
  if(error)return alert(error.message);
  e.target.reset();
  closeExercise();
  await loadAll();
});

async function deleteExercise(id){
  if(!confirm('Übung löschen?'))return;
  await sb.from('fitness_exercises').delete().eq('id',id);
  await loadAll();
}

function renderFitness(){
  $('#exerciseList').innerHTML=exercises.length?exercises.map(x=>`
    <div class="exercise-row">
      <b>${x.name}</b>
      <span>${x.muscle_group||'-'}</span>
      <span>${x.default_sets} Sätze</span>
      <span>${x.default_reps} Wdh.</span>
      <span>${Number(x.default_weight||0).toFixed(1)} kg</span>
      <button class="btn danger" onclick="deleteExercise('${x.id}')">Löschen</button>
    </div>
  `).join(''):'<div class="empty">Noch keine Übungen angelegt.</div>';
}

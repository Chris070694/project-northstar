
let notes=[];

async function loadNotes(){
  const {data,error}=await sb.from('notes').select('*').order('created_at',{ascending:false});
  if(error)throw error;
  notes=data||[];
}

function openNote(){ $('#noteModal').classList.add('open'); }
function closeNote(){ $('#noteModal').classList.remove('open'); }

$('#noteForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const {error}=await sb.from('notes').insert({
    user_id:currentUser.id,
    title:$('#nTitle').value,
    category:$('#nCategory').value,
    content:$('#nContent').value
  });
  if(error)return alert(error.message);
  e.target.reset();
  closeNote();
  await loadAll();
});

async function deleteNote(id){
  if(!confirm('Notiz löschen?'))return;
  await sb.from('notes').delete().eq('id',id);
  await loadAll();
}

function renderNotes(){
  $('#notesList').innerHTML=notes.length?notes.map(n=>`
    <div class="card note-card">
      <span class="pill">${n.category||'Allgemein'}</span>
      <h3 style="margin:10px 0 6px">${n.title}</h3>
      <p class="sub">${(n.content||'').replace(/</g,'&lt;').slice(0,220)}</p>
      <button class="btn danger" onclick="deleteNote('${n.id}')">Löschen</button>
    </div>
  `).join(''):'<div class="empty">Noch keine Notizen.</div>';
}

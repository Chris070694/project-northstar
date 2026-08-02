
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v)||0);
let sb,currentUser=null,trades=[],focus=null,goals=[];
function showPage(id){$$('.page').forEach(p=>p.classList.remove('active'));$('#'+id).classList.add('active');$$('.nav').forEach(n=>n.classList.toggle('active',n.dataset.page===id))}
$$('[data-page]').forEach(b=>b.onclick=()=>showPage(b.dataset.page));
async function login(){const{error}=await sb.auth.signInWithPassword({email:$('#email').value,password:$('#password').value});$('#authMsg').textContent=error?error.message:''}
async function logout(){await sb.auth.signOut()}
function showApp(){$('#auth').classList.add('hide');$('#app').classList.remove('hide');$('#who').textContent=currentUser.email}
function showAuth(){$('#app').classList.add('hide');$('#auth').classList.remove('hide')}
async function signedUrl(path){if(!path)return'';const{data}=await sb.storage.from('northstar-media').createSignedUrl(path,3600);return data?.signedUrl||''}
async function uploadMedia(file){if(!file)return null;const ext=file.name.split('.').pop().toLowerCase(),path=`${currentUser.id}/vision/${crypto.randomUUID()}.${ext}`;const{error}=await sb.storage.from('northstar-media').upload(path,file);if(error)throw error;return path}

function escapeHtml(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}
async function uploadMediaToFolder(file,folder){
  if(!file)return null;
  const ext=file.name.split('.').pop().toLowerCase();
  const path=`${currentUser.id}/${folder}/${crypto.randomUUID()}.${ext}`;
  const {error}=await sb.storage.from('northstar-media').upload(path,file);
  if(error)throw error;
  return path;
}

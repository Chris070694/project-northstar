const $ = s => document.querySelector(s),
  $$ = s => [...document.querySelectorAll(s)];
const money = v =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(v) || 0);
let sb,
  currentUser = null,
  trades = [],
  focus = null,
  goals = [];
const mobilePrimaryPages = new Set(['home', 'trading', 'tasks', 'fitness']);
function closeMobileMore() {
  $('#mobileMoreSheet')?.classList.remove('show');
  $('#mobileMoreButton')?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('sheet-open');
}
function openMobileMore() {
  $('#mobileMoreSheet')?.classList.add('show');
  $('#mobileMoreButton')?.setAttribute('aria-expanded', 'true');
  document.body.classList.add('sheet-open');
}
function updateNavigation(id) {
  $$('.nav,.mobile-nav-btn[data-page]').forEach(item =>
    item.classList.toggle('active', item.dataset.page === id),
  );
  $('#mobileMoreButton')?.classList.toggle('active', !mobilePrimaryPages.has(id));
}
function showPage(id) {
  if (id === 'focus') id = 'tasks';
  const target = $('#' + id);
  if (!target?.classList.contains('page')) return;
  $$('.page').forEach(page => page.classList.remove('active'));
  target.classList.add('active');
  updateNavigation(id);
  closeMobileMore();
  const url = new URL(location.href);
  id === 'home' ? url.searchParams.delete('page') : url.searchParams.set('page', id);
  history.replaceState(null, '', url);
  window.scrollTo({ top: 0, left: 0 });
}
$$('[data-page]').forEach(button =>
  button.addEventListener('click', () => showPage(button.dataset.page)),
);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeMobileMore();
});
async function login() {
  const { error } = await sb.auth.signInWithPassword({
    email: $('#email').value,
    password: $('#password').value,
  });
  $('#authMsg').textContent = error ? error.message : '';
}
async function logout() {
  await sb.auth.signOut();
}
function showApp() {
  $('#auth').classList.add('hide');
  $('#app').classList.remove('hide');
  $('#who').textContent = currentUser.email;
  const requestedPage = new URLSearchParams(location.search).get('page');
  if (requestedPage) showPage(requestedPage);
}
function showAuth() {
  $('#app').classList.add('hide');
  $('#auth').classList.remove('hide');
}
async function signedUrl(path) {
  if (!path) return '';
  const { data } = await sb.storage.from('northstar-media').createSignedUrl(path, 3600);
  return data?.signedUrl || '';
}
async function uploadMedia(file) {
  if (!file) return null;
  const ext = file.name.split('.').pop().toLowerCase(),
    path = `${currentUser.id}/vision/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from('northstar-media').upload(path, file);
  if (error) throw error;
  return path;
}

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[ch],
  );
}
async function uploadMediaToFolder(file, folder) {
  if (!file) return null;
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `${currentUser.id}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from('northstar-media').upload(path, file);
  if (error) throw error;
  return path;
}

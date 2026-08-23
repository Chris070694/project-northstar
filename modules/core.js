const $ = s => document.querySelector(s),
  $$ = s => [...document.querySelectorAll(s)];
const money = v =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(v) || 0);
let sb,
  currentUser = null,
  trades = [],
  focus = null,
  goals = [];
const mobilePrimaryPages = new Set(['today', 'trading', 'fitness']);
const mobileWissenPages = new Set(['library', 'notes', 'academy']);
const MOBILE_SHEETS = {
  wissen: { sheet: '#mobileWissenSheet', button: '#mobileWissenButton' },
  ich: { sheet: '#mobileMoreSheet', button: '#mobileMoreButton' },
};
function closeMobileSheet() {
  Object.values(MOBILE_SHEETS).forEach(entry => {
    $(entry.sheet)?.classList.remove('show');
    $(entry.button)?.setAttribute('aria-expanded', 'false');
  });
  document.body.classList.remove('sheet-open');
}
function openMobileSheet(name) {
  const entry = MOBILE_SHEETS[name];
  if (!entry) return;
  closeMobileSheet();
  $(entry.sheet)?.classList.add('show');
  $(entry.button)?.setAttribute('aria-expanded', 'true');
  document.body.classList.add('sheet-open');
}
/* Alte Namen bleiben gültig, damit vorhandene Aufrufe weiter funktionieren. */
function openMobileMore() {
  openMobileSheet('ich');
}
function closeMobileMore() {
  closeMobileSheet();
}
function updateNavigation(id) {
  $$('.nav,.mobile-nav-btn[data-page]').forEach(item =>
    item.classList.toggle('active', item.dataset.page === id),
  );
  const inWissen = mobileWissenPages.has(id);
  $('#mobileWissenButton')?.classList.toggle('active', inWissen);
  $('#mobileMoreButton')?.classList.toggle('active', !mobilePrimaryPages.has(id) && !inWissen);
}
function showPage(id) {
  if (id === 'focus') id = 'tasks';
  /* Dashboard ist in "Heute" aufgegangen. Alte Links und gespeicherte
     ?page=home-Adressen sollen trotzdem irgendwo landen. */
  if (id === 'home') id = 'today';
  const target = $('#' + id);
  if (!target?.classList.contains('page')) return;
  const previous = $('.page.active')?.id;
  const swap = () => {
    $$('.page').forEach(page => page.classList.remove('active'));
    target.classList.add('active');
    if (id === 'today') renderToday();
    if (id === 'fitness' && typeof onFitnessPageOpen === 'function') onFitnessPageOpen();
    if (typeof motionAfterPage === 'function') motionAfterPage();
  };
  if (typeof motionSwapPage === 'function') motionSwapPage(previous, id, swap);
  else swap();
  updateNavigation(id);
  closeMobileSheet();
  const url = new URL(location.href);
  id === 'today' ? url.searchParams.delete('page') : url.searchParams.set('page', id);
  history.replaceState(null, '', url);
  window.scrollTo({ top: 0, left: 0 });
}
$$('[data-page]').forEach(button =>
  button.addEventListener('click', () => showPage(button.dataset.page)),
);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeMobileSheet();
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

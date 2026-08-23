let gymBagItems = [];
let gymBagReady = true;

const GYM_BAG_DEFAULTS = [
  'Trinkflasche',
  'Handtuch',
  'Gurt',
  'Chalk',
  'Kopfhörer',
  'Schuhe',
  'Wechselshirt',
  'Schlüssel für Spind',
];

function gymBagDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isMissingGymBagTable(error) {
  const message = `${error?.code || ''} ${error?.message || ''}`;
  return (
    /42P01|PGRST205/i.test(message) ||
    (/gym_bag_items/i.test(message) && /does not exist|schema cache|could not find/i.test(message))
  );
}

// Ein Haken zaehlt nur fuer den Tag, an dem er gesetzt wurde. Dadurch braucht der
// taegliche Reset weder Cron-Job noch Edge Function -- er passiert beim Lesen.
function isGymBagItemChecked(item, today = gymBagDateKey()) {
  return Boolean(item?.checked) && String(item?.checked_on || '').slice(0, 10) === today;
}

function staleGymBagItemIds(items = gymBagItems, today = gymBagDateKey()) {
  return items
    .filter(item => item.checked && !isGymBagItemChecked(item, today))
    .map(item => item.id);
}

async function resetStaleGymBagItems() {
  const today = gymBagDateKey();
  const ids = staleGymBagItemIds(gymBagItems, today);
  if (!ids.length) return;
  gymBagItems.forEach(item => {
    if (ids.includes(item.id)) {
      item.checked = false;
      item.checked_on = null;
    }
  });
  const { error } = await sb
    .from('gym_bag_items')
    .update({ checked: false, checked_on: null, updated_at: new Date().toISOString() })
    .in('id', ids);
  if (error && !isMissingGymBagTable(error)) console.warn('Trainingstasche', error.message);
}

async function loadGymBag() {
  const { data, error } = await sb
    .from('gym_bag_items')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) {
    if (!isMissingGymBagTable(error)) throw error;
    gymBagReady = false;
    gymBagItems = [];
    return;
  }
  gymBagReady = true;
  gymBagItems = data || [];
  await resetStaleGymBagItems();
}

async function refreshGymBag() {
  await loadGymBag();
  renderGymBag();
}

// Wird beim Wechsel auf die Fitness-Seite aufgerufen (siehe showPage in core.js).
// Faellt der Tageswechsel in eine offene Sitzung, sind die Haken hier wieder weg.
async function onFitnessPageOpen() {
  if (!gymBagReady || !gymBagItems.length) return;
  if (!staleGymBagItemIds().length) return;
  await resetStaleGymBagItems();
  renderGymBag();
}

async function createDefaultGymBagItems() {
  if (!gymBagReady) return alert('Bitte zuerst die Migration für die Trainingstasche ausführen.');
  if (gymBagItems.length) return;
  const rows = GYM_BAG_DEFAULTS.map((label, index) => ({
    user_id: currentUser.id,
    label,
    sort_order: index,
  }));
  const { error } = await sb.from('gym_bag_items').insert(rows);
  if (error) return alert(error.message);
  await refreshGymBag();
}

async function addGymBagItem() {
  if (!gymBagReady) return alert('Bitte zuerst die Migration für die Trainingstasche ausführen.');
  const input = $('#gymBagInput');
  const label = input.value.trim();
  if (!label) return;
  const sortOrder = gymBagItems.length
    ? Math.max(...gymBagItems.map(item => Number(item.sort_order) || 0)) + 1
    : 0;
  const { error } = await sb
    .from('gym_bag_items')
    .insert({ user_id: currentUser.id, label, sort_order: sortOrder });
  if (error) return alert(error.message);
  input.value = '';
  await refreshGymBag();
}

async function toggleGymBagItem(id, checked) {
  const item = gymBagItems.find(entry => entry.id === id);
  if (!item) return;
  const checkedOn = checked ? gymBagDateKey() : null;
  item.checked = checked;
  item.checked_on = checkedOn;
  renderGymBag();
  const { error } = await sb
    .from('gym_bag_items')
    .update({ checked, checked_on: checkedOn, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    alert(error.message);
    await refreshGymBag();
  }
}

async function renameGymBagItem(id, label) {
  const value = String(label || '').trim();
  const item = gymBagItems.find(entry => entry.id === id);
  if (!item) return;
  if (!value) return renderGymBag();
  if (value === item.label) return;
  item.label = value;
  const { error } = await sb
    .from('gym_bag_items')
    .update({ label: value, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    alert(error.message);
    await refreshGymBag();
  }
}

async function deleteGymBagItem(id) {
  const item = gymBagItems.find(entry => entry.id === id);
  if (!item || !confirm(`"${item.label}" aus der Trainingstasche entfernen?`)) return;
  const { error } = await sb.from('gym_bag_items').delete().eq('id', id);
  if (error) return alert(error.message);
  await refreshGymBag();
}

async function moveGymBagItem(id, direction) {
  const rows = [...gymBagItems].sort((a, b) => a.sort_order - b.sort_order);
  const index = rows.findIndex(item => item.id === id);
  const swapIndex = index + direction;
  if (index < 0 || swapIndex < 0 || swapIndex >= rows.length) return;
  const current = rows[index];
  const other = rows[swapIndex];
  const currentOrder = current.sort_order;
  const [first, second] = await Promise.all([
    sb
      .from('gym_bag_items')
      .update({ sort_order: other.sort_order, updated_at: new Date().toISOString() })
      .eq('id', current.id),
    sb
      .from('gym_bag_items')
      .update({ sort_order: currentOrder, updated_at: new Date().toISOString() })
      .eq('id', other.id),
  ]);
  if (first.error || second.error) return alert(first.error?.message || second.error?.message);
  await refreshGymBag();
}

async function uncheckAllGymBagItems() {
  const ids = gymBagItems.filter(item => item.checked).map(item => item.id);
  if (!ids.length) return;
  gymBagItems.forEach(item => {
    item.checked = false;
    item.checked_on = null;
  });
  renderGymBag();
  const { error } = await sb
    .from('gym_bag_items')
    .update({ checked: false, checked_on: null, updated_at: new Date().toISOString() })
    .in('id', ids);
  if (error) {
    alert(error.message);
    await refreshGymBag();
  }
}

function renderGymBag() {
  const card = $('#gymBagCard');
  if (!card) return;
  const setup = $('#gymBagSetupNotice');
  const list = $('#gymBagList');
  const form = $('#gymBagForm');

  setup.classList.toggle('hide', gymBagReady);
  form.classList.toggle('hide', !gymBagReady);

  if (!gymBagReady) {
    list.innerHTML = '';
    $('#gymBagStatus').textContent = '–';
    return;
  }

  if (!gymBagItems.length) {
    list.innerHTML = `<div class="empty gym-bag-empty">
      Noch nichts eingepackt.
      <button class="btn" onclick="createDefaultGymBagItems()">Standardliste anlegen</button>
    </div>`;
    $('#gymBagStatus').textContent = 'Leer';
    return;
  }

  const today = gymBagDateKey();
  const rows = [...gymBagItems].sort((a, b) => a.sort_order - b.sort_order);
  const packed = rows.filter(item => isGymBagItemChecked(item, today)).length;
  $('#gymBagStatus').textContent =
    packed === rows.length ? 'Alles eingepackt' : `${packed}/${rows.length} eingepackt`;

  list.innerHTML = rows
    .map((item, index) => {
      const checked = isGymBagItemChecked(item, today);
      return `<div class="gym-bag-item ${checked ? 'done' : ''}">
        <input class="fit-check" type="checkbox" ${checked ? 'checked' : ''}
          onchange="toggleGymBagItem('${item.id}',this.checked)"
          aria-label="${escapeHtml(item.label)} eingepackt">
        <input class="gym-bag-label" type="text" value="${escapeHtml(item.label)}" maxlength="80"
          onchange="renameGymBagItem('${item.id}',this.value)" aria-label="Bezeichnung">
        <div class="gym-bag-actions">
          <button class="mini-btn" onclick="moveGymBagItem('${item.id}',-1)" ${index === 0 ? 'disabled' : ''} title="Nach oben">↑</button>
          <button class="mini-btn" onclick="moveGymBagItem('${item.id}',1)" ${index === rows.length - 1 ? 'disabled' : ''} title="Nach unten">↓</button>
          <button class="mini-btn danger-text" onclick="deleteGymBagItem('${item.id}')" title="Entfernen">✕</button>
        </div>
      </div>`;
    })
    .join('');
}

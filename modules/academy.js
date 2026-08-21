let academyNotes = [];

async function loadAcademy() {
  const { data, error } = await sb
    .from('academy_notes')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  academyNotes = data || [];
}

function openAcademyNote() {
  $('#academyModal').classList.add('open');
}
function closeAcademyNote() {
  $('#academyModal').classList.remove('open');
}
function closeAcademyDetail() {
  $('#academyDetailModal').classList.remove('open');
}

$('#academyForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const image_path = await uploadMediaToFolder($('#aImage').files[0], 'academy');
    const tags = $('#aTags')
      .value.split(',')
      .map(x => x.trim())
      .filter(Boolean);
    const { error } = await sb.from('academy_notes').insert({
      user_id: currentUser.id,
      title: $('#aTitle').value,
      category: $('#aCategory').value,
      definition: $('#aDefinition').value,
      rules: $('#aRules').value,
      example_text: $('#aExample').value,
      mistakes: $('#aMistakes').value,
      checklist: $('#aChecklist').value,
      tags,
      image_path,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    e.target.reset();
    closeAcademyNote();
    await loadAll();
    showPage('academy');
  } catch (err) {
    alert(err.message);
  }
});

async function deleteAcademyNote(id, path) {
  if (!confirm('Lernnotiz wirklich löschen?')) return;
  if (path) await sb.storage.from('northstar-media').remove([path]);
  await sb.from('academy_notes').delete().eq('id', id);
  await loadAll();
}

async function openAcademyDetail(id) {
  const note = academyNotes.find(n => n.id === id);
  if (!note) return;
  const image = await signedUrl(note.image_path);
  $('#academyDetailTitle').textContent = note.title;
  $('#academyDetailContent').innerHTML = `
    ${image ? `<img src="${image}" alt="">` : ''}
    <div class="detail-section"><h3>Definition</h3><p>${escapeHtml(note.definition || '-')}</p></div>
    <div class="detail-section"><h3>Regeln</h3><p>${escapeHtml(note.rules || '-')}</p></div>
    <div class="detail-section"><h3>Beispiel</h3><p>${escapeHtml(note.example_text || '-')}</p></div>
    <div class="detail-section"><h3>Häufige Fehler</h3><p>${escapeHtml(note.mistakes || '-')}</p></div>
    <div class="detail-section"><h3>Checkliste</h3><p>${escapeHtml(note.checklist || '-')}</p></div>`;
  $('#academyDetailModal').classList.add('open');
}

async function renderAcademy() {
  const q = ($('#academySearch')?.value || '').toLowerCase();
  const cat = $('#academyCategory')?.value || '';
  const list = academyNotes.filter(
    n =>
      (!cat || n.category === cat) &&
      `${n.title} ${n.definition || ''} ${(n.tags || []).join(' ')}`.toLowerCase().includes(q),
  );
  const cards = [];
  for (const n of list) {
    const image = await signedUrl(n.image_path);
    cards.push(`<div class="card academy-card">
      ${image ? `<img src="${image}" alt="">` : ''}
      <span class="pill">${escapeHtml(n.category || 'Andere')}</span>
      <h3 style="margin:10px 0 6px">${escapeHtml(n.title)}</h3>
      <div class="preview">${escapeHtml(n.definition || 'Noch keine Erklärung.')}</div>
      <div class="tags">${(n.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
      <div class="actions" style="margin-top:auto">
        <button class="btn primary" onclick="openAcademyDetail('${n.id}')">Öffnen</button>
        <button class="btn danger" onclick="deleteAcademyNote('${n.id}','${n.image_path || ''}')">Löschen</button>
      </div>
    </div>`);
  }
  $('#academyGrid').innerHTML =
    cards.join('') ||
    '<div class="empty">Noch keine Lernnotizen. Starte beispielsweise mit MSS.</div>';
}

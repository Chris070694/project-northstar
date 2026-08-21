const PENCIL_CANVAS_WIDTH = 1200;
const PENCIL_CANVAS_HEIGHT = 1697;
const PENCIL_DRAWING_VERSION = 1;
let notes = [];
let pencilNotesReady = true;
let pencilEditorNoteId = null;
let pencilStrokes = [];
let pencilRedoStrokes = [];
let pencilActiveStroke = null;
let pencilActivePointerId = null;
let pencilRenderQueued = false;
let pencilTool = 'pen';
let pencilColor = '#162033';
let pencilDirty = false;

function isMissingPencilNotesSchema(error) {
  const message =
    `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return (
    /note_type|drawing_path|paper_style|updated_at/.test(message) &&
    /does not exist|schema cache|not find|pgrst204|42703/.test(message)
  );
}

function notesQuery(columns = '*') {
  return sb.from('notes').select(columns).order('created_at', { ascending: false });
}

async function loadNotes() {
  const columns =
    'id,user_id,created_at,updated_at,title,category,content,image_path,note_type,drawing_path,paper_style';
  let { data, error } = await notesQuery(columns);
  if (error && isMissingPencilNotesSchema(error)) {
    pencilNotesReady = false;
    ({ data, error } = await notesQuery());
  } else pencilNotesReady = true;
  if (error) throw error;
  notes = (data || []).map(note => ({
    note_type: 'text',
    drawing_path: null,
    paper_style: 'lined',
    ...note,
  }));
  await Promise.all(
    notes
      .filter(note => note.note_type === 'handwriting' && note.image_path)
      .map(async note => {
        note.preview_url = await signedUrl(note.image_path);
      }),
  );
}

function openNote() {
  $('#noteForm').reset();
  $('#noteModal').classList.add('open');
}
function closeNote() {
  $('#noteModal').classList.remove('open');
}

$('#noteForm').addEventListener('submit', async event => {
  event.preventDefault();
  const { error } = await sb.from('notes').insert({
    user_id: currentUser.id,
    title: $('#nTitle').value.trim(),
    category: $('#nCategory').value,
    content: $('#nContent').value,
    ...(pencilNotesReady ? { note_type: 'text', updated_at: new Date().toISOString() } : {}),
  });
  if (error) return alert(error.message);
  event.target.reset();
  closeNote();
  await loadAll();
});

function pencilCanvas() {
  return $('#pencilCanvas');
}

function resetPencilEditor() {
  pencilEditorNoteId = null;
  pencilStrokes = [];
  pencilRedoStrokes = [];
  pencilActiveStroke = null;
  pencilActivePointerId = null;
  pencilTool = 'pen';
  pencilColor = '#162033';
  pencilDirty = false;
  $('#pencilTitle').value = '';
  $('#pencilCategory').value = 'Allgemein';
  $('#pencilPaper').value = 'lined';
  $('#pencilSize').value = '5';
  updatePencilToolbar();
  renderPencilCanvas();
}

async function openPencilNote(noteId = null) {
  if (!pencilNotesReady)
    return alert('Bitte zuerst die Pencil-Notizen-Migration in Supabase ausführen.');
  resetPencilEditor();
  $('#pencilNoteModal').classList.add('open');
  if (noteId) {
    const note = notes.find(item => item.id === noteId);
    if (!note) return;
    pencilEditorNoteId = note.id;
    $('#pencilTitle').value = note.title || '';
    $('#pencilCategory').value = note.category || 'Allgemein';
    $('#pencilPaper').value = note.paper_style || 'lined';
    $('#pencilEditorHeading').textContent = 'Pencil-Notiz bearbeiten';
    await loadPencilDrawing(note);
  } else {
    $('#pencilEditorHeading').textContent = 'Neue Pencil-Notiz';
  }
  pencilDirty = false;
  requestAnimationFrame(renderPencilCanvas);
}

function closePencilNote(force = false) {
  if (!force && pencilDirty && !confirm('Pencil-Notiz ohne Speichern schließen?')) return;
  $('#pencilNoteModal').classList.remove('open');
  pencilActiveStroke = null;
}

async function loadPencilDrawing(note) {
  if (!note.drawing_path) {
    renderPencilCanvas();
    return;
  }
  try {
    const { data, error } = await sb.storage.from('northstar-media').download(note.drawing_path);
    if (error) throw error;
    const drawing = JSON.parse(await data.text());
    if (Number(drawing.version) !== PENCIL_DRAWING_VERSION || !Array.isArray(drawing.strokes))
      throw new Error('Unbekanntes Pencil-Format');
    pencilStrokes = drawing.strokes;
    $('#pencilPaper').value = drawing.paperStyle || note.paper_style || 'lined';
  } catch (error) {
    console.error(error);
    alert('Die Pencil-Notiz konnte nicht vollständig geladen werden.');
  }
  renderPencilCanvas();
}

function setPencilTool(tool) {
  pencilTool = tool === 'eraser' ? 'eraser' : 'pen';
  updatePencilToolbar();
}

function setPencilColor(color) {
  pencilColor = color;
  pencilTool = 'pen';
  updatePencilToolbar();
}

function updatePencilToolbar() {
  $$('.pencil-tool').forEach(button =>
    button.classList.toggle('active', button.dataset.tool === pencilTool),
  );
  $$('.pencil-color').forEach(button =>
    button.classList.toggle('active', button.dataset.color === pencilColor),
  );
  $('#pencilUndoBtn').disabled = !pencilStrokes.length;
  $('#pencilRedoBtn').disabled = !pencilRedoStrokes.length;
  $('#pencilSizeLabel').textContent = `${$('#pencilSize').value} px`;
}

function pencilStrokeWidth(size, pressure, tool = 'pen') {
  const base = Math.max(1, Number(size) || 5);
  if (tool === 'eraser') return Math.max(18, base * 4);
  const force = Number(pressure) > 0 ? Number(pressure) : 0.45;
  return base * (0.38 + Math.min(1, force) * 1.05);
}

function pencilPoint(event) {
  const canvas = pencilCanvas();
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) * canvas.width) / rect.width,
    y: ((event.clientY - rect.top) * canvas.height) / rect.height,
    pressure:
      event.pointerType === 'mouse'
        ? 0.5
        : Number(event.pressure) > 0
          ? Number(event.pressure)
          : 0.45,
  };
}

function drawPaper(context, style) {
  context.save();
  context.fillStyle = '#fffdf8';
  context.fillRect(0, 0, PENCIL_CANVAS_WIDTH, PENCIL_CANVAS_HEIGHT);
  context.lineWidth = 1;
  if (style === 'lined' || style === 'grid') {
    context.strokeStyle = 'rgba(94,139,190,.22)';
    for (let y = 82; y < PENCIL_CANVAS_HEIGHT; y += 54) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(PENCIL_CANVAS_WIDTH, y);
      context.stroke();
    }
  }
  if (style === 'grid') {
    for (let x = 54; x < PENCIL_CANVAS_WIDTH; x += 54) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, PENCIL_CANVAS_HEIGHT);
      context.stroke();
    }
  }
  if (style === 'dotted') {
    context.fillStyle = 'rgba(94,139,190,.28)';
    for (let y = 54; y < PENCIL_CANVAS_HEIGHT; y += 54) {
      for (let x = 54; x < PENCIL_CANVAS_WIDTH; x += 54) {
        context.beginPath();
        context.arc(x, y, 1.6, 0, Math.PI * 2);
        context.fill();
      }
    }
  }
  if (style === 'lined') {
    context.strokeStyle = 'rgba(235,101,120,.24)';
    context.beginPath();
    context.moveTo(104, 0);
    context.lineTo(104, PENCIL_CANVAS_HEIGHT);
    context.stroke();
  }
  context.restore();
}

function drawPencilStroke(context, stroke) {
  const points = stroke.points || [];
  if (!points.length) return;
  context.save();
  context.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  context.strokeStyle = stroke.color || '#162033';
  context.fillStyle = stroke.color || '#162033';
  context.lineCap = 'round';
  context.lineJoin = 'round';
  if (points.length === 1) {
    context.beginPath();
    context.arc(
      points[0].x,
      points[0].y,
      pencilStrokeWidth(stroke.size, points[0].pressure, stroke.tool) / 2,
      0,
      Math.PI * 2,
    );
    context.fill();
  } else {
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1],
        current = points[index];
      context.lineWidth = pencilStrokeWidth(
        stroke.size,
        (previous.pressure + current.pressure) / 2,
        stroke.tool,
      );
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      context.lineTo(current.x, current.y);
      context.stroke();
    }
  }
  context.restore();
}

function renderPencilCanvas() {
  const canvas = pencilCanvas();
  if (!canvas) return;
  if (canvas.width !== PENCIL_CANVAS_WIDTH) canvas.width = PENCIL_CANVAS_WIDTH;
  if (canvas.height !== PENCIL_CANVAS_HEIGHT) canvas.height = PENCIL_CANVAS_HEIGHT;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawPaper(context, $('#pencilPaper').value || 'lined');
  pencilStrokes.forEach(stroke => drawPencilStroke(context, stroke));
  context.save();
  context.globalCompositeOperation = 'destination-over';
  drawPaper(context, $('#pencilPaper').value || 'lined');
  context.restore();
  updatePencilToolbar();
}

function queuePencilRender() {
  if (pencilRenderQueued) return;
  pencilRenderQueued = true;
  requestAnimationFrame(() => {
    pencilRenderQueued = false;
    renderPencilCanvas();
  });
}

function appendPencilPoint(event) {
  if (!pencilActiveStroke) return;
  const point = pencilPoint(event);
  const previous = pencilActiveStroke.points.at(-1);
  if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 0.7) return;
  pencilActiveStroke.points.push(point);
}

function startPencilStroke(event) {
  if (event.pointerType === 'touch') return;
  event.preventDefault();
  pencilCanvas().setPointerCapture?.(event.pointerId);
  pencilActiveStroke = {
    tool: pencilTool,
    color: pencilColor,
    size: Number($('#pencilSize').value) || 5,
    points: [pencilPoint(event)],
  };
  pencilActivePointerId = event.pointerId;
  pencilStrokes.push(pencilActiveStroke);
  pencilRedoStrokes = [];
  pencilDirty = true;
  renderPencilCanvas();
}

function movePencilStroke(event) {
  if (!pencilActiveStroke || event.pointerId !== pencilActivePointerId) return;
  event.preventDefault();
  const events =
    typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [event];
  events.forEach(appendPencilPoint);
  queuePencilRender();
}

function finishPencilStroke(event) {
  if (!pencilActiveStroke || event.pointerId !== pencilActivePointerId) return;
  event.preventDefault();
  appendPencilPoint(event);
  pencilCanvas().releasePointerCapture?.(event.pointerId);
  pencilActiveStroke = null;
  pencilActivePointerId = null;
  renderPencilCanvas();
}

function undoPencilStroke() {
  const stroke = pencilStrokes.pop();
  if (!stroke) return;
  pencilRedoStrokes.push(stroke);
  pencilDirty = true;
  renderPencilCanvas();
}

function redoPencilStroke() {
  const stroke = pencilRedoStrokes.pop();
  if (!stroke) return;
  pencilStrokes.push(stroke);
  pencilDirty = true;
  renderPencilCanvas();
}

function clearPencilSheet() {
  if (!pencilStrokes.length || !confirm('Die gesamte Seite leeren?')) return;
  pencilRedoStrokes.push(...pencilStrokes.splice(0));
  pencilDirty = true;
  renderPencilCanvas();
}

function canvasBlob(canvas, type = 'image/png', quality = 0.92) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Vorschau konnte nicht erstellt werden.'))),
      type,
      quality,
    ),
  );
}

async function uploadPencilAsset(path, blob, contentType) {
  const { error } = await sb.storage
    .from('northstar-media')
    .upload(path, blob, { upsert: true, contentType, cacheControl: '3600' });
  if (error) throw error;
}

async function savePencilNote() {
  if (!pencilNotesReady) return;
  const title = $('#pencilTitle').value.trim();
  if (!title) return alert('Bitte einen Titel eingeben.');
  if (!pencilStrokes.length && !confirm('Leere Pencil-Notiz speichern?')) return;
  const button = $('#savePencilNoteBtn');
  button.disabled = true;
  button.textContent = 'Wird gespeichert…';
  const id = pencilEditorNoteId || crypto.randomUUID();
  const folder = `${currentUser.id}/notes/${id}`;
  const drawingPath = `${folder}/drawing.json`;
  const imagePath = `${folder}/preview.png`;
  const paperStyle = $('#pencilPaper').value || 'lined';
  try {
    renderPencilCanvas();
    const drawingBlob = new Blob(
      [
        JSON.stringify({
          version: PENCIL_DRAWING_VERSION,
          width: PENCIL_CANVAS_WIDTH,
          height: PENCIL_CANVAS_HEIGHT,
          paperStyle,
          strokes: pencilStrokes,
        }),
      ],
      { type: 'application/json' },
    );
    const previewBlob = await canvasBlob(pencilCanvas());
    await Promise.all([
      uploadPencilAsset(drawingPath, drawingBlob, 'application/json'),
      uploadPencilAsset(imagePath, previewBlob, 'image/png'),
    ]);
    const payload = {
      id,
      user_id: currentUser.id,
      title,
      category: $('#pencilCategory').value,
      content: '',
      note_type: 'handwriting',
      drawing_path: drawingPath,
      image_path: imagePath,
      paper_style: paperStyle,
      updated_at: new Date().toISOString(),
    };
    const result = pencilEditorNoteId
      ? await sb.from('notes').update(payload).eq('id', id)
      : await sb.from('notes').insert(payload);
    if (result.error) throw result.error;
    pencilDirty = false;
    closePencilNote(true);
    await loadAll();
    showPage('notes');
  } catch (error) {
    console.error(error);
    if (!pencilEditorNoteId)
      await sb.storage.from('northstar-media').remove([drawingPath, imagePath]);
    alert(error.message || 'Pencil-Notiz konnte nicht gespeichert werden.');
  } finally {
    button.disabled = false;
    button.textContent = 'Pencil-Notiz speichern';
  }
}

async function deleteNote(id) {
  if (!confirm('Notiz löschen?')) return;
  const note = notes.find(item => item.id === id);
  const { error } = await sb.from('notes').delete().eq('id', id);
  if (error) return alert(error.message);
  const paths = [note?.image_path, note?.drawing_path].filter(Boolean);
  if (paths.length) {
    const cleanup = await sb.storage.from('northstar-media').remove(paths);
    if (cleanup.error)
      console.warn('Notiz-Dateien konnten nicht vollständig gelöscht werden.', cleanup.error);
  }
  await loadAll();
}

function renderNotes() {
  $('#pencilNotesSetupNotice').classList.toggle('hide', pencilNotesReady);
  $('#openPencilNoteBtn').disabled = !pencilNotesReady;
  $('#notesList').innerHTML = notes.length
    ? notes
        .map(note =>
          note.note_type === 'handwriting'
            ? `
    <article class="card note-card pencil-note-card">
      ${note.preview_url ? `<button class="pencil-note-preview" type="button" onclick="openPencilNote('${note.id}')"><img src="${note.preview_url}" alt="Vorschau: ${escapeHtml(note.title)}"></button>` : '<div class="pencil-note-placeholder">✎</div>'}
      <div class="note-card-body"><div class="note-card-meta"><span class="pill">${escapeHtml(note.category || 'Allgemein')}</span><span>✎ Pencil</span></div><h3>${escapeHtml(note.title)}</h3>
      <div class="actions"><button class="btn primary" onclick="openPencilNote('${note.id}')">Weiterschreiben</button><button class="btn danger" onclick="deleteNote('${note.id}')">Löschen</button></div></div>
    </article>`
            : `
    <article class="card note-card">
      <span class="pill">${escapeHtml(note.category || 'Allgemein')}</span>
      <h3 style="margin:10px 0 6px">${escapeHtml(note.title)}</h3>
      <p class="sub">${escapeHtml(note.content || '').slice(0, 220)}</p>
      <button class="btn danger" onclick="deleteNote('${note.id}')">Löschen</button>
    </article>`,
        )
        .join('')
    : '<div class="empty">Noch keine Notizen.</div>';
}

const pencilCanvasElement = pencilCanvas();
pencilCanvasElement.addEventListener('pointerdown', startPencilStroke, { passive: false });
pencilCanvasElement.addEventListener('pointermove', movePencilStroke, { passive: false });
pencilCanvasElement.addEventListener('pointerup', finishPencilStroke, { passive: false });
pencilCanvasElement.addEventListener('pointercancel', finishPencilStroke, { passive: false });
$('#pencilSize').addEventListener('input', updatePencilToolbar);
$('#pencilPaper').addEventListener('change', () => {
  pencilDirty = true;
  renderPencilCanvas();
});
['#pencilTitle', '#pencilCategory'].forEach(selector =>
  $(selector).addEventListener('input', () => {
    pencilDirty = true;
  }),
);

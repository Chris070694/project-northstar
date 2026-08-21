let libraryBooks = [];
let libraryReady = true;
let activeLibraryBook = null;
let activeLibraryPdf = null;
let activeLibraryRenderTask = null;
let activeLibraryPdfUrl = '';
let libraryReaderPage = 1;
let libraryReaderZoom = 1;
let libraryRenderVersion = 0;
let libraryOpenVersion = 0;
let libraryResizeTimer = null;

const LIBRARY_BUCKET = 'northstar-library';
const PDFJS_VERSION = '5.7.284';
const PDFJS_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}`;
let pdfJsPromise = null;

function isMissingLibrarySchema(error) {
  const message =
    `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return (
    message.includes('42p01') ||
    message.includes('pgrst205') ||
    (message.includes('library_books') && /does not exist|schema cache|not find/i.test(message))
  );
}

function formatLibraryFileSize(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function libraryProgress(book) {
  const total = Math.max(1, Number(book.total_pages) || 1);
  return Math.min(100, Math.max(0, Math.round(((Number(book.current_page) || 1) / total) * 100)));
}

async function getPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import(`${PDFJS_BASE}/build/pdf.min.mjs`).then(pdfjs => {
      pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/build/pdf.worker.min.mjs`;
      return pdfjs;
    });
  }
  return pdfJsPromise;
}

async function loadLibrary() {
  const result = await sb
    .from('library_books')
    .select('*')
    .order('last_opened_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (result.error) {
    if (!isMissingLibrarySchema(result.error)) throw result.error;
    libraryReady = false;
    libraryBooks = [];
    return;
  }
  libraryReady = true;
  libraryBooks = result.data || [];
}

async function librarySignedUrl(path, expiresIn = 21600) {
  if (!path) return '';
  const { data, error } = await sb.storage.from(LIBRARY_BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data?.signedUrl || '';
}

async function librarySignedUrlMap(paths) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data, error } = await sb.storage.from(LIBRARY_BUCKET).createSignedUrls(unique, 3600);
  if (error) throw error;
  return new Map((data || []).map(item => [item.path, item.signedUrl]));
}

function openLibraryUpload() {
  if (!libraryReady) return alert('Bitte zuerst die Bibliotheks-Migration in Supabase ausführen.');
  $('#libraryBookModal').classList.add('open');
  setTimeout(() => $('#bookTitle').focus(), 80);
}

function closeLibraryUpload() {
  if ($('#bookSaveBtn').disabled) return;
  $('#libraryBookModal').classList.remove('open');
}

$('#bookPdf')?.addEventListener('change', event => {
  const file = event.target.files?.[0];
  const label = $('#bookFileName');
  if (!file) {
    label.textContent = 'PDF auswählen';
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    event.target.value = '';
    label.textContent = 'PDF auswählen';
    return alert('Die PDF darf im kostenlosen Supabase-Projekt maximal 50 MB groß sein.');
  }
  label.textContent = `${file.name} · ${formatLibraryFileSize(file.size)}`;
  if (!$('#bookTitle').value.trim())
    $('#bookTitle').value = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');
});

async function inspectLibraryPdf(file) {
  const pdfjs = await getPdfJs();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({
    data: bytes,
    cMapUrl: `${PDFJS_BASE}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${PDFJS_BASE}/standard_fonts/`,
    wasmUrl: `${PDFJS_BASE}/wasm/`,
  }).promise;
  let coverBlob = null;
  try {
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const scale = Math.min(520 / viewport.width, 720 / viewport.height, 1.6);
    const coverViewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(coverViewport.width);
    canvas.height = Math.ceil(coverViewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: coverViewport }).promise;
    coverBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.82));
  } catch (error) {
    console.warn('Cover konnte nicht automatisch erstellt werden.', error);
  }
  const totalPages = pdf.numPages;
  await pdf.destroy();
  return { totalPages, coverBlob };
}

function uploadLibraryPdf(file, path, onProgress) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!window.tus?.Upload) throw new Error('Upload-Modul konnte nicht geladen werden.');
      const {
        data: { session },
      } = await sb.auth.getSession();
      if (!session) throw new Error('Bitte erneut anmelden.');
      const projectId = new URL(SUPABASE_URL).hostname.split('.')[0];
      const upload = new window.tus.Upload(file, {
        endpoint: `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: { authorization: `Bearer ${session.access_token}`, 'x-upsert': 'false' },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        metadata: {
          bucketName: LIBRARY_BUCKET,
          objectName: path,
          contentType: 'application/pdf',
          cacheControl: '3600',
        },
        chunkSize: 6 * 1024 * 1024,
        onError: reject,
        onProgress: (uploaded, total) => onProgress(Math.round((uploaded / total) * 100)),
        onSuccess: resolve,
      });
      const previous = await upload.findPreviousUploads();
      if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    } catch (error) {
      reject(error);
    }
  });
}

function setLibraryUploadProgress(percent, label) {
  $('#bookUploadProgress').classList.remove('hide');
  $('#bookUploadProgressBar').style.width = `${percent}%`;
  $('#bookUploadProgressText').textContent = label;
}

$('#libraryBookForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!libraryReady) return alert('Bitte zuerst die Bibliotheks-Migration in Supabase ausführen.');
  const file = $('#bookPdf').files?.[0];
  if (!file) return alert('Bitte eine PDF auswählen.');
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))
    return alert('Bitte nur PDF-Dateien hochladen.');
  if (file.size > 50 * 1024 * 1024) return alert('Die PDF darf maximal 50 MB groß sein.');

  const button = $('#bookSaveBtn');
  button.disabled = true;
  button.textContent = 'PDF wird vorbereitet…';
  const bookId = crypto.randomUUID();
  const pdfPath = `${currentUser.id}/books/${bookId}.pdf`;
  const coverPath = `${currentUser.id}/covers/${bookId}.webp`;
  let pdfUploaded = false;
  let coverUploaded = false;
  try {
    setLibraryUploadProgress(3, 'PDF wird analysiert…');
    const { totalPages, coverBlob } = await inspectLibraryPdf(file);
    button.textContent = 'PDF wird hochgeladen…';
    await uploadLibraryPdf(file, pdfPath, percent =>
      setLibraryUploadProgress(Math.max(5, Math.round(percent * 0.9)), `Upload ${percent}%`),
    );
    pdfUploaded = true;
    let savedCoverPath = null;
    if (coverBlob) {
      setLibraryUploadProgress(94, 'Cover wird erstellt…');
      const { error } = await sb.storage.from(LIBRARY_BUCKET).upload(coverPath, coverBlob, {
        contentType: 'image/webp',
        cacheControl: '3600',
        upsert: false,
      });
      if (error) throw error;
      coverUploaded = true;
      savedCoverPath = coverPath;
    }
    setLibraryUploadProgress(98, 'Buch wird gespeichert…');
    const { error } = await sb.from('library_books').insert({
      id: bookId,
      user_id: currentUser.id,
      title: $('#bookTitle').value.trim(),
      author: $('#bookAuthor').value.trim(),
      category: $('#bookCategory').value,
      description: $('#bookDescription').value.trim(),
      pdf_path: pdfPath,
      cover_path: savedCoverPath,
      file_name: file.name,
      file_size: file.size,
      total_pages: totalPages,
      current_page: 1,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    setLibraryUploadProgress(100, 'Fertig ✓');
    event.target.reset();
    $('#bookFileName').textContent = 'PDF auswählen';
    setTimeout(() => {
      $('#libraryBookModal').classList.remove('open');
      $('#bookUploadProgress').classList.add('hide');
      $('#bookUploadProgressBar').style.width = '0%';
    }, 350);
    await loadLibrary();
    await renderLibrary();
  } catch (error) {
    console.error(error);
    if (pdfUploaded) await sb.storage.from(LIBRARY_BUCKET).remove([pdfPath]);
    if (coverUploaded) await sb.storage.from(LIBRARY_BUCKET).remove([coverPath]);
    alert(`Buch konnte nicht gespeichert werden: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = 'Buch hochladen';
  }
});

async function deleteLibraryBook(id) {
  const book = libraryBooks.find(item => item.id === id);
  if (!book || !confirm(`„${book.title}“ wirklich aus deiner Bibliothek löschen?`)) return;
  if (activeLibraryBook?.id === id) await closeLibraryReader();
  const paths = [book.pdf_path, book.cover_path].filter(Boolean);
  if (paths.length) {
    const { error } = await sb.storage.from(LIBRARY_BUCKET).remove(paths);
    if (error) return alert(error.message);
  }
  const { error } = await sb.from('library_books').delete().eq('id', id);
  if (error) return alert(error.message);
  libraryBooks = libraryBooks.filter(item => item.id !== id);
  await renderLibrary();
}

async function renderLibrary() {
  const version = ++libraryRenderVersion;
  const grid = $('#libraryGrid');
  if (!grid) return;
  $('#librarySetupNotice').classList.toggle('hide', libraryReady);
  $('#openLibraryUploadBtn').disabled = !libraryReady;
  $('#libraryCount').textContent = String(libraryBooks.length);
  $('#libraryReadingCount').textContent = String(
    libraryBooks.filter(book => Number(book.current_page) > 1 && libraryProgress(book) < 100)
      .length,
  );
  $('#libraryFinishedCount').textContent = String(
    libraryBooks.filter(book => libraryProgress(book) >= 100).length,
  );

  if (!libraryReady) {
    $('#libraryContinue').classList.add('hide');
    grid.innerHTML =
      '<div class="empty">Nach der Supabase-Einrichtung kannst du hier deine PDFs hochladen.</div>';
    return;
  }

  const query = ($('#librarySearch')?.value || '').trim().toLowerCase();
  const category = $('#libraryCategoryFilter')?.value || '';
  const filtered = libraryBooks.filter(
    book =>
      (!category || book.category === category) &&
      `${book.title} ${book.author || ''} ${book.category || ''}`.toLowerCase().includes(query),
  );
  const covers = await librarySignedUrlMap(filtered.map(book => book.cover_path));
  if (version !== libraryRenderVersion) return;

  const latest = libraryBooks.find(book => book.last_opened_at) || null;
  const continueCard = $('#libraryContinue');
  if (latest) {
    const latestCover = latest.cover_path
      ? covers.get(latest.cover_path) || (await librarySignedUrl(latest.cover_path))
      : '';
    continueCard.classList.remove('hide');
    $('#libraryContinueCover').innerHTML = latestCover
      ? `<img src="${escapeHtml(latestCover)}" alt="">`
      : '<span>📖</span>';
    $('#libraryContinueTitle').textContent = latest.title;
    $('#libraryContinueMeta').textContent =
      `Seite ${latest.current_page || 1} von ${latest.total_pages || 1} · ${libraryProgress(latest)}%`;
    $('#libraryContinueBtn').onclick = () => openLibraryBook(latest.id);
  } else continueCard.classList.add('hide');

  grid.innerHTML = filtered.length
    ? filtered
        .map(book => {
          const cover = book.cover_path ? covers.get(book.cover_path) : '';
          const progress = libraryProgress(book);
          return `<article class="library-book-card">
      <button class="library-book-cover" type="button" onclick="openLibraryBook('${book.id}')" aria-label="${escapeHtml(book.title)} öffnen">
        ${cover ? `<img src="${escapeHtml(cover)}" alt="Cover von ${escapeHtml(book.title)}">` : `<span>📖<small>${escapeHtml(book.category || 'Buch')}</small></span>`}
        ${progress > 1 ? `<em>${progress}%</em>` : ''}
      </button>
      <div class="library-book-copy">
        <span class="pill">${escapeHtml(book.category || 'Andere')}</span>
        <h3>${escapeHtml(book.title)}</h3>
        <p>${escapeHtml(book.author || 'Autor nicht angegeben')}</p>
        <div class="library-book-progress"><span style="width:${progress}%"></span></div>
        <small>Seite ${book.current_page || 1} von ${book.total_pages || 1} · ${formatLibraryFileSize(book.file_size)}</small>
        <div class="library-book-actions"><button class="btn primary" type="button" onclick="openLibraryBook('${book.id}')">${progress > 1 ? 'Weiterlesen' : 'Lesen'}</button><button class="btn danger" type="button" onclick="deleteLibraryBook('${book.id}')" aria-label="Buch löschen">✕</button></div>
      </div>
    </article>`;
        })
        .join('')
    : '<div class="empty">Keine Bücher gefunden. Lade deine erste PDF hoch.</div>';
}

async function openLibraryBook(id) {
  const book = libraryBooks.find(item => item.id === id);
  if (!book) return;
  const openVersion = ++libraryOpenVersion;
  const reader = $('#libraryReader');
  reader.classList.add('open');
  reader.setAttribute('aria-hidden', 'false');
  document.body.classList.add('reader-open');
  $('#libraryReaderTitle').textContent = book.title;
  $('#libraryReaderAuthor').textContent = book.author || book.category || '';
  $('#libraryReaderLoading').classList.remove('hide');
  $('#libraryReaderCanvas').classList.add('hide');
  activeLibraryBook = book;
  libraryReaderPage = Math.min(
    Math.max(1, Number(book.current_page) || 1),
    Math.max(1, Number(book.total_pages) || 1),
  );
  libraryReaderZoom = 1;
  updateLibraryZoomLabel();
  try {
    activeLibraryPdfUrl = await librarySignedUrl(book.pdf_path, 21600);
    const pdfjs = await getPdfJs();
    const loadedPdf = await pdfjs.getDocument({
      url: activeLibraryPdfUrl,
      cMapUrl: `${PDFJS_BASE}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${PDFJS_BASE}/standard_fonts/`,
      wasmUrl: `${PDFJS_BASE}/wasm/`,
    }).promise;
    if (openVersion !== libraryOpenVersion || !activeLibraryBook || activeLibraryBook.id !== id) {
      await loadedPdf.destroy();
      return;
    }
    activeLibraryPdf = loadedPdf;
    activeLibraryBook.total_pages = activeLibraryPdf.numPages;
    libraryReaderPage = Math.min(libraryReaderPage, activeLibraryPdf.numPages);
    $('#libraryOpenOriginalBtn').onclick = () =>
      window.open(activeLibraryPdfUrl, '_blank', 'noopener');
    await renderLibraryReaderPage();
  } catch (error) {
    if (openVersion !== libraryOpenVersion) return;
    console.error(error);
    alert(`PDF konnte nicht geöffnet werden: ${error.message}`);
    await closeLibraryReader();
  }
}

async function renderLibraryReaderPage() {
  if (!activeLibraryPdf || !activeLibraryBook) return;
  const renderId = ++libraryRenderVersion;
  try {
    activeLibraryRenderTask?.cancel();
  } catch (_error) {}
  $('#libraryReaderLoading').classList.remove('hide');
  const page = await activeLibraryPdf.getPage(libraryReaderPage);
  if (renderId !== libraryRenderVersion) return;
  const baseViewport = page.getViewport({ scale: 1 });
  const stage = $('#libraryReaderStage');
  const availableWidth = Math.max(260, Math.min(1100, stage.clientWidth - 32));
  const fitScale = Math.min(2.2, availableWidth / baseViewport.width);
  const displayScale = fitScale * libraryReaderZoom;
  const outputScale = Math.min(window.devicePixelRatio || 1, 2);
  const displayViewport = page.getViewport({ scale: displayScale });
  const renderViewport = page.getViewport({ scale: displayScale * outputScale });
  const canvas = $('#libraryReaderCanvas');
  canvas.width = Math.ceil(renderViewport.width);
  canvas.height = Math.ceil(renderViewport.height);
  canvas.style.width = `${Math.ceil(displayViewport.width)}px`;
  canvas.style.height = `${Math.ceil(displayViewport.height)}px`;
  canvas.classList.remove('hide');
  activeLibraryRenderTask = page.render({
    canvasContext: canvas.getContext('2d'),
    viewport: renderViewport,
  });
  try {
    await activeLibraryRenderTask.promise;
  } catch (error) {
    if (error?.name !== 'RenderingCancelledException') throw error;
  }
  if (renderId !== libraryRenderVersion) return;
  $('#libraryReaderLoading').classList.add('hide');
  $('#libraryPageInput').value = String(libraryReaderPage);
  $('#libraryPageTotal').textContent = `/ ${activeLibraryPdf.numPages}`;
  $('#libraryPrevPage').disabled = libraryReaderPage <= 1;
  $('#libraryNextPage').disabled = libraryReaderPage >= activeLibraryPdf.numPages;
  const progress = Math.round((libraryReaderPage / activeLibraryPdf.numPages) * 100);
  $('#libraryReaderProgressBar').style.width = `${progress}%`;
  $('#libraryReaderProgressText').textContent = `${progress}% gelesen`;
  activeLibraryBook.current_page = libraryReaderPage;
  activeLibraryBook.total_pages = activeLibraryPdf.numPages;
  activeLibraryBook.last_opened_at = new Date().toISOString();
  await saveLibraryProgress();
}

async function saveLibraryProgress() {
  if (!activeLibraryBook) return;
  const { error } = await sb
    .from('library_books')
    .update({
      current_page: activeLibraryBook.current_page,
      total_pages: activeLibraryBook.total_pages,
      last_opened_at: activeLibraryBook.last_opened_at,
      updated_at: new Date().toISOString(),
    })
    .eq('id', activeLibraryBook.id);
  if (error) console.error('Lesefortschritt konnte nicht gespeichert werden.', error);
}

async function changeLibraryPage(delta) {
  if (!activeLibraryPdf) return;
  const next = Math.min(activeLibraryPdf.numPages, Math.max(1, libraryReaderPage + delta));
  if (next === libraryReaderPage) return;
  libraryReaderPage = next;
  await renderLibraryReaderPage();
  $('#libraryReaderStage').scrollTo({ top: 0, left: 0, behavior: 'smooth' });
}

async function goToLibraryPage() {
  if (!activeLibraryPdf) return;
  const next = Math.min(
    activeLibraryPdf.numPages,
    Math.max(1, Number($('#libraryPageInput').value) || 1),
  );
  libraryReaderPage = next;
  await renderLibraryReaderPage();
}

function updateLibraryZoomLabel() {
  $('#libraryZoomLabel').textContent = `${Math.round(libraryReaderZoom * 100)}%`;
}

async function changeLibraryZoom(delta) {
  libraryReaderZoom = Math.min(2.5, Math.max(0.65, libraryReaderZoom + delta));
  updateLibraryZoomLabel();
  await renderLibraryReaderPage();
}

async function closeLibraryReader() {
  if (!activeLibraryBook) return;
  ++libraryOpenVersion;
  ++libraryRenderVersion;
  try {
    activeLibraryRenderTask?.cancel();
  } catch (_error) {}
  await saveLibraryProgress();
  try {
    await activeLibraryPdf?.destroy();
  } catch (_error) {}
  activeLibraryPdf = null;
  activeLibraryRenderTask = null;
  activeLibraryBook = null;
  activeLibraryPdfUrl = '';
  $('#libraryReader').classList.remove('open');
  $('#libraryReader').setAttribute('aria-hidden', 'true');
  document.body.classList.remove('reader-open');
  await renderLibrary();
}

window.addEventListener('resize', () => {
  if (!activeLibraryPdf) return;
  clearTimeout(libraryResizeTimer);
  libraryResizeTimer = setTimeout(() => renderLibraryReaderPage(), 180);
});

document.addEventListener('keydown', event => {
  if (!activeLibraryPdf) return;
  if (event.key === 'ArrowLeft') changeLibraryPage(-1);
  if (event.key === 'ArrowRight') changeLibraryPage(1);
  if (event.key === 'Escape') closeLibraryReader();
});

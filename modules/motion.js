/* Bewegung — die Schicht, die aus Seiten eine App macht.
   Fasst keine Daten und keine Module an: sie hört nur zu und animiert.
   Alles hier respektiert prefers-reduced-motion. */

const motionReduced =
  typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)').matches : false;

/* ---------------- Zahlen: aus Text die Zahl herausschälen ----------------
   Die App formatiert an verschiedenen Stellen unterschiedlich: "670 $",
   "$1,234.00", "57 %", "+0.96R", "3.48". Wir zerlegen in Vorspann, Zahl und
   Nachspann und zählen nur die Zahl hoch — Trennzeichen bleiben erhalten. */

function parseAnimatableNumber(text) {
  const match = String(text ?? '').match(/^(\D*?)(-?\d[\d.,]*)(.*)$/s);
  if (!match) return null;
  const [, prefix, raw, suffix] = match;

  const separators = [...raw].filter(char => char === '.' || char === ',');
  const lastIndex = Math.max(raw.lastIndexOf('.'), raw.lastIndexOf(','));
  const lastChar = lastIndex >= 0 ? raw[lastIndex] : '';
  const tail = lastIndex >= 0 ? raw.slice(lastIndex + 1) : '';

  /* Ein bis zwei Ziffern hinter dem letzten Trennzeichen sind Nachkommastellen.
     Drei sind ein Tausenderzeichen — "1.234" ist tausendzweihundertvierunddreißig. */
  const isDecimal = /^\d{1,2}$/.test(tail);
  const decimals = isDecimal ? tail.length : 0;

  /* Das Anzeigeformat muss erhalten bleiben: wer mit Punkt gruppiert, bekommt
     auch während der Animation einen Punkt. Sonst springt die Schreibweise. */
  const decimalChar = isDecimal ? lastChar : '';
  const groupChar =
    separators.filter((_, i) => !(isDecimal && i === separators.length - 1))[0] || '';
  const locale = decimalChar === ',' || groupChar === '.' ? 'de-DE' : 'en-US';
  const grouping = Boolean(groupChar);

  const value = Number(raw.replace(/[.,]/g, m => (m === decimalChar ? '.' : '')));
  if (!Number.isFinite(value)) return null;
  return { prefix, suffix, value, decimals, locale, grouping };
}

function formatAnimatedNumber(parts, value) {
  const number = value.toLocaleString(parts.locale, {
    minimumFractionDigits: parts.decimals,
    maximumFractionDigits: parts.decimals,
    useGrouping: parts.grouping,
  });
  return `${parts.prefix}${number}${parts.suffix}`;
}

/* Schnell los, weich aus — dieselbe Kurve wie die Übergänge.
   Der Zeitstempel des ersten Bildes kann vor dem Start liegen; ohne Klemmen
   würde die Kurve negativ und die Zahl bliebe für einen Frame im Minus. */
function motionEase(elapsed, duration) {
  const t = Math.min(1, Math.max(0, elapsed / duration));
  return 1 - Math.pow(1 - t, 4);
}

function animateNumber(node) {
  const parts = parseAnimatableNumber(node.textContent);
  if (!parts || parts.value === 0) return;
  if (motionReduced) return;
  const target = parts.value;
  const duration = 780;
  const started = performance.now();
  node.dataset.animating = '1';
  const step = now => {
    const eased = motionEase(now - started, duration);
    node.textContent = formatAnimatedNumber(parts, target * eased);
    if (eased < 1) requestAnimationFrame(step);
    else {
      node.textContent = formatAnimatedNumber(parts, target);
      delete node.dataset.animating;
    }
  };
  requestAnimationFrame(step);
}

function animateNumbersIn(root) {
  if (!root) return;
  root.querySelectorAll('.stat .value, .stats-tile strong').forEach(animateNumber);
}

/* ---------------- Kopfzeile: Titel wandert beim Scrollen hinauf ---------------- */

function currentPageTitle() {
  const heading = document.querySelector('.page.active .top h1, .page.active .today-head h1');
  return heading ? heading.textContent.trim() : '';
}

function syncHeaderTitle() {
  const slot = $('#mobileHeaderTitle');
  if (slot) slot.textContent = currentPageTitle();
}

function updateHeaderOnScroll() {
  const header = document.querySelector('.mobile-header');
  if (!header) return;
  const scrolled = (window.scrollY || document.documentElement.scrollTop || 0) > 46;
  header.classList.toggle('scrolled', scrolled);
}

/* ---------------- Sheets folgen dem Finger ---------------- */

function attachSheetDrag(sheet) {
  if (!sheet || sheet.dataset.dragReady) return;
  sheet.dataset.dragReady = '1';
  let startY = null;
  let offset = 0;

  sheet.addEventListener('pointerdown', event => {
    if (event.target.closest('button, a, input, textarea, select')) return;
    startY = event.clientY;
    offset = 0;
    sheet.classList.add('dragging');
    sheet.setPointerCapture?.(event.pointerId);
  });

  sheet.addEventListener('pointermove', event => {
    if (startY === null) return;
    const delta = event.clientY - startY;
    /* Nach unten eins zu eins, nach oben gedämpft — das Gummiband. */
    offset = delta > 0 ? delta : delta / 4;
    sheet.style.transform = `translateY(${offset}px)`;
  });

  const finish = event => {
    if (startY === null) return;
    startY = null;
    sheet.classList.remove('dragging');
    if (event) sheet.releasePointerCapture?.(event.pointerId);
    if (offset > sheet.offsetHeight * 0.3) {
      sheet.style.transform = '';
      closeMobileSheet();
    } else {
      sheet.style.transform = '';
    }
  };

  sheet.addEventListener('pointerup', finish);
  sheet.addEventListener('pointercancel', finish);
}

function setupSheetDrag() {
  document.querySelectorAll('.mobile-sheet').forEach(attachSheetDrag);
}

/* ---------------- Seitenwechsel mit Richtung ---------------- */

const MOTION_TAB_ORDER = ['today', 'trading', 'fitness'];

function motionDirection(fromId, toId) {
  const from = MOTION_TAB_ORDER.indexOf(fromId);
  const to = MOTION_TAB_ORDER.indexOf(toId);
  if (from < 0 || to < 0 || from === to) return 1;
  return to > from ? 1 : -1;
}

/* showPage ruft das hier auf, statt selbst zu wissen wie animiert wird. */
function motionSwapPage(fromId, toId, swap) {
  document.documentElement.style.setProperty('--motion-dir', motionDirection(fromId, toId));
  if (motionReduced || typeof document.startViewTransition !== 'function') {
    swap();
    motionCountUp();
    return;
  }
  /* Während des Übergangs ruht die Animationsschleife des Browsers. Würden die
     Zahlen jetzt starten, wäre ihre Laufzeit vorbei, bevor der erste Frame kommt —
     sie sprängen ohne Bewegung auf den Endwert. Also erst danach. */
  const transition = document.startViewTransition(swap);
  transition.finished.then(motionCountUp).catch(() => motionCountUp());
}

function motionCountUp() {
  animateNumbersIn(document.querySelector('.page.active'));
}

function motionAfterPage() {
  syncHeaderTitle();
  updateHeaderOnScroll();
}

function initMotion() {
  const header = document.querySelector('.mobile-header');
  if (header && !$('#mobileHeaderTitle')) {
    const slot = document.createElement('div');
    slot.id = 'mobileHeaderTitle';
    slot.className = 'mobile-header-title';
    header.appendChild(slot);
  }
  let ticking = false;
  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        updateHeaderOnScroll();
        ticking = false;
      });
    },
    { passive: true },
  );
  setupSheetDrag();
  motionAfterPage();
  motionCountUp();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', initMotion, { once: true });
  else initMotion();
}

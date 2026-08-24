/* Wirtschaftskalender — was heute den Markt bewegt.
   Daten kommen aus der Edge Function `forex-news`, die den Wochen-Feed von
   Fair Economy (Quelle hinter dem ForexFactory-Kalender) serverseitig holt.
   Direkt aus dem Browser ginge das nicht: fremde Domain, kein CORS.

   Das Modul rechnet selbst nichts aus dem Markt — es zeigt Termine. Die
   Bewertung, ob man deshalb draußen bleibt, bleibt beim Menschen. */

let newsEvents = [];
let newsStatus = 'laden'; /* laden | ok | fehler | aus */
let newsGrund = '';
let newsAbgerufen = null;

const NEWS_CACHE_KEY = 'northstar-news-cache';
const NEWS_CACHE_MINUTEN = 15;
const NEWS_MAX_ZEILEN = 6;

function newsDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/* Der Feed liefert die Zeit in US-Ostküstenzeit mit Offset. Ein Date-Objekt
   daraus zeigt im Browser automatisch Ortszeit — genau was gebraucht wird. */
/* Achtung: new Date(null) ist nicht ungueltig, sondern der 1.1.1970 — ein
   fehlendes Datum wuerde sonst als "01:00" durchgehen. Deshalb erst auf einen
   nicht-leeren Text pruefen. */
function newsDatum(iso) {
  if (typeof iso !== 'string' || !iso.trim()) return null;
  const datum = new Date(iso);
  return Number.isNaN(datum.getTime()) ? null : datum;
}

function newsZeit(iso) {
  const datum = newsDatum(iso);
  if (!datum) return '';
  return new Intl.DateTimeFormat('de-AT', { hour: '2-digit', minute: '2-digit' }).format(datum);
}

function newsTagKey(iso) {
  const datum = newsDatum(iso);
  return datum ? newsDateKey(datum) : '';
}

function istNewsHeute(event, heute = newsDateKey()) {
  return newsTagKey(event?.date) === heute;
}

/* Vergangen heißt: der Termin liegt hinter uns. Zahlen stehen dann meistens
   schon fest, die Zeile ist nur noch Rückblick. */
function istNewsVorbei(event, jetzt = Date.now()) {
  const datum = newsDatum(event?.date);
  return Boolean(datum) && datum.getTime() < jetzt;
}

function newsNaechster(events = newsEvents, jetzt = Date.now()) {
  return events.find(event => !istNewsVorbei(event, jetzt)) || null;
}

/* Abstand in Minuten bis zum nächsten Termin — für den Satz im Kopf der Karte. */
function newsMinutenBis(event, jetzt = Date.now()) {
  const datum = newsDatum(event?.date);
  if (!datum) return null;
  return Math.round((datum.getTime() - jetzt) / 60000);
}

function newsAbstandText(minuten) {
  if (minuten === null) return '';
  if (minuten < 0) return 'gerade eben';
  if (minuten < 60) return `in ${minuten} min`;
  const stunden = Math.floor(minuten / 60);
  const rest = minuten % 60;
  if (stunden < 24) return rest ? `in ${stunden} h ${rest} min` : `in ${stunden} h`;
  const tage = Math.round(stunden / 24);
  return tage === 1 ? 'morgen' : `in ${tage} Tagen`;
}

function newsCacheLesen() {
  try {
    const roh = localStorage.getItem(NEWS_CACHE_KEY);
    if (!roh) return null;
    const daten = JSON.parse(roh);
    const alter = (Date.now() - Number(daten.zeit || 0)) / 60000;
    if (!Array.isArray(daten.events) || alter > NEWS_CACHE_MINUTEN) return null;
    return daten;
  } catch (error) {
    return null;
  }
}

function newsCacheSchreiben(events) {
  try {
    localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ zeit: Date.now(), events }));
  } catch (error) {
    /* Ohne Speicher wird bei jedem Start neu geholt. Kein Beinbruch. */
  }
}

async function loadNews() {
  const zwischenspeicher = newsCacheLesen();
  if (zwischenspeicher) {
    newsEvents = zwischenspeicher.events;
    newsAbgerufen = zwischenspeicher.zeit;
    newsStatus = 'ok';
    return;
  }

  try {
    const { data, error } = await sb.functions.invoke('forex-news');
    if (error) throw error;
    if (!data || data.ok === false) {
      newsStatus = 'fehler';
      newsGrund = data?.grund || 'Kalender nicht erreichbar';
      newsEvents = [];
      return;
    }
    newsEvents = Array.isArray(data.events) ? data.events : [];
    newsAbgerufen = Date.now();
    newsStatus = 'ok';
    newsCacheSchreiben(newsEvents);
  } catch (fehler) {
    /* Die Funktion fehlt oder das Netz ist weg. Beides darf loadAll() nicht
       reißen — die Karte sagt es, der Rest der App läuft weiter. */
    newsStatus = 'fehler';
    newsGrund = fehler?.message || 'Kalender nicht erreichbar';
    newsEvents = [];
  }
}

async function refreshNews() {
  try {
    localStorage.removeItem(NEWS_CACHE_KEY);
  } catch (error) {
    /* egal */
  }
  newsStatus = 'laden';
  renderNews();
  await loadNews();
  renderNews();
}

function newsZeileHtml(event, jetzt = Date.now()) {
  const vorbei = istNewsVorbei(event, jetzt);
  const werte = [
    event.forecast ? `Prognose ${escapeHtml(event.forecast)}` : '',
    event.previous ? `zuvor ${escapeHtml(event.previous)}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return `<div class="news-row ${vorbei ? 'vorbei' : ''}">
    <span class="news-time">${escapeHtml(newsZeit(event.date))}</span>
    <span class="news-dot" aria-hidden="true"></span>
    <div class="news-copy">
      <b>${escapeHtml(event.title || '')}</b>
      ${werte ? `<small>${werte}</small>` : ''}
    </div>
    <span class="news-cur">${escapeHtml(event.country || '')}</span>
  </div>`;
}

function renderNews() {
  const karte = $('#newsCard');
  if (!karte) return;
  const liste = $('#newsList');
  const status = $('#newsStatus');
  const jetzt = Date.now();
  const heute = newsDateKey();

  if (newsStatus === 'laden') {
    status.textContent = '…';
    liste.innerHTML = '<div class="news-empty">Kalender wird geladen …</div>';
    return;
  }

  if (newsStatus === 'fehler') {
    status.textContent = '–';
    liste.innerHTML = `<div class="news-empty news-fehler">
      Kalender nicht erreichbar.<small>${escapeHtml(newsGrund)}</small>
      <button class="btn" onclick="refreshNews()">Nochmal versuchen</button>
    </div>`;
    return;
  }

  const heutige = newsEvents.filter(event => istNewsHeute(event, heute));
  const offen = heutige.filter(event => !istNewsVorbei(event, jetzt));

  if (!heutige.length) {
    /* Kein roter Termin heute ist eine Nachricht für sich — und die nächsten
       Tage trotzdem zeigen, sonst wirkt die Karte kaputt. */
    const kommende = newsEvents.filter(event => !istNewsVorbei(event, jetzt)).slice(0, 3);
    status.textContent = 'ruhig';
    liste.innerHTML = kommende.length
      ? `<div class="news-empty">Heute keine wichtigen US-Termine.</div>
         <div class="news-label">Als Nächstes</div>
         ${kommende.map(event => newsZeileHtml(event, jetzt)).join('')}`
      : '<div class="news-empty">Diese Woche keine wichtigen US-Termine.</div>';
    return;
  }

  const naechster = newsNaechster(heutige, jetzt);
  status.textContent = offen.length
    ? `${offen.length} offen`
    : `${heutige.length} durch`;

  const kopf = naechster
    ? `<div class="news-next">Nächster: <b>${escapeHtml(naechster.title)}</b> ${escapeHtml(
        newsAbstandText(newsMinutenBis(naechster, jetzt)),
      )}</div>`
    : '<div class="news-next">Alle Termine von heute sind durch.</div>';

  liste.innerHTML =
    kopf + heutige.slice(0, NEWS_MAX_ZEILEN).map(event => newsZeileHtml(event, jetzt)).join('');
}

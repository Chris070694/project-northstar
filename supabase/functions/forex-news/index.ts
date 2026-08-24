import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

/* CPRB — Wirtschaftskalender
 *
 * Holt den Wochen-Feed von Fair Economy (die Datenquelle hinter dem
 * ForexFactory-Kalender) serverseitig. Direkt aus dem Browser geht das nicht:
 * fremde Domain, kein CORS. Diese Funktion ist der Proxy.
 *
 * Gefiltert wird schon hier, nicht erst im Client — was nicht gebraucht wird,
 * soll gar nicht erst über die Leitung.
 */

const FEED = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const ERLAUBTE_IMPACTS = new Set(['high', 'medium', 'low']);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

type Eintrag = {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  forecast?: string;
  previous?: string;
};

function antwort(daten: unknown, status = 200, cacheSekunden = 0) {
  return new Response(JSON.stringify(daten), {
    status,
    headers: {
      ...CORS,
      'Content-Type': 'application/json',
      /* Der Feed wird wöchentlich gepflegt. Eine Viertelstunde Cache nimmt die
         Last raus, ohne dass Termine spürbar veralten. */
      'Cache-Control': cacheSekunden ? `public, max-age=${cacheSekunden}` : 'no-store',
    },
  });
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = new URL(req.url);
  /* Vorgabe passt zu Christians Handel: XAUUSD reagiert vor allem auf US-Daten. */
  const waehrungen = (url.searchParams.get('currencies') || 'USD')
    .split(',')
    .map(w => w.trim().toUpperCase())
    .filter(Boolean);
  const impacts = (url.searchParams.get('impact') || 'high')
    .split(',')
    .map(i => i.trim().toLowerCase())
    .filter(i => ERLAUBTE_IMPACTS.has(i));

  try {
    const feed = await fetch(FEED, {
      headers: { 'User-Agent': 'CPRB-OS/1.0 (persoenlicher Kalender)' },
      signal: AbortSignal.timeout(10000),
    });

    if (!feed.ok) {
      /* Nicht so tun, als wäre nichts los: der Client soll den Grund anzeigen
         können statt eine leere Liste zu zeigen, die nach "keine Termine" aussieht. */
      return antwort(
        { ok: false, grund: `Kalender antwortet mit ${feed.status}`, events: [] },
        502,
      );
    }

    const roh = (await feed.json()) as Eintrag[];
    if (!Array.isArray(roh)) {
      return antwort({ ok: false, grund: 'Unerwartetes Format', events: [] }, 502);
    }

    const events = roh
      .filter(e => {
        const land = String(e.country || '').toUpperCase();
        const impact = String(e.impact || '').toLowerCase();
        return waehrungen.includes(land) && impacts.includes(impact);
      })
      .map(e => ({
        title: String(e.title || '').slice(0, 140),
        country: String(e.country || '').toUpperCase(),
        /* Als ISO durchreichen. Die Umrechnung in Christians Zeitzone macht der
           Client — der weiß, wo er steht, die Funktion nicht. */
        date: e.date || null,
        impact: String(e.impact || '').toLowerCase(),
        forecast: String(e.forecast || '') || null,
        previous: String(e.previous || '') || null,
      }))
      .filter(e => e.date && e.title)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    return antwort({ ok: true, abgerufen: new Date().toISOString(), events }, 200, 900);
  } catch (fehler) {
    const grund = fehler instanceof Error ? fehler.message : 'Unbekannter Fehler';
    return antwort({ ok: false, grund, events: [] }, 502);
  }
});

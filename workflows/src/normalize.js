// Normalisation : schéma unifié + extraction des signaux de popularité
// + fenêtre de collecte : tout ce qui a été publié depuis la dernière collecte réussie.
// Le bot ne tourne que Mac allumé. Avec une fenêtre fixe de 24 h, tout ce qui était publié
// pendant un sommeil de plus d'un jour était perdu : 38 % du temps en octobre 2026.
// La fenêtre fait au moins 24 h et au plus 7 jours, la mémoire du dédoublonnage
// (dedup-cross-runs.js). staticData n'est enregistré qu'après une exécution réussie :
// si l'exécution échoue, la suivante repart de l'ancienne date et ne perd rien.
const sd = $getWorkflowStaticData('global');
const now = Date.now();
const HEURE_MS = 60 * 60 * 1000;
const FENETRE_MIN_MS = 24 * HEURE_MS;
const FENETRE_MAX_MS = 7 * 24 * HEURE_MS;
const MARGE_MS = 2 * HEURE_MS; // un article est parfois daté un peu avant sa mise en ligne
const derniereCollecte = Number(sd.lastCollectAt) || 0;
const WINDOW_MS = derniereCollecte
  ? Math.min(FENETRE_MAX_MS, Math.max(FENETRE_MIN_MS, now - derniereCollecte + MARGE_MS))
  : FENETRE_MIN_MS;
sd.lastCollectAt = now;
const stats = { collected: 0, feedErrors: [], kept: 0, windowHours: Math.round(WINDOW_MS / HEURE_MS) };

// NB : new URL() n'est pas disponible dans la sandbox du task runner n8n -> regex.
// La query est CONSERVÉE (hors params de tracking) : l'identité vit dedans pour
// YouTube (watch?v=ID), Azure (updates?id=N)... Le fragment aussi (GCP release notes).
const TRACKING = /^(utm_|ref$|ref_|fbclid|gclid|si$|s$|feature$|source$|mc_|cmpid|igshid)/;
function canonical(raw) {
  const m = /^https?:\/\/([^/?#]+)([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(String(raw || '').trim());
  if (!m) return null;
  const host = m[1].toLowerCase().replace(/^(www|m|mobile|amp)\./, '');
  const path = m[2].toLowerCase().replace(/\/amp$/, '').replace(/\/+$/, '');
  let query = '';
  if (m[3]) {
    const keep = m[3].slice(1).split('&').filter(p => !TRACKING.test(p.split('=')[0].toLowerCase())).sort();
    if (keep.length) query = '?' + keep.join('&');
  }
  const frag = m[4] && m[4].length > 1 ? m[4] : '';
  return host + path + query + frag;
}
function stripHtml(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

const out = [];
const redditRank = {};

for (const item of $input.all()) {
  const j = item.json;
  if (!j || j._skip) continue;
  stats.collected++;
  if (j.error) {
    const src = (j._feed && j._feed.s) || String(j.error).substring(0, 60);
    if (!stats.feedErrors.includes(src)) stats.feedErrors.push(src);
    continue;
  }
  const f = j._feed || {};
  let title = String(j.title || '').replace(/\s+/g, ' ').trim();
  const url = j.link || j.url;
  if (!title || !url) continue;
  // les titres de releases GitHub ("v1.0.55") sont ambigus : préfixer par la source
  if (f.k === 'release' && !title.toLowerCase().includes(String(f.s || '').toLowerCase().split(' ')[0])) {
    title = `${f.s} — ${title}`;
  }
  // cross-posts AINews dans Latent Space (même auteur)
  if (f.s === 'Latent Space' && /^\[AINews\]/i.test(title)) continue;

  const pubRaw = j.isoDate || j.pubDate || j.date || j.published || j.updated;
  let pub = pubRaw ? new Date(pubRaw).getTime() : 0;
  if (Number.isNaN(pub)) pub = 0;
  if (f.k === 'ghtrend') pub = now; // GitHub Trending n'a pas de pubDate
  if (pub > 0 && pub < now - WINDOW_MS) continue; // hors fenêtre (items non datés conservés)

  const desc = j.content || j.contentSnippet || j.description || j.summary || '';
  const signals = Object.assign({}, j._signals || {});
  if (f.k === 'hn' && f.s === 'Hacker News') {
    const pts = /Points:\s*(\d+)/.exec(desc);
    if (pts) signals.hnPoints = parseInt(pts[1], 10);
    const cm = /#\s*Comments:\s*(\d+)/.exec(desc);
    if (cm) signals.hnComments = parseInt(cm[1], 10);
    signals.hnUrl = j.comments || j.guid || null;
  }
  if (f.k === 'reddit') {
    // le feed top?t=day est trié par score : le rang est un proxy du score
    redditRank[f.s] = (redditRank[f.s] || 0) + 1;
    signals.redditRank = redditRank[f.s];
    signals.redditUrl = j.link;
  }

  const key = canonical(url);
  if (!key) continue;

  out.push({ json: {
    title,
    url,
    canonicalKey: key,
    source: f.s || 'inconnu',
    cat: f.c || 'tendances',
    weight: f.w || 1.0,
    kind: f.k || 'blog',
    always: !!f.a,
    publishedAt: pub ? new Date(pub).toISOString() : new Date(now).toISOString(),
    snippet: stripHtml(desc).substring(0, 400),
    signals,
  }});
  stats.kept++;
}

sd._runStats = stats;
if (!out.length) return [{ json: { _none: true, canonicalKey: 'none-' + now } }];
return out;

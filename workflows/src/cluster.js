// Clustering en STORIES : regroupe les articles qui couvrent le même sujet
// (URL canonique identique OU titres similaires), calcule la "chaleur" (heat),
// et filtre les sujets déjà publiés dans les 72 dernières heures (anti-répétition).
const sd = $getWorkflowStaticData('global');
if (!sd.stories) sd.stories = [];
const now = Date.now();
const DAY = 24 * 3600 * 1000;

// purge du registre : > 7 jours
sd.stories = sd.stories.filter(st => now - new Date(st.l || st.f).getTime() < 7 * DAY);

const items = $input.all().map(i => i.json).filter(j => !j._none);
if (!items.length) return [{ json: { _none: true } }];

// ---- tokens de titre ----
const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'for', 'and', 'on', 'with', 'is', 'are', 'at', 'its', 'it',
  'how', 'why', 'what', 'de', 'la', 'le', 'les', 'du', 'des', 'un', 'une', 'et', 'pour', 'sur', 'avec', 'dans',
  'new', 'now', 'your', 'you', 'we', 'our', 'this', 'that', 'from', 'by', 'as', 'be', 'not', 'no', 'via']);
function tokens(t) {
  return new Set(
    String(t)
      .replace(/^(show hn|ask hn|tell hn)\s*:\s*/i, '')
      .replace(/^\[[a-z]{1,12}\]\s*/i, '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9.+#-]+/g, ' ')
      .split(' ')
      .filter(w => w.length >= 2 && !STOP.has(w))
  );
}
function overlap(a, b) { let n = 0; for (const x of a) if (b.has(x)) n++; return n; }
function jaccard(a, b) { const i = overlap(a, b); return i / (a.size + b.size - i || 1); }
function containment(a, b) { const [s, l] = a.size <= b.size ? [a, b] : [b, a]; return s.size ? overlap(s, l) / s.size : 0; }
function hashId(str) { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0; return h.toString(36); }
// Un mot « distinctif » porte un nom de version ou de modèle : gpt-6.1, k3.1, 5.5, cve-2026-1234.
// Deux titres qui partagent un tel mot et un autre mot parlent presque sûrement du même événement,
// même rédigés différemment : « Nouveau modèle OpenAI : GPT-6.1 Terra » et « Introducing GPT-6.1 Terra ».
function distinctif(w) { return /\d+\.\d+/.test(w) || (/\d/.test(w) && /[a-z]/.test(w) && w.length >= 4); }
// Mots trop courants pour prouver à eux seuls qu'il s'agit du même sujet.
const GENERIQUES = new Set(['ai', 'ia', 'model', 'models', 'modele', 'modeles', 'llm', 'llms', 'agent', 'agents', 'open',
  'source', 'weights', 'release', 'releases', 'released', 'launch', 'launches', 'launched', 'introducing', 'announcing',
  'available', 'version', 'api', 'data', 'code', 'coding', 'today', 'week', 'update', 'updates', 'news', 'first',
  'more', 'than', 'about', 'into', 'over', 'nouveau', 'nouvelle', 'nouveaux', 'publie', 'support', 'preview', 'beta',
  'small', 'mini', 'nano', 'large', 'medium', 'pro', 'flash', 'lite', 'turbo', 'max', 'ultra', 'plus', 'base',
  'instruct', 'chat', 'vision', 'coder', 'hugging', 'face', 'github', 'google', 'openai', 'anthropic', 'meta']);
function memeEvenement(a, b) {
  let communDistinctif = false, autres = 0;
  for (const w of a) if (b.has(w)) {
    if (distinctif(w)) communDistinctif = true;
    else if (!GENERIQUES.has(w) && w.length >= 4) autres++;
  }
  return communDistinctif && autres >= 1;
}
// La source principale d'un sujet est la plus proche de l'origine : l'annonce officielle d'abord,
// puis le radar des modèles, les notes de version, les blogs, la presse, et les forums en dernier.
const RANG = { lab: 0, radar: 1, release: 2, blog: 3, newsletter: 3, papers: 4, news: 4, podcast: 5, youtube: 5, buzz: 5, hn: 6, reddit: 6, ghtrend: 6 };
const rang = (m) => (RANG[m.kind] !== undefined ? RANG[m.kind] : 4);

const toks = items.map(it => tokens(it.title));

// ---- union-find ----
const parent = items.map((_, i) => i);
function find(i) { return parent[i] === i ? i : (parent[i] = find(parent[i])); }
function union(i, j) { parent[find(j)] = find(i); }

for (let i = 0; i < items.length; i++) {
  for (let j = i + 1; j < items.length; j++) {
    if (items[i].canonicalKey === items[j].canonicalKey) { union(i, j); continue; }
    // une même source ne parle pas deux fois du même événement : deux notes de version d'Anthropic
    // titrées « Claude Platform release notes — October 21 » et « — October 23 » restent deux sujets
    if (items[i].source === items[j].source) continue;
    // similarité de titres : exige au moins 3 tokens de chaque côté (évite les faux positifs sur titres courts)
    if (toks[i].size >= 3 && toks[j].size >= 3 &&
        (jaccard(toks[i], toks[j]) >= 0.5 || containment(toks[i], toks[j]) >= 0.75)) union(i, j);
    else if (memeEvenement(toks[i], toks[j])) union(i, j);
  }
}

const groups = {};
for (let i = 0; i < items.length; i++) (groups[find(i)] = groups[find(i)] || []).push(i);

// AINews, lu dans le flux de Latent Space (normalize.js), sert de capteur : un sujet qu'il cite
// est un sujet dont la communauté parle. On ne garde que ses sujets de moins de 36 heures.
const ainews = sd.ainews && now - (sd.ainews.parution || 0) < 36 * 3600 * 1000 ? sd.ainews : null;
const sujetsAinews = ainews ? [ainews.titre, ...(ainews.sujets || [])].map(tokens) : [];
function citeParAinews(t) {
  return sujetsAinews.some(s => {
    let n = 0, specifique = false;
    for (const w of t) if (s.has(w)) { n++; if (!GENERIQUES.has(w) && (w.length >= 4 || distinctif(w))) specifique = true; }
    return n >= 2 && specifique;
  });
}

// ---- construction des stories ----
const stories = [];
for (const idxs of Object.values(groups)) {
  const members = idxs.map(i => items[i]);
  // membre principal : la source la plus proche de l'origine, puis la plus pondérée, puis le snippet le plus riche
  members.sort((a, b) => (rang(a) - rang(b)) || (b.weight - a.weight) || ((b.snippet || '').length - (a.snippet || '').length));
  const main = members[0];
  const srcNames = [...new Set(members.map(m => m.source))];
  const domains = [...new Set(members.map(m => (m.canonicalKey || '').split('/')[0]))];
  const sig = {};
  for (const m of members) {
    for (const [k, v] of Object.entries(m.signals || {})) {
      if (typeof v === 'number') sig[k] = Math.max(sig[k] || 0, v);
      else if (!sig[k]) sig[k] = v;
    }
  }
  let heat = srcNames.length;
  if ((sig.hnPoints || 0) >= 150) heat++;
  if ((sig.hnPoints || 0) >= 400) heat++;
  if ((sig.lobsters || 0) >= 20) heat++;
  if ((sig.hfUpvotes || 0) >= 50) heat++;
  if ((sig.trendingScore || 0) >= 300) heat++;
  if ((sig.redditRank || 99) <= 3) heat++;

  // tokens du titre PRINCIPAL uniquement (l'union du cluster crée des "soupes de tokens"
  // qui matchent tout dans l'anti-répétition)
  const mainToks = tokens(main.title);
  if (sujetsAinews.length && members.some(m => citeParAinews(tokens(m.title)))) { heat++; sig.ainews = 1; }
  const kinds = [...new Set(members.map(m => m.kind))];

  stories.push({
    id: hashId(main.canonicalKey + '|' + main.title),
    title: main.title,
    url: main.url,
    snippet: main.snippet,
    cat: main.cat,
    always: members.some(m => m.always),
    publishedAt: main.publishedAt,
    sources: members.slice(0, 6).map(m => ({ s: m.source, u: m.url, t: m.title })),
    sourceCount: srcNames.length,
    domains: domains.length,
    heat,
    signals: sig,
    preScore: Math.max(...members.map(m => m.preScore || 0)),
    _tokens: [...mainToks],
    // un sujet « labo » : une publication officielle, ou un nouveau modèle d'un grand labo repéré par les radars
    labo: members.some(m => m.kind === 'lab' || (m.kind === 'radar' && m.always)),
    kinds,
    mainSource: main.source,
    isUpdate: false,
  });
}

// ---- anti-répétition vs registre (72h) + détection d'escalade ----
const recent = sd.stories.filter(st => now - new Date(st.l || st.f).getTime() < 3 * DAY);
const recentToks = recent.map(st => new Set((st.k || '').split(' ').filter(Boolean)));
const kept = [];
let skippedRepeats = 0;

for (const story of stories) {
  const stoks = new Set(story._tokens);
  let matched = null;
  for (let i = 0; i < recent.length; i++) {
    // même source, autre adresse : un nouvel article, pas une répétition
    if (recent[i].src && recent[i].src === story.mainSource && recent[i].u !== story.url) continue;
    // containment ET au moins 3 tokens communs (évite les faux "déjà couvert")
    if (stoks.size >= 3 && recentToks[i].size >= 3 &&
        overlap(stoks, recentToks[i]) >= 3 && containment(stoks, recentToks[i]) >= 0.7) { matched = recent[i]; break; }
  }
  if (!matched) { kept.push(story); continue; }
  // sujet déjà connu : mise à jour du registre
  matched.l = new Date(now).toISOString();
  const heatJump = story.heat - (matched.h || 0);
  const bigEngagement = (story.signals.hnPoints || 0) >= 300;
  if (!matched.e && (heatJump >= 2 || (bigEngagement && story.heat >= 3))) {
    matched.e = true;
    matched.h = Math.max(matched.h || 0, story.heat);
    story.isUpdate = true;
    kept.push(story); // repasse une fois, routé vers #tendances comme "ça monte"
  } else {
    matched.h = Math.max(matched.h || 0, story.heat);
    skippedRepeats++;
  }
}

sd._runStats = Object.assign(sd._runStats || {}, { stories: kept.length, skippedRepeats });
if (!kept.length) return [{ json: { _none: true } }];
kept.sort((a, b) => (b.preScore + b.heat) - (a.preScore + a.heat));
return kept.map(s => ({ json: s }));

// Pré-ranking multi-signaux : mots-clés 2026 + popularité + poids source + récence
// Remplace le cap brutal "top 50 par mots-clés" de la v1 : top 130 par score composite pour
// une journée de collecte, jusqu'au double après un rattrapage de plusieurs jours (normalize.js).
const sd = $getWorkflowStaticData('global');
const joursCollectes = Math.max(1, ((sd._runStats || {}).windowHours || 24) / 24);
const KEEP = Math.round(130 * Math.min(2, joursCollectes));

const HOT3 = ['claude', 'gpt-', 'gemini', 'llama', 'mistral', 'deepseek', 'qwen', 'open-weights', 'open weights',
  'nouveau modèle', 'new model', 'benchmark', 'sota', 'state of the art', 'agent', 'agentic', 'mcp',
  'model context protocol', 'claude code', 'cursor', 'copilot', 'codex', 'fine-tun', 'rag', 'inference',
  'reasoning', 'multimodal', 'release', 'released', 'launch', 'v2.', 'v3.', 'v4.', 'v5.', 'breaking change',
  'cve-', 'zero-day', '0-day', 'rce', 'critical vulnerability', 'supply chain', 'faille', 'exploit',
  'typescript', 'javascript', 'python', 'rust', 'react', 'node.js', 'bun', 'deno', 'vite', 'open source', 'open-source'];
const HOT2 = ['llm', 'ia', ' ai ', 'embedding', 'transformer', 'training', 'gpu', 'context window', 'prompt',
  'eval', 'hallucination', 'distillation', 'quantization', 'framework', 'compiler', 'runtime', 'api',
  'sdk', 'cli', 'devtools', 'docker', 'kubernetes', 'serverless', 'postgres', 'sqlite', 'self-host',
  'paper', 'research', 'étude', 'browser', 'webassembly', 'wasm'];
const HOT1 = ['cloud', 'database', 'tool', 'outil', 'update', 'version', 'performance', 'sécurité', 'security', 'data'];
const NEG = ['webinar', 'sponsored', 'partenariat', 'case study', 'hiring', 'recrut', 'black friday', 'promo',
  'horoscope', 'bon plan', 'soldes', 'forfait', 'raises $', 'series a', 'series b', 'series c', 'funding round',
  'ipo', 'valuation', 'netflix', 'disney', 'gaming console', 'iphone 1', 'galaxy s'];

function kwScore(text) {
  let s = 0;
  for (const w of HOT3) if (text.includes(w)) s += 3;
  for (const w of HOT2) if (text.includes(w)) s += 2;
  for (const w of HOT1) if (text.includes(w)) s += 1;
  for (const w of NEG) if (text.includes(w)) s -= 4;
  return Math.min(s, 12);
}
function popScore(sig) {
  let p = 0;
  if (sig.hnPoints) p = Math.max(p, Math.min(1, sig.hnPoints / 500));
  if (sig.lobsters) p = Math.max(p, Math.min(1, sig.lobsters / 40));
  if (sig.hfUpvotes) p = Math.max(p, Math.min(1, sig.hfUpvotes / 80));
  if (sig.trendingScore) p = Math.max(p, Math.min(1, sig.trendingScore / 600));
  if (sig.ghStars) p = Math.max(p, Math.min(1, sig.ghStars / 800));
  if (sig.redditRank) p = Math.max(p, Math.max(0, (15 - sig.redditRank) / 15) * 0.7);
  return p;
}

const now = Date.now();
const items = $input.all().filter(i => !i.json._none);
if (!items.length) return [{ json: { _none: true } }];

for (const it of items) {
  const j = it.json;
  const text = (j.title + ' ' + (j.snippet || '')).toLowerCase();
  const ageH = Math.max(0, (now - new Date(j.publishedAt).getTime()) / 3600000);
  j.preScore = Math.round((
    kwScore(text) * 0.8 +
    popScore(j.signals || {}) * 6 +
    ((j.weight || 1) - 1) * 3 +
    (ageH < 6 ? 0.5 : 0)
  ) * 10) / 10;
}

items.sort((a, b) => b.json.preScore - a.json.preScore);
const selected = [];
const seen = new Set();
for (const it of items) {
  if (it.json.always && !seen.has(it.json.canonicalKey)) { selected.push(it); seen.add(it.json.canonicalKey); }
}
const alwaysCount = selected.length;
// Une même source ne prend pas plus de 15 % des places : en octobre 2026, un seul forum
// (r/LocalLLaMA) et un seul site de sécurité faisaient près de la moitié des publications.
const PAR_SOURCE = Math.max(8, Math.round(KEEP * 0.15));
const parSource = {};
for (const it of items) {
  if (selected.length >= KEEP + alwaysCount) break;
  if (seen.has(it.json.canonicalKey)) continue;
  const s = it.json.source || '?';
  if ((parSource[s] || 0) >= PAR_SOURCE) continue;
  parSource[s] = (parSource[s] || 0) + 1;
  selected.push(it);
  seen.add(it.json.canonicalKey);
}

sd._runStats = Object.assign(sd._runStats || {}, { ranked: selected.length });
return selected;

// Message de statut : métriques du funnel + observabilité feeds/LLM/envois
const sd = $getWorkflowStaticData('global');
const s = sd._runStats || {};
const t = new Date().toISOString().replace('T', ' ').substring(0, 16);

// l'input = sortie de Discord Send (continueOnFail) : compter les envois en échec
const sendFails = $input.all().filter(i => i.json && i.json.error).length;

const lines = [
  `**Veille Pro v2** — ${t} UTC`,
  `📥 ${s.collected || 0} collectés → 🆕 ${s.kept || 0} dans la fenêtre → 🏷️ ${s.ranked || 0} pré-classés → 🧩 ${s.stories || 0} stories → ✅ ${s.published || 0} publiées`,
];
const extras = [];
if (s.hot) extras.push(`🔥 ${s.hot} sujets chauds`);
if (s.critiques) extras.push(`🚨 ${s.critiques} critiques`);
if (s.skippedRepeats) extras.push(`🔁 ${s.skippedRepeats} déjà couverts (72h)`);
if (s.fallbacks) extras.push(`⚠️ ${s.fallbacks} classés en fallback (LLM KO)`);
if (sendFails) extras.push(`❌ ${sendFails} envoi(s) Discord en échec`);
if (extras.length) lines.push(extras.join(' · '));
if (s.byChannel && Object.keys(s.byChannel).length) {
  lines.push('📂 ' + Object.entries(s.byChannel).map(([k, v]) => `${k}: ${v}`).join(', '));
}
if (s.feedErrors && s.feedErrors.length) {
  lines.push(`📡 ${s.feedErrors.length} feed(s) en erreur : ${s.feedErrors.slice(0, 6).join(', ')}${s.feedErrors.length > 6 ? '…' : ''}`);
}

return [{ json: { payload: {
  username: 'Veille · Status',
  content: lines.join('\n').substring(0, 1900),
  flags: 4096,
  allowed_mentions: { parse: [] },
}}}];

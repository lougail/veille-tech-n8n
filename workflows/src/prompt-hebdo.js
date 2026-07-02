// Bilan hebdomadaire (dimanche soir) : stories fortes de la semaine + mémoire des digests
const sd = $getWorkflowStaticData('global');
const week = (sd.stories || []).filter(st => st.p && st.s >= 7);
const digests = (sd.digestHistory || []).map(d => `[${d.d}]\n${(d.text || '').substring(0, 700)}`).join('\n\n');
if (!week.length && !digests) return [];

week.sort((a, b) => (b.s + (b.h || 0)) - (a.s + (a.h || 0)));
const list = week.slice(0, 25).map(st =>
  `- [${st.c}] "${st.t}" (score ${st.s}/10, chaleur ${st.h || 1}) ${st.u}`
).join('\n');

const prompt = `Tu rédiges le bilan hebdomadaire de veille de Louis, développeur fullstack (JS/TS, Python) spécialisé data/IA.

STORIES MARQUANTES DE LA SEMAINE (score >= 7) :
${list || '(aucune)'}

DIGESTS QUOTIDIENS DE LA SEMAINE (pour repérer les trajectoires) :
${digests || '(aucun)'}

Rédige en français, markdown Discord, MAXIMUM 3300 caractères, sans titre principal ni introduction :
**📈 Les tendances de la semaine** — 3-5 dynamiques de fond : ce qui monte, ce qui confirme, ce qui retombe (compare les digests entre eux).
**🏆 Top des immanquables** — 5 à 10 stories au format "- **[titre](url)** — 1 ligne d'impact" (liens markdown obligatoires, reprends les URLs fournies).
**🔍 Signaux faibles** — 2-3 sujets discrets mais prometteurs à surveiller.
**💡 L'insight de la semaine** — 1 conclusion actionnable pour un dev IA.
Ton analytique et dense, zéro remplissage.`;

return [{ json: { prompt, count: week.length } }];

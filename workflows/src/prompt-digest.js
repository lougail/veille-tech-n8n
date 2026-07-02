// Digest quotidien : relit les stories publiées AUJOURD'HUI depuis le registre
// (couvre les 3 runs de la journée, pas seulement le run courant — corrige la v1)
const sd = $getWorkflowStaticData('global');
const today = $now.toISODate();
const todays = (sd.stories || []).filter(st => st.p && st.f && st.f.startsWith(today));
if (!todays.length) return [];

todays.sort((a, b) => (b.s + (b.h || 0) * 0.5) - (a.s + (a.h || 0) * 0.5));
const list = todays.slice(0, 30).map(st =>
  `- [${st.c}] "${st.t}" (score ${st.s}/10, chaleur ${st.h || 1}, ${st.n || 1} source(s)) ${st.u}\n  ${st.sm || ''}`
).join('\n');

const prev = sd.lastDigest && sd.lastDigest.d !== today && sd.lastDigest.text
  ? `\nDIGEST D'HIER (pour repérer ce qui évolue, ne le répète pas) :\n${sd.lastDigest.text.substring(0, 1200)}\n`
  : '';

const prompt = `Tu rédiges le digest quotidien de veille de Louis, développeur fullstack (JS/TS, Python) spécialisé data/IA.

STORIES PUBLIÉES AUJOURD'HUI (${todays.length} au total, top 30 listées) :
${list}
${prev}
Rédige le digest en français, en markdown Discord, MAXIMUM 2500 caractères, sans titre principal (déjà géré) et sans phrase d'introduction :
**🎯 L'essentiel** — 2-3 phrases sur ce qui compte vraiment aujourd'hui.
**🤖 IA** / **💻 Dev** / **☁️ Cloud** / **🔒 Sécu** — sections uniquement si contenu pertinent, 2-4 items max chacune au format "- **[titre](url)** — pourquoi ça compte (1 ligne)". Les liens markdown sont OBLIGATOIRES (reprends les URLs fournies).
**💎 La découverte** — 1 pépite moins visible du jour.
**📈 À suivre** — 1-2 sujets qui montent (appuie-toi sur la chaleur et la continuité avec hier).
Ton factuel et dense, zéro remplissage.`;

return [{ json: { prompt, count: todays.length } }];

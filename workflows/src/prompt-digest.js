// Résumé : relit dans le registre les stories publiées depuis le résumé précédent, au plus
// les trois derniers jours (planifier-resumes.js décide quand il part). Un résumé manqué
// un soir couvre ainsi, à l'exécution suivante, tout ce qui a été publié depuis.
const sd = $getWorkflowStaticData('global');
const today = $now.toISODate();
const plan = $input.first().json;
const TROIS_JOURS_MS = 3 * 24 * 3600 * 1000;
const maintenant = $now.toMillis();
const depuis = Math.max(Number(plan.depuisResume) || 0, maintenant - TROIS_JOURS_MS);
const todays = (sd.stories || []).filter(st => st.p && st.f && Date.parse(st.f) > depuis);
if (!todays.length) return [];
const debut = $now.minus({ milliseconds: maintenant - depuis }).setLocale('fr');
const periode = debut.toISODate() === today
  ? "aujourd'hui"
  : 'depuis ' + debut.toFormat("cccc d LLLL 'à' H 'h'");

todays.sort((a, b) => (b.s + (b.h || 0) * 0.5) - (a.s + (a.h || 0) * 0.5));
const list = todays.slice(0, 30).map(st =>
  `- [${st.c}] "${st.t}" (score ${st.s}/10, chaleur ${st.h || 1}, ${st.n || 1} source(s)) ${st.u}\n  ${st.sm || ''}`
).join('\n');

const prev = sd.lastDigest && sd.lastDigest.d !== today && sd.lastDigest.text
  ? `\nDIGEST D'HIER (pour repérer ce qui évolue, ne le répète pas) :\n${sd.lastDigest.text.substring(0, 1200)}\n`
  : '';

const prompt = `Tu rédiges le digest quotidien de veille de Louis, développeur fullstack (JS/TS, Python) spécialisé data/IA.

STORIES PUBLIÉES ${periode.toUpperCase()} (${todays.length} au total, top 30 listées) :
${list}
${prev}
Rédige le digest en français, en markdown Discord, MAXIMUM 2500 caractères, sans titre principal (déjà géré) et sans phrase d'introduction :
**🎯 L'essentiel** — 2-3 phrases sur ce qui compte vraiment sur cette période.
**🤖 IA** / **💻 Dev** / **☁️ Cloud** / **🔒 Sécu** — sections uniquement si contenu pertinent, 2-4 items max chacune au format "- **[titre](url)** — pourquoi ça compte (1 ligne)". Les liens markdown sont OBLIGATOIRES (reprends les URLs fournies).
**💎 La découverte** — 1 pépite moins visible du jour.
**📈 À suivre** — 1-2 sujets qui montent (appuie-toi sur la chaleur et la continuité avec hier).
Ton factuel et dense, zéro remplissage.`;

return [{ json: { prompt, count: todays.length, periode } }];

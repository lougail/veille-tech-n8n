// Le brief du matin : les sujets publiés depuis le brief précédent (trois jours au plus),
// relus dans le registre, en trois rubriques. Les publications des labos d'abord, puis ce qui fait
// du bruit, puis ce qui sert au développement ; un nombre fixe de sujets, pour un message qu'on lit
// jusqu'au bout.
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

const poids = (st) => st.s + (st.h || 0) * 0.5 + (st.lab ? 1 : 0);
todays.sort((a, b) => poids(b) - poids(a));
function ligne(st) {
  const marques = [st.lab ? 'LABO' : '', (st.h || 0) >= 3 || st.ai ? 'BRUIT' : ''].filter(Boolean).join(', ');
  return `- [${st.c}${marques ? ', ' + marques : ''}] "${st.t}" (score ${st.s}/10, chaleur ${st.h || 1}, ${st.n || 1} source(s)) ${st.u}\n  ${st.sm || ''}`;
}
const list = todays.slice(0, 40).map(ligne).join('\n');
const ainews = sd.ainews && maintenant - (sd.ainews.parution || 0) < 36 * 3600 * 1000 ? sd.ainews : null;
const bruit = ainews
  ? `\nSUJETS DU JOUR SELON AINEWS (résumé de ce qui fait du bruit sur X et Reddit ; numéro « ${ainews.titre} », ${ainews.url}) :\n- ${ainews.sujets.slice(0, 15).join('\n- ')}\n`
  : '';
const prev = sd.lastDigest && sd.lastDigest.d !== today && sd.lastDigest.text
  ? `\nBRIEF PRÉCÉDENT (pour repérer ce qui évolue, ne le répète pas) :\n${sd.lastDigest.text.substring(0, 1200)}\n`
  : '';

const prompt = `Tu rédiges le brief du matin de la veille de Louis, développeur fullstack (JS/TS, Python) qui se spécialise en IA.
Ses deux priorités : suivre tout ce que publient officiellement les grands labos d'IA (sujets marqués LABO), et savoir au plus vite ce qui fait beaucoup de bruit (sujets marqués BRUIT, et sujets du jour selon AINews).

SUJETS PUBLIÉS ${periode.toUpperCase()} (${todays.length} au total, les 40 premiers listés, du plus important au moins important) :
${list}
${bruit}${prev}
Rédige le brief en français, en markdown Discord, MAXIMUM 2800 caractères, sans titre principal (déjà géré) et sans phrase d'introduction :
**🎯 L'essentiel** — 2 phrases au plus : ce qu'il faut retenir de la période.
**🏛️ Les labos** — les publications officielles notables (modèle, version, fonction d'API, prix, retrait, outil), 6 au plus, au format "- **[titre](url)** — ce que ça change, en une ligne". Si rien de notable : "Rien de notable."
**🔥 Ce qui fait du bruit** — les 3 ou 4 sujets dont on parle le plus, d'après la chaleur, les sources multiples et AINews ; même format, en disant en quelques mots pourquoi ça fait du bruit.
**💻 Pour le dev** — 2 ou 3 sujets utiles pour son travail (outils, versions, sécurité qui le touche) ; même format.
Douze sujets au plus en tout. Les liens markdown sont OBLIGATOIRES : reprends exactement les URLs fournies, n'en invente aucune. Ton factuel et dense, zéro remplissage.`;

return [{ json: { prompt, count: todays.length, periode } }];

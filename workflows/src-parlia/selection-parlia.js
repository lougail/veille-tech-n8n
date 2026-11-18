// La sélection de la semaine : au plus 8 fiches (réglable), sans minimum, choisies sur leur note, d'après les règles
// de sources.md, section 6.2. Une semaine calme en donne moins ; les autres articles notés 4 ou plus vont en réserve.
// Jusqu'au 16 novembre 2026, elle en proposait de 10 à 15 : elle complétait avec des notes de 5 et forçait deux
// fiches par axe.
// Elle puise dans le registre les articles triés depuis la dernière préparation (14 jours au plus, 7 la première fois).
// 1. La CNIL ou le CEPD : le texte le plus pertinent de la semaine est toujours rappelé sur une ligne à part (« la
//    CNIL et le CEPD cette semaine »), même noté bas ; il ne devient une fiche que s'il est noté 6 ou plus.
// 2. Toujours les drapeaux vérifiés : retrait ou changement de prix d'un modèle suivi ; nouveau modèle de décision
//    annoncé par une source primaire ; échéance réglementaire avant la fin de janvier 2027 (la soutenance).
// 3. Seuil : les articles notés 6 ou plus, par note décroissante, jusqu'au maximum.
// 4. Au plus 5 fiches par axe, sans minimum par axe.
// 5. Plafonds : au plus 3 prépublications arXiv, au plus 2 articles d'une même source. Une prépublication dont le titre
//    commence par le nom d'un modèle suivi, suivi d'un deux-points, présente ce modèle lui-même (« Zuse: A Decision
//    Model for European Languages ») : elle ne compte dans aucun de ces deux plafonds (16 novembre 2026 ; au rejeu de
//    la semaine 46, ils laissaient Zuse en réserve, que Louis avait gardé en séance). Une étude sur un modèle suivi
//    (« Is Jev a Good Multilingual Judge? », « UltraBERT-JEV: … ») y compte, comme les autres.
// 6. Un événement, une ligne : la source primaire en tête, « couvert aussi par » ensuite ; un article non primaire
//    n'entre que si l'original manque, marqué « à recouper ».
//    Deux sources d'un même éditeur (le blog de Google et le journal de l'API Gemini, ou le catalogue d'OpenRouter pour
//    un modèle de Google), publiées à un jour près, qui nomment le même produit, sont un seul événement : la semaine 47
//    avait proposé deux fois la Decisions API de Google (fiches 1 et 6). Deux versions différentes d'un même produit
//    (« Gemini Omni 1.1 Flash », « Gemini Omni 1.2 Flash ») restent deux événements.
// 8. Hors thème : jamais.
// Les règles 1 et 2 passent avant les plafonds, jamais avant le maximum. La règle 7 (les points « à surveiller »
// des séances précédentes, en tête et hors quota) ne passe pas par ici : la préparation les reprend des notes de
// séance (nœud Notes), au-dessus des candidats.
// Chaque candidat porte sa date de publication (vide si la source n'en donne pas), le jour où le bot l'a vu, et
// s'il a été publié avant le premier jour de la période lue (avantPeriode) : un article ancien, ou la mise à jour
// d'un avis ancien, à signaler (le billet de TypeSafe du 3 novembre 2026, dans la période du 4 au 9 novembre).
const sd = $getWorkflowStaticData('global');
const plan = $('Que faire ?').first().json;
if (!plan.preparation) return [];
const reglages = plan.reglages || {};
const MAX = reglages.candidatsMax || 8;
const maintenant = $now.toMillis();
const J = 24 * 3600 * 1000;
const aujourdhui = $now.toISODate();
const dans90 = $now.plus({ days: 90 }).toISODate();
const FIN_FORMATION = '2027-01-31';
// Les dates relevées le 29 octobre 2026 (sources.md, 6.4), rappelées quand elles tombent dans les 90 jours.
const ECHEANCES_CONNUES = [
  { date: '2026-11-30', titre: "Arrêt d'OpenAI Evals et de l'API des prompts réutilisables", url: 'https://developers.openai.com/api/docs/deprecations' },
  { date: '2026-11-30', titre: 'Retrait de Claude Sonnet 4.5', url: 'https://platform.claude.com/docs/en/about-claude/model-deprecations' },
  { date: '2026-12-01', titre: 'Journée RGPD de la CNIL à Poitiers', url: 'https://www.cnil.fr/fr/journee-rgpd-2026-poitiers' },
  { date: '2026-12-02', titre: "Règlement IA : nouvelles interdictions et fin de la transition pour le marquage des contenus générés (article 50, paragraphe 2)", url: 'https://ai-act-service-desk.ec.europa.eu/en/ai-act/eu-ai-act-implementation-timeline' },
  { date: '2026-12-11', titre: "Retrait d'anciennes versions de GPT-5", url: 'https://developers.openai.com/api/docs/deprecations' },
  { date: '2027-01-14', titre: 'Retrait de GPT-4o, GPT-4o mini, GPT-4.1 et GPT-4.1 mini', url: 'https://developers.openai.com/api/docs/deprecations' },
];

const prep = sd.prep || {};
const depuis = plan.essai || !prep.at ? maintenant - 7 * J : Math.max(Number(prep.at), maintenant - 14 * J);
// Le jour (heure de Paris) d'un instant passé, en millisecondes.
const jourDe = (t) => (t ? $now.minus({ milliseconds: Math.max(0, maintenant - Number(t)) }).toISODate() : '');
const jourDebut = jourDe(depuis);
// Une ligne des retraits d'OpenAI qui ne nomme que des modèles d'image, de son ou de vidéo, triée avant le 16 novembre
// 2026, ne revient pas : la collecte n'en garde plus que les modèles de texte (PARLIA.RETRAITS_TEXTE).
const fenetre = (sd.registre || []).filter((a) => (a.vu || 0) > depuis && !(deRetraitsTexte(a.sid, a.t, a.s) && ligneHorsTexte(a.t)));
const stats = { lus: fenetre.length, horsTheme: 0, secours: 0, parAxe: {}, notes6: 0 };
for (const a of fenetre) {
  if (a.axe === 'hors_theme') stats.horsTheme++;
  else stats.parAxe[a.axe] = (stats.parAxe[a.axe] || 0) + 1;
  if (a.sec) stats.secours++;
  if (a.axe !== 'hors_theme' && a.p >= 6) stats.notes6++;
}

// ---- Un événement, une ligne ----
const sansAccents = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const VIDES = new Set(['dans', 'avec', 'pour', 'from', 'with', 'that', 'this', 'your', 'about', 'their', 'sont', 'nouveau',
  'nouvelle', 'nouveaux', 'notes', 'version', 'release', 'model', 'models', 'modele', 'modeles', 'what', 'have', 'will']);
// Les mois et les années ne disent pas de quoi parle un texte : « November 11, 2026 », « le 11 novembre 2026 ».
const MOIS_OU_ANNEE = /^((19|20)\d\d|january|february|march|april|june|july|august|september|october|november|december|janvier|fevrier|mars|avril|juin|juillet|aout|septembre|octobre|novembre|decembre)$/;
const mots = (t) => new Set(sansAccents(t).split(/[^a-z0-9.]+/).map((m) => m.replace(/^\.+|\.+$/g, ''))
  .filter((m) => m.length >= 4 && !VIDES.has(m) && !MOIS_OU_ANNEE.test(m)));
// Le sujet d'un titre : sans le nom de sa source en tête (« Google, journal de l'API Gemini — … »), ni, au catalogue
// d'OpenRouter, la formule du bot (« Nouveau modèle au catalogue d'OpenRouter : Google: Gemini 4 Carbon »).
const sujet = (a) => {
  let t = String(a.t || '');
  if (a.s && t.startsWith(a.s + ' — ')) t = t.slice(a.s.length + 3);
  return a.sid === 'A02' ? t.replace(/^[^:]*:\s+/, '') : t;
};
// Les numéros de version d'un titre (« 1.2 » dans « Gemini Omni 1.2 Flash ») ; une date (11.11.2026) n'en est pas un.
const versions = (t) => new Set((sansAccents(t).match(/(?<![\d.])\d+(?:\.\d+)+/g) || []).filter((v) => !/\d{4}/.test(v)));
const autresVersions = (a, b) => {
  const A = versions(sujet(a));
  const B = versions(sujet(b));
  return A.size > 0 && B.size > 0 && ![...A].some((v) => B.has(v));
};
// L'éditeur d'un article : le nom de sa source avant la virgule (« Google, blog … »), ou, au catalogue d'OpenRouter
// et sur Hugging Face, le compte qui publie le modèle (openrouter.ai/google/…, huggingface.co/perplexity-ai/…).
const ALIAS_EDITEURS = { mistralai: 'mistral', liquidai: 'liquid', typesafeai: 'typesafe', perplexityai: 'perplexity' };
const editeurDe = (a) => {
  const compte = /^https?:\/\/(?:openrouter\.ai|huggingface\.co)\/(?!blog\/|papers\/|spaces\/|datasets\/|docs\/)([\w-]+)\/[\w.:-]+/i.exec(String(a.u || ''));
  const nom = sansAccents(compte ? compte[1] : String(a.s || '').split(',')[0]).replace(/[^a-z0-9]/g, '');
  return ALIAS_EDITEURS[nom] || nom;
};
// Les mots des annonces et des résumés du tri qui ne nomment aucun produit.
const GENERIQUES = new Set(['available', 'availability', 'generally', 'developers', 'developer', 'introducing', 'introduces',
  'launch', 'launches', 'launched', 'released', 'releases', 'releasing', 'support', 'supports', 'update', 'updates', 'updated',
  'today', 'access', 'using', 'build', 'faster', 'better', 'latest', 'newest', 'feature', 'features', 'pricing', 'price',
  'catalogue', 'changement', 'prix', 'suivi', 'retrait', 'annonce', 'annoncent', 'ajoute', 'depot', 'disponible', 'sortie',
  'entree', 'jetons', 'million', 'pourrait', 'comparatif', 'parlia', 'louis', 'etiquetage', 'questions', 'ecrites', 'senat',
  'developpeurs', 'nouvelles', 'offre', 'lance', 'publie', 'propose', 'permet', 'openrouter']);
const jourPublie = (a) => a.d || jourDe(a.vu);
const ecartJours = (x, y) => (x && y ? Math.abs(Date.parse(x + 'T12:00:00Z') - Date.parse(y + 'T12:00:00Z')) / J : Infinity);
// Deux articles de deux sources différentes parlent du même événement s'ils ont la même adresse ; ou deux mots
// longs en commun dans leurs titres, pour un quart de leurs mots : « OpenAI launches the Decisions API for
// classification » et « Build more responsive apps with the Decisions API for classification » ; ou, de deux sources
// d'un même éditeur, publiés à un jour près, deux mots en commun entre le titre de l'un et le titre ou le résumé de
// l'autre, sans le nom de l'éditeur ni les mots des annonces (« Gemini Decisions API: Fast, calibrated multimodal
// decisions » et « November 11, 2026 », résumé « Google annonce la sortie de la Decisions API et du modèle Gemini
// Decision ») ; un même numéro de version compte pour un mot (« GPT-6.2 Astra »). Deux numéros de version
// différents séparent deux articles, sauf à la même adresse.
const proches = (a, b) => {
  if (a.sid === b.sid) return false;
  if (cleAdresse(a.u) && cleAdresse(a.u) === cleAdresse(b.u)) return true;
  if (autresVersions(a, b)) return false;
  const A = mots(sujet(a));
  const B = mots(sujet(b));
  let communs = 0;
  for (const m of A) if (B.has(m)) communs++;
  if (communs >= 2 && communs / (A.size + B.size - communs) >= 0.25) return true;
  if (a.ax || b.ax || a.axe === 'hors_theme' || b.axe === 'hors_theme') return false;
  const editeur = editeurDe(a);
  if (!editeur || editeur !== editeurDe(b) || ecartJours(jourPublie(a), jourPublie(b)) > 1) return false;
  const garder = (s) => new Set([...s].filter((m) => m !== editeur && !GENERIQUES.has(m)));
  const TA = garder(A);
  const TB = garder(B);
  const WA = new Set([...TA, ...garder(mots(a.r))]);
  const WB = new Set([...TB, ...garder(mots(b.r))]);
  const partages = new Set([...TA].filter((m) => WB.has(m)).concat([...TB].filter((m) => WA.has(m))));
  const memeVersion = [...versions(sujet(a))].some((v) => versions(sujet(b)).has(v));
  return partages.size + (memeVersion ? 1 : 0) >= 2;
};
const ordre = (x, y) => (y.p - x.p) || ((y.pr ? 1 : 0) - (x.pr ? 1 : 0)) || ((y.v ? 1 : 0) - (x.v ? 1 : 0))
  || String(y.d || '').localeCompare(String(x.d || ''));
// Une prépublication qui présente un modèle suivi : « Zuse: … », « Jev 1.15: … ».
const PRESENTE_UN_SUIVI = new RegExp('^\\W*' + PARLIA.NOMS_SUIVIS.source + '(?:[\\s-]*v?\\d[\\w.]*)?\\s*:', 'i');
// Un modèle suivi, pour la règle 2 : vérifié par le programme (catalogue d'OpenRouter), nommé dans le titre, ou, pour
// un retrait, dans le résumé (« Planned model deprecations on Workers AI » ne dit pas lesquels). Un résumé qui cite
// GPT-6 Luna pour comparer un prix ne fait pas d'un nouveau modèle un modèle suivi (Muse Ember, essai du 16 novembre
// 2026). Le drapeau et le nom viennent d'un même article de l'événement : la Decisions API de Google, couverte aussi
// par le journal de l'API Gemini qui parlait de tarification, n'est pas le prix d'un modèle suivi.
const nommeUnSuivi = (m) => !!m.v || nomsSuivisDans(m.t).size > 0 || (!!(m.f && m.f.retrait_modele) && nomsSuivisDans(m.r).size > 0);
const evenements = [];
for (const a of fenetre.slice().sort((x, y) => ((y.pr ? 1 : 0) - (x.pr ? 1 : 0)) || ordre(x, y))) {
  const ev = evenements.find((e) => e.membres.some((m) => proches(m, a)));
  if (ev) ev.membres.push(a);
  else evenements.push({ membres: [a] });
}
const candidats = evenements.map((e) => {
  const tete = e.membres[0];
  const p = Math.max(...e.membres.map((m) => (m.axe === 'hors_theme' ? 0 : m.p)));
  const f = {};
  for (const m of e.membres) for (const [k, v] of Object.entries(m.f || {})) if (v) f[k] = true;
  const touche = e.membres.find((m) => m.f && (m.f.retrait_modele || m.f.changement_prix) && nommeUnSuivi(m));
  const suivi = touche ? (touche.f.retrait_modele ? 'retrait' : 'prix') : '';
  return {
    id: tete.id, titre: tete.t, url: tete.u, source: tete.s, sid: tete.sid, kind: tete.k || '', axe: tete.axe, p,
    primaire: !!tete.pr, nature: tete.na || 'inconnu', resume: tete.r || '', aChercher: tete.c || '', hypothese: tete.h || '',
    hypotheseEcartee: tete.he || '',
    drapeaux: f, dateEffet: e.membres.map((m) => m.de).find(Boolean) || null, date: tete.d || '',
    vu: jourDe(tete.vu), avantPeriode: !!tete.d && tete.d < jourDebut, dateAvant: tete.da || '',
    arxiv: !!tete.ax, cnil: e.membres.some((m) => m.cn), decision: !!tete.dc, secours: tete.sec || '', verifie: e.membres.some((m) => m.v),
    modeleSuiviArxiv: !!tete.ax && PRESENTE_UN_SUIVI.test(String(tete.t || '').replace(/[\u2010-\u2015]/g, '-')),
    plafonds: tete.pl || '', aRecouper: !tete.pr,
    aussi: e.membres.slice(1).map((m) => ({ s: m.s, u: m.u })).slice(0, 3),
    horsTheme: tete.axe === 'hors_theme', suivi,
  };
});
const parScore = (x, y) => (y.p - x.p) || ((y.primaire ? 1 : 0) - (x.primaire ? 1 : 0))
  || ((y.verifie ? 1 : 0) - (x.verifie ? 1 : 0)) || String(y.date).localeCompare(String(x.date));
const dansLeTheme = candidats.filter((c) => !c.horsTheme).sort(parScore);

// ---- Le choix ----
const choisis = [];
const parAxe = {};
const parSource = {};
let arxiv = 0;
function ajouter(c, raison, force) {
  if (choisis.includes(c) || choisis.length >= MAX) return false;
  if (!force && (parAxe[c.axe] || 0) >= 5) return false;
  if (!force && !c.modeleSuiviArxiv && ((parSource[c.sid] || 0) >= 2 || (c.arxiv && arxiv >= 3))) return false;
  c.raison = raison;
  choisis.push(c);
  parAxe[c.axe] = (parAxe[c.axe] || 0) + 1;
  if (!c.modeleSuiviArxiv) {
    parSource[c.sid] = (parSource[c.sid] || 0) + 1;
    if (c.arxiv) arxiv++;
  }
  return true;
}
// Règle 1 : une fiche à partir de 6 ; plus bas, seulement la ligne à part (cnil, en sortie).
const cnil = candidats.filter((c) => c.cnil).sort(parScore)[0] || null;
if (cnil && !cnil.horsTheme && cnil.p >= 6) ajouter(cnil, 'la CNIL et le CEPD cette semaine', true);
// Règle 2.
for (const c of dansLeTheme) {
  const f = c.drapeaux;
  if (c.suivi) ajouter(c, c.suivi === 'retrait' ? "retrait d'un modèle suivi" : "prix d'un modèle suivi", true);
  else if (f.nouveau_modele_decision && c.primaire) ajouter(c, 'nouveau modèle de décision', true);
  else if (f.echeance_reglementaire && c.dateEffet && c.dateEffet >= aujourdhui && c.dateEffet <= FIN_FORMATION) ajouter(c, 'échéance réglementaire', true);
}
// Règles 3 et 4 : les plafonds par axe, par source et pour arXiv sont vérifiés par ajouter().
for (const c of dansLeTheme.filter((x) => x.p >= 6)) {
  ajouter(c, c.modeleSuiviArxiv ? 'note de 6 ou plus ; une étude qui présente un modèle suivi, hors des plafonds arXiv et par source' : 'note de 6 ou plus', false);
}

const rang = (axe) => PARLIA.AXES.indexOf(axe);
choisis.sort((x, y) => (rang(x.axe) - rang(y.axe)) || parScore(x, y));
choisis.forEach((c, i) => { c.n = i + 1; });
// Par où commencer : les trois mieux notés, d'axes différents si possible.
const parNote = choisis.slice().sort(parScore);
const aLaUne = [];
for (const c of parNote) if (aLaUne.length < 3 && !aLaUne.some((u) => u.axe === c.axe)) aLaUne.push(c);
for (const c of parNote) if (aLaUne.length < 3 && !aLaUne.includes(c)) aLaUne.push(c);
// Le texte de la CNIL ou du CEPD qui n'est pas devenu une fiche a déjà sa ligne à part : pas une seconde fois ici.
const reserve = dansLeTheme.filter((c) => !choisis.includes(c) && c !== cnil && c.p >= 4).slice(0, 10)
  .map((c) => ({ titre: c.titre, url: c.url, source: c.source, axe: c.axe, p: c.p, primaire: c.primaire }));

// ---- Les échéances des 90 jours : les dates connues, celles des articles, celles du catalogue d'OpenRouter ----
// Une échéance dont la source a changé la date garde l'ancienne (avant) ; celle dont la source a changé ou retiré
// le texte sans date lisible est mise à part, à vérifier.
const echeances = [];
const changees = [];
const ajouterEcheance = (e) => {
  if (!e.date || e.date < aujourdhui || e.date > dans90) return;
  if (!echeances.some((x) => x.date === e.date && x.titre === e.titre)) echeances.push(e);
};
ECHEANCES_CONNUES.forEach((e) => ajouterEcheance(Object.assign({ source: 'sources.md, 6.4' }, e)));
(sd.echeances || []).forEach((e) => {
  if (!e.changee) ajouterEcheance({ date: e.date, titre: e.titre, url: e.url, source: e.s, avant: e.avant || '' });
  else if (e.date >= aujourdhui) changees.push({ date: e.date, titre: e.titre, url: e.url, source: e.s, changee: e.changee });
});
const suivis = (sd.openrouter && sd.openrouter.suivi) || {};
for (const [id, m] of Object.entries(suivis)) {
  if (m && m.e) ajouterEcheance({ date: m.e, titre: 'Arrêt annoncé de ' + id + " chez OpenRouter", url: 'https://openrouter.ai/' + id, source: "OpenRouter, catalogue des modèles" });
}
echeances.sort((x, y) => x.date.localeCompare(y.date));

sd._passage = Object.assign(sd._passage || {}, { selection: { candidats: choisis.length, reserve: reserve.length, lus: stats.lus } });
return [{ json: {
  semaine: plan.semaine,
  essai: !!plan.essai,
  depuis,
  jourDebut,
  candidats: choisis.map((c) => Object.assign({}, c, { horsTheme: undefined })),
  aLaUne: aLaUne.map((c) => c.n).sort((x, y) => x - y),
  reserve,
  cnil: cnil ? { n: choisis.includes(cnil) ? cnil.n : null, titre: cnil.titre, url: cnil.url, source: cnil.source, p: cnil.p, horsTheme: cnil.horsTheme } : null,
  echeances: echeances.slice(0, 10),
  echeancesChangees: changees.slice(0, 5),
  stats,
} }];

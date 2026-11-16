// La sélection de la semaine : de 10 à 15 candidats (réglable), d'après les règles de sources.md, section 6.2.
// Elle puise dans le registre les articles triés depuis la dernière préparation (14 jours au plus, 7 la première fois).
// 1. Toujours un texte de la CNIL ou du CEPD : le plus pertinent de la semaine est proposé même s'il est noté bas,
//    et rappelé sur une ligne à part (« la CNIL et le CEPD cette semaine »).
// 2. Toujours les drapeaux vérifiés : retrait ou changement de prix d'un modèle suivi ; nouveau modèle de décision
//    annoncé par une source primaire ; échéance réglementaire avant la fin de janvier 2027 (la soutenance).
// 3. Seuil : les articles notés 6 ou plus, par note décroissante ; moins de 10 : on complète avec les meilleurs 5.
// 4. Équilibre : au moins 2 articles par axe quand l'axe en a de notés 5 ou plus ; au plus 5 par axe.
// 5. Plafonds : au plus 3 prépublications arXiv, au plus 2 articles d'une même source.
// 6. Un événement, une ligne : la source primaire en tête, « couvert aussi par » ensuite ; un article non primaire
//    n'entre que si l'original manque, marqué « à recouper ».
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
const MAX = reglages.candidatsMax || 15;
const MIN = Math.min(reglages.candidatsMin || 10, MAX);
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
const fenetre = (sd.registre || []).filter((a) => (a.vu || 0) > depuis);
const stats = { lus: fenetre.length, horsTheme: 0, secours: 0, parAxe: {}, notes6: 0 };
for (const a of fenetre) {
  if (a.axe === 'hors_theme') stats.horsTheme++;
  else stats.parAxe[a.axe] = (stats.parAxe[a.axe] || 0) + 1;
  if (a.sec) stats.secours++;
  if (a.axe !== 'hors_theme' && a.p >= 6) stats.notes6++;
}

// ---- Un événement, une ligne ----
const VIDES = new Set(['dans', 'avec', 'pour', 'from', 'with', 'that', 'this', 'your', 'about', 'their', 'sont', 'nouveau',
  'nouvelle', 'nouveaux', 'notes', 'version', 'release', 'model', 'models', 'modèle', 'modèles', 'what', 'have', 'will']);
const mots = (t) => new Set(String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .split(/[^a-z0-9.]+/).filter((m) => m.length >= 4 && !VIDES.has(m)));
// Deux articles de deux sources différentes parlent du même événement s'ils ont la même adresse, ou deux mots
// longs en commun pour un quart de leurs mots : « OpenAI launches the Decisions API for classification » et
// « Build more responsive apps with the Decisions API for classification ».
const proches = (a, b) => {
  if (a.sid === b.sid) return false;
  if (cleAdresse(a.u) && cleAdresse(a.u) === cleAdresse(b.u)) return true;
  const A = mots(a.t);
  const B = mots(b.t);
  let communs = 0;
  for (const m of A) if (B.has(m)) communs++;
  return communs >= 2 && communs / (A.size + B.size - communs) >= 0.25;
};
const ordre = (x, y) => (y.p - x.p) || ((y.pr ? 1 : 0) - (x.pr ? 1 : 0)) || ((y.v ? 1 : 0) - (x.v ? 1 : 0))
  || String(y.d || '').localeCompare(String(x.d || ''));
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
  const suivi = e.membres.some((m) => m.v || PARLIA.NOMS_SUIVIS.test(m.t + ' ' + (m.r || '')));
  return {
    id: tete.id, titre: tete.t, url: tete.u, source: tete.s, sid: tete.sid, axe: tete.axe, p,
    primaire: !!tete.pr, nature: tete.na || 'inconnu', resume: tete.r || '', aChercher: tete.c || '', hypothese: tete.h || '',
    drapeaux: f, dateEffet: e.membres.map((m) => m.de).find(Boolean) || null, date: tete.d || '',
    vu: jourDe(tete.vu), avantPeriode: !!tete.d && tete.d < jourDebut, dateAvant: tete.da || '',
    arxiv: !!tete.ax, cnil: e.membres.some((m) => m.cn), decision: !!tete.dc, secours: tete.sec || '', verifie: e.membres.some((m) => m.v),
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
  if (!force && ((parAxe[c.axe] || 0) >= 5 || (parSource[c.sid] || 0) >= 2 || (c.arxiv && arxiv >= 3))) return false;
  c.raison = raison;
  choisis.push(c);
  parAxe[c.axe] = (parAxe[c.axe] || 0) + 1;
  parSource[c.sid] = (parSource[c.sid] || 0) + 1;
  if (c.arxiv) arxiv++;
  return true;
}
// Règle 1.
const cnil = candidats.filter((c) => c.cnil).sort(parScore)[0] || null;
if (cnil && !cnil.horsTheme) ajouter(cnil, 'la CNIL et le CEPD cette semaine', true);
// Règle 2.
for (const c of dansLeTheme) {
  const f = c.drapeaux;
  if ((f.retrait_modele || f.changement_prix) && c.suivi) ajouter(c, f.retrait_modele ? "retrait d'un modèle suivi" : "prix d'un modèle suivi", true);
  else if (f.nouveau_modele_decision && c.primaire) ajouter(c, 'nouveau modèle de décision', true);
  else if (f.echeance_reglementaire && c.dateEffet && c.dateEffet >= aujourdhui && c.dateEffet <= FIN_FORMATION) ajouter(c, 'échéance réglementaire', true);
}
// Règle 4 : au moins 2 par axe.
for (const axe of PARLIA.AXES) {
  for (const c of dansLeTheme.filter((x) => x.axe === axe && x.p >= 5)) {
    if ((parAxe[axe] || 0) >= 2) break;
    ajouter(c, "équilibre des axes", false);
  }
}
// Règle 3.
for (const c of dansLeTheme.filter((x) => x.p >= 6)) ajouter(c, 'note de 6 ou plus', false);
for (const c of dansLeTheme.filter((x) => x.p === 5)) {
  if (choisis.length >= MIN) break;
  ajouter(c, 'complément : note de 5', false);
}

const rang = (axe) => PARLIA.AXES.indexOf(axe);
choisis.sort((x, y) => (rang(x.axe) - rang(y.axe)) || parScore(x, y));
choisis.forEach((c, i) => { c.n = i + 1; });
// Par où commencer : les trois mieux notés, d'axes différents si possible.
const parNote = choisis.slice().sort(parScore);
const aLaUne = [];
for (const c of parNote) if (aLaUne.length < 3 && !aLaUne.some((u) => u.axe === c.axe)) aLaUne.push(c);
for (const c of parNote) if (aLaUne.length < 3 && !aLaUne.includes(c)) aLaUne.push(c);
const reserve = dansLeTheme.filter((c) => !choisis.includes(c) && c.p >= 4).slice(0, 10)
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

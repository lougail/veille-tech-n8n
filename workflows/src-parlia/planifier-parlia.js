// Que faire à ce passage ? n8n passe toutes les 30 minutes, de 7 h 15 à 22 h 45, quand le Mac est allumé.
// Rien n'a d'heure fixe : chaque tâche part au premier passage après son heure, et une seule fois.
// - La collecte : au plus toutes les 4 heures (réglable), et juste avant une préparation.
// - Les pages sans flux : une fois par jour, avec la première collecte du jour.
// - La préparation de la semaine : au premier passage à partir du lundi 6 h (réglable), une fois par
//   semaine ; Mac éteint le lundi, elle part au premier réveil suivant, jusqu'au dimanche.
// - Le rappel doux : au premier passage à partir du jeudi 16 h 30 (réglable), si la préparation de la
//   semaine est partie avant cette heure ; jusqu'au dimanche (ergonomie.md, F1 et F2).
// Les réglages viennent du nœud Réglages (variables d'environnement, avec des valeurs par défaut).
// En mode essai (build_parlia.py --test), tout est dû. Rien n'est enregistré ici, sauf sd._passage,
// le carnet du passage en cours, que lit le message de #status.
const sd = $getWorkflowStaticData('global');
const r = $input.first().json || {};
const entier = (v, defaut, min, max) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= min && n <= max ? n : defaut;
};
const heureMinute = (v, defaut) => {
  const m = /^(\d{1,2})\s*(?:[:h]\s*(\d{2})?)?$/i.exec(String(v == null ? '' : v).trim());
  if (!m) return defaut;
  const h = Number(m[1]);
  const mn = Number(m[2] || 0);
  return h <= 23 && mn <= 59 ? { h, mn } : defaut;
};
const reglages = {
  prepJour: entier(r.prepJour, 1, 1, 7),
  prepHeure: heureMinute(r.prepHeure, { h: 6, mn: 0 }),
  rappelJour: entier(r.rappelJour, 4, 1, 7),
  rappelHeure: heureMinute(r.rappelHeure, { h: 16, mn: 30 }),
  collecteHeures: entier(r.collecteHeures, 4, 1, 24),
  candidatsMin: entier(r.candidatsMin, 10, 1, 30),
  candidatsMax: entier(r.candidatsMax, 15, 1, 30),
  forum: String(r.forum) === '1',
  discord: String(r.discord) === '1',
  statut: String(r.statut) === '1',
  mention: /^\d{5,25}$/.test(String(r.mention || '')) ? String(r.mention) : '',
  essai: String(r.essai) === '1',
};
if (reglages.candidatsMin > reglages.candidatsMax) reglages.candidatsMin = reglages.candidatsMax;

const lundi = $now.startOf('week');
const semaine = {
  cle: $now.toFormat("kkkk-'S'WW"),
  numero: $now.weekNumber,
  lundi: lundi.toISODate(),
  dimanche: lundi.plus({ days: 6 }).toISODate(),
};
const moment = (jour, hm) => lundi.plus({ days: jour - 1 }).set({ hour: hm.h, minute: hm.mn, second: 0, millisecond: 0 });
const maintenant = $now.toMillis();
const prep = sd.prep || {};

const seuilPrep = moment(reglages.prepJour, reglages.prepHeure);
const preparation = reglages.essai || ($now >= seuilPrep && prep.semaine !== semaine.cle);
const seuilRappel = moment(reglages.rappelJour, reglages.rappelHeure);
const rappel = reglages.essai || ($now >= seuilRappel && prep.semaine === semaine.cle && !prep.rappel
  && (Number(prep.at) || 0) < seuilRappel.toMillis());

const derniere = Number(sd.lastCollectAt) || 0;
const marge = 10 * 60 * 1000; // le pas de 30 minutes
const collecte = reglages.essai
  || maintenant - derniere >= reglages.collecteHeures * 3600 * 1000 - marge
  || (preparation && maintenant - derniere > 30 * 60 * 1000);
const pages = collecte && (reglages.essai || sd.pagesJour !== $now.toISODate());

if (!collecte && !preparation && !rappel) return [];
sd._passage = {
  debut: maintenant,
  collecte, pages, preparation, rappel,
  essai: reglages.essai,
  sommeilH: derniere ? Math.round((maintenant - derniere) / 360000) / 10 : null,
};
return [{ json: { collecte, pages, jorf: collecte, preparation, rappel, essai: reglages.essai, semaine, reglages } }];

// Normalisation : un format commun pour tous les articles, la fenêtre de collecte, les filtres par mots, le
// domaine officiel, le dédoublonnage, la santé de chaque source, et le détecteur de secours du remaniement.
// - La fenêtre part de la dernière collecte réussie : 48 heures au moins, 14 jours au plus, 7 jours la première
//   fois. staticData n'est enregistré qu'après une exécution réussie : si l'exécution échoue, la suivante repart
//   de l'ancienne date et ne perd rien. Les pages sans flux et les API ne signalent que du neuf : pas de fenêtre.
// - Un article déjà vu (même adresse, ou même bloc de page) est écarté pendant 45 jours.
//   Sauf un article dont l'échéance est relevée (sd.echeances) quand sa source en change le texte : il est trié de
//   nouveau, même ancien, pour reprendre sa date. Cloudflare a repoussé du 15 au 20 novembre 2026, dans le même
//   billet, l'arrêt de la fiche 3 de la semaine 46 ; la préparation gardait le 15. La clé et l'empreinte du texte
//   sont gardées avec l'échéance (registre-parlia.js). Une échéance relevée avant le 15 novembre 2026 n'en a pas :
//   reconnue par l'adresse de son article, elle le fait trier une fois de plus, avec la consigne du 15 novembre.
// - Sans date de publication, l'article n'en reçoit pas : « date inconnue ». Le jour où le bot l'a vu est gardé à
//   part (vu). Le 9 novembre 2026, le billet de TypeSafe du 3 novembre portait le 5, jour de la collecte, et entrait
//   dans une période qui commençait le 4.
// - L'extrait : 1 200 caractères au plus (600 jusqu'au 15 novembre 2026, ce qui coupait les résumés d'arXiv au
//   milieu : fiche 9 de la semaine 46).
// - Un domaine officiel est celui d'un éditeur ou d'une institution suivis (sources.md, 5.3) : le tri le reçoit,
//   pour plafonner une « annonce » publiée ailleurs.
// - Les communiqués de l'Élysée ne sont jamais triés : un titre sur la nomination ou la composition du
//   Gouvernement devient une alerte (sources.md, 6.3, le secours du Journal officiel).
// - Un billet de retraits de Cloudflare (PARLIA.RETRAITS_TEXTE) dont le titre ne nomme que des modèles d'image, de
//   son, de vidéo ou de plongements n'est pas trié : il ne donnerait ni fiche ni échéance dans le thème.
// Sortie : un élément par article à trier, ou { _rien: true } pour que la suite de la branche s'exécute.
const sd = $getWorkflowStaticData('global');
const maintenant = $now.toMillis();
const H = 3600 * 1000;
const J = 24 * H;
const derniere = Number(sd.lastCollectAt) || 0;
const fenetre = derniere ? Math.min(14 * J, Math.max(2 * J, maintenant - derniere + 2 * H)) : 7 * J;
const depuis = maintenant - fenetre;
if (!sd.vus) sd.vus = {};
for (const [cle, t] of Object.entries(sd.vus)) if (maintenant - t > 45 * J) delete sd.vus[cle];
const echeances = sd.echeances || [];
const echeanceDe = (cle) => echeances.find((e) => (e.id ? e.cle === cle && !!e.empreinte : cleAdresse(e.url) === cle));

const OFFICIELS = [
  'openai.com', 'anthropic.com', 'claude.com', 'mistral.ai', 'ai.google.dev', 'blog.google', 'googleblog.com',
  'typesafe.ai', 'liquid.ai', 'cloudflare.com', 'huggingface.co', 'openrouter.ai', 'arxiv.org', 'simonwillison.net',
  'hamel.dev', 'cnil.fr', 'europa.eu', 'senat.fr', 'assemblee-nationale.fr', 'legifrance.gouv.fr', 'gouv.fr',
  'elysee.fr',
];
const officiel = (url) => {
  const d = domaineDe(url);
  return OFFICIELS.some((o) => d === o || d.endsWith('.' + o));
};
const dateDe = (j) => {
  for (const v of [j.isoDate, j.pubDate, j.published, j.updated, j.date]) {
    if (!v) continue;
    const t = new Date(v).getTime();
    if (Number.isFinite(t) && t > 0) return t;
  }
  return 0;
};
// Un titre réduit à une date (le journal d'OpenRouter, les notes de version d'Anthropic) est préfixé par la source.
const MOIS = /\b(january|february|march|april|may|june|july|august|september|october|november|december|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\b/gi;
const titreUtile = (t) => /[a-zà-ÿ]{4}/i.test(t.replace(MOIS, ''));

const stats = { lus: 0, nouveaux: 0, horsFenetre: 0, dejaVus: 0, ecartes: 0, majEcheances: 0, parSource: {} };
const sante = {};
const articles = [];
for (const item of $input.all()) {
  const j = item.json || {};
  if (j._sante) {
    const s = j._sante;
    if (s.id) sante[s.id] = { s: s.s, ok: !!s.ok, detail: s.detail || '', k: 'autre' };
    continue;
  }
  const src = j._source;
  if (!src || !src.id) continue;
  if (!sante[src.id]) sante[src.id] = { s: src.s, ok: true, detail: '', k: src.kind || 'flux' };
  if (j.erreur) {
    sante[src.id] = { s: src.s, ok: false, detail: j.erreur, k: src.kind || 'flux' };
    continue;
  }
  if (j._vide) continue;
  let titre = texteSimple(j.title);
  let url = String(j.link || j.url || '').trim();
  if (src.reecrire && src.reecrire.length === 2) url = url.split(src.reecrire[0]).join(src.reecrire[1]);
  if (!titre || !/^https?:\/\//i.test(url)) continue;
  stats.lus++;
  stats.parSource[src.id] = (stats.parSource[src.id] || 0) + 1;
  if (!titreUtile(titre)) titre = src.s + ' — ' + titre;
  const extrait = tronquer(texteSimple(j.contentSnippet || j.summary || j.content || j.description || ''), 1200);
  const pub = dateDe(j);
  const parFlux = src.kind !== 'page' && src.kind !== 'api';
  const cle = j._cle || cleAdresse(url) || hacher(titre);
  const empreinte = hacher(extrait);
  const echeance = sd.vus[cle] ? echeanceDe(cle) : null;
  const maj = !!echeance && echeance.empreinte !== empreinte;
  if (parFlux && pub && pub < depuis && !maj) { stats.horsFenetre++; continue; }

  if (src.role === 'detecteur') {
    if (/nomination du gouvernement|composition du gouvernement|nomination du premier ministre/i.test(titre)) {
      pousserAlerte(sd, {
        type: 'remaniement', origine: src.s, titre: tronquer(titre, 200), url,
        date: pub ? new Date(pub).toISOString().slice(0, 10) : $now.toISODate(),
      });
    }
    continue;
  }
  if (src.filtre && !new RegExp(src.filtre, 'i').test(titre + ' ' + extrait)) { stats.ecartes++; continue; }
  if (deRetraitsTexte(src.id, titre, src.s) && ligneHorsTexte(titre)) { stats.ecartes++; continue; }
  if (sd.vus[cle] && !maj) { stats.dejaVus++; continue; }
  sd.vus[cle] = maintenant;
  stats.nouveaux++;
  if (maj) stats.majEcheances++;
  articles.push({
    id: hacher(cle),
    cle,
    empreinte,
    titre: tronquer(titre, 220),
    url,
    date: pub ? new Date(pub).toISOString() : '',
    vu: $now.toUTC().toISO(),
    extrait,
    officiel: officiel(url),
    source: {
      id: src.id, s: src.s, axe: src.axe, nature: src.nature, primaire: !!src.primaire,
      cnil: !!src.cnil, decision: !!src.decision, arxiv: !!src.arxiv, kind: src.kind || 'flux',
    },
    verifie: j._verifie || null,
    lignes: Array.isArray(j._lignes) ? j._lignes : [],
    maj: maj ? { date: echeance.date } : null,
  });
}

for (const [id, s] of Object.entries(sante)) noterSante(sd, id, s.s, s.ok, s.detail, maintenant);
// Le carnet de la semaine, pour le paragraphe « Sources interrogées » de la préparation.
const carnet = sd.semaine || { depuis: maintenant, collectes: 0, parSource: {} };
carnet.collectes++;
for (const [id, s] of Object.entries(sante)) {
  const e = carnet.parSource[id] || { s: s.s, lus: 0, echecs: 0, k: s.k };
  e.s = s.s;
  e.k = s.k;
  e.lus += stats.parSource[id] || 0;
  if (!s.ok) e.echecs++;
  carnet.parSource[id] = e;
}
sd.semaine = carnet;
sd.lastCollectAt = maintenant;
sd._passage = Object.assign(sd._passage || {}, { collecteStats: stats, fenetreH: Math.round(fenetre / H) });
if (!articles.length) return [{ json: { _rien: true } }];
return articles.map((a) => ({ json: a }));

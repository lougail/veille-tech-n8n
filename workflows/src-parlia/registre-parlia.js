// Le registre des articles triés : la mémoire dans laquelle la préparation du lundi choisit ses candidats.
// Chaque article y reste 16 jours (la sélection remonte au plus 14 jours), sous une forme courte ; 400 au plus.
// Les articles « hors thème » y sont comptés mais jamais proposés (critère C6.5) : ils n'y gardent pas leurs
// textes longs. La mémoire d'un workflow n8n doit rester petite.
// Une hypothèse écartée par le contrôle du tri (lire-tri-parlia.js) y garde son motif (he), pour la fiche.
// Alerte immédiate (sources.md, 6.2, règle 9) : le retrait d'un modèle suivi, annoncé à moins de 90 jours,
// qu'il soit calculé par le programme (catalogue d'OpenRouter) ou repéré par le tri dans un texte qui nomme
// un modèle suivi.
// Les échéances (retraits, dates d'application d'un texte) sont gardées à part jusqu'à leur date : la
// préparation rappelle celles des 90 jours suivants, même quand l'article est sorti du registre.
// Chaque échéance garde la clé et l'empreinte du texte de son article : si la source change ce texte, l'article
// est trié de nouveau (normaliser-parlia.js, a.maj) ; une autre date remplace l'ancienne, gardée pour l'afficher
// (« c'était le 15 novembre »), et l'article revient dans la préparation suivante ; la même date ne change rien.
// Une échéance relevée sur une page sans flux garde aussi les empreintes de ses lignes : quand elles disparaissent
// de la page, la source l'a changée ou retirée (collecte-pages-api.js). Elle reste en mémoire 14 jours après sa
// date, pour qu'un report annoncé au dernier moment se voie encore.
// Les échéances relevées avant le 15 novembre 2026 n'ont pas d'identifiant : elles venaient de l'ancien tri, qui
// prenait des remplaçants pour des modèles arrêtés (fiche 4 de la semaine 46). Celle d'un article de flux le fait
// trier une fois de plus (normaliser-parlia.js) et prend son identifiant ; les autres sont oubliées au premier
// passage. Les dates connues de sources.md, 6.4, ne sont pas en mémoire : la sélection les ajoute.
const sd = $getWorkflowStaticData('global');
const maintenant = $now.toMillis();
const J = 24 * 3600 * 1000;
const aujourdhui = $now.toISODate();
const dans90 = $now.plus({ days: 90 }).toISODate();
const oubli = $now.minus({ days: 14 }).toISODate();
const registre = (sd.registre || []).filter((a) => maintenant - (a.vu || 0) < 16 * J);
const echeances = (sd.echeances || []).filter((e) => e.date >= oubli);
const parAxe = {};
let secours = 0;
let horsTheme = 0;
let nouveaux = 0;
let majEcheances = 0;
let hypothesesEcartees = 0;
for (const item of $input.all()) {
  const a = item.json || {};
  if (!a.id || !a.tri) continue;
  const t = a.tri;
  const datee = t.drapeaux && (t.drapeaux.retrait_modele || t.drapeaux.echeance_reglementaire);
  const dateEffet = datee && t.axe !== 'hors_theme' && t.date_effet ? t.date_effet : '';
  // Un article trié de nouveau parce que sa source a changé son texte.
  const echeance = a.maj ? echeances.find((e) => (e.id ? e.cle === a.cle : cleAdresse(e.url) === cleAdresse(a.url))) : null;
  if (a.maj) {
    majEcheances++;
    if (echeance) {
      Object.assign(echeance, { cle: a.cle, id: a.id, empreinte: a.empreinte });
      if (!dateEffet) echeance.changee = aujourdhui;
      else if (dateEffet !== echeance.date) Object.assign(echeance, { avant: echeance.date, date: dateEffet, changee: '' });
    }
    if (!dateEffet || dateEffet === a.maj.date) continue;
  }
  nouveaux++;
  if (t.secours) secours++;
  if (t.axe === 'hors_theme') horsTheme++;
  else if (t.hypothese_ecartee) hypothesesEcartees++;
  parAxe[t.axe] = (parAxe[t.axe] || 0) + 1;
  const sansTextes = t.axe === 'hors_theme';
  const ancien = registre.findIndex((x) => x.id === a.id);
  if (ancien >= 0) registre.splice(ancien, 1);
  const entree = {
    id: a.id, t: a.titre, u: a.url, s: a.source.s, sid: a.source.id, axe: t.axe, p: t.pertinence,
    pr: !!t.source_primaire, na: t.nature, r: sansTextes ? '' : t.resume, c: sansTextes ? '' : t.a_chercher,
    h: sansTextes ? '' : t.hypothese, f: t.drapeaux, de: t.date_effet, d: String(a.date || '').slice(0, 10), vu: maintenant,
    ax: !!a.source.arxiv, cn: !!a.source.cnil, dc: !!a.source.decision, sec: t.secours || '',
    v: a.verifie ? 1 : 0, pl: (t.plafonds || []).join(', '), da: a.maj ? a.maj.date : '', k: a.source.kind || '',
  };
  if (!sansTextes && t.hypothese_ecartee) entree.he = t.hypothese_ecartee;
  registre.push(entree);
  const retrait = t.drapeaux && t.drapeaux.retrait_modele && t.date_effet && t.date_effet >= aujourdhui && t.date_effet <= dans90;
  // gpt-4o-mini-tts, un modèle de voix, n'est pas gpt-4o-mini (nomsSuivisDans, outils.js).
  const suivi = a.verifie || nomsSuivisDans(a.titre + ' ' + (a.extrait || '')).size > 0;
  if (retrait && suivi) {
    pousserAlerte(sd, { type: 'retrait', id: a.id, titre: a.titre, url: a.url, origine: a.source.s, date: t.date_effet, cle: hacher('retrait|' + a.id + '|' + t.date_effet) });
  }
  const titre = tronquer(a.titre, 160);
  if (!echeance && dateEffet && dateEffet >= aujourdhui
    && !echeances.some((e) => (e.id && e.id === a.id) || (e.date === dateEffet && e.url === a.url && e.titre === titre))) {
    echeances.push({
      date: dateEffet, titre, url: a.url, s: a.source.s, id: a.id, cle: a.cle || '', empreinte: a.empreinte || '',
      page: a.source.kind === 'page' ? a.source.id : '', lignes: (a.lignes || []).slice(0, 20),
    });
  }
}
sd.registre = registre.slice(-400);
sd.echeances = echeances.filter((e) => e.id).sort((x, y) => x.date.localeCompare(y.date)).slice(0, 40);
sd._passage = Object.assign(sd._passage || {}, { tri: { nouveaux, secours, horsTheme, parAxe, majEcheances, hypothesesEcartees } });
return [{ json: { registre: sd.registre.length, nouveaux } }];

// Le registre des articles triés : la mémoire dans laquelle la préparation du lundi choisit ses candidats.
// Chaque article y reste 16 jours (la sélection remonte au plus 14 jours), sous une forme courte ; 400 au plus.
// Les articles « hors thème » y sont comptés mais jamais proposés (critère C6.5) : ils n'y gardent pas leurs
// textes longs. La mémoire d'un workflow n8n doit rester petite.
// Alerte immédiate (sources.md, 6.2, règle 9) : le retrait d'un modèle suivi, annoncé à moins de 90 jours,
// qu'il soit calculé par le programme (catalogue d'OpenRouter) ou repéré par le tri dans un texte qui nomme
// un modèle suivi.
// Les échéances (retraits, dates d'application d'un texte) sont gardées à part jusqu'à leur date : la
// préparation rappelle celles des 90 jours suivants, même quand l'article est sorti du registre.
const sd = $getWorkflowStaticData('global');
const maintenant = $now.toMillis();
const J = 24 * 3600 * 1000;
const aujourdhui = $now.toISODate();
const dans90 = $now.plus({ days: 90 }).toISODate();
const registre = (sd.registre || []).filter((a) => maintenant - (a.vu || 0) < 16 * J);
const echeances = (sd.echeances || []).filter((e) => e.date >= aujourdhui);
const parAxe = {};
let secours = 0;
let horsTheme = 0;
let nouveaux = 0;
for (const item of $input.all()) {
  const a = item.json || {};
  if (!a.id || !a.tri) continue;
  const t = a.tri;
  nouveaux++;
  if (t.secours) secours++;
  if (t.axe === 'hors_theme') horsTheme++;
  parAxe[t.axe] = (parAxe[t.axe] || 0) + 1;
  const sansTextes = t.axe === 'hors_theme';
  registre.push({
    id: a.id, t: a.titre, u: a.url, s: a.source.s, sid: a.source.id, axe: t.axe, p: t.pertinence,
    pr: !!t.source_primaire, na: t.nature, r: sansTextes ? '' : t.resume, c: sansTextes ? '' : t.a_chercher,
    h: sansTextes ? '' : t.hypothese, f: t.drapeaux, de: t.date_effet, d: String(a.date || '').slice(0, 10), vu: maintenant,
    ax: !!a.source.arxiv, cn: !!a.source.cnil, dc: !!a.source.decision, sec: t.secours || '',
    v: a.verifie ? 1 : 0, pl: (t.plafonds || []).join(', '),
  });
  const retrait = t.drapeaux && t.drapeaux.retrait_modele && t.date_effet && t.date_effet >= aujourdhui && t.date_effet <= dans90;
  const suivi = a.verifie || PARLIA.NOMS_SUIVIS.test(a.titre + ' ' + (a.extrait || ''));
  if (retrait && suivi) {
    pousserAlerte(sd, { type: 'retrait', id: a.id, titre: a.titre, url: a.url, origine: a.source.s, date: t.date_effet });
  }
  const datee = t.drapeaux && (t.drapeaux.retrait_modele || t.drapeaux.echeance_reglementaire);
  if (datee && t.axe !== 'hors_theme' && t.date_effet && t.date_effet >= aujourdhui
    && !echeances.some((e) => e.date === t.date_effet && e.url === a.url)) {
    echeances.push({ date: t.date_effet, titre: tronquer(a.titre, 160), url: a.url, s: a.source.s });
  }
}
sd.registre = registre.slice(-400);
sd.echeances = echeances.sort((x, y) => x.date.localeCompare(y.date)).slice(0, 40);
sd._passage = Object.assign(sd._passage || {}, { tri: { nouveaux, secours, horsTheme, parAxe } });
return [{ json: { registre: sd.registre.length, nouveaux } }];

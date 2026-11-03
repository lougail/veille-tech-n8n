// Les notes de séance, relues sans pouvoir les modifier : le dossier des notes est monté en lecture seule dans le
// conteneur, et le nœud « Lire les notes » prend les fichiers AAAA-MM-JJ-seance-NN.md (docs/veille-parlia.md).
// Le bot en tire trois choses, pour la préparation et le rappel :
// - les séances tenues. Une séance compte comme tenue quand la ligne « Date » de son tableau « Séance » porte une
//   date AAAA-MM-JJ déjà passée, sans repère « [À REMPLIR …] », « [À COMPLÉTER …] » ni « [EN COURS …] » : une note
//   préparée à l'avance ne compte pas. Elle appartient à la semaine de sa première date : la séance tenue les
//   29 octobre et 2 novembre 2026 est celle de la semaine du 26 octobre ;
// - dans la dernière séance tenue, les points classés « à surveiller » (tableau « Ce que ça change… »), avec le
//   titre du point retenu correspondant : la préparation les rappelle en tête, hors quota (sources.md, 6.2,
//   règle 7). Pour garder un point au-delà, la séance suivante le reclasse « à surveiller » ;
// - la « Prochaine piste » de cette séance.
// Aucune note lisible (dossier non monté, vide, ou fichier illisible) : { lisibles: false }, et le rappel part
// avec « si c'est fait, ignore ce message ». Le résultat va dans le carnet du passage (sd._passage.notes).
const sd = $getWorkflowStaticData('global');
const plan = $('Que faire ?').first().json;
const aujourdhui = $now.toISODate();
const lundi = (plan.semaine && plan.semaine.lundi) || $now.startOf('week').toISODate();
const lundiPrecedent = $now.startOf('week').minus({ weeks: 1 }).toISODate();

const simple = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const A_REMPLIR = /\[\s*(a remplir|a completer|en cours)/;
const cellules = (ligne) => ligne.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim());
const estSeparateur = (ligne) => /^\|?[\s:|-]+\|?$/.test(ligne.trim()) && ligne.includes('-');

// Les sections de niveau 2 (« ## … ») : { titre simplifié, lignes }.
function sections(texte) {
  const res = [];
  let courant = { titre: '', lignes: [] };
  for (const l of String(texte).replace(/\r\n?/g, '\n').split('\n')) {
    const m = /^##\s+(.+?)\s*$/.exec(l);
    if (m) {
      res.push(courant);
      courant = { titre: simple(m[1]), lignes: [] };
    } else {
      courant.lignes.push(l);
    }
  }
  res.push(courant);
  return res;
}
const section = (liste, debut) => liste.find((s) => s.titre.startsWith(debut)) || { titre: '', lignes: [] };
const lignesDuTableau = (s) => s.lignes.filter((l) => l.trim().startsWith('|') && !estSeparateur(l)).map(cellules);

function lireNote(texte, fichier) {
  const parties = sections(texte);
  const seance = lignesDuTableau(section(parties, 'seance'));
  const champ = (nom) => (seance.find((c) => simple(c[0]).startsWith(nom)) || [])[1] || '';
  const date = champ('date');
  const aRemplir = A_REMPLIR.test(simple(date));
  const dates = [...new Set((date.match(/\b20\d{2}-\d{2}-\d{2}\b/g) || [])
    .filter((d) => Number(d.slice(5, 7)) >= 1 && Number(d.slice(5, 7)) <= 12 && Number(d.slice(8, 10)) >= 1
      && Number(d.slice(8, 10)) <= 31 && d <= aujourdhui))].sort();
  const mChamp = /\d+/.exec(champ('seance n'));
  const mFichier = /seance-(\d+)/.exec(simple(fichier));
  const numeroTexte = mChamp ? mChamp[0] : (mFichier ? mFichier[1] : '');
  // Les points retenus : « 1. **Titre** (candidat 2). Texte… » ; le titre en gras, sinon la première phrase.
  const retenus = {};
  for (const l of section(parties, 'points retenus').lignes) {
    const m = /^\s*(\d+)[.)]\s+(.+)$/.exec(l);
    if (!m) continue;
    const gras = /\*\*(.+?)\*\*/.exec(m[2]);
    retenus[m[1]] = tronquer(texteSimple(gras ? gras[1] : m[2].split(/(?<=\.)\s/)[0]).replace(/\*/g, ''), 160);
  }
  const aSurveiller = [];
  for (const c of lignesDuTableau(section(parties, 'ce que ca change'))) {
    if (c.length < 2 || simple(c[0]) === 'point') continue;
    const classement = c[c.length - 1];
    if (!simple(classement).startsWith('a surveiller')) continue;
    const point = c[0].replace(/\*/g, '').trim();
    aSurveiller.push({
      point,
      titre: retenus[point] || tronquer(texteSimple(c.length > 2 ? c[1] : ''), 160),
      classement: tronquer(texteSimple(classement), 220),
    });
  }
  const pisteTexte = texteSimple(section(parties, 'prochaine piste').lignes.join(' '));
  return {
    fichier: String(fichier || ''),
    numero: numeroTexte ? String(Number(numeroTexte)).padStart(2, '0') : '',
    tenue: !aRemplir && dates.length > 0,
    debut: dates[0] || '',
    fin: dates[dates.length - 1] || '',
    aSurveiller: aSurveiller.slice(0, 8),
    piste: A_REMPLIR.test(simple(pisteTexte)) ? '' : tronquer(pisteTexte, 500),
  };
}

const notes = [];
const erreurs = [];
// L'erreur d'origine vient du nœud de lecture : « Texte des notes » ne voit qu'un élément sans fichier.
try {
  for (const i of $('Lire les notes').all()) {
    const e = i.json && i.json.error;
    if (e) erreurs.push(String(typeof e === 'string' ? e : e.message || JSON.stringify(e)).slice(0, 160));
  }
} catch (e) {
  // nœud non exécuté : rien à ajouter
}
for (const item of $input.all()) {
  const j = item.json || {};
  if (j.error) {
    erreurs.push(String(typeof j.error === 'string' ? j.error : j.error.message || JSON.stringify(j.error)).slice(0, 160));
    continue;
  }
  if (typeof j.texte !== 'string') continue;
  const fichier = String(j.fileName || '').split('/').pop();
  notes.push(lireNote(j.texte, fichier));
}
const ordre = (a, b) => a.debut.localeCompare(b.debut) || a.fin.localeCompare(b.fin) || a.numero.localeCompare(b.numero)
  || a.fichier.localeCompare(b.fichier);
const tenues = notes.filter((n) => n.tenue).sort(ordre);
const resume = (n) => (n ? { numero: n.numero, debut: n.debut, fin: n.fin, fichier: n.fichier } : null);
const derniere = tenues.length ? tenues[tenues.length - 1] : null;
const cetteSemaine = tenues.filter((n) => n.debut >= lundi);
const semainePrecedente = tenues.filter((n) => n.debut >= lundiPrecedent && n.debut < lundi);
const bilan = {
  lisibles: notes.length > 0,
  motif: notes.length ? '' : (!erreurs.length || /no file/i.test(erreurs[0])
    ? 'aucune note trouvée : dossier des notes non monté, ou vide' : erreurs[0]),
  lues: notes.length,
  tenues: tenues.length,
  seanceSemaine: resume(cetteSemaine[cetteSemaine.length - 1]),
  seancePrecedente: resume(semainePrecedente[semainePrecedente.length - 1]),
  derniere: derniere ? Object.assign(resume(derniere), { aSurveiller: derniere.aSurveiller, piste: derniere.piste }) : null,
};
sd._passage = Object.assign(sd._passage || {}, { notes: bilan });
return [{ json: { lues: bilan.lues, tenues: bilan.tenues, lisibles: bilan.lisibles } }];

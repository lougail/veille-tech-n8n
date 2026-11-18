// Les notes de séance, relues sans pouvoir les modifier : le dossier des notes est monté en lecture seule dans le
// conteneur, et le nœud « Lire les notes » prend les fichiers AAAA-MM-JJ-seance-NN.md (docs/veille-parlia.md).
// Le bot en tire cinq choses, pour la préparation et le rappel :
// - les séances tenues. Une séance compte comme tenue quand la ligne « Date » de son tableau « Séance » porte une
//   date AAAA-MM-JJ déjà passée, sans repère « [À REMPLIR …] », « [À COMPLÉTER …] » ni « [EN COURS …] » : une note
//   préparée à l'avance ne compte pas. Elle appartient à la semaine de sa première date : la séance tenue les
//   29 octobre et 2 novembre 2026 est celle de la semaine du 26 octobre ;
// - dans la dernière séance tenue, les points classés « à surveiller » (tableau « Ce que ça change… »), avec le
//   titre du point retenu correspondant : la préparation les rappelle en tête, hors quota (sources.md, 6.2,
//   règle 7). Pour garder un point au-delà, la séance suivante le reclasse « à surveiller » ;
// - la « Prochaine piste » de cette séance.
// - les sources sur quatre semaines (sources.md, 6.2, règle 10) : pour chaque séance tenue depuis quatre semaines sur
//   une préparation du bot, les fiches de cette préparation, avec leur source, et celles que citent ses points
//   retenus (« (fiche 7) », « (candidat 2) »). La préparation est celle dont la note donne le lien
//   (« preparations/2026-11-09-preparation.md »), relue dans le dossier où le bot l'a écrite (nœuds « Lire les
//   préparations » et « Texte des préparations ») ; sans lien, la dernière préparation du bot des sept jours d'avant
//   la séance. Une séance préparée à la main (« à la main », ligne « Outil ») n'est pas comptée : ses candidats ne
//   viennent pas des sources du bot. Le bot ne retire aucune source : la préparation montre les chiffres, Louis décide.
// - la matière de la synthèse du mois, la semaine du dernier mercredi du mois (plan.semaine.synthese) : dans les
//   séances de ce mois-là, les points classés « à surveiller » ou « décision à ouvrir », avec ce qu'ils changent et
//   leurs sources, tels que les notes les écrivent ; et, pour la régularité, les séances tenues chaque semaine du
//   mois. Une séance appartient au mois du mercredi de sa semaine : celle du jeudi 29 octobre 2026 à octobre. Sans
//   modèle de langage : une liste exacte vaut mieux qu'un résumé qui pourrait inventer (technique.md).
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
// Les fiches qu'un point retenu cite : « fiche 9 », « candidat n° 2 », « fiches 2 et 4 », « fiches 1 à 3 » ; pas la
// date qui suit (« candidat 1, 29 octobre 2026 », « fiche 9, 4 nov. 2026 », « fiche 9, 2026-11-04 » ou « 04/11/2026 »),
// ni la fiche d'une autre séance (« séance 02, candidat 10 »).
const CITES = /\b(?:candidats?|fiches?)\s*(?:n°\s*)?(\d{1,2})(?!\d)((?:\s*(?:,|et|à)\s*\d{1,2}(?![\d-]|[/.]\d)(?!\s*(?:er\s+)?(?:janv|févr|fevr|mars|avr|mai(?!s)|juin|juil|août|aout|sept|oct|nov|déc|dec)))*)/gi;
function fichesCitees(parenthese) {
  const res = [];
  const deCetteSemaine = String(parenthese).replace(/\bs[ée]ance\s*(?:n°\s*)?\d+[^;)]*/gi, ' ');
  for (const ref of deCetteSemaine.matchAll(CITES)) {
    for (const morceau of (ref[1] + ref[2]).split(/\s*(?:,|et)\s*/)) {
      const plage = /^(\d+)\s*(?:à|-)\s*(\d+)$/.exec(morceau.trim());
      const [de, a] = plage ? [Number(plage[1]), Number(plage[2])] : [0, 0];
      if (plage && a > de && a - de <= 30) for (let k = de; k <= a; k++) res.push(k);
      else for (const k of morceau.match(/\d+/g) || []) res.push(Number(k));
    }
  }
  return res;
}

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
// Les sources d'un point retenu : la ligne « Sources : … » de son paragraphe, telle quelle (liens Markdown ou
// adresses, avec ce qu'en dit la note) ; sans elle, les adresses que le paragraphe cite.
function sourcesDu(lignes) {
  const dites = lignes.map((l) => l.trim()).filter((l) => /^sources?\s*:/i.test(l)).map((l) => l.replace(/^sources?\s*:\s*/i, ''));
  if (dites.length) return dites.join(' ; ').slice(0, 1500);
  return [...new Set(lignes.join(' ').match(/https?:\/\/[^\s)<>\]]+/g) || [])].join(' ; ').slice(0, 1500);
}

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
  // La préparation dont la note donne le lien, et la ligne « Outil » : une préparation faite à la main ?
  const lien = /preparations\/(\d{4}-\d{2}-\d{2}-preparation\.md)/.exec(section(parties, 'preparation').lignes.join('\n'));
  const aLaMain = /\ba la main\b/.test(simple(champ('outil')));
  // Les points retenus : « 1. **Titre** (candidat 2). Texte… » ; le titre en gras, sinon la première phrase. Les
  // fiches qu'ils citent, dans leur première parenthèse : « (fiche 9) » ; « (alerte) » n'en cite aucune. Le
  // paragraphe de chacun, jusqu'au point suivant, pour ses sources.
  const retenus = {};
  const paragraphes = {};
  const fiches = new Set();
  let courant = '';
  for (const l of section(parties, 'points retenus').lignes) {
    const m = /^\s*(\d+)[.)]\s+(.+)$/.exec(l);
    if (!m) {
      if (courant) paragraphes[courant].push(l);
      continue;
    }
    courant = m[1];
    paragraphes[courant] = [m[2]];
    const gras = /\*\*(.+?)\*\*/.exec(m[2]);
    retenus[m[1]] = tronquer(texteSimple(gras ? gras[1] : m[2].split(/(?<=\.)\s/)[0]).replace(/\*/g, ''), 160);
    const parenthese = (/\*\*[^*]+\*\*\s*\(([^)]*)\)/.exec(m[2]) || /\(([^)]*)\)/.exec(m[2]) || [])[1] || '';
    for (const k of fichesCitees(parenthese)) fiches.add(k);
  }
  // Les points classés « à surveiller » ou « décision à ouvrir » (tableau « Ce que ça change… », dernière colonne).
  const classes = [];
  for (const c of lignesDuTableau(section(parties, 'ce que ca change'))) {
    if (c.length < 2 || simple(c[0]) === 'point') continue;
    const classement = c[c.length - 1];
    const type = simple(classement).startsWith('a surveiller') ? 'surveiller' : simple(classement).startsWith('decision') ? 'decision' : '';
    if (!type) continue;
    const point = c[0].replace(/\*/g, '').trim();
    classes.push({
      point,
      type,
      titre: retenus[point] || '',
      effet: c.length > 2 ? tronquer(texteSimple(c[1]), 400) : '',
      classement: tronquer(texteSimple(classement), 220),
      sources: paragraphes[point] ? sourcesDu(paragraphes[point]) : '',
    });
  }
  const pisteTexte = texteSimple(section(parties, 'prochaine piste').lignes.join(' '));
  return {
    fichier: String(fichier || ''),
    numero: numeroTexte ? String(Number(numeroTexte)).padStart(2, '0') : '',
    tenue: !aRemplir && dates.length > 0,
    debut: dates[0] || '',
    fin: dates[dates.length - 1] || '',
    classes: classes.slice(0, 12),
    retenus,
    sourcesParPoint: Object.fromEntries(Object.entries(paragraphes).map(([k, v]) => [k, sourcesDu(v)])),
    piste: A_REMPLIR.test(simple(pisteTexte)) ? '' : tronquer(pisteTexte, 500),
    preparation: lien ? lien[1] : '',
    aLaMain,
    fiches: [...fiches].sort((a, b) => a - b),
  };
}

// Les préparations du bot : leurs fiches, par numéro, avec leur source, d'après le tableau « Candidats, par axe »
// (« | N° | … | Source et nature | … »), où la source est écrite « nom : nature, primaire » (preparation-parlia.js).
const NATURE = /^(.*?) : (éditeur|institution|auteurs|praticien|presse|agrégateur|nature inconnue)(, |$)/;
function fichesDe(texte) {
  const res = {};
  let colonne = -1;
  for (const l of String(texte).replace(/\r\n?/g, '\n').split('\n')) {
    if (!l.trim().startsWith('|')) {
      colonne = -1;
      continue;
    }
    if (estSeparateur(l)) continue;
    const c = cellules(l);
    if (simple(c[0]) === 'n°') {
      colonne = c.findIndex((x) => simple(x).startsWith('source'));
      continue;
    }
    const n = parseInt(c[0], 10);
    if (colonne < 0 || !Number.isFinite(n) || !c[colonne]) continue;
    const m = NATURE.exec(c[colonne]);
    res[n] = (m ? m[1] : c[colonne].split(' : ')[0]).trim();
  }
  return res;
}
const preparations = {};
try {
  for (const i of $('Texte des préparations').all()) {
    const j = i.json || {};
    const fichier = String(j.fileName || '').split('/').pop();
    if (typeof j.texte === 'string' && /^\d{4}-\d{2}-\d{2}-preparation\.md$/.test(fichier)) preparations[fichier] = fichesDe(j.texte);
  }
} catch (e) {
  // nœud non exécuté : aucune préparation relue
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
// Un point d'une séance précédente, reclassé (« Séance 02, point 2 ») : le titre et les sources du point d'origine.
// Sans titre, l'effet en tient lieu. Puis les points « à surveiller », pour l'en-tête de la préparation.
for (const n of notes) {
  for (const p of n.classes) {
    const ref = /^s[ée]ance\s*(?:n°\s*)?(\d+)\s*,\s*point\s*(?:n°\s*)?(\d+)$/i.exec(p.point);
    const origine = ref ? notes.find((x) => x.numero === ref[1].padStart(2, '0')) : null;
    if (origine) {
      p.titre = p.titre || origine.retenus[ref[2]] || '';
      p.sources = p.sources || origine.sourcesParPoint[ref[2]] || '';
    }
    if (!p.titre) [p.titre, p.effet] = [tronquer(p.effet, 160), ''];
  }
  n.aSurveiller = n.classes.filter((x) => x.type === 'surveiller').map((x) => ({ point: x.point, titre: x.titre, classement: x.classement })).slice(0, 8);
}
const ordre = (a, b) => a.debut.localeCompare(b.debut) || a.fin.localeCompare(b.fin) || a.numero.localeCompare(b.numero)
  || a.fichier.localeCompare(b.fichier);
const tenues = notes.filter((n) => n.tenue).sort(ordre);
const resume = (n) => (n ? { numero: n.numero, debut: n.debut, fin: n.fin, fichier: n.fichier } : null);
const derniere = tenues.length ? tenues[tenues.length - 1] : null;
const cetteSemaine = tenues.filter((n) => n.debut >= lundi);
const semainePrecedente = tenues.filter((n) => n.debut >= lundiPrecedent && n.debut < lundi);

// ---- Les sources sur quatre semaines ----
const jourAvant = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') - n * 864e5).toISOString().slice(0, 10);
const debutQuatre = jourAvant(lundi, 28);
const datees = Object.keys(preparations).sort();
const parSource = {};
const comptees = [];
const nonComptees = [];
for (const n of tenues.filter((x) => x.debut >= debutQuatre && x.debut < lundi)) {
  if (n.aLaMain) {
    nonComptees.push({ numero: n.numero, motif: 'préparée à la main' });
    continue;
  }
  const fichier = n.preparation || datees.filter((f) => f.slice(0, 10) <= n.debut && f.slice(0, 10) >= jourAvant(n.debut, 7)).pop() || '';
  const fichesPrep = preparations[fichier];
  if (!fichesPrep || !Object.keys(fichesPrep).length) {
    nonComptees.push({ numero: n.numero, motif: 'préparation du bot introuvable' + (fichier ? ' (' + fichier + ')' : '') });
    continue;
  }
  comptees.push({ numero: n.numero, preparation: fichier });
  for (const [k, nom] of Object.entries(fichesPrep)) {
    const e = parSource[nom] || (parSource[nom] = { proposes: 0, gardes: 0 });
    e.proposes++;
    if (n.fiches.includes(Number(k))) e.gardes++;
  }
}

// ---- La matière de la synthèse du mois ----
// Le mercredi de la semaine d'une date (AAAA-MM-JJ).
const mercrediDe = (iso) => jourAvant(iso, (new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7 - 2);
const mois = (plan.semaine && plan.semaine.synthese) || '';
let synthese = null;
if (mois) {
  const dernierMercredi = mercrediDe(lundi);
  const mercredis = [];
  for (let m = dernierMercredi; m.slice(0, 7) === mois; m = jourAvant(m, 7)) mercredis.unshift(m);
  const duMois = tenues.filter((n) => mercrediDe(n.debut).slice(0, 7) === mois);
  synthese = {
    mois,
    mercredi: dernierMercredi,
    seances: duMois.map((n) => Object.assign(resume(n), { points: n.classes })),
    semaines: mercredis.map((m) => ({ mercredi: m, seances: duMois.filter((n) => mercrediDe(n.debut) === m).map(resume) })),
  };
}
const bilan = {
  lisibles: notes.length > 0,
  motif: notes.length ? '' : (!erreurs.length || /no file/i.test(erreurs[0])
    ? 'aucune note trouvée : dossier des notes non monté, ou vide' : erreurs[0]),
  lues: notes.length,
  tenues: tenues.length,
  seanceSemaine: resume(cetteSemaine[cetteSemaine.length - 1]),
  seancePrecedente: resume(semainePrecedente[semainePrecedente.length - 1]),
  derniere: derniere ? Object.assign(resume(derniere), { aSurveiller: derniere.aSurveiller, piste: derniere.piste }) : null,
  sources: { depuis: debutQuatre, seances: comptees, nonComptees, parSource },
  synthese,
};
sd._passage = Object.assign(sd._passage || {}, { notes: bilan });
return [{ json: { lues: bilan.lues, tenues: bilan.tenues, lisibles: bilan.lisibles } }];

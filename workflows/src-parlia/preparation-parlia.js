// La préparation de la semaine : le fichier Markdown daté et les messages Discord, à partir de la sélection.
// - Le fichier suit la partie « Préparation » de la note de séance du 28 octobre 2026 (« Sources interrogées »,
//   « Candidats, par axe » en tableaux, « Ce qui n'a pas pu être vérifié »), puis les fiches guidées, la réserve,
//   les échéances des 90 jours et les alertes. Avant elle, « Depuis la dernière séance » : les points « à
//   surveiller » et la piste de la dernière séance tenue, lus dans les notes (nœud Notes ; sources.md, 6.2,
//   règle 7). Il est signé et daté : c'est le travail du bot, pas une lecture.
//   Nom : AAAA-MM-JJ-preparation.md, à la date où il est écrit ; « essai- » devant en mode test. Dossier :
//   /home/node/.n8n-files/parlia dans le conteneur, monté depuis PARLIA_EXPORT_DIR (docs/veille-parlia.md).
// - Discord : un message d'ouverture qui notifie (la semaine, par où commencer, comment répondre), puis une fiche
//   guidée par candidat et la réserve, en silence (ergonomie.md, A1, A5, A10). En forum, l'ouverture crée le post
//   de la semaine (thread_name) ; les messages suivants y vont (nœud Fiches).
// La date de la préparation est posée ici ; si l'ouverture échoue dans Discord, le nœud Fiches la retire, et la
// préparation repart au passage suivant (trois essais par semaine au plus).
// La date d'un candidat : celle de sa publication, signalée quand elle précède la période lue ; sans date donnée
// par la source, « date inconnue », avec le jour où le bot l'a vu (jamais ce jour à la place de la date).
const sd = $getWorkflowStaticData('global');
const plan = $('Que faire ?').first().json;
const reglages = plan.reglages || {};
const sel = $input.first().json;
const semaine = sel.semaine || plan.semaine;
const essai = !!plan.essai;
const maintenant = $now.toMillis();
const aujourdhui = $now.toISODate();
const candidats = sel.candidats || [];
const total = candidats.length;

// ---- Dates en français ----
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const jourLong = (dt) => JOURS[dt.weekday - 1] + ' ' + (dt.day === 1 ? '1er' : dt.day) + ' ' + MOIS_FR[dt.month - 1] + ' ' + dt.year;
const heure = (dt) => dt.hour + ' h ' + String(dt.minute).padStart(2, '0');
const instant = (dt) => jourLong(dt) + ' à ' + heure(dt);
const depuisDt = $now.minus({ milliseconds: Math.max(0, maintenant - (Number(sel.depuis) || maintenant)) });
function periode(debut, fin, court) {
  const [a1, m1, j1] = debut.split('-').map(Number);
  const [a2, m2, j2] = fin.split('-').map(Number);
  const j = (n) => (n === 1 ? '1er' : String(n));
  const l = court ? '' : 'lundi ';
  const d = court ? '' : 'dimanche ';
  if (a1 !== a2) return 'du ' + l + j(j1) + ' ' + MOIS_FR[m1 - 1] + ' ' + a1 + ' au ' + d + j(j2) + ' ' + MOIS_FR[m2 - 1] + ' ' + a2;
  if (m1 !== m2) return 'du ' + l + j(j1) + ' ' + MOIS_FR[m1 - 1] + ' au ' + d + j(j2) + ' ' + MOIS_FR[m2 - 1] + ' ' + a2;
  return 'du ' + l + j(j1) + ' au ' + d + j(j2) + ' ' + MOIS_FR[m2 - 1] + ' ' + a2;
}
const laSemaine = 'semaine ' + semaine.numero + ', ' + periode(semaine.lundi, semaine.dimanche);
const nature = (c) => (PARLIA.NOM_NATURE[c.nature] || 'nature inconnue') + ', ' + (c.primaire ? 'source primaire' : 'source non primaire, à recouper');
const listeNumeros = (ns) => (ns.length <= 1 ? 'la fiche ' + (ns[0] || '') : 'les fiches ' + ns.slice(0, -1).join(', ') + ' et ' + ns[ns.length - 1]);
const plage = (ns) => (ns.length === 1 ? 'fiche ' + ns[0] : (ns[ns.length - 1] === ns[0] + 1 ? 'fiches ' + ns[0] + ' et ' + ns[1] : 'fiches ' + ns[0] + ' à ' + ns[ns.length - 1]));
// « rien » : le tri ne voit pas de lien concret avec ParlIA. Un champ vide : il n'a pas proposé d'hypothèse.
const hypothese = (c) => {
  if (/^rien\.?$/i.test(String(c.hypothese || '').trim())) return "Rien pour ParlIA, d'après le tri : à confirmer ou à contredire en séance.";
  return c.hypothese || "Pas d'hypothèse du tri : à formuler en séance.";
};
const quand = (c) => (c.date ? dateLongue(c.date) + (c.avantPeriode ? ', avant la période lue' : '')
  : 'date inconnue' + (c.vu ? ' (vu le ' + dateLongue(c.vu) + ')' : ''));

// ---- Sources interrogées ----
const carnet = sd.semaine || { collectes: 0, parSource: {} };
const sante = sd.sante || {};
const ids = Object.keys(carnet.parSource || {});
const nbFlux = ids.filter((id) => carnet.parSource[id].k === 'flux').length;
const nbAutres = ids.length - nbFlux;
const lus = ids.reduce((n, id) => n + (carnet.parSource[id].lus || 0), 0);
const enEchec = ids.filter((id) => carnet.parSource[id].echecs > 0)
  .map((id) => carnet.parSource[id].s + ' (' + carnet.parSource[id].echecs + ' fois sur ' + carnet.collectes
    + (sante[id] && sante[id].detail ? ' ; dernier motif : ' + sante[id].detail : '') + ')');
const avecCandidat = new Set(candidats.map((c) => c.sid));
const sansCandidat = ids.filter((id) => !avecCandidat.has(id) && carnet.parSource[id].echecs < carnet.collectes)
  .map((id) => carnet.parSource[id].s);
const st = sel.stats || {};
const jo = sante.A12 ? (sante.A12.echecs ? 'en échec (' + sante.A12.echecs + ' fois de suite)' : 'lu sans problème') : 'pas encore lu';
let sources = 'Du ' + instant(depuisDt) + ' au ' + instant($now) + ' : ' + (carnet.collectes || 0) + ' collecte(s), '
  + ids.length + ' sources (' + nbFlux + ' flux, ' + nbAutres + (nbAutres > 1 ? ' pages sans flux ou API' : ' page sans flux ou API')
  + '), plus le Journal officiel, ' + jo + '. ';
sources += enEchec.length ? 'En échec au moins une fois : ' + enEchec.join(' ; ') + '. ' : 'Toutes ont répondu à chaque collecte. ';
sources += 'Éléments lus : ' + lus + ' ; triés par le modèle : ' + (st.lus || 0) + ', dont ' + (st.horsTheme || 0) + ' hors thème'
  + (st.secours ? ' et ' + st.secours + ' au tri de secours' : '') + ' ; notés 6 ou plus : ' + (st.notes6 || 0)
  + ' ; proposés : ' + total + (sel.reserve && sel.reserve.length ? ', et ' + sel.reserve.length + ' en réserve' : '') + '.';
if (sansCandidat.length) sources += ' Sans candidat cette semaine : ' + sansCandidat.slice(0, 25).join(', ') + (sansCandidat.length > 25 ? '…' : '') + '.';

// ---- Depuis la dernière séance (les notes de séance, relues en lecture seule par le nœud Notes) ----
const notes = (sd._passage && sd._passage.notes) || null;
const derniere = notes && notes.lisibles ? notes.derniere : null;
const quandSeance = (s) => (s.debut === s.fin ? 'le ' + dateLongue(s.debut) : periode(s.debut, s.fin, true));
const D = [];
if (!notes || !notes.lisibles) {
  D.push("Le bot n'a pas pu lire les notes de séance (" + (notes ? notes.motif : 'notes non lues')
    + ') : reprendre à la main, dans la dernière note, les points « à surveiller » et la piste notée.');
} else if (!derniere) {
  D.push('Aucune séance tenue dans les ' + notes.lues + ' note(s) lue(s) : rien à reprendre.');
} else {
  const sp = notes.seancePrecedente;
  D.push('Dernière séance tenue : séance ' + derniere.numero + ', ' + quandSeance(derniere) + ' (' + derniere.fichier + '). '
    + 'La semaine dernière : ' + (sp ? 'séance ' + sp.numero + ', ' + quandSeance(sp) : 'aucune séance notée') + '.');
  D.push('');
  if (derniere.aSurveiller.length) {
    D.push("Points « à surveiller », rappelés ici, hors quota, jusqu'à ce qu'une séance les classe autrement :");
    derniere.aSurveiller.forEach((p) => D.push('- Point ' + p.point + ' : ' + p.titre + ' — ' + p.classement));
  } else {
    D.push('Aucun point « à surveiller » dans cette séance.');
  }
  if (derniere.piste) {
    D.push('');
    D.push('La piste notée pour la suite : « ' + derniere.piste + ' »');
  }
}

// ---- Le fichier ----
const L = [];
L.push('# ' + (essai ? '[ESSAI] ' : '') + 'Préparation de la veille ParlIA — ' + laSemaine);
L.push('');
L.push('> Écrit par le bot de veille le ' + instant($now) + " (heure de Paris). C'est le fichier du bot : la note de séance s'écrit à part, à la date réelle de la lecture.");
L.push('> Période lue : du ' + instant(depuisDt) + ' au ' + instant($now) + '.');
L.push("> Les résumés, les « à chercher » et les hypothèses viennent du tri automatique (Mistral Small 3.2) : à vérifier dans l'original, à confirmer ou à écarter en séance.");
L.push('');
L.push('Thème : ' + PARLIA.THEME + " Quatre axes : fournisseurs et coûts, qualité de l'étiquetage, conformité, exploitation.");
L.push('');
L.push('## Depuis la dernière séance');
L.push('');
D.forEach((l) => L.push(l));
L.push('');
L.push('## Préparation');
L.push('');
L.push('### Sources interrogées');
L.push('');
L.push(sources);
L.push('');
L.push('### Candidats, par axe');
L.push('');
L.push("Chaque phrase de la dernière colonne est une hypothèse du tri automatique, à confirmer ou à écarter en séance. « Primaire » : l'information vient de qui l'a produite (l'éditeur du modèle, l'institution, les auteurs de l'étude).");
for (const axe of PARLIA.AXES) {
  L.push('');
  L.push('**' + PARLIA.NOM_AXE[axe] + '**');
  L.push('');
  const liste = candidats.filter((c) => c.axe === axe);
  if (!liste.length) {
    L.push('Aucun candidat cette semaine.');
    continue;
  }
  L.push('| N° | Élément et date | Source et nature | Lien | Ce que ça pourrait changer pour ParlIA (hypothèse) |');
  L.push('|---|---|---|---|---|');
  for (const c of liste) {
    const element = '« ' + c.titre + ' »' + (c.resume ? ' : ' + c.resume.replace(/\.?$/, '.') : '.') + ' ' + quand(c);
    let src = c.source + ' : ' + PARLIA.NOM_NATURE[c.nature] + ', ' + (c.primaire ? 'primaire' : 'non primaire, à recouper');
    if (c.aussi && c.aussi.length) src += '. Couvert aussi par : ' + c.aussi.map((a) => a.s).join(', ');
    L.push('| ' + [c.n, element, src, c.url, hypothese(c)].map(cellule).join(' | ') + ' |');
  }
}
L.push('');
if (sel.cnil) {
  L.push('**La CNIL et le CEPD cette semaine** : « ' + sel.cnil.titre + ' » (' + sel.cnil.source + ')'
    + (sel.cnil.n ? ', fiche ' + sel.cnil.n : sel.cnil.horsTheme ? ', classé hors thème par le tri : pour information, pas un candidat' : '')
    + ' — ' + sel.cnil.url);
} else {
  L.push("**La CNIL et le CEPD cette semaine** : aucun texte lu depuis la dernière préparation.");
}
L.push('');
L.push("### Ce qui n'a pas pu être vérifié");
L.push('');
const nonVerifie = ["Aucun original n'a été ouvert par le bot : les résumés et les hypothèses s'appuient sur le titre et l'extrait donnés par la source."];
for (const id of Object.keys(sante)) {
  if (sante[id].echecs > 0) nonVerifie.push(sante[id].s + ' : ' + sante[id].echecs + ' échec(s) de suite à la dernière lecture' + (sante[id].detail ? ' (' + sante[id].detail + ')' : '') + '.');
}
for (const c of candidats) {
  if (c.secours) nonVerifie.push('Fiche ' + c.n + " : le tri automatique n'a pas répondu (" + c.secours + ') ; note de secours, à lire en entier.');
  if (!c.primaire) nonVerifie.push('Fiche ' + c.n + " : source non primaire ; l'original reste à trouver.");
  if (!c.date) nonVerifie.push('Fiche ' + c.n + ' : date de publication inconnue' + (c.vu ? " ; le bot l'a vue le " + dateLongue(c.vu) : '') + '.');
  if (c.avantPeriode) {
    nonVerifie.push('Fiche ' + c.n + ' : publiée le ' + dateLongue(c.date) + ', avant la période lue (qui commence le '
      + dateLongue(sel.jourDebut) + ") : un article ancien, ou la mise à jour d'un avis ancien.");
  }
  if (c.dateAvant && c.dateEffet) nonVerifie.push('Fiche ' + c.n + ' : la source a changé la date, du ' + dateLongue(c.dateAvant) + ' au ' + dateLongue(c.dateEffet) + '.');
  if (c.plafonds) nonVerifie.push('Fiche ' + c.n + ' : note plafonnée (' + c.plafonds + ').');
}
nonVerifie.forEach((l) => L.push('- ' + l));
L.push('');
L.push('### Fiches guidées');
L.push('');
if (total) {
  L.push('Par où commencer : ' + listeNumeros(sel.aLaUne || []) + ". Pour chaque fiche : lire les deux lignes, ouvrir l'original, y chercher ce qui est indiqué, puis répondre aux deux questions.");
  for (const c of candidats) {
    L.push('');
    L.push('#### Fiche ' + c.n + ' · ' + PARLIA.NOM_AXE[c.axe] + ' · ' + nature(c) + ' · note du tri : ' + c.p + '/10');
    L.push('');
    L.push('**« ' + c.titre + ' »** — ' + quand(c) + ' — ' + c.source);
    L.push('');
    L.push("- En deux lignes (résumé automatique, à vérifier dans l'original) : " + (c.resume || "pas de résumé : lire l'original."));
    L.push("- À chercher dans l'original : " + (c.aChercher || 'la date, les chiffres et ce qui change concrètement.'));
    L.push("- Qu'est-ce qui sort ?");
    L.push('- Est-ce que ça pourrait servir à ParlIA ?');
    L.push("- L'hypothèse du tri : " + hypothese(c));
    L.push('- Lien : ' + c.url);
    L.push('- Pourquoi cette fiche : ' + (c.raison || 'sélection') + (c.aussi && c.aussi.length ? '. Couvert aussi par : ' + c.aussi.map((a) => a.s + ' (' + a.u + ')').join(', ') : '') + '.');
  }
} else {
  L.push("Aucun candidat cette semaine : aucune source n'a publié d'article noté 5 ou plus dans le thème. Une séance courte peut partir de la réserve.");
}
L.push('');
L.push('### Réserve');
L.push('');
if (sel.reserve && sel.reserve.length) {
  sel.reserve.forEach((r) => L.push('- « ' + r.titre + ' » — ' + r.source + ' (' + PARLIA.NOM_AXE[r.axe] + ', note ' + r.p + '/10) — ' + r.url));
} else {
  L.push('Rien en réserve.');
}
L.push('');
L.push('### Échéances dans les 90 jours');
L.push('');
if (sel.echeances && sel.echeances.length) {
  sel.echeances.forEach((e) => L.push('- ' + dateLongue(e.date) + ' : ' + e.titre + (e.avant ? " (date changée par la source : c'était le " + dateLongue(e.avant) + ')' : '')
    + (e.source ? ' (' + e.source + ')' : '') + (e.url ? ' — ' + e.url : '')));
} else {
  L.push('Aucune échéance connue.');
}
if (sel.echeancesChangees && sel.echeancesChangees.length) {
  L.push('');
  L.push('Changées ou retirées par la source depuis leur relevé, à vérifier dans l\'original :');
  sel.echeancesChangees.forEach((e) => L.push('- ' + dateLongue(e.date) + ' : ' + e.titre + ' (texte changé le ' + dateLongue(e.changee) + ')' + (e.url ? ' — ' + e.url : '')));
}
L.push('');
L.push('### Alertes depuis la dernière préparation');
L.push('');
const precedente = sd.prep && sd.prep.at ? Number(sd.prep.at) : 0;
const alertes = (sd.alertesJournal || []).filter((a) => (a.at || 0) > precedente);
const NOM_ALERTE = { remaniement: 'Remaniement', attributions: 'Attributions', retrait: "Retrait d'un modèle suivi" };
if (alertes.length) alertes.forEach((a) => L.push('- ' + (NOM_ALERTE[a.type] || a.type) + ' : « ' + a.titre + ' » (' + (dateLongue(a.date) || a.date) + ', ' + a.origine + ') — ' + a.url));
else L.push('Aucune.');
L.push('');
L.push('### Classer en séance');
L.push('');
L.push("Pour chaque fiche ouverte : rien, à surveiller ou décision à ouvrir, et pourquoi. Dans Discord, une ligne par fiche, sous le message de la semaine : « 2 décision : … », « 5 rien », « 9 à surveiller : … ». Le bot propose ; Louis classe.");
const markdown = L.join('\n') + '\n';
const nom = (essai ? 'essai-' : '') + aujourdhui + '-preparation.md';

// ---- Discord ----
const md = (s) => pourDiscord(texteSimple(s)).replace(/[\[\]]/g, '');
const mdUrl = (u) => String(u || '').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/ /g, '%20');
const COULEUR = { fournisseurs: 5793266, qualite: 5763719, conformite: 15418782, exploitation: 16705372 };
const mention = reglages.mention ? '<@' + reglages.mention + '> ' : '';
const O = [];
O.push(mention + '📂 **Veille ParlIA · semaine ' + semaine.numero + '** — ' + periode(semaine.lundi, semaine.dimanche) + (essai ? ' · ESSAI' : ''));
if (total) {
  O.push(total + ' fiche' + (total > 1 ? 's guidées' : ' guidée') + ' ci-dessous, à lire quand tu veux avant dimanche soir. **Par où commencer : '
    + listeNumeros(sel.aLaUne || []) + '.**');
  const axes = PARLIA.AXES.map((axe) => {
    const ns = candidats.filter((c) => c.axe === axe).map((c) => c.n);
    return ns.length ? PARLIA.NOM_AXE[axe] + ' : ' + plage(ns) : '';
  }).filter(Boolean);
  O.push(axes.join(' · '));
} else {
  O.push("Rien de neuf noté 5 ou plus dans le thème cette semaine. La réserve est ci-dessous s'il y en a une.");
}
if (derniere && derniere.aSurveiller.length) {
  const pts = derniere.aSurveiller;
  O.push('🟡 À surveiller depuis la séance ' + derniere.numero + ' : ' + pts.slice(0, 2).map((p) => '« ' + md(tronquer(p.titre, 90)) + ' »').join(', ')
    + (pts.length > 2 ? ' et ' + (pts.length - 2) + ' autre' + (pts.length > 3 ? 's' : '') : ''));
}
if (derniere && derniere.piste) O.push('🧭 Piste notée : ' + md(tronquer(derniere.piste, 180)));
if (sel.cnil) O.push('🛡️ La CNIL et le CEPD cette semaine : ' + (sel.cnil.n ? 'fiche ' + sel.cnil.n + ', ' : '') + '« ' + md(tronquer(sel.cnil.titre, 120)) + ' »');
if (sel.echeances && sel.echeances.length) {
  O.push('⏳ Dans les 90 jours : ' + sel.echeances.slice(0, 3).map((e) => dateLongue(e.date).replace(/ \d{4}$/, '') + ', ' + md(tronquer(e.titre, 70))).join(' ; '));
}
if (alertes.length) O.push('🚨 Alertes depuis la dernière fois : ' + alertes.length + ' (voir le fichier)');
O.push('Pour répondre : une ligne par fiche, ici, « 2 décision : … », « 5 rien », « 9 à surveiller : … ». Une seule fiche lue, c\'est déjà une séance courte.');
O.push('-# Préparé par le bot le ' + instant($now) + " · résumés automatiques, à vérifier dans l'original · fichier " + nom);
let contenu = O.join('\n');
if (contenu.length > 1990) contenu = contenu.slice(0, 1985) + '…';
const ouverture = { payload: {
  username: 'Veille · ParlIA', content: contenu,
  allowed_mentions: reglages.mention ? { parse: [], users: [reglages.mention] } : { parse: [] },
}, cv2: false };
if (reglages.forum) ouverture.payload.thread_name = ('Semaine ' + semaine.numero + ' · ' + periode(semaine.lundi, semaine.dimanche, true)).slice(0, 100);

function carte(c) {
  const comps = [];
  comps.push({ type: 10, content: '### Fiche ' + c.n + '/' + total + ' · ' + PARLIA.NOM_AXE[c.axe] + '\n**' + md(tronquer(c.titre, 200)) + '**\n-# '
    + [quand(c), md(c.source), nature(c), 'note du tri ' + c.p + '/10'].join(' · ') });
  comps.push({ type: 10, content: '**En deux lignes** : ' + md(tronquer(c.resume || "pas de résumé : lire l'original.", 400))
    + "\n**À chercher dans l'original** : " + md(tronquer(c.aChercher || 'la date, les chiffres et ce qui change concrètement.', 400)) });
  comps.push({ type: 10, content: "**Deux questions** : qu'est-ce qui sort ? Est-ce que ça pourrait servir à ParlIA ?\n**L'hypothèse du tri** : "
    + md(tronquer(hypothese(c), 400)) });
  const notes = [];
  if (c.aussi && c.aussi.length) notes.push('couvert aussi par ' + c.aussi.map((a) => md(a.s)).join(', '));
  if (c.secours) notes.push("tri de secours : le modèle n'a pas répondu");
  if (c.raison) notes.push('pourquoi cette fiche : ' + c.raison);
  if (notes.length) comps.push({ type: 10, content: '-# ' + notes.join(' · ') });
  if (/^https?:\/\//.test(c.url) && c.url.length <= 512) comps.push({ type: 1, components: [{ type: 2, style: 5, label: "Lire l'original", url: c.url }] });
  comps.push({ type: 10, content: '-# Pour répondre : « ' + c.n + " », puis rien, à surveiller ou décision, et pourquoi. Résumé automatique : à vérifier dans l'original." });
  return { payload: {
    username: 'Veille · ParlIA', flags: 36864, allowed_mentions: { parse: [] },
    components: [{ type: 17, accent_color: COULEUR[c.axe] || 5793266, components: comps }],
  }, cv2: true };
}
const fiches = candidats.map(carte);
if (sel.reserve && sel.reserve.length) {
  const lignes = sel.reserve.map((r) => '- [' + md(tronquer(r.titre, 90)) + '](' + mdUrl(r.url) + ') · ' + md(r.source) + ' · ' + r.p + '/10');
  fiches.push({ payload: {
    username: 'Veille · ParlIA', flags: 36864, allowed_mentions: { parse: [] },
    components: [{ type: 17, components: [{ type: 10, content: ('### Réserve · ' + sel.reserve.length + ' autre' + (sel.reserve.length > 1 ? 's liens' : ' lien') + ', pour aller plus loin\n' + lignes.join('\n')).slice(0, 3800) }] }],
  }, cv2: true });
}

// ---- La mémoire : la préparation de la semaine est faite ----
const avant = { prep: sd.prep || null, semaine: sd.semaine || null };
sd.prep = { semaine: semaine.cle, at: maintenant, fichier: nom, nb: total, threadId: null, messageId: null, rappel: false };
sd.semaine = { depuis: maintenant, collectes: 0, parSource: {} };
sd._passage = Object.assign(sd._passage || {}, { prepAvant: avant, preparation: { fichier: nom, candidats: total, reserve: (sel.reserve || []).length } });
return [{ json: {
  markdown, nom, chemin: '/home/node/.n8n-files/parlia/' + nom, semaine: semaine.cle, candidats: total,
  discord: { ouverture, fiches },
} }];

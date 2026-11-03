// Le message de #status (DISCORD_WEBHOOK_STATUS) : ce que le passage a fait, en quelques lignes, à l'heure de Paris.
// Silencieux (drapeau 4096), sauf problème : une source en échec trois fois de suite, le fichier non écrit, un
// envoi Discord refusé. Il lit le carnet du passage (sd._passage), rempli par les autres nœuds, puis l'efface,
// et les sorties des nœuds d'écriture et d'envoi (en erreur, ils continuent : continueOnFail).
const sd = $getWorkflowStaticData('global');
const plan = $('Que faire ?').first().json;
const reglages = plan.reglages || {};
const p = sd._passage || {};
delete sd._passage;
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const quand = JOURS[$now.weekday - 1] + ' ' + ($now.day === 1 ? '1er' : $now.day) + ' ' + MOIS_FR[$now.month - 1] + ', '
  + $now.hour + ' h ' + String($now.minute).padStart(2, '0');
// La sortie d'un nœud : le nombre d'éléments et les erreurs ; null s'il n'a pas tourné. Les noms sont écrits en
// toutes lettres à l'appel ($('Écrire le fichier')) : le task runner de n8n y repère les données à transmettre.
function sortieDe(lire) {
  try {
    const n = lire();
    if (n.isExecuted === false) return null;
    const items = n.all();
    const err = items.map((i) => i.json && i.json.error).filter(Boolean)
      .map((e) => String(typeof e === 'string' ? e : e.message || JSON.stringify(e)).slice(0, 120));
    return { n: items.length, err };
  } catch (e) {
    return null;
  }
}
const lignes = ['**Veille ParlIA** — ' + quand + (plan.essai ? ' · ESSAI' : '')];
let probleme = false;
if (p.collecte) {
  const c = p.collecteStats || {};
  const t = p.tri;
  let l = '📥 ' + (c.lus || 0) + ' lus → 🆕 ' + (c.nouveaux || 0) + ' nouveaux';
  if (t) {
    const axes = PARLIA.AXES.filter((a) => t.parAxe && t.parAxe[a]).map((a) => a + ' ' + t.parAxe[a]).join(' · ');
    l += ' → 🏷️ ' + (t.nouveaux - (t.horsTheme || 0)) + ' dans le thème' + (axes ? ' (' + axes + ')' : '') + ', ' + (t.horsTheme || 0) + ' hors thème';
    if (t.secours) l += ' · ⚠️ ' + t.secours + ' au tri de secours';
  }
  lignes.push(l);
  const extras = [];
  if (p.sommeilH && p.sommeilH > 12) extras.push('🕒 rattrapage : ' + Math.round(p.sommeilH) + ' h depuis la dernière collecte');
  if (p.pages) {
    extras.push('🌐 pages et API : ' + (p.pages.lues - p.pages.echecs.length) + '/' + p.pages.lues + ' lues, ' + p.pages.nouveautes + ' nouveauté(s)'
      + (p.pages.refaites.length ? ', refaites : ' + p.pages.refaites.join(', ') : ''));
  }
  if (p.jorf) extras.push('⚖️ Journal officiel : ' + p.jorf.archives + ' archive(s), ' + p.jorf.decrets + ' décret(s)' + (p.jorf.erreur ? ' · ' + p.jorf.erreur : ''));
  if (extras.length) lignes.push(extras.join(' · '));
}
if (p.alertes && p.alertes.nouvelles) {
  const envoi = sortieDe(() => $('Discord alertes'));
  const ko = envoi && envoi.err.length;
  if (ko) probleme = true;
  lignes.push('🚨 ' + p.alertes.nouvelles + ' alerte(s) : ' + p.alertes.types.join(', ')
    + (!reglages.discord ? ' (Discord non réglé : voir le fichier de la semaine)' : ko ? ' · ❌ envoi refusé : ' + envoi.err[0] : ''));
}
if (p.preparation) {
  const prep = p.preparation;
  lignes.push('📂 Préparation de la semaine ' + plan.semaine.numero + ' : ' + prep.candidats + ' candidat(s), ' + prep.reserve + ' en réserve');
  const ecrit = sortieDe(() => $('Écrire le fichier'));
  if (ecrit && !ecrit.err.length) lignes.push('📄 ' + prep.fichier + ' écrit dans le dossier d\'export');
  else {
    probleme = true;
    lignes.push('❌ fichier non écrit' + (ecrit && ecrit.err.length ? ' : ' + ecrit.err[0] : '') + ' (dossier monté ? voir docs/veille-parlia.md)');
  }
  const d = p.discord;
  if (!reglages.discord) lignes.push('💬 Discord non réglé (DISCORD_WEBHOOK_PARLIA) : rien publié');
  else if (d && d.ouverture === 'échec') {
    probleme = true;
    lignes.push("❌ ouverture refusée par Discord (" + d.detail + ') : ' + (d.abandon ? 'abandon après trois essais cette semaine' : 'nouvel essai au prochain passage'));
  } else if (d) {
    const envoi = sortieDe(() => $('Discord fiches'));
    const ko = envoi ? envoi.err.length : 0;
    if (ko) probleme = true;
    lignes.push('💬 Discord : ouverture ' + (d.ouverture === 'ok' ? 'publiée' : 'préparée (essai)') + ', ' + (d.fiches - ko) + '/' + d.fiches + ' fiche(s) et réserve'
      + (ko ? ' · ❌ ' + envoi.err[0] : ''));
  }
}
if (p.rappel) {
  const envoi = sortieDe(() => $('Discord rappel'));
  const ko = envoi && envoi.err.length;
  if (ko) probleme = true;
  lignes.push('⏰ Rappel du jeudi : ' + (p.rappel === 'sans Discord' ? 'Discord non réglé' : ko ? '❌ ' + envoi.err[0] : plan.essai ? 'préparé (essai)' : 'envoyé'));
}
const alertesFlux = (p.flux || []).filter((f) => !f.retour);
const retours = (p.flux || []).filter((f) => f.retour);
if (alertesFlux.length) {
  probleme = true;
  lignes.push('⚠️ En échec ' + alertesFlux[0].echecs + ' fois de suite : ' + alertesFlux.map((f) => f.s + (f.detail ? ' (' + f.detail + ')' : '')).join(' ; '));
}
if (retours.length) lignes.push('✅ De retour : ' + retours.map((f) => f.s).join(', '));
if (!reglages.statut) return [];
const payload = { username: 'Veille · ParlIA', content: lignes.join('\n').slice(0, 1900), allowed_mentions: { parse: [] } };
if (!probleme) payload.flags = 4096;
return [{ json: { payload, cv2: false, threadId: null, probleme } }];

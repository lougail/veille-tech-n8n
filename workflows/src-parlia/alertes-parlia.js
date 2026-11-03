// Les alertes immédiates, hors préparation (sources.md, 6.2, règle 9) : un remaniement (Journal officiel, ou
// communiqué de l'Élysée en secours), des décrets d'attributions, le retrait d'un modèle suivi annoncé à moins de
// 90 jours. Les nœuds Normaliser, Registre et Journal officiel les déposent dans sd._alertes ; celui-ci les envoie,
// toutes dans un seul message, avec la mention de Louis si elle est réglée (PARLIA_DISCORD_MENTION).
// Une alerte n'est envoyée qu'une fois (120 jours de mémoire). Elle est aussi gardée 60 jours dans sd.alertesJournal,
// pour la section « Alertes depuis la dernière préparation » du fichier, même quand Discord n'est pas réglé.
// En forum, l'alerte va dans le post de la semaine s'il existe, sinon dans un post à elle.
const sd = $getWorkflowStaticData('global');
const plan = $('Que faire ?').first().json;
const reglages = plan.reglages || {};
const maintenant = $now.toMillis();
const J = 24 * 3600 * 1000;
const alertes = Array.isArray(sd._alertes) ? sd._alertes : [];
delete sd._alertes;
if (!sd.alertesEnvoyees) sd.alertesEnvoyees = {};
for (const [cle, t] of Object.entries(sd.alertesEnvoyees)) if (maintenant - t > 120 * J) delete sd.alertesEnvoyees[cle];
const nouvelles = alertes.filter((a) => a && a.cle && !sd.alertesEnvoyees[a.cle]);
for (const a of nouvelles) sd.alertesEnvoyees[a.cle] = maintenant;
sd.alertesJournal = (sd.alertesJournal || []).filter((a) => maintenant - (a.at || 0) < 60 * J)
  .concat(nouvelles.map((a) => ({ type: a.type, titre: a.titre, url: a.url, date: a.date, origine: a.origine, at: maintenant })))
  .slice(-50);
sd._passage = Object.assign(sd._passage || {}, { alertes: { nouvelles: nouvelles.length, types: nouvelles.map((a) => a.type) } });
if (!nouvelles.length || !reglages.discord) return [];

const ORDRE = { remaniement: 0, attributions: 1, retrait: 2 };
nouvelles.sort((a, b) => (ORDRE[a.type] ?? 9) - (ORDRE[b.type] ?? 9));
const md = (s) => pourDiscord(texteSimple(s)).replace(/[\[\]]/g, '');
const lien = (u) => (/^https?:\/\//.test(String(u || '')) ? ' <' + String(u).slice(0, 500) + '>' : '');
function ligne(a) {
  const quand = dateLongue(a.date);
  if (a.type === 'remaniement' && /lysée/.test(String(a.origine || ''))) {
    return "🚨 **Remaniement annoncé par l'Élysée** — « " + md(a.titre) + ' »' + (quand ? ', ' + quand : '')
      + ". Le décret paraîtra au Journal officiel : vérifier la table des ministères de ParlIA." + lien(a.url);
  }
  if (a.type === 'remaniement') {
    return '🚨 **Remaniement publié au Journal officiel du ' + quand + '** — « ' + md(a.titre) + ' ». À faire : vérifier '
      + "la table des ministères de ParlIA, puis attendre les décrets d'attributions, qui fixent les périmètres." + lien(a.url);
  }
  if (a.type === 'attributions') {
    return '📌 **Attributions publiées au Journal officiel du ' + quand + '** — « ' + md(a.titre) + ' ». À faire : mettre à '
      + 'jour la table de correspondance des périmètres.' + lien(a.url);
  }
  if (a.type === 'retrait') {
    return "⏳ **Retrait annoncé d'un modèle suivi**" + (quand ? ', le ' + quand : '') + ' — « ' + md(a.titre) + ' » ('
      + md(a.origine) + "). À vérifier sur la page des retraits de l'éditeur." + lien(a.url);
  }
  return '🔔 ' + md(a.titre) + lien(a.url);
}
const mention = reglages.mention ? '<@' + reglages.mention + '> ' : '';
let contenu = mention;
for (const a of nouvelles) {
  const l = ligne(a);
  if ((contenu + l).length > 1900) {
    contenu += '\n…';
    break;
  }
  contenu += (contenu === mention ? '' : '\n') + l;
}
const payload = {
  username: 'Veille · ParlIA',
  content: contenu,
  allowed_mentions: reglages.mention ? { parse: [], users: [reglages.mention] } : { parse: [] },
};
let threadId = null;
if (reglages.forum) {
  const prep = sd.prep || {};
  if (prep.semaine === plan.semaine.cle && prep.threadId) threadId = prep.threadId;
  else {
    const NOM = { remaniement: 'Remaniement', attributions: 'Attributions', retrait: 'Retrait d\'un modèle' };
    payload.thread_name = ('Alerte · ' + (NOM[nouvelles[0].type] || 'ParlIA') + ' · ' + dateLongue($now.toISODate())).slice(0, 100);
  }
}
return [{ json: { payload, cv2: false, threadId } }];

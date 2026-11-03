// Les fiches guidées et la réserve, après l'ouverture. En forum, l'ouverture a créé le post de la semaine :
// la réponse de Discord (?wait=true) donne son identifiant (channel_id), que suivent les fiches, puis le rappel.
// Si l'ouverture a échoué (réseau absent au réveil du Mac, webhook supprimé…), rien ne part : la préparation est
// retirée de la mémoire et repart au passage suivant, trois fois au plus dans la semaine. Le fichier, déjà
// écrit, est alors réécrit. En mode essai, le nœud Discord est désactivé : les fiches sont seulement préparées.
const sd = $getWorkflowStaticData('global');
const plan = $('Que faire ?').first().json;
const reglages = plan.reglages || {};
const prep = $('Préparation').first().json;
const rep = $input.first().json || {};
const ok = !rep.error && !!rep.id;
if (!sd._passage) sd._passage = {};
if (!ok && !plan.essai) {
  const cle = prep.semaine;
  const n = sd.echecsOuverture && sd.echecsOuverture.semaine === cle ? sd.echecsOuverture.n + 1 : 1;
  sd.echecsOuverture = { semaine: cle, n };
  const erreur = rep.error;
  const detail = erreur ? String(typeof erreur === 'string' ? erreur : erreur.message || JSON.stringify(erreur)).slice(0, 160) : 'réponse sans identifiant';
  const avant = sd._passage.prepAvant;
  if (n < 3 && avant) {
    if (avant.prep) sd.prep = avant.prep;
    else delete sd.prep;
    if (avant.semaine) sd.semaine = avant.semaine;
  }
  sd._passage.discord = { ouverture: 'échec', detail, essai: n, abandon: n >= 3 };
  return [];
}
let threadId = null;
if (ok) {
  if (reglages.forum) threadId = String(rep.channel_id || rep.id);
  if (sd.prep && sd.prep.semaine === prep.semaine) {
    sd.prep.threadId = threadId;
    sd.prep.messageId = String(rep.id);
  }
  delete sd.echecsOuverture;
}
const liste = (prep.discord && prep.discord.fiches) || [];
sd._passage.discord = { ouverture: ok ? 'ok' : 'essai', fiches: liste.length };
return liste.map((f) => ({ json: Object.assign({}, f, { threadId }) }));

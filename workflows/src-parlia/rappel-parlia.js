// Le rappel doux (ergonomie.md, F2) : au premier passage après le jeudi 16 h 30 (réglable), une fois, si la
// préparation de la semaine est partie avant. Il va dans le post de la semaine (forum) et mentionne Louis si la
// mention est réglée. Tant que le bot ne lit pas les réponses, il part toujours : « si c'est fait, ignore ce message ».
const sd = $getWorkflowStaticData('global');
const plan = $('Que faire ?').first().json;
if (!plan.rappel) return [];
const reglages = plan.reglages || {};
const prep = sd.prep || {};
if (sd.prep) sd.prep.rappel = true;
sd._passage = Object.assign(sd._passage || {}, { rappel: reglages.discord ? 'préparé' : 'sans Discord' });
if (!reglages.discord) return [];
const mention = reglages.mention ? '<@' + reglages.mention + '> ' : '';
const nb = Number(prep.nb) || 0;
const payload = {
  username: 'Veille · ParlIA',
  content: mention + '⏰ Petit rappel : le dossier de la semaine ' + plan.semaine.numero + " t'attend"
    + (nb ? ' (' + nb + ' fiche' + (nb > 1 ? 's' : '') + ')' : '') + ", jusqu'à dimanche soir. Une fiche lue et une ligne de "
    + "réponse, c'est déjà une séance courte. Si c'est fait, ignore ce message.",
  allowed_mentions: reglages.mention ? { parse: [], users: [reglages.mention] } : { parse: [] },
};
let threadId = null;
if (reglages.forum) {
  if (prep.threadId) threadId = prep.threadId;
  else payload.thread_name = ('Rappel · semaine ' + plan.semaine.numero).slice(0, 100);
}
return [{ json: { payload, cv2: false, threadId } }];

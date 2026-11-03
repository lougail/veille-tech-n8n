// Le message d'ouverture de la semaine, préparé par le nœud Préparation. Sans webhook Discord réglé, rien ne part :
// la branche s'arrête ici, et le fichier reste la seule trace de la préparation.
const plan = $('Que faire ?').first().json;
const prep = $input.first().json || {};
if (!plan.reglages || !plan.reglages.discord || !prep.discord || !prep.discord.ouverture) return [];
return [{ json: Object.assign({ threadId: null }, prep.discord.ouverture) }];

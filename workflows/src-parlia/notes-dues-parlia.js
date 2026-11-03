// Les notes de séance ne servent qu'à la préparation de la semaine (les points « à surveiller » et la piste de la
// dernière séance) et au rappel du jeudi (la séance de la semaine a-t-elle eu lieu ?) : on ne les lit qu'alors.
const plan = $('Que faire ?').first().json;
return plan.preparation || plan.rappel ? [{ json: { notes: true } }] : [];

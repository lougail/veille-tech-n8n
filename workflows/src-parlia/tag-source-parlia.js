// Attache la fiche de la source à chaque article lu par le nœud RSS, et allège l'article : seuls les champs
// utiles sont gardés, tronqués (assez long pour l'extrait de 1 200 caractères que reçoit le tri : un résumé
// d'arXiv en fait souvent 1 000 à 1 900). Une erreur de lecture devient un élément « erreur », compté par la santé
// des flux.
const flux = $('Flux ParlIA').first().json;
const source = {
  id: flux.id, s: flux.s, u: flux.u, axe: flux.axe, nature: flux.nature, primaire: !!flux.primaire,
  filtre: flux.filtre || '', cnil: !!flux.cnil, decision: !!flux.decision, arxiv: !!flux.arxiv,
  role: flux.role || 'tri', reecrire: flux.reecrire || null, kind: 'flux',
};
const court = (v, n) => (v === undefined || v === null ? v : String(v).substring(0, n));
return $input.all().map((item) => {
  const j = item.json || {};
  if (j.error) return { json: { erreur: court(j.error.message || j.error, 200), _source: source } };
  if (!j.title && !j.link) return { json: { _vide: true, _source: source } };
  return { json: {
    title: court(j.title, 300), link: j.link || j.url || j.id, guid: j.guid,
    isoDate: j.isoDate, pubDate: j.pubDate, date: j.date, published: j.published, updated: j.updated,
    contentSnippet: court(j.contentSnippet, 1500), summary: court(j.summary, 1500), content: court(j.content, 2500),
    _source: source,
  } };
});

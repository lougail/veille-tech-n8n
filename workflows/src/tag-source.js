// Attache les métadonnées du flux à chaque article lu, et allège l'article : seuls les champs utiles
// sont gardés, tronqués. Le texte complet n'est gardé que pour les numéros d'AINews, dont on extrait
// les sujets du jour (normalize.js). Chaque exécution pèse ainsi bien moins lourd dans la base de n8n.
const feed = $('Loop Feeds').first().json;
const meta = { u: feed.u, s: feed.s, c: feed.c, w: feed.w, k: feed.k, a: feed.a || false };
const court = (v, n) => (v === undefined || v === null ? v : String(v).substring(0, n));
return $input.all().map(item => {
  const j = item.json || {};
  if (j.error) return { json: { error: j.error, _feed: meta } };
  const garde = {
    title: j.title, link: j.link, url: j.url, guid: j.guid, comments: j.comments,
    isoDate: j.isoDate, pubDate: j.pubDate, date: j.date, published: j.published, updated: j.updated,
    contentSnippet: court(j.contentSnippet, 800), content: court(j.content, 2000),
    description: court(j.description, 2000), summary: court(j.summary, 800),
    _feed: meta,
  };
  if (feed.s === 'Latent Space' && /^\[AINews\]/i.test(String(j.title || ''))) garde['content:encoded'] = j['content:encoded'];
  return { json: garde };
});

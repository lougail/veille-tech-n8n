// Hacker News par l'API de recherche d'Algolia : les articles les plus votés des dernières
// 48 heures, avec leurs points et leurs commentaires. Remplace la copie de hnrss.org, en panne
// une exécution sur deux en octobre 2026 (erreur 502). Les points servent à la chaleur des
// sujets (cluster.js) et à repérer ce qui monte d'une exécution à l'autre.
const out = [];
for (const it of $input.all()) {
  const j = it.json;
  if (!j || j.error) continue;
  const hits = Array.isArray(j.hits) ? j.hits : (j.objectID ? [j] : []);
  for (const h of hits) {
    if (!h || !h.title || !h.objectID) continue;
    const discussion = 'https://news.ycombinator.com/item?id=' + h.objectID;
    const points = Number(h.points) || 0;
    const commentaires = Number(h.num_comments) || 0;
    const date = h.created_at || (h.created_at_i ? new Date(h.created_at_i * 1000).toISOString() : undefined);
    out.push({ json: {
      title: String(h.title),
      link: h.url || discussion,
      contentSnippet: points + ' points et ' + commentaires + ' commentaires sur Hacker News.',
      isoDate: date,
      _signals: { hnPoints: points, hnComments: commentaires, hnUrl: discussion },
      _feed: { u: 'hn-algolia', s: 'Hacker News', c: 'tendances', w: 1.2, k: 'hn' },
    }});
  }
}
if (!out.length) return [{ json: { _skip: true } }];
return out;

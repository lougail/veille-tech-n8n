// Attache les métadonnées du feed courant à chaque item lu
const feed = $('Loop Feeds').first().json;
return $input.all().map(item => {
  item.json._feed = { u: feed.u, s: feed.s, c: feed.c, w: feed.w, k: feed.k, a: feed.a || false };
  return item;
});

// Apparie la réponse OSV du chunk courant avec ses métadonnées et renvoie
// les paquets vulnérables (les items retournent au SplitInBatches, qui les
// accumule et les ré-émet tous sur sa sortie "done").
const chunkMeta = $('Batch OSV').first().json._chunk || [];
const resp = $input.first().json;
const results = (resp && resp.results) || [];

const out = [];
for (let i = 0; i < chunkMeta.length; i++) {
  const vulns = (results[i] && results[i].vulns) || [];
  if (!vulns.length) continue;
  out.push({ json: {
    pkg: chunkMeta[i],
    vulnIds: vulns.map(v => v.id),
  }});
}
if (!out.length) return [{ json: { _empty: true } }];
return out;

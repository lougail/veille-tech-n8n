// Dedup cross-runs en staticData (TTL 7 jours).
// Remplace le node Remove Duplicates natif : pas de plafond qui crashe (historySize),
// et les clés ne sont persistées QUE si l'exécution réussit (sémantique "vu = traité").
// Les items d'engagement (HN, Lobsters, Reddit) ne sont PAS dédupliqués ici : ils doivent
// pouvoir revenir avec plus de points pour alimenter la détection d'escalade ("ça monte") —
// l'anti-répétition se fait pour eux au niveau du registre de stories (cluster.js).
const sd = $getWorkflowStaticData('global');
if (!sd.seen) sd.seen = {};
const now = Date.now();
const TTL = 7 * 24 * 3600 * 1000;
for (const [k, ts] of Object.entries(sd.seen)) {
  if (now - ts > TTL) delete sd.seen[k];
}

const out = [];
for (const item of $input.all()) {
  const j = item.json;
  if (j._none) { out.push(item); continue; }
  const k = j.canonicalKey;
  if (!k) continue;
  if (j.kind === 'hn' || j.kind === 'reddit') { out.push(item); continue; }
  if (sd.seen[k]) continue;
  sd.seen[k] = now;
  out.push(item);
}

if (!out.length) return [{ json: { _none: true } }];
return out;

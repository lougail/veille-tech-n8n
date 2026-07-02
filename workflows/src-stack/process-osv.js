// Diff des vulnérabilités vs l'historique + gestion du premier run (baseline).
// Sortie : les items de détail à récupérer (≤ maxDetails), avec leur contexte.
const sd = $getWorkflowStaticData('global');
if (!sd.seenVulns) sd.seenVulns = {};
const config = $('Config Stack').first().json.config;
const nowIso = new Date().toISOString();

// vulnId -> contexte paquet(s)
const byVuln = {};
let vulnerablePkgs = 0;
for (const item of $input.all()) {
  const j = item.json;
  if (!j || j._empty || !j.vulnIds) continue;
  vulnerablePkgs++;
  for (const id of j.vulnIds) {
    if (!byVuln[id]) byVuln[id] = [];
    byVuln[id].push(j.pkg);
  }
}

const allIds = Object.keys(byVuln);
const newIds = allIds.filter(id => !sd.seenVulns[id]);
// re-baseline automatique : si la baseline a été établie avec un token limité
// (repos publics seulement) et que le scan couvre maintenant toute l'org
const fullScanUnlocked = sd.osvBaselineLimited && !(sd._stackStats || {}).tokenLimited;
const isBaseline = !sd.osvBaselineDone || fullScanUnlocked;

let toFetch;
if (isBaseline) {
  // Premier run : tout marquer vu, mais auditer les paquets les plus utilisés + les contraintes surveillées
  const watchNames = new Set((config.constraintWatch || []).map(w => `${w.eco}|${w.name}`));
  toFetch = allIds
    .map(id => ({ id, ctx: byVuln[id] }))
    .sort((a, b) => {
      const wa = a.ctx.some(p => watchNames.has(`${p.eco}|${p.name}`)) ? 1 : 0;
      const wb = b.ctx.some(p => watchNames.has(`${p.eco}|${p.name}`)) ? 1 : 0;
      if (wa !== wb) return wb - wa;
      return Math.max(...b.ctx.map(p => p.repos.length)) - Math.max(...a.ctx.map(p => p.repos.length));
    })
    .slice(0, config.maxDetailsPerRun);
  for (const id of allIds) sd.seenVulns[id] = nowIso;
  sd.osvBaselineDone = true;
  sd.osvBaselineLimited = !!(sd._stackStats || {}).tokenLimited;
} else {
  toFetch = newIds.slice(0, config.maxDetailsPerRun).map(id => ({ id, ctx: byVuln[id] }));
  for (const id of newIds) sd.seenVulns[id] = nowIso;
}

sd._stackStats = Object.assign(sd._stackStats || {}, {
  vulnerablePkgs,
  knownVulns: allIds.length,
  newVulns: isBaseline ? 0 : newIds.length,
  baseline: isBaseline,
  detailsFetched: toFetch.length,
});

if (!toFetch.length) return [{ json: { _none: true } }];
return toFetch.map(t => ({ json: { vulnId: t.id, ctx: t.ctx, baseline: isBaseline } }));

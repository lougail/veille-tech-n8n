// Déduplique les dépendances à l'échelle de la plateforme et construit
// les requêtes OSV par lots de 500 (limite querybatch : 1000).
// Lit UNIQUEMENT le cache staticData → tourne même quand aucun repo n'a changé
// (de nouvelles CVE sortent tous les jours sur des dépendances inchangées).
const sd = $getWorkflowStaticData('global');
const manifests = sd.manifests || {};
const ECO = { pypi: 'PyPI', npm: 'npm', pub: 'Pub' };

// clé "eco|name" → { version retenue (la plus BASSE vue = borne pessimiste), repos }
const uniq = {};
for (const [repo, m] of Object.entries(manifests)) {
  for (const [eco, name, ver] of (m.d || [])) {
    if (!ECO[eco] || !name) continue;
    const k = `${eco}|${name}`;
    if (!uniq[k]) uniq[k] = { eco, name, ver: ver || null, repos: [] };
    uniq[k].repos.push(repo);
    if (ver && (!uniq[k].ver || compareVer(ver, uniq[k].ver) < 0)) uniq[k].ver = ver;
  }
}
function compareVer(a, b) {
  const pa = String(a).split(/[.+-]/).map(x => parseInt(x) || 0);
  const pb = String(b).split(/[.+-]/).map(x => parseInt(x) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

const entries = Object.values(uniq).filter(e => e.ver); // sans version connue → pas de requête CVE
sd._stackStats = Object.assign(sd._stackStats || {}, {
  uniqueDeps: Object.keys(uniq).length,
  queriedDeps: entries.length,
  imagesSeen: [...new Set(Object.values(manifests).flatMap(m => m.img || []))].length,
});

if (!entries.length) return [{ json: { _none: true } }];

const CHUNK = 500;
const out = [];
for (let i = 0; i < entries.length; i += CHUNK) {
  const chunk = entries.slice(i, i + CHUNK);
  out.push({ json: {
    queriesJson: JSON.stringify({ queries: chunk.map(e => ({ package: { ecosystem: ECO[e.eco], name: e.name }, version: String(e.ver) })) }),
    _chunk: chunk.map(e => ({ eco: e.eco, name: e.name, ver: e.ver, repos: e.repos.slice(0, 60) })),
  }});
}
return out;

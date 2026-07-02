// Construit la liste des fichiers à récupérer, en sautant les repos inchangés (cache staticData)
const sd = $getWorkflowStaticData('global');
if (!sd.manifests) sd.manifests = {};
const config = $('Config Stack').first().json.config;

// Fusionne les pages de repos (2 nœuds HTTP de pagination)
const repos = [];
for (const item of $input.all()) {
  const j = item.json;
  const arr = Array.isArray(j) ? j : [j];
  for (const r of arr) {
    if (r && r.name && !r.archived) repos.push({ name: r.name, pushed: r.pushed_at });
  }
}

const stats = { totalRepos: repos.length, changedRepos: 0, cachedRepos: 0 };
const plan = [];
for (const r of repos) {
  const cached = sd.manifests[r.name];
  if (cached && cached.p === r.pushed) { stats.cachedRepos++; continue; }
  stats.changedRepos++;
  const paths = config.specialPaths[r.name] || config.defaultPaths;
  for (const p of paths) plan.push({ repo: r.name, path: p, pushed: r.pushed });
}

// Purge du cache : repos disparus/archivés
const names = new Set(repos.map(r => r.name));
for (const k of Object.keys(sd.manifests)) if (!names.has(k)) delete sd.manifests[k];

sd._stackStats = stats;
// Alerte token : si on ne voit presque rien, le PAT n'est pas (encore) approuvé
sd._stackStats.tokenLimited = repos.length < 10;

if (!plan.length) return [{ json: { _none: true } }];
return plan.map(p => ({ json: p }));

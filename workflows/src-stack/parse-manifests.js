// Parse les manifestes récupérés et met à jour le cache par repo.
// Les réponses HTTP sont appariées 1:1 par index avec les items de 'Plan Fetch'
// (le nœud HTTP préserve l'ordre ; neverError garantit un item par requête).
const sd = $getWorkflowStaticData('global');
if (!sd.manifests) sd.manifests = {};

function parseRequirements(txt) {
  const out = [];
  for (const raw of String(txt).split('\n')) {
    const line = raw.split('#')[0].trim();
    if (!line || line.startsWith('-') || line.startsWith('git+') || line.includes('://')) continue;
    const m = /^([A-Za-z0-9_.-]+)(\[[^\]]*\])?\s*(==|>=|~=)?\s*([0-9][A-Za-z0-9._+-]*)?/.exec(line);
    if (!m || !m[1]) continue;
    out.push(['pypi', m[1].toLowerCase(), m[4] || null]);
  }
  return out;
}
function parsePackageJson(txt) {
  const out = [];
  try {
    const j = JSON.parse(txt);
    for (const block of [j.dependencies, j.devDependencies]) {
      if (!block) continue;
      for (const [name, spec] of Object.entries(block)) {
        const s = String(spec);
        if (/^(workspace:|file:|link:|github:|git\+|https?:|npm:)/.test(s)) continue;
        const m = /([0-9]+\.[0-9]+\.[0-9]+[0-9A-Za-z.-]*)/.exec(s);
        out.push(['npm', name, m ? m[1] : null]);
      }
    }
  } catch (e) { /* JSON invalide : ignore */ }
  return out;
}
function parsePubspecYaml(txt) {
  const out = [];
  let inDeps = false;
  let current = null;
  for (const raw of String(txt).split('\n')) {
    if (/^(dependencies|dev_dependencies):\s*$/.test(raw)) { inDeps = true; continue; }
    if (/^[a-z_]+:/i.test(raw)) { inDeps = false; current = null; continue; }
    if (!inDeps) continue;
    const dep = /^  ([a-z0-9_]+):\s*(.*)$/.exec(raw);
    if (dep) {
      current = dep[1];
      const v = /\^?([0-9]+\.[0-9]+\.[0-9]+[0-9A-Za-z.+-]*)/.exec(dep[2] || '');
      if (dep[2] && v) out.push(['pub', current, v[1]]);
      continue;
    }
    if (current && /^\s+(path|git|sdk):/.test(raw)) {
      const i = out.findIndex(d => d[1] === current);
      if (i !== -1) out.splice(i, 1);
      current = null;
    }
  }
  return out;
}
function parsePubspecLock(txt) {
  // versions EXACTES résolues (directes + transitives) — idéal pour OSV
  const out = [];
  let name = null;
  for (const raw of String(txt).split('\n')) {
    const n = /^  ([a-z0-9_]+):\s*$/.exec(raw);
    if (n) { name = n[1]; continue; }
    if (name) {
      const v = /^    version:\s*"([^"]+)"/.exec(raw);
      if (v) { out.push(['pub', name, v[1]]); name = null; }
    }
  }
  return out;
}
function parseDockerfile(txt) {
  const imgs = [];
  for (const m of String(txt).matchAll(/^FROM\s+([^\s]+)/gim)) {
    const img = m[1];
    if (img.includes('$') || img === 'scratch') continue;
    imgs.push(img);
  }
  return imgs;
}

const plans = $('Plan Fetch').all().map(i => i.json);
const responses = $input.all();
const byRepo = {};
let fetched = 0;

for (let i = 0; i < responses.length; i++) {
  const meta = plans[i];
  if (!meta || !meta.repo) continue;
  const r = responses[i].json || {};
  const status = r.statusCode || (r.error ? 0 : 200);
  const body = typeof r.body === 'string' ? r.body : (typeof r.data === 'string' ? r.data : null);
  if (!byRepo[meta.repo]) byRepo[meta.repo] = { p: meta.pushed, d: [], img: [], lockSeen: false };
  if (status !== 200 || !body) continue;
  fetched++;
  const path = meta.path;
  if (path.endsWith('pubspec.lock')) { byRepo[meta.repo].d.push(...parsePubspecLock(body)); byRepo[meta.repo].lockSeen = true; }
  else if (path.endsWith('pubspec.yaml')) { if (!byRepo[meta.repo].lockSeen) byRepo[meta.repo].d.push(...parsePubspecYaml(body)); }
  else if (path.endsWith('requirements.txt')) byRepo[meta.repo].d.push(...parseRequirements(body));
  else if (path.endsWith('package.json')) byRepo[meta.repo].d.push(...parsePackageJson(body));
  else if (path.endsWith('Dockerfile')) byRepo[meta.repo].img.push(...parseDockerfile(body));
}

for (const [repo, data] of Object.entries(byRepo)) {
  sd.manifests[repo] = { p: data.p, d: data.d, img: data.img };
}

sd._stackStats = Object.assign(sd._stackStats || {}, {
  filesFetched: fetched,
  parsedRepos: Object.keys(byRepo).length,
});
return [{ json: { parsedRepos: Object.keys(byRepo).length, filesFetched: fetched } }];

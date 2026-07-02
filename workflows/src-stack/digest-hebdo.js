// Digest hebdo : libérations de contraintes possibles + EOL qui approchent
const sd = $getWorkflowStaticData('global');
if (!sd.lastLatest) sd.lastLatest = {};
const config = $('Config Stack').first().json.config;
const plans = $('Plan Hebdo').all().map(i => i.json);
const responses = $input.all();

const pkgLines = [];
const eolLines = [];

for (let i = 0; i < responses.length; i++) {
  const p = plans[i];
  if (!p) continue;
  const r = responses[i].json || {};
  const body = r.statusCode && r.statusCode !== 200 ? null : (r.body || r);
  if (!body) continue;

  if (p.kind === 'pkg') {
    let latest = null;
    if (p.eco === 'pypi') latest = body.info && body.info.version;
    else if (p.eco === 'npm') latest = body.version;
    else if (p.eco === 'pub') latest = body.latest && body.latest.version;
    if (!latest) continue;
    const key = `${p.eco}|${p.name}`;
    const prev = sd.lastLatest[key];
    const isNew = prev && prev !== latest;
    sd.lastLatest[key] = latest;
    pkgLines.push(`- ${isNew ? '✨ **NOUVELLE RELEASE** ' : ''}\`${p.name}\` (${p.eco}) : dernière version **${latest}**${prev && !isNew ? ' _(inchangé)_' : ''}\n  -# ${p.why}`);
  }

  if (p.kind === 'eol') {
    const cycles = Array.isArray(body) ? body : [];
    const c = cycles.find(x => String(x.cycle) === String(p.cycle));
    if (!c) continue;
    const eol = c.eol;
    if (eol === false) continue;
    if (eol === true) { eolLines.push(`- 🔴 **${p.product} ${p.cycle} : DÉJÀ EOL** — ${p.where}`); continue; }
    const days = Math.round((new Date(eol).getTime() - Date.now()) / 86400000);
    if (days < 0) eolLines.push(`- 🔴 **${p.product} ${p.cycle} : EOL depuis ${eol}** — ${p.where}`);
    else if (days < 90) eolLines.push(`- 🟠 **${p.product} ${p.cycle} : EOL dans ${days} j** (${eol}) — ${p.where}`);
    else if (days < config.eolWarnDays) eolLines.push(`- 🟡 ${p.product} ${p.cycle} : EOL dans ${days} j (${eol}) — ${p.where}`);
  }
}

let digest = '';
if (pkgLines.length) digest += `## 📦 Contraintes surveillées\n${pkgLines.join('\n')}\n\n`;
if (eolLines.length) digest += `## ⏳ Fins de vie\n${eolLines.join('\n')}`;
if (!digest) digest = '_Rien à signaler cette semaine sur les contraintes et EOL._';

return [{ json: { digest: digest.substring(0, 3600) } }];

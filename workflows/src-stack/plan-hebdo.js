// Construit la liste des références à consulter pour le digest hebdo :
// dernières versions des paquets sous contrainte + échéances EOL
const config = $('Config Stack').first().json.config;
const out = [];

for (const w of config.constraintWatch || []) {
  let url = null;
  if (w.eco === 'pypi') url = `https://pypi.org/pypi/${w.name}/json`;
  else if (w.eco === 'npm') url = `https://registry.npmjs.org/${w.name}/latest`;
  else if (w.eco === 'pub') url = `https://pub.dev/api/packages/${w.name}`;
  if (url) out.push({ json: { kind: 'pkg', url, eco: w.eco, name: w.name, why: w.why } });
}
for (const e of config.eolWatch || []) {
  out.push({ json: { kind: 'eol', url: `https://endoflife.date/api/${e.product}.json`, product: e.product, cycle: e.cycle, where: e.where } });
}
return out;

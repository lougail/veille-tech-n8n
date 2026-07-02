// Apparie la fiche OSV avec le contexte du batch courant
const meta = $('Batch Details').first().json;
const r = $input.first().json || {};
const rec = r.statusCode && r.statusCode !== 200 ? null : (r.body || r);

function severityOf(rec) {
  if (!rec) return 'INCONNUE';
  const ds = rec.database_specific;
  if (ds && ds.severity) return String(ds.severity).toUpperCase();
  for (const a of rec.affected || []) {
    const es = a.ecosystem_specific;
    if (es && es.severity) return String(es.severity).toUpperCase();
  }
  const vec = (rec.severity || []).find(s => /^CVSS/.test(s.type || ''));
  if (vec && /\/A:H|\/C:H|\/I:H/.test(vec.score || '')) return 'HIGH?';
  return 'INCONNUE';
}
function fixedVersions(rec) {
  const fixed = new Set();
  for (const a of (rec && rec.affected) || []) {
    for (const rg of a.ranges || []) {
      for (const ev of rg.events || []) if (ev.fixed) fixed.add(ev.fixed);
    }
  }
  return [...fixed].slice(0, 3);
}

return [{ json: {
  vulnId: meta.vulnId,
  ctx: meta.ctx,
  baseline: meta.baseline,
  severity: severityOf(rec),
  summary: rec ? String(rec.summary || rec.details || '').substring(0, 240) : '',
  fixed: rec ? fixedVersions(rec) : [],
  aliases: rec ? (rec.aliases || []).filter(a => a.startsWith('CVE-')).slice(0, 2) : [],
}}];

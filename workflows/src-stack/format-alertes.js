// Construit la liste d'alertes finales à partir des fiches OSV détaillées
const items = $input.all().map(i => i.json).filter(j => j && j.vulnId);
const GRAVE = new Set(['CRITICAL', 'HIGH', 'HIGH?']);

const alerts = [];
for (const v of items) {
  const grave = GRAVE.has(v.severity);
  // hors baseline : on alerte les HIGH/CRITICAL ; en baseline : uniquement CRITICAL (audit initial)
  if (v.baseline ? v.severity !== 'CRITICAL' : !grave) continue;
  for (const pkg of v.ctx || []) {
    alerts.push({
      id: v.vulnId,
      cve: (v.aliases || [])[0] || v.vulnId,
      severity: v.severity,
      eco: pkg.eco,
      name: pkg.name,
      ver: pkg.ver,
      repoCount: (pkg.repos || []).length,
      repos: (pkg.repos || []).slice(0, 8),
      fixed: v.fixed,
      summary: v.summary,
      baseline: !!v.baseline,
    });
  }
}
alerts.sort((a, b) => (b.severity === 'CRITICAL') - (a.severity === 'CRITICAL') || b.repoCount - a.repoCount);
return [{ json: { alerts } }];

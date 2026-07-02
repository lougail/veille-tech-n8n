// GitHub Search API : nouveaux repos (<7 jours) qui explosent en stars
const out = [];
for (const it of $input.all()) {
  const j = it.json;
  if (!j || j.error) continue;
  const repos = Array.isArray(j) ? j : (j.items || []);
  for (const r of repos) {
    if (!r || !r.full_name || (r.stargazers_count || 0) < 200) continue;
    const desc = [r.description, r.language, (r.topics || []).slice(0, 5).join(', ')].filter(Boolean).join(' — ');
    out.push({ json: {
      title: `Nouveau repo GitHub qui décolle : ${r.full_name} (${r.stargazers_count} stars en <7j)`,
      link: r.html_url,
      contentSnippet: desc.substring(0, 400),
      isoDate: new Date().toISOString(),
      _signals: { ghStars: r.stargazers_count || 0 },
      _feed: { u: 'github-new-repos', s: 'GitHub (nouveaux repos)', c: 'tendances', w: 1.0, k: 'ghtrend' }
    }});
  }
}
if (!out.length) return [{ json: { _skip: true } }];
return out.slice(0, 10);

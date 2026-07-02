// Hugging Face Trending Models (API JSON publique) -> alertes "modèle qui monte"
const out = [];
for (const it of $input.all()) {
  let arr = it.json;
  if (!arr || arr.error) continue;
  if (!Array.isArray(arr)) arr = [arr];
  for (const m of arr) {
    if (!m || !m.id || (m.trendingScore || 0) < 150) continue;
    const info = [m.pipeline_tag, m.library_name].filter(Boolean).join(', ');
    out.push({ json: {
      title: 'Modèle en tendance sur Hugging Face : ' + m.id,
      link: 'https://huggingface.co/' + m.id,
      contentSnippet: `trendingScore ${m.trendingScore}, ${m.likes || 0} likes, ${m.downloads || 0} téléchargements. ${info}`,
      isoDate: new Date().toISOString(),
      _signals: { trendingScore: m.trendingScore || 0, likes: m.likes || 0 },
      _feed: { u: 'hf-trending-models', s: 'HF Trending', c: 'ia', w: 1.0, k: 'papers' }
    }});
  }
}
if (!out.length) return [{ json: { _skip: true } }];
return out;

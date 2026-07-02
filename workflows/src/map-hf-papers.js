// Hugging Face Daily Papers (API JSON publique) -> pseudo-articles avec upvotes
const out = [];
for (const it of $input.all()) {
  let arr = it.json;
  if (!arr || arr.error) continue;
  if (!Array.isArray(arr)) arr = [arr];
  for (const j of arr) {
    const p = j && j.paper;
    if (!p || !p.title) continue;
    out.push({ json: {
      title: p.title,
      link: 'https://huggingface.co/papers/' + p.id,
      contentSnippet: (p.ai_summary || p.summary || '').replace(/\s+/g, ' ').substring(0, 500),
      isoDate: j.publishedAt || p.publishedAt || new Date().toISOString(),
      _signals: { hfUpvotes: (p.upvotes || 0), comments: (j.numComments || 0), ghStars: (p.githubStars || 0) },
      _feed: { u: 'hf-daily-papers', s: 'HF Daily Papers', c: 'ia', w: 1.2, k: 'papers' }
    }});
  }
}
if (!out.length) return [{ json: { _skip: true } }];
return out;

// Lobsters hottest.json -> articles avec score communautaire
const out = [];
for (const it of $input.all()) {
  let arr = it.json;
  if (!arr || arr.error) continue;
  if (!Array.isArray(arr)) arr = [arr];
  for (const st of arr) {
    if (!st || !st.title || (st.score || 0) < 10) continue;
    out.push({ json: {
      title: st.title,
      link: st.url || st.short_id_url,
      contentSnippet: 'Tags : ' + (st.tags || []).join(', '),
      isoDate: st.created_at,
      _signals: { lobsters: st.score || 0, comments: st.comment_count || 0, lobstersUrl: st.comments_url },
      _feed: { u: 'lobsters-hottest', s: 'Lobsters', c: 'dev', w: 1.1, k: 'hn' }
    }});
  }
}
if (!out.length) return [{ json: { _skip: true } }];
return out;

// Filtre de publication (score >= 6) + registre persistant des stories
// (anti-répétition 72h, digest du jour, bilan hebdo)
const sd = $getWorkflowStaticData('global');
if (!sd.stories) sd.stories = [];
const nowIso = new Date().toISOString();

const items = $input.all().map(i => i.json).filter(j => !j._none && !j._statusOnly && j.title);
const stats = sd._runStats || {};

if (!items.length) {
  stats.published = 0;
  sd._runStats = stats;
  return [{ json: { _statusOnly: true } }];
}

let fallbacks = 0;
const publish = [];
for (const st of items) {
  if (st._fallback) fallbacks++;
  const posted = st.score >= 6;
  if (!st.isUpdate) {
    sd.stories.push({
      k: (st._tokens || []).join(' '),
      t: st.titre || st.title,
      u: st.url,
      c: st.categorie,
      s: st.score,
      h: st.heat,
      n: st.sourceCount,
      f: nowIso,
      l: nowIso,
      p: posted,
      e: false,
      sm: posted ? (st.resume || '').substring(0, 220) : '',
    });
  }
  if (posted) publish.push(st);
}

publish.sort((a, b) => b.score - a.score);
stats.published = publish.length;
stats.fallbacks = fallbacks;
stats.classified = items.length;
sd._runStats = stats;

if (!publish.length) return [{ json: { _statusOnly: true } }];
return publish.map(s => ({ json: s }));

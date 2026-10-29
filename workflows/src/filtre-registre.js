// Filtre de publication + registre persistant des stories (anti-répétition 72 h, brief, bilan).
// Publiés : les sujets notés 7 ou plus, et ceux notés 6 qui viennent d'un labo ou font du bruit.
// En octobre 2026, le seuil de 6 pour tous publiait environ 75 sujets par jour : trop pour être lu.
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
  const bruit = st.heat >= 3 || !!(st.signals && st.signals.ainews);
  const posted = st.score >= 7 || (st.score >= 6 && (st.labo || bruit));
  if (!st.isUpdate) {
    sd.stories.push({
      k: (st._tokens || []).join(' '),
      t: st.titre || st.title,
      u: st.url,
      c: st.categorie,
      s: st.score,
      h: st.heat,
      n: st.sourceCount,
      lab: !!st.labo,
      ai: !!(st.signals && st.signals.ainews),
      src: st.mainSource || (st.sources && st.sources[0] && st.sources[0].s) || '',
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

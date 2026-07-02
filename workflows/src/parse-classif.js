// Parse la réponse LLM et mappe par id (robuste : fallback règle si échec LLM)
const input = $input.first().json;
const batch = $('Prompt Classification').first().json._stories || [];

function fallback(st) {
  return { json: {
    ...st,
    score: Math.max(3, Math.min(7, Math.round(3 + (st.preScore || 0) / 3))),
    categorie: ['ia', 'dev', 'data', 'cloud', 'securite', 'tendances'].includes(st.cat) ? st.cat : 'tendances',
    titre: st.title,
    resume: (st.snippet || '').substring(0, 200),
    pourquoi: '',
    tags: [],
    type: 'actu',
    hot: st.heat >= 3,
    _fallback: true,
  }};
}

const text = input.text || input.output || '';
if (!text || input.error) return batch.map(fallback);

try {
  let jsonStr = text;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1];
  // isole le premier bloc JSON, que ce soit un OBJET ou un TABLEAU
  // (le modèle renvoie parfois [...] au lieu de {"stories": [...]})
  const iObj = jsonStr.indexOf('{');
  const iArr = jsonStr.indexOf('[');
  const start = (iArr !== -1 && (iObj === -1 || iArr < iObj)) ? iArr : iObj;
  const end = Math.max(jsonStr.lastIndexOf('}'), jsonStr.lastIndexOf(']'));
  if (start !== -1 && end > start) jsonStr = jsonStr.substring(start, end + 1);
  const parsed = JSON.parse(jsonStr);
  const arr = Array.isArray(parsed) ? parsed : (parsed.stories || parsed.articles);
  if (!Array.isArray(arr)) throw new Error('stories manquant');

  const byId = {};
  for (const a of arr) if (a && a.id != null) byId[String(a.id)] = a;

  return batch.map(st => {
    const a = byId[String(st.id)];
    if (!a) return fallback(st);
    return { json: {
      ...st,
      score: Math.max(0, Math.min(10, Math.round(Number(a.score) || 0))),
      categorie: ['ia', 'dev', 'data', 'cloud', 'securite', 'tendances'].includes(a.categorie) ? a.categorie : (st.cat || 'tendances'),
      titre: String(a.titre || st.title).substring(0, 220),
      resume: String(a.resume || st.snippet || '').substring(0, 400),
      pourquoi: String(a.pourquoi || '').substring(0, 250),
      tags: Array.isArray(a.tags) ? a.tags.slice(0, 3).map(String) : [],
      type: ['release', 'recherche', 'outil', 'secu', 'actu', 'analyse'].includes(a.type) ? a.type : 'actu',
      hot: !!a.hot,
    }};
  });
} catch (e) {
  return batch.map(fallback);
}

// Construit le prompt de classification pour un batch de stories
const stories = $input.all().map(i => i.json).filter(j => !j._none);
if (!stories.length) return [];

function signalLine(st) {
  const parts = [`${st.sourceCount} source(s)`];
  const sig = st.signals || {};
  if (sig.hnPoints) parts.push(`HN ${sig.hnPoints} pts / ${sig.hnComments || 0} comm.`);
  if (sig.ainews) parts.push('cité par AINews');
  if (sig.lobsters) parts.push(`Lobsters ${sig.lobsters} pts`);
  if (sig.hfUpvotes) parts.push(`HF ${sig.hfUpvotes} upvotes`);
  if (sig.trendingScore) parts.push(`HF trending ${sig.trendingScore}`);
  if (sig.ghStars) parts.push(`${sig.ghStars} stars GitHub`);
  if (sig.redditRank) parts.push(`top ${sig.redditRank} Reddit du jour`);
  return parts.join(' · ');
}
const NATURE = { lab: 'annonce officielle d\'un labo', radar: 'radar des nouveaux modèles', release: 'notes de version',
  blog: 'blog', newsletter: 'lettre d\'information', news: 'presse', papers: 'recherche', youtube: 'vidéo',
  podcast: 'podcast', buzz: 'AINews, résumé de ce qui fait du bruit', hn: 'forum', reddit: 'forum', ghtrend: 'tendance GitHub' };

const blocks = stories.map(st => {
  const others = st.sources.slice(1, 4).map(s => `${s.s}: "${s.t}"`).join(' | ');
  const natures = [...new Set((st.kinds || []).map(k => NATURE[k] || k))].join(', ');
  return `--- STORY id=${st.id} ---
Titre: ${st.title}
Source principale: ${st.sources[0].s} (catégorie flux: ${st.cat}${natures ? '; nature : ' + natures : ''})
Signaux: ${signalLine(st)}${others ? `\nAutres couvertures: ${others}` : ''}
Extrait: ${st.snippet || 'N/A'}`;
}).join('\n\n');

const prompt = `Tu es l'analyste de veille personnel de Louis : développeur fullstack (JavaScript/TypeScript, Python) qui se spécialise en IA, francophone, et qui héberge lui-même ses outils.

SA PRIORITÉ N° 1 : suivre, jour après jour, tout ce que publient officiellement les grands laboratoires d'IA (OpenAI, Anthropic et Claude, Google et Gemini, Meta, Mistral, xAI, DeepSeek, Qwen, Moonshot, Z.ai, MiniMax, Cohere, Amazon, Microsoft, NVIDIA…) : nouveaux modèles et nouvelles versions, fonctions d'API, prix, retraits, outils (Claude Code, Codex, Gemini CLI…), travaux de recherche marquants.
SA PRIORITÉ N° 2 : savoir au plus vite ce qui fait beaucoup de bruit dans le domaine de l'IA et du développement.

CE QUI L'INTÉRESSE AUSSI :
- Outils de développement assistés par l'IA, agents de code, MCP, frameworks d'agents
- Ingénierie des modèles de langage : évaluation, RAG, fine-tuning, inférence, coûts
- Versions majeures de ses outils : TypeScript, Node, Bun, Python, uv, React, Vite, Docker, PostgreSQL, n8n
- Sécurité, SEULEMENT si elle touche ses outils (Node, npm, Python, PyPI, Docker, n8n, PostgreSQL, macOS, navigateurs, GitHub) ou si une faille est massivement exploitée et que tout le monde en parle
- Open source notable, auto-hébergement, écosystème tech français

CE QUI NE L'INTÉRESSE PAS (notes basses) :
- Études de cas clients, communiqués commerciaux, webinaires, partenariats sans contenu technique
- Failles de logiciels d'entreprise qu'il n'utilise pas (Oracle, SAP, Magento, Fortinet, Ivanti…), sauf exploitation massive dont tout le monde parle
- Levées de fonds et finance, SAUF quand elles concernent un grand labo et font beaucoup de bruit
- Tutoriels basiques, listes, contenu SEO, gadgets grand public, crypto

BARÈME (sois exigeant) :
- 9-10 ÉVÉNEMENT MAJEUR : nouveau modèle de pointe d'un grand labo, rupture dont tout le domaine parle, faille critique exploitée dans un de ses outils
- 7-8 IMPORTANT : publication officielle notable d'un labo (modèle, version, fonction d'API, prix, outil), sujet très discuté, excellente analyse de fond
- 5-6 INTÉRESSANT : bon à savoir, incrémental mais dans son périmètre
- 3-4 FAIBLE : périphérique, redondant, hors profil
- 0-2 BRUIT : marketing, hors sujet

Une publication officielle d'un labo, ou un nouveau modèle repéré par le radar, vaut au moins 5, sauf s'il s'agit d'une étude de cas client ou d'un communiqué commercial.
Les signaux (nombre de sources, points Hacker News, citation dans AINews, votes) mesurent le bruit : un sujet cité par AINews ou très voté sur Hacker News fait parler de lui. Mais un sujet hors périmètre reste hors périmètre.

Analyse les ${stories.length} stories suivantes :

${blocks}

Réponds UNIQUEMENT avec un JSON valide, sans texte autour :
{"stories": [{"id": "<id exact fourni>", "score": 7, "categorie": "ia|dev|data|cloud|securite|tendances", "titre": "titre en français, concis et factuel, qui nomme le labo ou le produit", "resume": "résumé factuel en 2 phrases max, en français", "pourquoi": "1 phrase : ce que ça change concrètement pour Louis", "tags": ["tag1", "tag2"], "type": "release|recherche|outil|secu|actu|analyse", "hot": false}]}
Le champ "hot" est true si le sujet fait beaucoup de bruit ou va en faire. Un objet par story, ids exactement repris.`;

return [{ json: { prompt, _stories: stories } }];

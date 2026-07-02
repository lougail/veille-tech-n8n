// Construit le prompt de classification pour un batch de stories
const stories = $input.all().map(i => i.json).filter(j => !j._none);
if (!stories.length) return [];

function signalLine(st) {
  const parts = [`${st.sourceCount} source(s)`];
  const sig = st.signals || {};
  if (sig.hnPoints) parts.push(`HN ${sig.hnPoints} pts / ${sig.hnComments || 0} comm.`);
  if (sig.lobsters) parts.push(`Lobsters ${sig.lobsters} pts`);
  if (sig.hfUpvotes) parts.push(`HF ${sig.hfUpvotes} upvotes`);
  if (sig.trendingScore) parts.push(`HF trending ${sig.trendingScore}`);
  if (sig.ghStars) parts.push(`${sig.ghStars} stars GitHub`);
  if (sig.redditRank) parts.push(`top ${sig.redditRank} Reddit du jour`);
  return parts.join(' · ');
}

const blocks = stories.map(st => {
  const others = st.sources.slice(1, 4).map(s => `${s.s}: "${s.t}"`).join(' | ');
  return `--- STORY id=${st.id} ---
Titre: ${st.title}
Source principale: ${st.sources[0].s} (catégorie flux: ${st.cat})
Signaux: ${signalLine(st)}${others ? `\nAutres couvertures: ${others}` : ''}
Extrait: ${st.snippet || 'N/A'}`;
}).join('\n\n');

const prompt = `Tu es l'analyste de veille personnel de Louis : développeur fullstack (JavaScript/TypeScript, Python), spécialisation data/IA, francophone, qui self-hoste ses outils.

CE QUI L'INTÉRESSE (scores hauts) :
- Nouveaux modèles IA, benchmarks sérieux, open-weights
- Outils de dev IA : agents de code (Claude Code, Cursor, Codex), MCP, frameworks d'agents
- Releases majeures : langages (TypeScript, Python, Rust), runtimes (Node, Bun, Deno), frameworks (React, Vite), tooling (uv)
- Recherche IA vulgarisable, ingénierie LLM (RAG, fine-tuning, evals, inference, agents)
- Sécurité actionnable pour un dev (CVE sur technos répandues, supply chain)
- Open source notable, self-hosting, écosystème tech français
- Tendances de fond du métier de dev

CE QUI NE L'INTÉRESSE PAS (scores bas) :
- Marketing produit, communiqués creux, webinars, case studies corporate
- Levées de fonds / business sans impact technique concret
- Tutoriels basiques, listicles, contenu SEO, gadgets grand public, crypto spéculatif

BARÈME (sois exigeant, un article correct vaut 5) :
- 9-10 EXCEPTIONNEL : change la pratique du métier ou l'état de l'art ; faille critique à patcher ; release majeure d'un outil clé
- 7-8 IMPORTANT : release notable, outil prometteur, paper marquant, excellente analyse de fond
- 5-6 INTÉRESSANT : bon à savoir, incrémental mais pertinent
- 3-4 FAIBLE : périphérique, redondant, hors profil
- 0-2 BRUIT : marketing, hors sujet, clickbait

Les signaux fournis (nombre de sources, points HN, upvotes, stars) indiquent l'ampleur du buzz : une forte couverture multi-sources est un vrai indicateur d'importance, mais un sujet hors périmètre dev/IA reste hors périmètre.

Analyse les ${stories.length} stories suivantes :

${blocks}

Réponds UNIQUEMENT avec un JSON valide, sans texte autour :
{"stories": [{"id": "<id exact fourni>", "score": 7, "categorie": "ia|dev|data|cloud|securite|tendances", "titre": "titre en français, concis et factuel", "resume": "résumé factuel en 2 phrases max, en français", "pourquoi": "1 phrase : pourquoi ça compte pour un dev IA", "tags": ["tag1", "tag2"], "type": "release|recherche|outil|secu|actu|analyse", "hot": false}]}
Le champ "hot" est true si le sujet buzz ou va buzzer. Un objet par story, ids exactement repris.`;

return [{ json: { prompt, _stories: stories } }];

// Sources de la veille — refonte du 28 octobre 2026.
// Chaque adresse a été testée ce jour-là (code de réponse, nombre d'éléments, date du plus récent) ;
// les mesures sont dans docs/veille-v3.md.
// u: adresse | s: source | c: catégorie (ia|dev|data|cloud|securite|tendances|fr)
// w: poids éditorial (0.7-1.5) | a: toujours examinée par le modèle, quel que soit le pré-classement
// k: nature — lab (publication officielle d'un labo), release (notes de version), blog, newsletter,
//    news (presse), buzz (résumé de ce qui fait du bruit), reddit, youtube, podcast, ghtrend, papers.
// Les radars des nouveaux modèles (OpenRouter, Hugging Face) et Hacker News sont des API à part,
// dans build_v2.py. AINews arrive par le flux de Latent Space (normalize.js).
const FEEDS = [
  // ---- Labos : les publications officielles ----
  { u: 'https://openai.com/news/rss.xml', s: 'OpenAI', c: 'ia', w: 1.4, k: 'lab', a: true },
  { u: 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_openai_developer.xml', s: 'OpenAI Developers', c: 'ia', w: 1.3, k: 'lab', a: true },
  { u: 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_news.xml', s: 'Anthropic', c: 'ia', w: 1.4, k: 'lab', a: true },
  { u: 'https://platform.claude.com/docs/en/release-notes/feed.xml', s: 'Claude Platform (notes de version)', c: 'ia', w: 1.4, k: 'lab', a: true },
  { u: 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_research.xml', s: 'Anthropic Research', c: 'ia', w: 1.3, k: 'lab' },
  { u: 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_engineering.xml', s: 'Anthropic Engineering', c: 'ia', w: 1.3, k: 'lab' },
  { u: 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_claude.xml', s: 'Claude Blog', c: 'ia', w: 1.0, k: 'lab' },
  { u: 'https://blog.google/innovation-and-ai/technology/ai/rss/', s: 'Google AI', c: 'ia', w: 1.2, k: 'lab', a: true },
  { u: 'https://deepmind.google/blog/rss.xml', s: 'Google DeepMind', c: 'ia', w: 1.3, k: 'lab', a: true },
  { u: 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_google_ai.xml', s: 'Google Developers (IA)', c: 'ia', w: 1.2, k: 'lab' },
  { u: 'https://blog.google/innovation-and-ai/technology/developers-tools/rss/', s: 'Google Developer tools', c: 'ia', w: 1.1, k: 'lab' },
  { u: 'https://blog.google/products-and-platforms/products/gemini/rss/', s: 'Gemini (Google)', c: 'ia', w: 0.9, k: 'lab' },
  { u: 'https://mistral.ai/news/rss', s: 'Mistral AI', c: 'ia', w: 1.3, k: 'lab', a: true },
  { u: 'https://about.fb.com/news/tag/ai/feed/', s: 'Meta (IA)', c: 'ia', w: 1.2, k: 'lab', a: true },
  { u: 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_meta_ai.xml', s: 'Meta AI (blog)', c: 'ia', w: 1.0, k: 'lab' },
  // xAI n'a pas de flux officiel ; ce miroir ne se met plus à jour depuis le 10 octobre 2026.
  // Ses modèles restent couverts par le radar OpenRouter.
  { u: 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_xainews.xml', s: 'xAI', c: 'ia', w: 1.0, k: 'lab' },
  { u: 'https://docs.cohere.com/changelog.rss', s: 'Cohere (notes de version)', c: 'ia', w: 1.0, k: 'lab' },
  { u: 'https://docs.z.ai/release-notes/new-released/rss.xml', s: 'Z.ai (GLM)', c: 'ia', w: 1.1, k: 'lab' },
  { u: 'https://allenai.org/rss.xml', s: 'Ai2', c: 'ia', w: 1.0, k: 'lab' },
  { u: 'https://machinelearning.apple.com/rss.xml', s: 'Apple (recherche)', c: 'ia', w: 0.9, k: 'lab' },
  { u: 'https://developer.nvidia.com/blog/tag/nemotron/feed/', s: 'NVIDIA Nemotron', c: 'ia', w: 1.0, k: 'lab' },
  { u: 'https://huggingface.co/blog/feed.xml', s: 'Hugging Face', c: 'ia', w: 1.1, k: 'lab' },
  // ---- Outils de code assistés par l'IA : notes de version ----
  { u: 'https://github.com/anthropics/claude-code/releases.atom', s: 'Claude Code', c: 'dev', w: 1.2, k: 'release' },
  { u: 'https://github.com/openai/codex/releases.atom', s: 'OpenAI Codex', c: 'dev', w: 1.0, k: 'release' },
  { u: 'https://cursor.com/changelog/rss.xml', s: 'Cursor', c: 'dev', w: 1.1, k: 'release' },
  { u: 'https://github.com/ollama/ollama/releases.atom', s: 'Ollama', c: 'ia', w: 0.9, k: 'release' },
  // ---- Ce qui fait du bruit ----
  // Latent Space publie aussi AINews, le résumé quotidien de X et de Reddit (normalize.js).
  { u: 'https://latent.space/feed', s: 'Latent Space', c: 'ia', w: 1.2, k: 'newsletter', a: true },
  // 15 titres sur environ 7 heures : on y garde le lien de l'article d'origine (normalize.js).
  { u: 'https://www.techmeme.com/feed.xml', s: 'Techmeme', c: 'tendances', w: 1.2, k: 'news' },
  { u: 'https://the-decoder.com/feed/', s: 'The Decoder', c: 'ia', w: 1.0, k: 'news' },
  // Fuites et fonctions en préparation chez les labos ; près de la moitié des articles signés par un agent IA.
  { u: 'https://www.testingcatalog.com/rss/', s: 'TestingCatalog', c: 'ia', w: 0.8, k: 'news' },
  // Une seule requête Reddit par exécution : Reddit n'en accepte qu'une par minute.
  { u: 'https://www.reddit.com/r/LocalLLaMA+ClaudeAI+singularity+OpenAI+MachineLearning/top/.rss?t=day&limit=50', s: 'Reddit IA', c: 'ia', w: 1.0, k: 'reddit' },
  { u: 'https://mshibanami.github.io/GitHubTrendingRSS/daily/all.xml', s: 'GitHub Trending', c: 'tendances', w: 0.9, k: 'ghtrend' },
  // ---- Les personnes ----
  { u: 'https://simonwillison.net/atom/everything/', s: 'Simon Willison', c: 'ia', w: 1.3, k: 'blog', a: true },
  { u: 'https://thezvi.substack.com/feed', s: 'Zvi Mowshowitz', c: 'ia', w: 1.0, k: 'newsletter' },
  { u: 'https://www.oneusefulthing.org/feed', s: 'Ethan Mollick', c: 'ia', w: 1.0, k: 'newsletter' },
  { u: 'https://www.interconnects.ai/feed', s: 'Interconnects', c: 'ia', w: 1.2, k: 'newsletter' },
  { u: 'https://importai.substack.com/feed', s: 'Import AI', c: 'ia', w: 1.1, k: 'newsletter' },
  { u: 'https://magazine.sebastianraschka.com/feed', s: 'Ahead of AI', c: 'ia', w: 1.1, k: 'newsletter' },
  { u: 'https://www.seangoedecke.com/rss.xml', s: 'Sean Goedecke', c: 'dev', w: 0.9, k: 'blog' },
  { u: 'https://lucumr.pocoo.org/feed.atom', s: 'Armin Ronacher', c: 'dev', w: 1.0, k: 'blog' },
  { u: 'https://ghuntley.com/rss/', s: 'Geoffrey Huntley', c: 'dev', w: 0.8, k: 'blog' },
  { u: 'https://lilianweng.github.io/index.xml', s: 'Lil\'Log', c: 'ia', w: 1.1, k: 'blog' },
  { u: 'https://eugeneyan.com/rss/', s: 'Eugene Yan', c: 'ia', w: 1.0, k: 'blog' },
  { u: 'https://hamel.dev/index.xml', s: 'Hamel Husain', c: 'ia', w: 1.0, k: 'blog' },
  { u: 'https://karpathy.bearblog.dev/feed/?type=rss', s: 'Andrej Karpathy', c: 'ia', w: 1.4, k: 'blog' },
  { u: 'https://www.dwarkesh.com/feed', s: 'Dwarkesh Podcast', c: 'ia', w: 1.0, k: 'podcast' },
  { u: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCNJ1Ymd5yFuUPtn21xtRbbw', s: 'AI Explained', c: 'ia', w: 1.0, k: 'youtube' },
  // ---- Développement ----
  { u: 'https://feed.infoq.com/', s: 'InfoQ', c: 'dev', w: 0.9, k: 'news' },
  { u: 'https://newsletter.pragmaticengineer.com/feed', s: 'Pragmatic Engineer', c: 'dev', w: 1.1, k: 'newsletter' },
  { u: 'https://github.blog/feed/', s: 'GitHub Blog', c: 'dev', w: 1.0, k: 'blog' },
  { u: 'https://javascriptweekly.com/rss/', s: 'JavaScript Weekly', c: 'dev', w: 1.0, k: 'newsletter' },
  { u: 'https://nodeweekly.com/rss/', s: 'Node Weekly', c: 'dev', w: 0.9, k: 'newsletter' },
  { u: 'https://thisweekinreact.com/newsletter/rss.xml', s: 'This Week in React', c: 'dev', w: 1.0, k: 'newsletter' },
  { u: 'https://pycoders.com/feed', s: 'Pycoder\'s Weekly', c: 'dev', w: 1.0, k: 'newsletter' },
  { u: 'https://nodejs.org/en/feed/blog.xml', s: 'Node.js', c: 'dev', w: 1.0, k: 'blog' },
  { u: 'https://bun.com/rss.xml', s: 'Bun', c: 'dev', w: 0.9, k: 'blog' },
  { u: 'https://deno.com/feed', s: 'Deno', c: 'dev', w: 0.8, k: 'blog' },
  { u: 'https://code.visualstudio.com/feed.xml', s: 'VS Code', c: 'dev', w: 0.9, k: 'blog' },
  { u: 'https://blog.rust-lang.org/feed.xml', s: 'Rust Blog', c: 'dev', w: 0.8, k: 'blog' },
  { u: 'https://developer.chrome.com/static/blog/feed.xml', s: 'Chrome for Developers', c: 'dev', w: 0.8, k: 'blog' },
  { u: 'https://github.com/microsoft/TypeScript/releases.atom', s: 'TypeScript', c: 'dev', w: 1.0, k: 'release' },
  { u: 'https://github.com/python/cpython/releases.atom', s: 'CPython', c: 'dev', w: 0.9, k: 'release' },
  { u: 'https://github.com/facebook/react/releases.atom', s: 'React', c: 'dev', w: 1.0, k: 'release' },
  { u: 'https://github.com/vitejs/vite/releases.atom', s: 'Vite', c: 'dev', w: 0.8, k: 'release' },
  { u: 'https://github.com/astral-sh/uv/releases.atom', s: 'uv (Astral)', c: 'dev', w: 0.9, k: 'release' },
  // ---- Cloud et infrastructure ----
  { u: 'https://blog.cloudflare.com/rss/', s: 'Cloudflare', c: 'cloud', w: 1.0, k: 'blog' },
  { u: 'https://vercel.com/atom', s: 'Vercel', c: 'cloud', w: 0.9, k: 'blog' },
  { u: 'https://www.docker.com/feed/', s: 'Docker', c: 'cloud', w: 0.9, k: 'blog' },
  { u: 'https://kubernetes.io/feed.xml', s: 'Kubernetes', c: 'cloud', w: 0.7, k: 'blog' },
  { u: 'https://aws.amazon.com/about-aws/whats-new/recent/feed/', s: 'AWS', c: 'cloud', w: 0.6, k: 'news' },
  { u: 'https://docs.cloud.google.com/feeds/gcp-release-notes.xml', s: 'GCP', c: 'cloud', w: 0.6, k: 'news' },
  // ---- Sécurité ----
  { u: 'https://www.cert.ssi.gouv.fr/alerte/feed/', s: 'CERT-FR Alertes', c: 'securite', w: 1.5, k: 'news', a: true },
  { u: 'https://www.cert.ssi.gouv.fr/avis/feed/', s: 'CERT-FR Avis', c: 'securite', w: 0.9, k: 'news' },
  { u: 'https://feeds.feedburner.com/TheHackersNews', s: 'The Hacker News', c: 'securite', w: 0.8, k: 'news' },
  { u: 'https://www.bleepingcomputer.com/feed/', s: 'BleepingComputer', c: 'securite', w: 0.9, k: 'news' },
  { u: 'https://krebsonsecurity.com/feed/', s: 'Krebs on Security', c: 'securite', w: 1.0, k: 'blog' },
  // ---- Data ----
  { u: 'https://www.dataengineeringweekly.com/feed', s: 'Data Eng Weekly', c: 'data', w: 1.0, k: 'newsletter' },
  // ---- En français ----
  { u: 'https://next.ink/feed/', s: 'Next.ink', c: 'fr', w: 0.9, k: 'news' },
];
// Retirées le 28 octobre 2026 : AINews (smol.ai), figé depuis le 9 septembre, l'édition ayant rejoint
// Latent Space ; Hacker News par hnrss.org, en panne (remplacé par l'API d'Algolia) ; r/LocalLLaMA seul
// (remplacé par le flux Reddit groupé) ; Numerama, Ars Technica, TLDR Tech, Fireship, ThePrimeTime,
// Theo, bycloud, Karpathy sur YouTube (beaucoup lu, presque rien retenu, ou muets) ; Azure, HashiCorp,
// Databricks, dbt, JetBrains AI (peu pertinents) ; la copie des actualités de xAI reste, faute de mieux.
// Retiré le 19 novembre 2026 : Baidu ERNIE, dont le blog n'a plus de flux (404 à chaque lecture depuis au moins le
// 11 novembre) ; ses modèles restent suivis par les radars Hugging Face et OpenRouter.
return FEEDS.map(f => ({ json: f }));

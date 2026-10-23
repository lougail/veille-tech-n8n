// Sources RSS v2 — 72 feeds curés (audit de santé du 2026-07-02, URLs finales post-redirect ;
// r/MachineLearning retiré le 2026-10-23 : Reddit renvoie une page HTML au lieu du flux, 14 échecs sur 14)
// u: url | s: source | c: catégorie (ia|dev|data|cloud|securite|tendances|fr)
// w: poids éditorial (0.7-1.5) | k: kind (blog|news|newsletter|release|youtube|podcast|hn|reddit|ghtrend|papers)
// a: alwaysConsider (passe le pré-ranking quoi qu'il arrive)
const FEEDS = [
  // ---- IA : labs ----
  { u: 'https://openai.com/news/rss.xml', s: 'OpenAI', c: 'ia', w: 1.3, k: 'blog' },
  { u: 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_news.xml', s: 'Anthropic', c: 'ia', w: 1.4, k: 'blog' },
  { u: 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_engineering.xml', s: 'Anthropic Engineering', c: 'ia', w: 1.4, k: 'blog' },
  { u: 'https://blog.google/technology/ai/rss/', s: 'Google AI', c: 'ia', w: 1.1, k: 'blog' },
  { u: 'https://deepmind.google/blog/rss.xml', s: 'DeepMind', c: 'ia', w: 1.2, k: 'blog' },
  { u: 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_meta_ai.xml', s: 'Meta AI', c: 'ia', w: 1.1, k: 'blog' },
  { u: 'https://mistral.ai/rss.xml', s: 'Mistral AI', c: 'ia', w: 1.3, k: 'blog' },
  { u: 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_xainews.xml', s: 'xAI', c: 'ia', w: 1.0, k: 'blog' },
  { u: 'https://huggingface.co/blog/feed.xml', s: 'Hugging Face', c: 'ia', w: 1.1, k: 'blog' },
  // ---- IA : curation, newsletters, blogs ----
  { u: 'https://news.smol.ai/rss.xml', s: 'AINews (smol.ai)', c: 'ia', w: 1.2, k: 'newsletter' },
  { u: 'https://www.reddit.com/r/LocalLLaMA/top/.rss?t=day', s: 'r/LocalLLaMA', c: 'ia', w: 1.0, k: 'reddit' },
  { u: 'https://www.latent.space/feed', s: 'Latent Space', c: 'ia', w: 1.1, k: 'newsletter' },
  { u: 'https://www.interconnects.ai/feed', s: 'Interconnects', c: 'ia', w: 1.2, k: 'newsletter' },
  { u: 'https://importai.substack.com/feed', s: 'Import AI', c: 'ia', w: 1.1, k: 'newsletter' },
  { u: 'https://magazine.sebastianraschka.com/feed', s: 'Ahead of AI', c: 'ia', w: 1.1, k: 'newsletter' },
  { u: 'https://simonwillison.net/atom/everything/', s: 'Simon Willison', c: 'ia', w: 1.3, k: 'blog' },
  { u: 'https://lilianweng.github.io/index.xml', s: 'Lil\'Log', c: 'ia', w: 1.2, k: 'blog' },
  { u: 'https://eugeneyan.com/rss/', s: 'Eugene Yan', c: 'ia', w: 1.0, k: 'blog' },
  { u: 'https://hamel.dev/index.xml', s: 'Hamel Husain', c: 'ia', w: 1.0, k: 'blog' },
  { u: 'https://karpathy.bearblog.dev/feed/?type=rss', s: 'Andrej Karpathy', c: 'ia', w: 1.4, k: 'blog' },
  // ---- IA : vidéo / podcast ----
  { u: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCNJ1Ymd5yFuUPtn21xtRbbw', s: 'AI Explained', c: 'ia', w: 1.1, k: 'youtube' },
  { u: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCgfe2ooZD3VJPB6aJAnuQng', s: 'bycloud', c: 'ia', w: 0.9, k: 'youtube' },
  { u: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCXUPKJO5MZQN11PqgIvyuvQ', s: 'Karpathy (YouTube)', c: 'ia', w: 1.3, k: 'youtube' },
  { u: 'https://www.dwarkesh.com/feed', s: 'Dwarkesh Podcast', c: 'ia', w: 1.0, k: 'podcast' },
  // ---- Tendances : agrégateurs à signaux ----
  { u: 'https://hnrss.org/newest?points=150&count=100', s: 'Hacker News', c: 'tendances', w: 1.2, k: 'hn' },
  { u: 'https://mshibanami.github.io/GitHubTrendingRSS/daily/all.xml', s: 'GitHub Trending', c: 'tendances', w: 1.0, k: 'ghtrend' },
  // ---- Dev : news / agrégateurs ----
  { u: 'https://feed.infoq.com/', s: 'InfoQ', c: 'dev', w: 0.9, k: 'news' },
  { u: 'https://newsletter.pragmaticengineer.com/feed', s: 'Pragmatic Engineer', c: 'dev', w: 1.1, k: 'newsletter' },
  { u: 'https://tldr.tech/api/rss/tech', s: 'TLDR Tech', c: 'tendances', w: 0.9, k: 'newsletter' },
  { u: 'https://github.blog/feed/', s: 'GitHub Blog', c: 'dev', w: 1.0, k: 'blog' },
  // ---- Dev : newsletters hebdo ----
  { u: 'https://javascriptweekly.com/rss/', s: 'JavaScript Weekly', c: 'dev', w: 1.0, k: 'newsletter' },
  { u: 'https://nodeweekly.com/rss/', s: 'Node Weekly', c: 'dev', w: 0.9, k: 'newsletter' },
  { u: 'https://thisweekinreact.com/newsletter/rss.xml', s: 'This Week in React', c: 'dev', w: 1.0, k: 'newsletter' },
  { u: 'https://pycoders.com/feed', s: 'Pycoder\'s Weekly', c: 'dev', w: 1.0, k: 'newsletter' },
  // ---- Dev : blogs officiels ----
  { u: 'https://blog.rust-lang.org/feed.xml', s: 'Rust Blog', c: 'dev', w: 0.9, k: 'blog' },
  { u: 'https://developer.chrome.com/static/blog/feed.xml', s: 'Chrome for Developers', c: 'dev', w: 0.9, k: 'blog' },
  { u: 'https://nodejs.org/en/feed/blog.xml', s: 'Node.js', c: 'dev', w: 1.1, k: 'blog' },
  { u: 'https://deno.com/feed', s: 'Deno', c: 'dev', w: 0.9, k: 'blog' },
  { u: 'https://bun.com/rss.xml', s: 'Bun', c: 'dev', w: 1.0, k: 'blog' },
  { u: 'https://code.visualstudio.com/feed.xml', s: 'VS Code', c: 'dev', w: 1.0, k: 'blog' },
  { u: 'https://blog.jetbrains.com/ai/feed/', s: 'JetBrains AI', c: 'dev', w: 0.8, k: 'blog' },
  // ---- Dev-IA : outils & releases ----
  { u: 'https://cursor.com/changelog/rss.xml', s: 'Cursor', c: 'dev', w: 1.1, k: 'release' },
  { u: 'https://github.com/anthropics/claude-code/releases.atom', s: 'Claude Code', c: 'dev', w: 1.2, k: 'release' },
  { u: 'https://github.com/openai/codex/releases.atom', s: 'OpenAI Codex', c: 'dev', w: 1.0, k: 'release' },
  { u: 'https://github.com/ollama/ollama/releases.atom', s: 'Ollama', c: 'ia', w: 1.0, k: 'release' },
  { u: 'https://github.com/microsoft/TypeScript/releases.atom', s: 'TypeScript', c: 'dev', w: 1.1, k: 'release' },
  { u: 'https://github.com/python/cpython/releases.atom', s: 'CPython', c: 'dev', w: 1.0, k: 'release' },
  { u: 'https://github.com/facebook/react/releases.atom', s: 'React', c: 'dev', w: 1.1, k: 'release' },
  { u: 'https://github.com/vitejs/vite/releases.atom', s: 'Vite', c: 'dev', w: 0.9, k: 'release' },
  { u: 'https://github.com/astral-sh/uv/releases.atom', s: 'uv (Astral)', c: 'dev', w: 1.0, k: 'release' },
  // ---- Cloud / DevOps ----
  { u: 'https://aws.amazon.com/about-aws/whats-new/recent/feed/', s: 'AWS', c: 'cloud', w: 0.7, k: 'news' },
  { u: 'https://docs.cloud.google.com/feeds/gcp-release-notes.xml', s: 'GCP', c: 'cloud', w: 0.7, k: 'news' },
  { u: 'https://www.microsoft.com/releasecommunications/api/v2/azure/rss', s: 'Azure', c: 'cloud', w: 0.7, k: 'news' },
  { u: 'https://blog.cloudflare.com/rss/', s: 'Cloudflare', c: 'cloud', w: 1.1, k: 'blog' },
  { u: 'https://vercel.com/atom', s: 'Vercel', c: 'cloud', w: 1.0, k: 'blog' },
  { u: 'https://www.docker.com/feed/', s: 'Docker', c: 'cloud', w: 0.9, k: 'blog' },
  { u: 'https://kubernetes.io/feed.xml', s: 'Kubernetes', c: 'cloud', w: 0.8, k: 'blog' },
  { u: 'https://www.hashicorp.com/blog/feed.xml', s: 'HashiCorp', c: 'cloud', w: 0.7, k: 'blog' },
  // ---- Sécurité ----
  { u: 'https://www.cert.ssi.gouv.fr/alerte/feed/', s: 'CERT-FR Alertes', c: 'securite', w: 1.5, k: 'news', a: true },
  { u: 'https://www.cert.ssi.gouv.fr/avis/feed/', s: 'CERT-FR Avis', c: 'securite', w: 1.0, k: 'news' },
  { u: 'https://feeds.feedburner.com/TheHackersNews', s: 'The Hacker News', c: 'securite', w: 1.0, k: 'news' },
  { u: 'https://www.bleepingcomputer.com/feed/', s: 'BleepingComputer', c: 'securite', w: 1.0, k: 'news' },
  { u: 'https://krebsonsecurity.com/feed/', s: 'Krebs on Security', c: 'securite', w: 1.0, k: 'blog' },
  // ---- Data ----
  { u: 'https://www.databricks.com/feed', s: 'Databricks', c: 'data', w: 0.7, k: 'blog' },
  { u: 'https://www.getdbt.com/blog/feed.xml', s: 'dbt', c: 'data', w: 0.7, k: 'blog' },
  { u: 'https://www.dataengineeringweekly.com/feed', s: 'Data Eng Weekly', c: 'data', w: 1.0, k: 'newsletter' },
  // ---- Tendances / FR ----
  { u: 'https://feeds.arstechnica.com/arstechnica/index', s: 'Ars Technica', c: 'tendances', w: 0.8, k: 'news' },
  { u: 'https://next.ink/feed/', s: 'Next.ink', c: 'fr', w: 0.9, k: 'news' },
  { u: 'https://www.numerama.com/feed/', s: 'Numerama', c: 'fr', w: 0.8, k: 'news' },
  // ---- YouTube dev ----
  { u: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA', s: 'Fireship', c: 'tendances', w: 1.0, k: 'youtube' },
  { u: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCUyeluBRhGPCW4rPe_UvBZQ', s: 'ThePrimeTime', c: 'tendances', w: 0.8, k: 'youtube' },
  { u: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCbRP3c757lWg9M-U7TyEkXA', s: 'Theo (t3.gg)', c: 'tendances', w: 0.8, k: 'youtube' },
];
return FEEDS.map(f => ({ json: f }));

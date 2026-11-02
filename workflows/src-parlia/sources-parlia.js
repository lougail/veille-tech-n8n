// Les sources de la veille ParlIA lues par flux RSS ou Atom, d'après le rapport des sources du 29 octobre 2026
// (sources.md, section 4.1 : les sources « à retenir »). Les pages sans flux, le catalogue d'OpenRouter, la fiche
// data.gouv.fr et les comptes Hugging Face sont lus par collecte-pages-api.js ; le Journal officiel, par
// jorf-parlia.js. Ce nœud ne renvoie rien quand la collecte n'est pas due : la branche s'arrête là.
// id : repère du rapport · s : nom · u : adresse finale (après redirection) · axe : l'axe du thème
// nature : editeur | institution | auteurs | praticien | agregateur · primaire : la source produit l'information
// filtre : mots exigés dans le titre ou l'extrait, sinon l'article est écarté avant le tri
// cnil : la règle « toujours un texte de la CNIL ou du CEPD » · decision : source des modèles de décision
// arxiv : prépublication (au plus 3 candidats par semaine) · role : 'detecteur' = jamais trié (remaniement)
// reecrire : [ancien hôte, nouvel hôte] pour les liens cassés de data.senat.fr
if (!$('Que faire ?').first().json.collecte) return [];
const IA_UE = '\\b(ai|a\\.i\\.|artificial intelligence|ai act|ai office|general-purpose|gpai|llms?|language models?|automated decision\\w*|algorithm\\w*)\\b';
const ARXIV = 'https://export.arxiv.org/api/query?search_query=';
const FLUX = [
  // ---- Fournisseurs et coûts ----
  { id: 'A01', s: "OpenRouter, journal de l'API", u: 'https://openrouter.ai/docs/changelog/rss.xml', axe: 'fournisseurs', nature: 'editeur', primaire: true },
  { id: 'A03', s: 'OpenAI, actualités', u: 'https://openai.com/news/rss.xml', axe: 'fournisseurs', nature: 'editeur', primaire: true,
    filtre: '\\b(api|pricing|prices?|deprecat\\w*|retir\\w*|decisions?|gpt-[\\w.]+|luna|terra|batch|developers?|residency|europe|eu|classif\\w*)\\b' },
  { id: 'A04', s: 'Anthropic, notes de version', u: 'https://platform.claude.com/docs/en/release-notes/feed.xml', axe: 'fournisseurs', nature: 'editeur', primaire: true },
  { id: 'A05', s: 'Mistral AI, actualités', u: 'https://mistral.ai/news/rss', axe: 'fournisseurs', nature: 'editeur', primaire: true },
  { id: 'F15', s: 'Google, blog « Developer tools »', u: 'https://blog.google/innovation-and-ai/technology/developers-tools/rss/', axe: 'fournisseurs', nature: 'editeur', primaire: true },
  { id: 'A07', s: 'Simon Willison, étiquette « llms »', u: 'https://simonwillison.net/tags/llms.atom', axe: 'fournisseurs', nature: 'praticien', primaire: false,
    filtre: '(pric\\w*|cost|cheap|classif\\w*|eval\\w*|structured|decision|deprecat\\w*|retir\\w*|batch|logprob\\w*|calibrat\\w*)' },
  // ---- Modèles de décision ----
  { id: 'X01', s: 'Cloudflare, journal de Workers AI', u: 'https://developers.cloudflare.com/changelog/rss/workers-ai.xml', axe: 'fournisseurs', nature: 'editeur', primaire: true, decision: true },
  { id: 'R2', s: 'arXiv : modèles de décision et calibration', axe: 'qualite', nature: 'auteurs', primaire: true, arxiv: true,
    u: ARXIV + 'ti:%22decision+model%22+OR+ti:%22decision+models%22+OR+ti:jev+OR+ti:%22system+one%22+OR+%28ti:calibration+AND+%28ti:LLM+OR+ti:LLMs+OR+ti:classification+OR+ti:classifiers%29%29&sortBy=submittedDate&sortOrder=descending&max_results=50' },
  // ---- Qualité de l'étiquetage ----
  { id: 'R1', s: 'arXiv : étiquetage par modèle de langage', axe: 'qualite', nature: 'auteurs', primaire: true, arxiv: true,
    u: ARXIV + '%28ti:annotation+OR+ti:annotator+OR+ti:annotators+OR+ti:labeling+OR+ti:labelling+OR+ti:labels%29+AND+%28abs:LLM+OR+abs:LLMs+OR+abs:%22language+model%22+OR+abs:%22language+models%22%29&sortBy=submittedDate&sortOrder=descending&max_results=50' },
  { id: 'R3', s: 'arXiv : textes parlementaires ou administratifs', axe: 'qualite', nature: 'auteurs', primaire: true, arxiv: true,
    u: ARXIV + '%28abs:parliamentary+OR+abs:%22written+questions%22+OR+abs:%22policy+topics%22+OR+abs:%22comparative+agendas%22+OR+abs:%22public+administration%22%29+AND+%28abs:classification+OR+abs:annotation+OR+abs:labeling%29&sortBy=submittedDate&sortOrder=descending&max_results=50' },
  { id: 'A14', s: 'Hamel Husain', u: 'https://hamel.dev/index.xml', axe: 'qualite', nature: 'praticien', primaire: true },
  { id: 'A13', s: 'Hugging Face, blog', u: 'https://huggingface.co/blog/feed.xml', axe: 'qualite', nature: 'editeur', primaire: true,
    filtre: '(eval\\w*|annotat\\w*|label\\w*|classif\\w*|calibrat\\w*|judge|benchmark|decision|argilla|setfit|zero-shot)' },
  // ---- Conformité ----
  { id: 'A08', s: 'CNIL, actualités', u: 'https://www.cnil.fr/fr/rss.xml', axe: 'conformite', nature: 'institution', primaire: true, cnil: true },
  { id: 'A09', s: 'CEPD, actualités', u: 'https://www.edpb.europa.eu/feed/news_en', axe: 'conformite', nature: 'institution', primaire: true, cnil: true },
  { id: 'A10', s: 'Commission européenne, numérique', u: 'https://digital-strategy.ec.europa.eu/en/rss.xml', axe: 'conformite', nature: 'institution', primaire: true, filtre: IA_UE },
  { id: 'Z01', s: 'Sénat, dossier de la loi DDADUE', u: 'https://www.senat.fr/dossier-legislatif/rss/doslegpjl25-118.xml', axe: 'conformite', nature: 'institution', primaire: true },
  // ---- Exploitation ----
  { id: 'X06', s: 'data.senat.fr, actualités', u: 'https://data.senat.fr/feed/actualites-atom.xml', axe: 'exploitation', nature: 'institution', primaire: true,
    reecrire: ['data-ab.senat.fr', 'data.senat.fr'] },
  // Détecteur de secours du remaniement, à l'essai : jamais trié, seulement filtré sur le titre (normaliser-parlia.js).
  { id: 'X11', s: 'Élysée, communiqués', u: 'https://www.elysee.fr/feed', axe: 'exploitation', nature: 'institution', primaire: true, role: 'detecteur' },
];
return FLUX.map((f) => ({ json: f }));

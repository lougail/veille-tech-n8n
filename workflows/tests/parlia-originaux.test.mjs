// La lecture des originaux (originaux-parlia.js) et leurs résumés (resumes-parlia.js), sur les fiches de la
// semaine 46 : ce qui est lu, ce qui ne l'est pas et pourquoi, la demande de résumé, puis la réponse du modèle
// rapprochée de la fiche. Lance avec : npm test
import assert from 'node:assert/strict';
import test from 'node:test';
import { executer, http, plan } from './aide-parlia.mjs';

const MAINTENANT = '2026-11-09T07:15';
const cand = (n, extra = {}) => Object.assign({
  n, id: 'c' + n, sid: 'A08', kind: 'flux', titre: 'Titre ' + n, url: 'https://www.cnil.fr/fr/article-' + n, source: 'CNIL, actualités',
  nature: 'institution', primaire: true, axe: 'conformite', p: 7, drapeaux: {}, resume: 'Résumé du tri ' + n, aChercher: 'À chercher ' + n,
  hypothese: 'Hypothèse du tri ' + n, raison: 'note de 6 ou plus', date: '2026-11-05', vu: '2026-11-05', dateEffet: null,
}, extra);
const lire = (candidats, table) => {
  const h = http(table);
  return executer('originaux-parlia.js', { input: [{ candidats, jourDebut: '2026-11-04' }], maintenant: MAINTENANT, helpers: h })
    .then((demandes) => ({ demandes, lectures: demandes[0].lectures, appels: h.appels }));
};
const page = (corps) => '<html><body><header><nav>Menu du site</nav></header><main>' + corps + '</main><footer>Pied de page</footer></body></html>';
const PHRASES = ' Un paragraphe de l\'article, assez long pour être une vraie phrase de texte, avec ce qu\'il faut de détails.'.repeat(3);

test("un article : la page est lue, sa date déclarée relevée ; la demande donne l'état du projet, la proposition du tri et le texte", async () => {
  const url = 'https://developers.cloudflare.com/changelog/post/2026-11-05-planned-model-deprecations/';
  const corps = page('<article><time datetime="2026-11-05">November 5, 2026</time><h2>Planned model deprecations on Workers AI</h2>'
    + '<p>Update your apps to remove references to the models listed below before November 20, 2026.' + PHRASES + '</p></article>');
  const { demandes, lectures } = await lire([cand(3, { sid: 'X01', url, titre: 'Workers AI - Planned model deprecations on Workers AI' })], { [url]: { statusCode: 200, body: corps } });
  assert.equal(demandes.length, 1);
  assert.deepEqual([lectures[0].lu, lectures[0].comment, lectures[0].datePage], [true, 'article', '2026-11-05']);
  const p = demandes[0].prompt;
  assert.match(p, /L'ÉTAT DU PROJET\n- ParlIA propose les trois ministères/);
  assert.match(p, /l'application n'utilise aucun service d'IA du marché/);
  assert.match(p, /- résumé : Résumé du tri 3\n/);
  assert.match(p, /LE TEXTE DE L'ORIGINAL \(la page de l'article, \d+ caractères\)/);
  assert.match(p, /before November 20, 2026/);
  assert.doesNotMatch(p, /Menu du site|Pied de page/);
  assert.equal(demandes[0].n, 3);
});

test("Légifrance et l'aide d'OpenAI refusent les programmes : la fiche dit pourquoi ; sans original lu, une seule demande, vide", async () => {
  const { demandes, lectures } = await lire([
    cand(1, { url: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000055070176' }),
    cand(2, { url: 'https://help.openai.com/en/articles/1' }),
    cand(3, { url: 'https://www.cnil.fr/fr/disparu' }),
  ], {
    'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000055070176': { statusCode: 403, body: 'Forbidden' },
    'https://help.openai.com/en/articles/1': { statusCode: 403, body: 'Forbidden' },
  });
  assert.deepEqual(lectures.map((l) => [l.lu, l.motif]), [
    [false, 'Légifrance refuse les programmes (erreur 403)'],
    [false, "L'aide d'OpenAI refuse les programmes (erreur 403)"],
    [false, 'la page répond par une erreur 404'],
  ]);
  assert.equal(demandes.length, 1);
  assert.equal(demandes[0].vide, true);
});

// Fiche 9 : le résumé de l'étude dépasse 600 caractères ; la tâche même de ParlIA arrive après.
test("arXiv : le résumé de l'étude, par l'API, en entier (fiche 9)", async () => {
  const api = 'https://export.arxiv.org/api/query?id_list=2611.06655v1&max_results=1';
  const resume = 'Public bodies increasingly rely on AI-produced evidence, including classifications, summaries and assessments.' + PHRASES
    + ' We compare eight GPT-4o configurations classifying 1,200 UK Prime Minister\'s Questions into 21 policy topics, against human-coded labels and across unchanged repeats. Accuracy ranges from 68.2% to 70.3%, yet 24.3% of questions receive different labels.';
  const atome = '<feed><title>arXiv Query: id_list=2611.06655v1</title><entry><id>http://arxiv.org/abs/2611.06655v1</id><published>2026-11-04T15:31:51Z</published>'
    + '<title>Beyond accuracy: what AI assurance needs to establish in public services</title><summary>' + resume + '</summary><author><name>Louise Yorke</name></author></entry></feed>';
  const { demandes, lectures } = await lire([cand(9, { sid: 'R3', arxiv: true, url: 'https://arxiv.org/abs/2611.06655v1' })], { [api]: { statusCode: 200, body: atome } });
  assert.deepEqual([lectures[0].comment, lectures[0].datePage], ['arxiv', '2026-11-04']);
  assert.match(demandes[0].prompt, /Auteurs : Louise Yorke/);
  assert.match(demandes[0].prompt, /Accuracy ranges from 68\.2% to 70\.3%, yet 24\.3% of questions receive different labels/);
});

// Le 18 novembre 2026 : les études partaient en parallèle, et l'API d'arXiv demande trois secondes entre deux demandes.
test("arXiv : toutes les études en une seule demande, rapprochées sans leur version ; après une erreur 429, une seconde demande", async () => {
  const api = 'https://export.arxiv.org/api/query?id_list=2611.14861v1,2611.15592&max_results=2';
  const entree = (id, titre) => '<entry><id>http://arxiv.org/abs/' + id + '</id><published>2026-11-12T10:00:00Z</published><title>' + titre
    + '</title><summary>' + titre + PHRASES + '</summary><author><name>A. Auteur</name></author></entry>';
  let essais = 0;
  const repondre = () => (++essais === 1 ? { statusCode: 429, body: 'Rate exceeded.' }
    : { statusCode: 200, body: '<feed>' + entree('2611.15592v3', 'Small Heads') + entree('2611.14861v1', 'Is Jev a Good Multilingual Judge?') + '</feed>' });
  const { demandes, lectures, appels } = await lire([
    cand(1, { sid: 'R2', arxiv: true, url: 'https://arxiv.org/abs/2611.14861v1' }),
    cand(2, { url: 'https://www.cnil.fr/fr/article-2' }),
    cand(3, { sid: 'R2', arxiv: true, url: 'https://arxiv.org/abs/2611.15592' }),
    cand(4, { sid: 'R1', arxiv: true, url: 'https://arxiv.org/abs/pas-un-numero' }),
  ], { [api]: repondre, 'https://www.cnil.fr/fr/article-2': { statusCode: 200, body: page('<article><p>Un texte de la CNIL.' + PHRASES + '</p></article>') } });
  assert.equal(appels.filter((u) => u === api).length, 2);
  assert.deepEqual(lectures.map((l) => [l.n, l.lu, l.comment || l.motif]), [
    [1, true, 'arxiv'], [2, true, 'article'], [3, true, 'arxiv'], [4, false, "l'adresse ne donne pas le numéro de l'étude sur arXiv"],
  ]);
  assert.match(demandes.find((d) => d.n === 1).prompt, /Titre : Is Jev a Good Multilingual Judge\?/);
  assert.match(demandes.find((d) => d.n === 3).prompt, /Titre : Small Heads/);
});

test("arXiv : une erreur 429 qui dure est dite telle quelle sur chaque fiche", async () => {
  const api = 'https://export.arxiv.org/api/query?id_list=2611.14861v1&max_results=1';
  const { lectures } = await lire([cand(1, { sid: 'R2', arxiv: true, url: 'https://arxiv.org/abs/2611.14861v1' })], { [api]: { statusCode: 429, body: 'Rate exceeded.' } });
  assert.deepEqual([lectures[0].lu, lectures[0].motif], [false, 'arXiv a reçu trop de demandes (erreur 429)']);
});

// Fiche 1 : la page du blog de TypeSafe ne date pas ses billets ; le billet du 3 novembre 2026, si.
test("fiche 1 (semaine 46) : le billet est retrouvé sur la page du blog par le lien qui porte son titre, et lu", async () => {
  const liste = page('<a href="./blog/jev-1-14"><div><p>Company News</p></div><div><p>Jev: For the builders AND dreamers</p></div></a>'
    + '<a href="./blog/dont-call-it-a-decision-model"><div><p>Thoughts</p></div><div><p>Don’t Call It a Decision Model</p></div><p>Jev makes judgments, code makes decisions.</p></a>');
  const billet = '<html><body><div><h1>Don’t Call It a Decision Model</h1><p>Nov 3, 2026</p><h2>Allie Laabs, DevRel, TypeSafe</h2>'
    + '<p>So why is TypeSafe holding firm on calling Jev a System One model instead of a decision model?' + PHRASES + '</p></div></body></html>';
  const { demandes, lectures } = await lire([cand(1, { sid: 'D02', kind: 'page', url: 'https://typesafe.ai/blog', titre: 'TypeSafe AI, blog — Don’t Call It a Decision Model', date: '' })], {
    'https://typesafe.ai/blog': { statusCode: 200, body: liste },
    'https://typesafe.ai/blog/dont-call-it-a-decision-model': { statusCode: 200, body: billet },
  });
  assert.deepEqual([lectures[0].lu, lectures[0].comment, lectures[0].adresse], [true, 'billet', 'https://typesafe.ai/blog/dont-call-it-a-decision-model']);
  assert.equal(lectures[0].datePage, '2026-11-03'); // écrite sous le titre du billet
  assert.match(demandes[0].prompt, /Adresse lue : https:\/\/typesafe\.ai\/blog\/dont-call-it-a-decision-model/);
  assert.match(demandes[0].prompt, /Date de publication donnée par la source : inconnue \(vu par le bot le 2026-11-05\)/);
  assert.match(demandes[0].prompt, /Nov 3, 2026/);
});

const rangee = (arret, modele, remplacant, avis) => '<tr><td><strong>' + arret + '</strong></td><td><code>' + modele + '</code></td><td>Deprecated</td><td>' + remplacant + '</td><td>' + avis + '</td></tr>';
const pageRetraits = page('<h1>Deprecations</h1><p>Une introduction sur les retraits de modèles, assez longue pour faire une ligne.</p><h2>Upcoming deprecations</h2>'
  + '<table><thead><tr><th>Shutdown date</th><th>Affected model</th><th>Status</th><th>Recommended replacement</th><th>Notice date</th></tr></thead><tbody>'
  + rangee('Dec 1, 2026', 'gpt-image-1-mini', 'gpt-image-2.6-sunburst or gpt-image-2.6-flare', 'Jun 2, 2026')
  + rangee('Dec 1, 2026', 'chatgpt-image-latest', 'gpt-image-2.6-sunburst or gpt-image-2.6-flare', 'Jun 2, 2026')
  + rangee('Feb 1, 2027', 'gpt-5.5-cyber-preview', 'The most capable cyber model available to you.', 'Nov 5, 2026')
  + '</tbody></table><h2>Model deprecation notice periods</h2><p>Une autre partie de la page.</p>');
const RETRAITS = 'https://developers.openai.com/api/docs/deprecations';

test("une page sans flux : la partie du bloc, avec les en-têtes du tableau et la ligne retenue, sans les modèles d'image", async () => {
  const titre = 'OpenAI, retraits de modèles — Shutdown date : Feb 1, 2027 · Affected model : gpt-5.5-cyber-preview · Status : Deprecated · Recommended replacement : The most capable cyber model available to you. · Notice…';
  const { demandes, lectures } = await lire([cand(2, { sid: 'F02', kind: 'page', url: RETRAITS, titre })], { [RETRAITS]: { statusCode: 200, body: pageRetraits } });
  assert.deepEqual([lectures[0].comment, lectures[0].retrouvePar], ['page', '']);
  const p = demandes[0].prompt;
  assert.match(p, /<<<\n## Upcoming deprecations\n\[ligne retenue\] - Shutdown date : Feb 1, 2027 · Affected model : gpt-5\.5-cyber-preview · Status : Deprecated · Recommended replacement : The most capable cyber model available to you\. · Notice date : Nov 5, 2026\n/);
  // Les deux rangées des modèles d'image, juste au-dessus, ne sont pas lues (PARLIA.RETRAITS_TEXTE).
  assert.doesNotMatch(p.slice(p.indexOf('<<<')), /gpt-image|chatgpt-image/);
  assert.doesNotMatch(p, /Une autre partie de la page/); // l'intertitre suivant arrête la partie
});

test("un billet de retraits de Cloudflare : l'original est lu sans les modèles de son ni d'image", async () => {
  const billet = 'https://developers.cloudflare.com/changelog/post/2026-11-05-planned-model-deprecations/';
  const corps = page('<article><h1>Planned model deprecations on Workers AI</h1><p>Starting November 20, 2026, these models will stop returning responses.' + PHRASES + '</p>'
    + '<h3>LLMs</h3><ul><li>@cf/meta/llama-3.2-1b-instruct</li><li>@cf/qwen/qwq-32b</li></ul><h3>Other models</h3>'
    + '<ul><li>@cf/myshell-ai/melotts → @cf/deepgram/aura-2-en</li><li>@cf/lykon/dreamshaper-8-lcm → @cf/black-forest-labs/flux-2-klein-9b</li></ul></article>');
  const { demandes, lectures } = await lire([cand(3, { sid: 'X01', source: 'Cloudflare, journal de Workers AI', url: billet, titre: 'Workers AI - Planned model deprecations on Workers AI' })], { [billet]: { statusCode: 200, body: corps } });
  assert.deepEqual([lectures[0].lu, lectures[0].comment], [true, 'article']);
  const texte = demandes[0].prompt.slice(demandes[0].prompt.indexOf('<<<'));
  assert.match(texte, /@cf\/meta\/llama-3\.2-1b-instruct\n@cf\/qwen\/qwq-32b/);
  assert.doesNotMatch(texte, /melotts|dreamshaper|aura-2|flux-2/);
});

test("fiche 2 (semaine 46) : la page a changé depuis la collecte ; la partie est retrouvée par le nom du modèle", async () => {
  // Article trié avant cette version : le registre ne disait pas que sa source est une page.
  const { demandes, lectures } = await lire([cand(2, { sid: 'F02', kind: '', url: RETRAITS, titre: 'OpenAI, retraits de modèles — 2026-11-05: GPT-5.5-Cyber' })], { [RETRAITS]: { statusCode: 200, body: pageRetraits } });
  assert.deepEqual([lectures[0].lu, lectures[0].retrouvePar], [true, 'gpt-5.5-cyber']);
  assert.match(demandes[0].prompt, /\[ligne retenue\] - Shutdown date : Feb 1, 2027 · Affected model : gpt-5\.5-cyber-preview/);
});

test("le catalogue d'OpenRouter : pas d'original à lire, aucune demande au réseau", async () => {
  const { lectures, appels } = await lire([cand(7, { sid: 'A02', kind: 'api', url: 'https://openrouter.ai/google/gemini-omni-1.2-flash' })], {});
  assert.equal(lectures[0].sansObjet, true);
  assert.equal(appels.length, 0);
});

// La relecture du 16 novembre 2026 : un avis publié en PDF partait au modèle comme du texte illisible.
test("un original en PDF n'est pas lu : la fiche dit de l'ouvrir à la main, sans demande de résumé", async () => {
  const url = 'https://www.edpb.europa.eu/system/files/2026-11/edpb_statement_202603_en.pdf';
  const pdf = '%PDF-1.7\n%\u00e2\u00e3\u00cf\u00d3\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n' + 'stream x\u009c\u00ed\u00bd endstream '.repeat(40);
  const { demandes, lectures } = await lire([cand(4, { sid: 'A09', url })], { [url]: { statusCode: 200, body: pdf } });
  assert.deepEqual([lectures[0].lu, lectures[0].motif], [false, "l'original est un PDF, que le bot ne sait pas lire : l'ouvrir à la main"]);
  assert.equal(demandes[0].vide, true);
});

// Les deux dépôts Hugging Face de Perplexity de l'essai du 16 novembre 2026 : la page du dépôt n'a pas de texte lisible
// pour un programme ; sa fiche (README.md), si. Extrait de la vraie fiche, avec son en-tête YAML.
test("un dépôt Hugging Face : sa fiche (README) est lue, sans l'en-tête ; sans fiche, la page du dépôt, comme avant", async () => {
  const depot = 'https://huggingface.co/perplexity-ai/pplx-decider-v1.3';
  const fiche = '---\nlicense: apache-2.0\nbase_model: Qwen/Qwen3.8-27B\npipeline_tag: text-classification\ntags:\n  - classification\n---\n\n# pplx-decider-v1.3\n\n'
    + 'pplx-decider-v1.3 is the next version of [pplx-decider-v1.2](https://huggingface.co/perplexity-ai/pplx-decider-v1.2), a multimodal classification model on Qwen3.8-27B.\n'
    + 'It comes with improved performance and robustness across decision tasks, and a new extraction capability.\n\n## Usage\n\n'
    + 'Requirements: Python 3.12+ and a CUDA GPU with room for about 49 GiB of BF16 weights plus working memory.\n';
  const { demandes, lectures } = await lire([
    cand(3, { sid: 'X10', kind: 'api', url: depot, titre: 'Hugging Face : nouveau dépôt de perplexity-ai, pplx-decider-v1.3' }),
    cand(4, { sid: 'X10', kind: 'api', url: 'https://huggingface.co/perplexity-ai/sans-fiche', titre: 'Hugging Face : nouveau dépôt de perplexity-ai, sans-fiche' }),
  ], {
    [depot + '/raw/main/README.md']: { statusCode: 200, body: fiche },
    'https://huggingface.co/perplexity-ai/sans-fiche': { statusCode: 200, body: '<html><body><main><div id="app"></div></main></body></html>' },
  });
  assert.deepEqual([lectures[0].lu, lectures[0].comment, lectures[0].adresse], [true, 'readme', depot + '/raw/main/README.md']);
  assert.match(demandes[0].prompt, /LE TEXTE DE L'ORIGINAL \(la fiche du dépôt sur Hugging Face, \d+ caractères\)/);
  assert.match(demandes[0].prompt, /## pplx-decider-v1\.3\npplx-decider-v1\.3 is the next version of pplx-decider-v1\.2, a multimodal classification model/);
  assert.doesNotMatch(demandes[0].prompt, /license: apache-2\.0|base_model/);
  assert.deepEqual([lectures[1].lu, lectures[1].motif], [false, 'la page est sans texte lisible (construite dans le navigateur ?)']);
});

test("la page des modèles de TypeSafe : sa version Markdown est lue, et la rangée retenue retrouvée avec ses en-têtes", async () => {
  const md = "# Models\n\nJev is TypeSafe's flagship model. Every model on this page is served by the same endpoint.\n\n## Current models\n\n"
    + '| | Jev 1.15 | Jev 1.14 |\n| :- | :- | :- |\n| Model ID | \x60jev-1.15.0\x60 | \x60jev-1.14.0\x60 |\n| Context length | 128k per-request | 64k per-request |\n';
  const { demandes, lectures } = await lire([cand(2, { sid: 'Y02', kind: 'page', url: 'https://docs.typesafe.ai/models',
    titre: 'TypeSafe AI, page des modèles — Model ID · Jev 1.15 : jev-1.15.0 · Jev 1.14 : jev-1.14.0' })], { 'https://docs.typesafe.ai/models.md': { statusCode: 200, body: md } });
  assert.deepEqual([lectures[0].lu, lectures[0].comment], [true, 'page']);
  assert.match(demandes[0].prompt, /## Current models\n\[ligne retenue\] - Model ID · Jev 1\.15 : jev-1\.15\.0 · Jev 1\.14 : jev-1\.14\.0\n- Context length · Jev 1\.15 : 128k per-request/);
});

// ---- Les résumés ----
const reponse = (o) => ({ text: '\x60\x60\x60json\n' + JSON.stringify(Object.assign({ resume: 'Résumé de l\'original.', a_chercher: 'rien', hypothese: 'rien', hors_theme: false, date_publication: null, date_effet: null, ecart: 'rien' }, o)) + '\n\x60\x60\x60' });
async function resumer(candidats, lectures, reponses, sd = {}, echeances = []) {
  const lues = lectures.filter((l) => l.lu);
  const demandes = (lues.length ? lues.map((l) => ({ prompt: 'p', n: l.n })) : [{ prompt: 'Réponds seulement : {}', n: null, vide: true }]);
  demandes[0].lectures = lectures;
  const sel = { semaine: { cle: '2026-S46' }, jourDebut: '2026-11-04', candidats, echeances, reserve: [] };
  const [s] = await executer('resumes-parlia.js', { input: reponses, sd, maintenant: MAINTENANT, sorties: {
    'Que faire ?': [plan({ reglages: { modeleResumes: 'anthropic/claude-haiku-5.5' } })], 'Sélection': [sel], 'Originaux': demandes,
  } });
  return s;
}
const lu = (n, extra = {}) => Object.assign({ n, lu: true, comment: 'article', adresse: 'https://www.cnil.fr/fr/article-' + n, datePage: '', motif: '', taille: 5000, retrouvePar: '', version: 'v' }, extra);

test("la réponse du modèle : le résumé vient de l'original ; la date trouvée date la fiche (fiche 1) ; hors thème et écart sont dits", async () => {
  const s = await resumer(
    [cand(1, { sid: 'D02', url: 'https://typesafe.ai/blog', date: '' }), cand(5), cand(11, { url: 'https://www.legifrance.gouv.fr/jorf/id/X' })],
    [lu(1, { comment: 'billet', adresse: 'https://typesafe.ai/blog/dont-call-it-a-decision-model' }), lu(5), { n: 11, lu: false, motif: 'Légifrance refuse les programmes (erreur 403)', taille: 0 }],
    [reponse({ resume: 'Un billet d\'opinion : Jev « juge », le code « décide ».', date_publication: '2026-11-03', ecart: 'Aucun nouveau modèle de décision : un billet d\'opinion.' }),
      reponse({ hors_theme: true, hypothese: 'Cela pourrait aider ParlIA.' })],
  );
  const [f1, f5, f11] = s.candidats;
  assert.equal(f1.resume, 'Un billet d\'opinion : Jev « juge », le code « décide ».');
  assert.deepEqual(f1.tri, { resume: 'Résumé du tri 1', aChercher: 'À chercher 1', hypothese: 'Hypothèse du tri 1' });
  assert.deepEqual([f1.date, f1.avantPeriode, f1.url, f1.urlListe], ['2026-11-03', true, 'https://typesafe.ai/blog/dont-call-it-a-decision-model', 'https://typesafe.ai/blog']);
  assert.equal(f1.ecart, 'Aucun nouveau modèle de décision : un billet d\'opinion.');
  assert.equal(f1.aChercher, '');
  assert.deepEqual([f5.horsThemeOriginal, f5.hypothese, f5.original.resume], [true, 'rien', 'original']);
  assert.deepEqual([f11.original.lu, f11.original.motif, f11.resume], [false, 'Légifrance refuse les programmes (erreur 403)', 'Résumé du tri 11']);
  assert.deepEqual([s.originaux.total, s.originaux.lus, s.originaux.resumes, s.originaux.nonLus, s.originaux.modele], [3, 2, 2, [11], 'anthropic/claude-haiku-5.5']);
});

test("une erreur du modèle ou une réponse illisible : la fiche garde le résumé du tri, avec le motif", async () => {
  const s = await resumer([cand(1), cand(2)], [lu(1), lu(2)], [{ error: { message: '429' } }, { text: 'Je ne peux pas.' }]);
  assert.deepEqual(s.candidats.map((c) => [c.resume, c.original.resume, c.original.echec]), [
    ['Résumé du tri 1', 'tri', 'erreur du modèle'], ['Résumé du tri 2', 'tri', 'réponse illisible'],
  ]);
  assert.deepEqual(s.originaux.echecs, [1, 2]);
});

// Fiche 3 : l'original de Cloudflare dit le 20 novembre ; l'échéance relevée disait le 15.
test("fiche 3 (semaine 46) : une autre date d'effet dans l'original ; l'échéance la prend et garde l'ancienne", async () => {
  const url = 'https://developers.cloudflare.com/changelog/post/x/';
  const sd = { echeances: [{ id: 'c3', date: '2026-11-15', titre: 'Workers AI - Planned model deprecations', url, s: 'Cloudflare' }] };
  const s = await resumer([cand(3, { url, dateEffet: '2026-11-15', drapeaux: { retrait_modele: true } })], [lu(3)],
    [reponse({ date_effet: '2026-11-20' })], sd, [{ date: '2026-11-15', titre: 'Workers AI - Planned model deprecations', url, source: 'Cloudflare' }]);
  assert.deepEqual([sd.echeances[0].date, sd.echeances[0].avant], ['2026-11-20', '2026-11-15']);
  assert.deepEqual(s.echeances.map((e) => [e.date, e.avant]), [['2026-11-20', '2026-11-15']]);
  assert.deepEqual([s.candidats[0].dateEffet, s.candidats[0].dateAvant], ['2026-11-20', '2026-11-15']);
});

test("aucun original lu : la demande vide ne change aucune fiche", async () => {
  const s = await resumer([cand(1)], [{ n: 1, lu: false, motif: 'la page répond par une erreur 404', taille: 0 }], [{ text: '{}' }]);
  assert.deepEqual([s.candidats[0].resume, s.candidats[0].original.lu, s.originaux.nonLus], ['Résumé du tri 1', false, [1]]);
});

// Fiche 3 du rejeu de la semaine 46 (16 novembre 2026) : le résumé du billet de Cloudflare prêtait un retrait à Clef,
// que le billet ne nomme pas. Une hypothèse juste remplace celle que le contrôle du tri avait écartée.
test("l'hypothèse tirée de l'original est contrôlée contre le texte de l'original : écartée, la fiche dit pourquoi", async () => {
  const billet = 'Starting November 20, 2026, these models will stop returning responses.\n## LLMs\n@cf/meta/llama-3.2-1b-instruct\n@cf/qwen/qwq-32b';
  const sel = { semaine: { cle: '2026-S46' }, jourDebut: '2026-11-04', echeances: [], reserve: [], candidats: [
    cand(3, { sid: 'X01', titre: 'Workers AI - Planned model deprecations on Workers AI' }),
    cand(5, { hypothese: '', hypotheseEcartee: "elle dit « utilisés par ParlIA », alors qu'aucun service n'est utilisé ni choisi" }),
  ] };
  const demandes = [{ n: 3, prompt: "LE TEXTE DE L'ORIGINAL (la page de l'article)\n<<<\n" + billet + '\n>>>\n\nÉcris…', lectures: [lu(3), lu(5)] },
    { n: 5, prompt: '<<<\nLa CNIL publie sa recommandation sur les outils de rejeu de session.\n>>>' }];
  const [s] = await executer('resumes-parlia.js', { input: [
    reponse({ hypothese: 'Si Clef ou Clef-flash de Cloudflare figuraient dans le comparatif, leur retrait prévu le 20 novembre 2026 pourrait nécessiter leur remplacement.' }),
    reponse({ hypothese: "Cette recommandation pourrait s'appliquer à ParlIA si l'étiquetage enregistrait des sessions." }),
  ], maintenant: MAINTENANT, sorties: { 'Que faire ?': [plan()], 'Sélection': [sel], 'Originaux': demandes } });
  const [f3, f5] = s.candidats;
  assert.deepEqual([f3.hypothese, f3.hypotheseEcartee], ['', "elle prête un retrait à Clef, que l'article ne nomme pas"]);
  assert.equal(f3.tri.hypothese, 'Hypothèse du tri 3');
  assert.deepEqual([f5.hypothese, f5.hypotheseEcartee], ["Cette recommandation pourrait s'appliquer à ParlIA si l'étiquetage enregistrait des sessions.", '']);
  assert.deepEqual(s.originaux.ecartees, [3]);
});

test("#status : le nombre d'originaux lus et résumés, et les fiches sans original", async () => {
  const sd = { _passage: { preparation: { fichier: 'f.md', candidats: 10, reserve: 2 }, originaux: { total: 10, lus: 9, resumes: 8, sansObjet: 0, echecs: [4], nonLus: [9], ecartees: [3] } } };
  const [s] = await executer('statut-parlia.js', { sd, maintenant: MAINTENANT, sorties: { 'Que faire ?': [plan()] } });
  assert.match(s.payload.content, /📖 Originaux : 8\/10 lus et résumés · non lus : fiche\(s\) 9 · ⚠️ résumé échoué : fiche\(s\) 4 · hypothèse écartée : fiche\(s\) 3/);
});

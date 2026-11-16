// Les pages sans flux et les API (collecte-pages-api.js) : ce qui est nouveau d'un jour à l'autre, les garde-fous,
// le catalogue d'OpenRouter et la liste de suivi, la fiche data.gouv.fr, les comptes Hugging Face. Un essai sur les
// 12 vraies pages enregistrées le 29 octobre 2026 a donné : rien au premier passage, rien au deuxième, puis un
// article par page quand une entrée est ajoutée en tête. Lance avec : npm test
import assert from 'node:assert/strict';
import test from 'node:test';
import { executer, http, plan } from './aide-parlia.mjs';

const PAGES = [
  'https://developers.openai.com/api/docs/changelog', 'https://developers.openai.com/api/docs/deprecations',
  'https://platform.claude.com/docs/en/about-claude/model-deprecations', 'https://docs.mistral.ai/resources/changelogs',
  'https://aistudio.google.com/docs/changelog.md', 'https://aistudio.google.com/docs/deprecations.md',
  'https://typesafe.ai/blog', 'https://docs.typesafe.ai/models', 'https://www.liquid.ai/news/models',
  'https://ai-act-service-desk.ec.europa.eu/fr/resources', 'https://digital-strategy.ec.europa.eu/en/policies/ai-office',
  'https://www.assemblee-nationale.fr/dyn/17/dossiers/DLR5L17N53140',
];
const OPENROUTER = 'https://openrouter.ai/api/v1/models';
const DATAGOUV = 'https://www.data.gouv.fr/api/1/datasets/questions-du-senat/';
const hf = (org) => 'https://huggingface.co/api/models?author=' + org + '&sort=createdAt&direction=-1&limit=20';

const entree = (date, texte) => '<h2>' + date + '</h2><p>' + texte + '</p><div>Feature</div>';
const BASE = Array.from({ length: 12 }, (_, i) => entree('October ' + (25 - i), "Entrée numéro " + i + " du journal, avec assez de texte pour faire une vraie ligne de contenu."));
const page = (entrees) => '<html><head><title>T</title><script>var x = 1;</script></head><body><nav>Menu Docs API</nav><main><h1>Changelog</h1>'
  + entrees.join('') + '</main><footer>© 2026</footer></body></html>';
// Les pages Gemini, lues en Markdown : « ## date », puis l'entrée en liste.
const pageMd = (entrees) => '> ## AI Agent Context\n> Get the complete documentation index.\n\n# Release notes\n\n'
  + entrees.map(([d, t]) => '## ' + d + '\n\n- ' + t + '\n').join('\n');
const BASE_MD = Array.from({ length: 12 }, (_, i) => ['October ' + (25 - i) + ', 2026', 'Entrée numéro ' + i + ' du journal, avec assez de texte pour faire une vraie ligne de contenu.']);
const modele = (id, extra = {}) => Object.assign({ id, name: id, created: 1790000000, context_length: 128000,
  pricing: { prompt: '0.0000001', completion: '0.0000005' }, description: 'Un modèle.' }, extra);
const BOURRE = Array.from({ length: 60 }, (_, i) => modele('autre/modele-' + i));
const SUIVIS = ['openai/gpt-6-luna', 'anthropic/claude-haiku-5.5', 'mistralai/mistral-small-3.2-24b-instruct', 'openai/gpt-4o-mini', 'openai/gpt-6.1-terra', 'google/gemini-4-argon', 'mistralai/mistral-large-4-0'];
const catalogue = (extra = [], modifier = (m) => m) => ({ data: BOURRE.concat(SUIVIS.map((id) => modifier(modele(id))), extra) });
const fiche = (ressources, lm = '2026-03-25T10:00:00') => ({ page: 'https://www.data.gouv.fr/fr/datasets/questions-du-senat/', last_modified: lm,
  last_update: new Date().toISOString(), resources: ressources.map(([id, title, format]) => ({ id, title, format, last_modified: new Date().toISOString() })) });
const RESSOURCES = [['r1', 'Questions écrites', 'csv'], ['r2', 'Réponses', 'csv']];

function table(modifs = {}) {
  const t = {};
  for (const u of PAGES) t[u] = { statusCode: 200, body: u.endsWith('.md') ? pageMd(BASE_MD) : page(BASE) };
  t[OPENROUTER] = { statusCode: 200, body: catalogue() };
  t[DATAGOUV] = { statusCode: 200, body: fiche(RESSOURCES) };
  t[hf('Cloudflare')] = { statusCode: 200, body: [{ id: 'Cloudflare/clef', createdAt: '2026-10-09T08:00:00.000Z', tags: [] }] };
  t[hf('perplexity-ai')] = { statusCode: 200, body: [{ id: 'perplexity-ai/decider-v1', createdAt: '2026-10-01T08:00:00.000Z', tags: [] }] };
  return Object.assign(t, modifs);
}
const RSS = { title: 'Un article de flux', link: 'https://mistral.ai/news/a', _source: { id: 'A05' } };
async function passer(sd, t, extra = {}) {
  const h = http(t);
  const sortie = await executer('collecte-pages-api.js', { input: [RSS], sd, helpers: h, sorties: { 'Que faire ?': [plan(extra)] } });
  return { sortie, articles: sortie.filter((j) => j._source && j._source.kind !== 'flux' && j !== sortie[0]), sante: sortie.filter((j) => j._sante), appels: h.appels };
}

test("le premier passage apprend les pages et les catalogues sans rien proposer ; le deuxième ne voit rien de neuf", async () => {
  const sd = {};
  const un = await passer(sd, table());
  assert.deepEqual(un.sortie[0], RSS); // les articles des flux suivent
  assert.equal(un.articles.length, 0);
  assert.equal(un.sante.length, 16);
  assert.ok(un.sante.every((s) => s._sante.ok));
  assert.equal(Object.keys(sd.pages).length, 12);
  assert.equal(sd.pagesJour, '2026-11-02');
  assert.equal(sd._passage.pages.premiers, 16);
  const deux = await passer(sd, table());
  assert.equal(deux.articles.length, 0);
});

test("une entrée ajoutée en tête d'un journal devient un article, titré par sa première phrase et daté", async () => {
  const sd = {};
  await passer(sd, table());
  const nouvelle = entree('Oct 30', 'Mistral Small 4 is now available, with calibrated scores for classification tasks. MODEL RELEASED');
  const { articles } = await passer(sd, table({ 'https://docs.mistral.ai/resources/changelogs': { statusCode: 200, body: page([nouvelle].concat(BASE)) } }));
  assert.equal(articles.length, 1);
  const a = articles[0];
  assert.equal(a.title, 'Mistral, journal des modifications — Mistral Small 4 is now available, with calibrated scores for classification tasks. MODEL RELEASED');
  assert.equal(a.isoDate, '2026-10-30T12:00:00.000Z');
  assert.match(a._cle, /^page:F09:/);
  assert.equal(a._source.kind, 'page');
  assert.equal(a.link, 'https://docs.mistral.ai/resources/changelogs');
});

test("une page en Markdown (Gemini) : ses intertitres se lisent comme ceux d'une page HTML, et le lien mène à la page lisible", async () => {
  const U = 'https://aistudio.google.com/docs/changelog.md';
  const sd = {};
  await passer(sd, table());
  const nouvelle = ['October 30, 2026', 'The \x60gemini-2.5-pro\x60 model is **deprecated** and will be redirected to [gemini-3.8-flash](/models) on December 1, 2026.'];
  const { articles } = await passer(sd, table({ [U]: { statusCode: 200, body: pageMd([nouvelle].concat(BASE_MD)) } }));
  assert.equal(articles.length, 1);
  const a = articles[0];
  assert.equal(a.title, "Google, journal de l'API Gemini — The gemini-2.5-pro model is deprecated and will be redirected to gemini-3.8-flash on December 1, 2026.");
  assert.equal(a.isoDate, '2026-10-30T12:00:00.000Z');
  assert.equal(a.link, 'https://aistudio.google.com/docs/changelog?hl=en');
});

test('les garde-fous : un refus, une page vidée, une page refaite', async () => {
  const sd = {};
  await passer(sd, table());
  const refaite = Array.from({ length: 12 }, (_, i) => entree('Nouveau ' + i, 'Un tout autre contenu numéro ' + i + ', après une refonte complète du site web.'));
  const { articles, sante } = await passer(sd, table({
    [PAGES[0]]: { statusCode: 403, body: 'Forbidden' },
    [PAGES[1]]: { statusCode: 200, body: page(BASE.slice(0, 2)) },
    [PAGES[2]]: { statusCode: 200, body: page(refaite) },
  }));
  assert.equal(articles.length, 0);
  const etat = (i) => sante.find((s) => s._sante.id === ['F01', 'F02', 'F06'][i])._sante;
  assert.deepEqual([etat(0).ok, etat(0).detail], [false, 'code 403']);
  assert.equal(etat(1).ok, false);
  assert.match(etat(1).detail, /page réduite/);
  assert.equal(etat(2).ok, true);
  assert.deepEqual(sd._passage.pages.refaites, ['F06']);
  const encore = await passer(sd, table({ [PAGES[2]]: { statusCode: 200, body: page(refaite) } }));
  assert.equal(encore.articles.length, 0); // la page refaite sert de nouveau point de départ
});

test("OpenRouter : les nouveaux modèles des fournisseurs suivis, et pour la liste de suivi le prix, le retrait annoncé, la disparition", async () => {
  const sd = {};
  await passer(sd, table());
  const nouveaux = [
    modele('openai/gpt-7-nano', { created: 1795000000, pricing: { prompt: '0.00000005', completion: '0.0000004' } }),
    modele('openai/gpt-7-nano:free', { created: 1795000000 }), modele('meta-llama/llama-9', { created: 1795000000 }),
  ];
  const modifie = (m) => {
    if (m.id === 'openai/gpt-4o-mini') m.pricing = { prompt: '0.0000002', completion: '0.0000006' };
    if (m.id === 'anthropic/claude-haiku-5.5') m.expiration_date = '2027-01-20';
    return m;
  };
  const cat = catalogue(nouveaux, modifie);
  cat.data = cat.data.filter((m) => m.id !== 'google/gemini-4-argon');
  const { articles } = await passer(sd, table({ [OPENROUTER]: { statusCode: 200, body: cat } }));
  const parCle = Object.fromEntries(articles.map((a) => [a._cle.split(':').slice(0, 2).join(':'), a]));
  assert.deepEqual(Object.keys(parCle).sort(), ['or:absent', 'or:nouveau', 'or:prix', 'or:retrait']);
  assert.match(parCle['or:nouveau'].title, /gpt-7-nano$/);
  assert.match(parCle['or:nouveau'].contentSnippet, /0,05 \$ en entrée, 0,4 \$ en sortie/);
  assert.equal(parCle['or:nouveau']._source.primaire, false);
  assert.match(parCle['or:prix'].contentSnippet, /0,1 \$ → 0,2 \$ en entrée/);
  assert.deepEqual(parCle['or:prix']._verifie, { changement_prix: true, date_effet: '2026-11-02' });
  assert.deepEqual(parCle['or:retrait']._verifie, { retrait_modele: true, date_effet: '2027-01-20' });
  assert.match(parCle['or:absent'].title, /google\/gemini-4-argon/);
  const encore = await passer(sd, table({ [OPENROUTER]: { statusCode: 200, body: cat } }));
  assert.equal(encore.articles.length, 0);
});

test("data.gouv.fr : la republication nocturne ne compte pas ; un fichier ajouté, si", async () => {
  const sd = {};
  await passer(sd, table());
  const nuit = await passer(sd, table({ [DATAGOUV]: { statusCode: 200, body: fiche(RESSOURCES) } }));
  assert.equal(nuit.articles.length, 0);
  const ajout = await passer(sd, table({ [DATAGOUV]: { statusCode: 200, body: fiche(RESSOURCES.concat([['r3', 'Questions orales', 'json']])) } }));
  assert.equal(ajout.articles.length, 1);
  assert.match(ajout.articles[0].contentSnippet, /fichiers ajoutés : Questions orales \(json\)/);
  assert.equal(ajout.articles[0]._source.axe, 'exploitation');
});

test('Hugging Face : un nouveau dépôt, pas ses dérivés', async () => {
  const sd = {};
  await passer(sd, table());
  const depots = [
    { id: 'Cloudflare/clef-2', createdAt: '2026-11-01T08:00:00.000Z', pipeline_tag: 'text-classification', tags: ['decision'] },
    { id: 'Cloudflare/clef-2-GGUF', createdAt: '2026-11-01T09:00:00.000Z', tags: [] },
    { id: 'Cloudflare/clef', createdAt: '2026-10-09T08:00:00.000Z', tags: [] },
  ];
  const { articles } = await passer(sd, table({ [hf('Cloudflare')]: { statusCode: 200, body: depots } }));
  assert.deepEqual(articles.map((a) => a.title), ['Hugging Face : nouveau dépôt de Cloudflare, clef-2']);
  assert.equal(articles[0]._source.decision, true);
});

test("plus de la moitié des lectures en échec (réveil sans réseau) : on réessaiera à la collecte suivante", async () => {
  const sd = {};
  const panne = {};
  for (const u of Object.keys(table())) panne[u] = new Error('getaddrinfo ENOTFOUND');
  const { sante } = await passer(sd, panne);
  assert.ok(sante.every((s) => !s._sante.ok));
  assert.equal(sd.pagesJour, undefined);
});

test("pas dû aujourd'hui : les articles des flux passent, sans aucune lecture", async () => {
  const sd = {};
  const h = http(table());
  const sortie = await executer('collecte-pages-api.js', { input: [RSS], sd, helpers: h, sorties: { 'Que faire ?': [plan({ pages: false })] } });
  assert.deepEqual(sortie, [RSS]);
  assert.equal(h.appels.length, 0);
  const vide = await executer('collecte-pages-api.js', { input: [], sd, helpers: h, sorties: { 'Que faire ?': [plan({ pages: false })] } });
  assert.deepEqual(vide, [{ _rien: true }]);
});

// La page des retraits d'OpenAI, telle qu'elle est construite (relevé du 15 novembre 2026) : un tableau à en-têtes.
const rangeeRetrait = (arret, modele, remplacant, avis) => '<tr><td><strong>' + arret + '</strong></td><td><span><code>' + modele
  + '</code></span></td><td><span>Deprecated</span></td><td>' + remplacant + '</td><td>' + avis + '</td></tr>';
const pageRetraits = (remplacant) => page([
  '<p>Une phrase d\'introduction sur les retraits de modèles, assez longue pour faire une vraie ligne de la page.</p>',
  '<h2>Upcoming deprecations</h2><div><table><thead><tr><th>Shutdown date</th><th>Affected model</th><th>Status</th>'
    + '<th>Recommended replacement</th><th>Notice date</th></tr></thead><tbody>',
  rangeeRetrait('Dec 1, 2026', 'gpt-image-1-mini', remplacant, 'Jun 2, 2026'),
  rangeeRetrait('Dec 1, 2026', 'gpt-image-1.5', remplacant, 'Jun 2, 2026'),
  rangeeRetrait('Dec 1, 2026', 'chatgpt-image-latest', remplacant, 'Jun 2, 2026'),
  rangeeRetrait('Jan 14, 2027', 'gpt-4o-mini', '<code>gpt-6-luna</code>', 'Oct 14, 2026'),
  '</tbody></table></div>',
].concat(BASE));
const SUNBURST = '<code>gpt-image-2.6-sunburst</code> or <code>gpt-image-2.6-flare</code>';

// Fiche 4 de la semaine 46 : le 4 novembre 2026, OpenAI a remplacé dans ce tableau le remplaçant conseillé des modèles
// d'image. Lues sans leurs en-têtes, les cellules nouvelles avaient fait annoncer l'arrêt des remplaçants. Depuis le
// 16 novembre 2026, les lignes des modèles d'image n'entrent plus dans aucun article (PARLIA.RETRAITS_TEXTE).
test("fiche 4 (semaine 46) : sur la page des retraits d'OpenAI, les lignes des modèles d'image ne font plus d'article", async () => {
  const sd = {};
  await passer(sd, table({ [PAGES[1]]: { statusCode: 200, body: pageRetraits('<code>gpt-image-2</code>') } }));
  const { articles } = await passer(sd, table({ [PAGES[1]]: { statusCode: 200, body: pageRetraits(SUNBURST) } }));
  assert.equal(articles.length, 0);
});

// Le même changement sur des modèles de texte, avec une ligne d'image ajoutée en tête : l'article ne garde que les
// rangées des modèles de texte, chacune avec ses en-têtes, datées par l'avis.
const retraitsTexte = (remplacant, enTete = []) => page([
  '<p>Une phrase d\'introduction sur les retraits de modèles, assez longue pour faire une vraie ligne de la page.</p>',
  '<h2>Upcoming deprecations</h2><div><table><thead><tr><th>Shutdown date</th><th>Affected model</th><th>Status</th>'
    + '<th>Recommended replacement</th><th>Notice date</th></tr></thead><tbody>',
].concat(enTete, [
  rangeeRetrait('Jan 14, 2027', 'gpt-4o', remplacant, 'Oct 14, 2026'),
  rangeeRetrait('Jan 14, 2027', 'gpt-4o-mini', remplacant, 'Oct 14, 2026'),
  rangeeRetrait('Jan 14, 2027', 'gpt-4.1-mini', remplacant, 'Oct 14, 2026'),
  rangeeRetrait('Dec 1, 2026', 'gpt-image-1-mini', SUNBURST, 'Jun 2, 2026'),
  '</tbody></table></div>',
], BASE));
test("une rangée de tableau garde ses en-têtes ; sa date est celle de l'avis, pas celle de l'arrêt ; les modèles d'image restent dehors", async () => {
  const sd = {};
  await passer(sd, table({ [PAGES[1]]: { statusCode: 200, body: retraitsTexte('<code>gpt-5.6-terra</code>') } }));
  const image = rangeeRetrait('Feb 10, 2027', 'gpt-image-2', SUNBURST, 'Nov 10, 2026');
  const { articles } = await passer(sd, table({ [PAGES[1]]: { statusCode: 200, body: retraitsTexte('<code>gpt-6-luna</code>', [image]) } }));
  assert.equal(articles.length, 1);
  const a = articles[0];
  assert.ok(a.title.startsWith('OpenAI, retraits de modèles — Shutdown date : Jan 14, 2027 · Affected model : gpt-4o · Status : Deprecated'), a.title);
  assert.ok(a.contentSnippet.startsWith('Sous « Upcoming deprecations » : '));
  assert.ok(a.contentSnippet.includes('Affected model : gpt-4.1-mini · Status : Deprecated · Recommended replacement : gpt-6-luna · Notice date : Oct 14, 2026'));
  // Chaque remplaçant est annoncé comme tel ; les rangées sont séparées par « ; ».
  assert.equal(a.contentSnippet.split('Recommended replacement : gpt-6-luna').length - 1, 3);
  assert.equal(a.contentSnippet.split(' ; ').length, 3);
  assert.doesNotMatch(a.title + a.contentSnippet, /gpt-image/);
  assert.equal(a.isoDate, '2026-10-14T12:00:00.000Z');
});

test("Anthropic : le nom du modèle, écrit dans un bouton, est gardé ; une rangée sans date passée n'est pas datée", async () => {
  const rangee = (nom, retrait) => '<tr><td><button>' + nom + '</button></td><td>Active</td><td>N/A</td><td>Not sooner than ' + retrait + '</td></tr>';
  const pageModeles = (rangees) => page(['<h2>Model status</h2><div><table><thead><tr><th scope="col">API model name</th><th scope="col">Current state</th>'
    + '<th scope="col">Deprecated</th><th scope="col">Tentative retirement date</th></tr></thead><tbody>' + rangees.join('') + '</tbody></table></div>'].concat(BASE));
  const sd = {};
  await passer(sd, table({ [PAGES[2]]: { statusCode: 200, body: pageModeles([rangee('claude-fable-5-1', 'September 1, 2027')]) } }));
  const { articles } = await passer(sd, table({ [PAGES[2]]: { statusCode: 200, body: pageModeles([rangee('claude-fable-5-2', 'November 9, 2027'), rangee('claude-fable-5-1', 'September 1, 2027')]) } }));
  assert.deepEqual(articles.map((a) => a.title), ['Anthropic, retraits de modèles — API model name : claude-fable-5-2 · Current state : Active · Deprecated : N/A · Tentative retirement date : Not sooner than November 9, 2027']);
  assert.equal(articles[0].isoDate, undefined);
});

test("Gemini : un tableau Markdoc donne une ligne par rangée, avec ses en-têtes ; les balises « {% … %} » partent", async () => {
  const U = 'https://aistudio.google.com/docs/deprecations.md';
  const tableau = (rangees) => '# Gemini deprecations\n\nIntroduction de la page, assez longue pour faire une vraie ligne de texte.\n\n'
    + '## Gemini 4 models  {% id="gemini-4-models" %}\n\n{% table %}\n  * Model\n  * Release date\n  * Shutdown date\n  * Recommended replacement\n'
    + rangees.map(([m, d]) => '\n  ---\n\n  * \x60' + m + '\x60\n  * ' + d + '\n  * No shutdown date announced\n  * \n').join('') + '{% /table %}\n\n'
    + BASE_MD.map(([d, t]) => '## ' + d + '\n\n- ' + t + '\n').join('\n');
  const sd = {};
  await passer(sd, table({ [U]: { statusCode: 200, body: tableau([['gemini-4-argon', 'October 13, 2026']]) } }));
  const { articles } = await passer(sd, table({ [U]: { statusCode: 200, body: tableau([['gemini-4-carbon', 'October 30, 2026'], ['gemini-4-argon', 'October 13, 2026']]) } }));
  assert.equal(articles.length, 1);
  assert.equal(articles[0].title, 'Google, retraits de modèles Gemini — Model : gemini-4-carbon · Release date : October 30, 2026 · Shutdown date : No shutdown date announced');
  assert.equal(articles[0].contentSnippet, 'Sous « Gemini 4 models » : Model : gemini-4-carbon · Release date : October 30, 2026 · Shutdown date : No shutdown date announced');
  assert.equal(articles[0].isoDate, '2026-10-30T12:00:00.000Z');
});

test("une balise écrite sur plusieurs lignes ne laisse pas de morceaux dans le texte (page du Bureau de l'IA)", async () => {
  const sd = {};
  await passer(sd, table());
  const nouvelle = '<h2>Latest News</h2><p><a\n  href="/en/news/commission-launches-ai-skills"\n  rel="bookmark"\n>Commission launches an AI skills package for public administrations</a></p>';
  const { articles } = await passer(sd, table({ [PAGES[10]]: { statusCode: 200, body: page([nouvelle].concat(BASE)) } }));
  assert.equal(articles.length, 1);
  assert.equal(articles[0].contentSnippet, 'Latest News · Commission launches an AI skills package for public administrations');
});

test("le format des lignes change : chaque page est réapprise une fois, sans rien proposer, puis comparée comme avant", async () => {
  const sd = {};
  await passer(sd, table());
  for (const etat of Object.values(sd.pages)) delete etat.v; // une page apprise avant le 15 novembre 2026
  const mistral = (texte) => table({ 'https://docs.mistral.ai/resources/changelogs': { statusCode: 200, body: page([entree('Oct 30', texte)].concat(BASE)) } });
  const reapprise = await passer(sd, mistral('Mistral Small 4 is now available, with calibrated scores for classification tasks.'));
  assert.equal(reapprise.articles.length, 0);
  assert.equal(sd._passage.pages.premiers, 12);
  assert.ok(Object.values(sd.pages).every((e) => e.v === 2));
  const ensuite = await passer(sd, mistral('Mistral Medium 4 is now available, with a longer context window for long documents.'));
  assert.equal(ensuite.articles.length, 1);
});

test("une échéance relevée sur une page : quand ses lignes disparaissent de la page, elle est marquée changée", async () => {
  const sd = {};
  await passer(sd, table({ [PAGES[1]]: { statusCode: 200, body: retraitsTexte('<code>gpt-5.6-terra</code>') } }));
  const { articles } = await passer(sd, table({ [PAGES[1]]: { statusCode: 200, body: retraitsTexte('<code>gpt-6-luna</code>') } }));
  sd.echeances = [{ date: '2027-01-14', titre: articles[0].title, url: PAGES[1], s: 'OpenAI', page: 'F02', lignes: articles[0]._lignes }];
  await passer(sd, table({ [PAGES[1]]: { statusCode: 200, body: retraitsTexte('<code>gpt-6-luna</code>') } }));
  assert.equal(sd.echeances[0].changee, undefined); // les lignes sont toujours là
  await passer(sd, table({ [PAGES[1]]: { statusCode: 200, body: retraitsTexte('<code>gpt-6.1-terra</code>') } }));
  assert.equal(sd.echeances[0].changee, '2026-11-02');
});

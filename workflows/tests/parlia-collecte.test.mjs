// Collecte de la veille ParlIA : les flux, l'étiquetage des articles, la normalisation (fenêtre de dates,
// filtres, dédoublonnage, détecteur de l'Élysée) et la santé des sources. Lance avec : npm test
import assert from 'node:assert/strict';
import test from 'node:test';
import { executer, plan, ms, JOUR } from './aide-parlia.mjs';

const MAINTENANT = '2026-11-02T09:15';
const src = (id, extra = {}) => Object.assign({
  id, s: 'Source ' + id, u: 'https://exemple.org/' + id, axe: 'fournisseurs', nature: 'editeur', primaire: true,
  filtre: '', cnil: false, decision: false, arxiv: false, role: 'tri', reecrire: null, kind: 'flux',
}, extra);
const article = (titre, url, joursAvant, source, extra = {}) => Object.assign({
  title: titre, link: url, isoDate: new Date(ms(MAINTENANT) - joursAvant * JOUR).toISOString(),
  contentSnippet: 'Un extrait de ' + titre, _source: source,
}, extra);
const normaliser = (input, sd) => executer('normaliser-parlia.js', { input, sd, maintenant: MAINTENANT });

test('les sources : rien quand la collecte n\'est pas due, 18 flux sinon', async () => {
  assert.deepEqual(await executer('sources-parlia.js', { sorties: { 'Que faire ?': [plan({ collecte: false })] } }), []);
  const flux = await executer('sources-parlia.js', { sorties: { 'Que faire ?': [plan()] } });
  assert.equal(flux.length, 18);
  assert.equal(new Set(flux.map((f) => f.id)).size, 18);
  assert.ok(flux.every((f) => /^https:\/\//.test(f.u)));
  assert.deepEqual(flux.filter((f) => f.cnil).map((f) => f.id).sort(), ['A08', 'A09']);
  assert.equal(flux.find((f) => f.id === 'X11').role, 'detecteur');
  for (const f of flux.filter((x) => x.filtre)) assert.doesNotThrow(() => new RegExp(f.filtre, 'i'));
});

test("l'étiquetage : la fiche de la source, une erreur, un flux vide", async () => {
  const flux = src('A08', { cnil: true, axe: 'conformite', nature: 'institution' });
  const sortie = await executer('tag-source-parlia.js', {
    input: [{ title: 'Un titre', link: 'https://www.cnil.fr/fr/a', content: 'x'.repeat(5000) }, { error: { message: 'getaddrinfo ENOTFOUND' } }, {}],
    sorties: { 'Flux ParlIA': [flux] },
  });
  assert.equal(sortie[0]._source.id, 'A08');
  assert.equal(sortie[0]._source.cnil, true);
  assert.equal(sortie[0].content.length, 2500);
  assert.match(sortie[1].erreur, /ENOTFOUND/);
  assert.equal(sortie[2]._vide, true);
});

// Le billet de Cloudflare du 5 novembre 2026 (fiche 3 de la semaine 46) : seize modèles de texte, puis huit autres.
test("un billet de retraits de Cloudflare : l'extrait ne garde que les modèles de texte ; les autres billets ne changent pas", async () => {
  const flux = src('X01', { s: 'Cloudflare, journal de Workers AI', decision: true });
  const content = '<p>Starting November 20, 2026, these models will stop returning responses.</p><h3>LLMs</h3><ul>'
    + '<li>@cf/meta/llama-3.2-1b-instruct</li><li>@cf/qwen/qwq-32b</li></ul><h3>Other models</h3><ul>'
    + '<li>@cf/myshell-ai/melotts → @cf/deepgram/aura-2-en</li><li>@cf/stabilityai/stable-diffusion-xl-base-1.0 → @cf/black-forest-labs/flux-2-klein-9b</li></ul>';
  const [retraits, autre] = await executer('tag-source-parlia.js', {
    input: [
      { title: 'Workers AI - Planned model deprecations on Workers AI', link: 'https://developers.cloudflare.com/changelog/post/2026-11-05-planned-model-deprecations/', content, contentSnippet: 'Le texte complet du billet.' },
      { title: 'Workers AI - EmbeddingGemma 2 now available on Workers AI', link: 'https://developers.cloudflare.com/changelog/post/2026-11-12-embeddinggemma-2/', content: '<p>@cf/google/embeddinggemma-2 is now available.</p>', contentSnippet: '@cf/google/embeddinggemma-2 is now available.' },
    ],
    sorties: { 'Flux ParlIA': [flux] },
  });
  assert.equal(retraits.contentSnippet, 'Starting November 20, 2026, these models will stop returning responses. · LLMs · @cf/meta/llama-3.2-1b-instruct · @cf/qwen/qwq-32b · Other models');
  assert.equal(retraits.content, undefined);
  assert.equal(autre.contentSnippet, '@cf/google/embeddinggemma-2 is now available.');
  assert.equal(autre.content, '<p>@cf/google/embeddinggemma-2 is now available.</p>');
});

// La relecture du 16 novembre 2026 : un billet de retraits de Cloudflare qui ne nomme que des modèles de son ou d'image
// partait au tri, et pouvait y gagner une échéance.
test("un billet de retraits de Cloudflare dont le titre ne nomme que des modèles de son ou d'image n'est pas trié", async () => {
  const x01 = src('X01', { s: 'Cloudflare, journal de Workers AI', decision: true });
  const sd = {};
  const sortie = await normaliser([
    article('Workers AI - Deprecating @cf/myshell-ai/melotts and @cf/deepgram/aura-1', 'https://developers.cloudflare.com/changelog/post/melotts/', 1, x01),
    article('Workers AI - Planned model deprecations on Workers AI', 'https://developers.cloudflare.com/changelog/post/planned/', 1, x01),
  ], sd);
  assert.deepEqual(sortie.map((a) => a.titre), ['Workers AI - Planned model deprecations on Workers AI']);
  assert.equal(sd._passage.collecteStats.ecartes, 1);
});

test('la fenêtre part de la dernière collecte, 48 heures au moins, 14 jours au plus, 7 jours la première fois', async () => {
  const s = src('A04');
  const items = [1, 3, 6, 9, 20].map((j) => article('Article de il y a ' + j + ' jours', 'https://anthropic.com/a' + j, j, s));
  const premiere = await normaliser(items, {});
  assert.deepEqual(premiere.map((a) => a.titre), ['Article de il y a 1 jours', 'Article de il y a 3 jours', 'Article de il y a 6 jours']);
  const proche = await normaliser(items, { lastCollectAt: ms(MAINTENANT) - 4 * 3600 * 1000 });
  assert.deepEqual(proche.map((a) => a.titre), ['Article de il y a 1 jours']); // 48 heures au moins
  const loin = await normaliser(items, { lastCollectAt: ms(MAINTENANT) - 30 * JOUR });
  assert.equal(loin.length, 4); // 14 jours au plus : celui de 20 jours est écarté
});

// Le 18 novembre 2026 : une étude porte la date de son dépôt, et n'apparaît dans l'API qu'à son annonce, un à quatre
// jours plus tard. Avec 48 heures, le bot avait manqué 32 des 50 dernières études de la requête des modèles de décision.
test("arXiv : toujours 14 jours de fenêtre ; la clé d'une étude n'a pas de version, même pour les clés déjà gardées", async () => {
  const r2 = src('R2', { s: 'arXiv : modèles de décision et calibration', axe: 'qualite', nature: 'auteurs', arxiv: true });
  const autre = src('A04');
  const sd = {
    lastCollectAt: ms(MAINTENANT) - 4 * 3600 * 1000,
    vus: { 'arxiv.org/abs/2611.15592v1': ms(MAINTENANT) - 3 * JOUR, 'arxiv.org/abs/2611.00001': ms(MAINTENANT) - 9 * JOUR },
  };
  const sortie = await normaliser([
    article('Is Jev a Good Multilingual Judge?', 'http://arxiv.org/abs/2611.14861v1', 4, r2),
    article('Small Heads', 'http://arxiv.org/abs/2611.15592v2', 4, r2),
    article('Une étude de 12 jours', 'http://arxiv.org/abs/2611.00003v1', 12, r2),
    article('Une étude ancienne', 'http://arxiv.org/abs/2611.00002v1', 15, r2),
    article('Un article de quatre jours', 'https://anthropic.com/a4', 4, autre),
  ], sd);
  assert.deepEqual(sortie.map((a) => [a.titre, a.cle]), [
    ['Is Jev a Good Multilingual Judge?', 'arxiv.org/abs/2611.14861'], ['Une étude de 12 jours', 'arxiv.org/abs/2611.00003'],
  ]);
  assert.deepEqual([sd._passage.collecteStats.dejaVus, sd._passage.collecteStats.horsFenetre], [1, 2]);
  assert.equal(sd.vus['arxiv.org/abs/2611.15592v1'], undefined);
  assert.ok(sd.vus['arxiv.org/abs/2611.15592'] >= ms(MAINTENANT) - 3 * JOUR);
  assert.equal(sd.vus['arxiv.org/abs/2611.00001'], ms(MAINTENANT) - 9 * JOUR);
});

test("un article déjà vu est écarté 45 jours, et l'adresse est comparée sans paramètres de suivi", async () => {
  const sd = {};
  const s = src('A01');
  await normaliser([article('Nouveau tarif', 'https://openrouter.ai/docs/changelog?utm_source=rss', 1, s)], sd);
  const encore = await normaliser([article('Nouveau tarif', 'https://www.openrouter.ai/docs/changelog/', 1, s)], sd);
  assert.deepEqual(encore, [{ _rien: true }]);
  assert.equal(sd._passage.collecteStats.dejaVus, 1);
  for (const cle of Object.keys(sd.vus)) sd.vus[cle] = ms(MAINTENANT) - 46 * JOUR;
  const oublie = await normaliser([article('Nouveau tarif', 'https://openrouter.ai/docs/changelog', 1, s)], sd);
  assert.equal(oublie.length, 1);
});

test('les filtres par mots, le domaine officiel et les liens réécrits', async () => {
  const openai = src('A03', { filtre: '\\b(api|pricing|deprecat\\w*)\\b' });
  const senat = src('X06', { axe: 'exploitation', nature: 'institution', reecrire: ['data-ab.senat.fr', 'data.senat.fr'] });
  const sortie = await normaliser([
    article('New pricing for the API', 'https://openai.com/index/pricing', 1, openai),
    article('Retell uses OpenAI models to power calls', 'https://openai.com/index/retell', 1, openai),
    article('Un nouveau jeu de données', 'https://data-ab.senat.fr/jeu', 1, senat),
    article('Copie de l\'annonce', 'https://medium.com/@x/openai-pricing', 1, src('A07', { nature: 'praticien', primaire: false })),
  ], {});
  assert.deepEqual(sortie.map((a) => a.titre), ['New pricing for the API', 'Un nouveau jeu de données', "Copie de l'annonce"]);
  assert.equal(sortie[0].officiel, true);
  assert.equal(sortie[1].url, 'https://data.senat.fr/jeu');
  assert.equal(sortie[2].officiel, false);
});

test("un titre réduit à une date reçoit le nom de la source", async () => {
  const sortie = await normaliser([article('October 7, 2026', 'https://platform.claude.com/docs/en/release-notes/overview#october-7-2026', 1, src('A04', { s: 'Anthropic, notes de version' }))], {});
  assert.equal(sortie[0].titre, 'Anthropic, notes de version — October 7, 2026');
});

test("l'Élysée n'est jamais trié : une nomination du Gouvernement devient une alerte", async () => {
  const sd = {};
  const elysee = src('X11', { role: 'detecteur', axe: 'exploitation', nature: 'institution', s: 'Élysée, communiqués' });
  const sortie = await normaliser([
    article('Nomination du Gouvernement', 'https://www.elysee.fr/a', 0.2, elysee),
    article('Déplacement du Président en Bretagne', 'https://www.elysee.fr/b', 0.2, elysee),
  ], sd);
  assert.deepEqual(sortie, [{ _rien: true }]);
  assert.equal(sd._alertes.length, 1);
  assert.equal(sd._alertes[0].type, 'remaniement');
});

test("les pages et les API ne passent pas par la fenêtre de dates, et gardent leur clé et leurs drapeaux", async () => {
  const page = src('F02', { kind: 'page' });
  const sortie = await normaliser([
    article('OpenAI, retraits de modèles — 2026-09-01 : gpt-x', 'https://developers.openai.com/api/docs/deprecations', 60, page,
      { _cle: 'page:F02:abc', _verifie: { retrait_modele: true, date_effet: '2026-12-11' } }),
  ], { lastCollectAt: ms(MAINTENANT) - JOUR });
  assert.equal(sortie.length, 1);
  assert.equal(sortie[0].source.kind, 'page');
  assert.deepEqual(sortie[0].verifie, { retrait_modele: true, date_effet: '2026-12-11' });
});

test('trois échecs de suite : une alerte, une seule ; puis un message de retour', async () => {
  const sd = {};
  const cnil = src('A08', { s: 'CNIL, actualités' });
  const panne = { erreur: 'code 503', _source: cnil };
  for (let i = 0; i < 2; i++) {
    sd._passage = {};
    await normaliser([panne], sd);
    assert.equal(sd._passage.flux.length, 0);
  }
  sd._passage = {};
  await normaliser([panne], sd);
  assert.deepEqual(sd._passage.flux.map((f) => [f.id, f.echecs]), [['A08', 3]]);
  sd._passage = {};
  await normaliser([panne], sd);
  assert.equal(sd._passage.flux.length, 0); // pas de deuxième alerte
  sd._passage = {};
  await normaliser([article('Un retour', 'https://www.cnil.fr/fr/retour', 0.5, cnil)], sd);
  assert.deepEqual(sd._passage.flux, [{ id: 'A08', s: 'CNIL, actualités', retour: true }]);
  assert.equal(sd.sante.A08.echecs, 0);
});

test('la santé des pages et des API vient de leurs éléments _sante ; le carnet de la semaine compte tout', async () => {
  const sd = {};
  await normaliser([
    { _sante: { id: 'F01', s: "OpenAI, journal de l'API", ok: false, detail: 'code 403' } },
    article('Un article', 'https://mistral.ai/news/a', 1, src('A05')),
  ], sd);
  assert.equal(sd.sante.F01.echecs, 1);
  assert.equal(sd.semaine.collectes, 1);
  assert.deepEqual(sd.semaine.parSource.F01, { s: "OpenAI, journal de l'API", lus: 0, echecs: 1, k: 'autre' });
  assert.equal(sd.semaine.parSource.A05.k, 'flux');
  assert.equal(sd.lastCollectAt, ms(MAINTENANT));
});

// Fiche 1 de la semaine 46 : le billet de TypeSafe du 3 novembre 2026, vu le 5 sur la page du blog qui ne date
// pas ses billets, portait le 5 et entrait dans une période qui commençait le 4.
test("fiche 1 (semaine 46) : sans date de publication, « date inconnue », et le jour où le bot a vu l'article, à part", async () => {
  const blog = src('D02', { s: 'TypeSafe AI, blog', kind: 'page', decision: true });
  const [a] = await executer('normaliser-parlia.js', { sd: {}, maintenant: '2026-11-05T10:02', input: [{
    title: 'TypeSafe AI, blog — Don’t Call It a Decision Model', link: 'https://typesafe.ai/blog', _cle: 'page:D02:abc',
    contentSnippet: 'Thoughts · Don’t Call It a Decision Model · Jev makes judgments, code makes decisions.', _source: blog,
  }] });
  assert.equal(a.date, '');
  assert.equal(a.vu.slice(0, 10), '2026-11-05');
  const [lot] = await executer('consigne-tri-parlia.js', { input: [a], maintenant: '2026-11-05T10:02' });
  assert.match(lot.prompt, /Publié le : date inconnue \(vu par le bot le 2026-11-05\)/);
  // Datés par leur source, les articles gardent leur date.
  const [b] = await normaliser([article('Un billet daté', 'https://typesafe.ai/blog/b', 2, src('A03'))], {});
  assert.equal(b.date.slice(0, 10), '2026-10-31');
});

// Fiche 3 de la semaine 46 : Cloudflare a repoussé du 15 au 20 novembre 2026 l'arrêt annoncé dans son billet du
// 5 novembre, sans changer sa date de publication ; la préparation gardait le 15.
test("fiche 3 (semaine 46) : quand la source change le texte d'un article dont l'échéance est relevée, il est trié de nouveau", async () => {
  const cf = src('X01', { s: 'Cloudflare, journal de Workers AI', decision: true });
  const url = 'https://developers.cloudflare.com/changelog/post/2026-11-05-planned-model-deprecations/';
  const billet = (texte, lien = url) => ({ title: 'Workers AI - Planned model deprecations on Workers AI', link: lien,
    isoDate: '2026-11-05T00:00:00.000Z', contentSnippet: texte, _source: cf });
  const avant = 'Update your apps to remove references to the models listed below before November 15, 2026.';
  const apres = 'Update your apps to remove references to the models listed below before November 20, 2026. We originally stated these models would be deprecated on November 15, 2026, and have moved the deprecation date to November 20, 2026.';
  const sd = {};
  const [a] = await executer('normaliser-parlia.js', { input: [billet(avant)], sd, maintenant: '2026-11-06T08:59' });
  sd.echeances = [{ date: '2026-11-15', titre: a.titre, url, s: cf.s, id: a.id, cle: a.cle, empreinte: a.empreinte }];
  assert.deepEqual(await executer('normaliser-parlia.js', { input: [billet(avant)], sd, maintenant: '2026-11-10T09:45' }), [{ _rien: true }]);
  const [b] = await executer('normaliser-parlia.js', { input: [billet(apres)], sd, maintenant: '2026-11-10T13:45' });
  assert.equal(b.id, a.id);
  assert.deepEqual(b.maj, { date: '2026-11-15' });
  assert.equal(sd._passage.collecteStats.majEcheances, 1);
  // Une échéance relevée avant cette version n'a ni identifiant ni empreinte : reconnue par l'adresse de son
  // article, elle le fait trier une fois de plus, avec la nouvelle consigne.
  const ancienne = { vus: { [a.cle]: ms('2026-11-06T08:59') }, echeances: [{ date: '2026-11-15', titre: a.titre, url, s: cf.s }] };
  const [c] = await executer('normaliser-parlia.js', { input: [billet(apres)], sd: ancienne, maintenant: '2026-11-10T09:45' });
  assert.deepEqual(c.maj, { date: '2026-11-15' });
  // Sans échéance relevée, un article déjà vu reste écarté, même si son texte change.
  const sans = {};
  await executer('normaliser-parlia.js', { input: [billet(avant, url + 'autre')], sd: sans, maintenant: '2026-11-06T08:59' });
  assert.deepEqual(await executer('normaliser-parlia.js', { input: [billet(apres, url + 'autre')], sd: sans, maintenant: '2026-11-06T13:15' }), [{ _rien: true }]);
});

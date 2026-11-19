// La refonte du 28 octobre 2026 : radars des nouveaux modèles, Hacker News, AINews, collecte au
// réveil du Mac, regroupement des sujets et seuil de publication.
// Lance avec : npm test
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DateTime } from 'luxon';

const src = (nom) => readFileSync(new URL('../src/' + nom, import.meta.url), 'utf8');
const noeud = (nom, ...vars) => new Function(...vars, src(nom));
const entree = (liste) => ({ all: () => liste.map((json) => ({ json })), first: () => ({ json: liste[0] }) });
const jsons = (sortie) => sortie.map((o) => o.json).filter((j) => !j._skip && !j._none);
const paris = (iso) => DateTime.fromISO(iso, { zone: 'Europe/Paris' });
const JOUR = 864e5;

// ---- Radar OpenRouter ----
const radar = noeud('radar-openrouter.js', '$input', '$getWorkflowStaticData');
const modele = (id, joursAvant, extra = {}) => Object.assign({
  // comme dans le vrai catalogue : « Fournisseur: Nom », suivi de « (free) » pour une version gratuite
  id, name: 'Labo: ' + id.split('/')[1].split(':')[0] + (id.endsWith(':free') ? ' (free)' : ''),
  created: Math.floor((Date.now() - joursAvant * JOUR) / 1000),
  context_length: 200000, pricing: { prompt: '0.000001', completion: '0.000005' }, description: 'Un modèle.',
}, extra);

test('radar OpenRouter : un modèle par identifiant, variantes, alias et routeurs écartés', () => {
  const catalogue = { data: [
    modele('openai/gpt-x', 1), modele('openai/gpt-x:batch', 1), modele('openai/gpt-x:free', 1),
    modele('nvidia/nano-gratuit:free', 2), modele('~openai/gpt-latest', 1), modele('openrouter/auto', 1),
    modele('inconnu/petit-modele', 1),
  ] };
  const sortie = jsons(radar(entree([catalogue]), () => ({})));
  const titres = sortie.map((j) => j.title);
  assert.deepEqual(titres.sort(), [
    'Nouveau modèle Inconnu : petit-modele', 'Nouveau modèle NVIDIA : nano-gratuit', 'Nouveau modèle OpenAI : gpt-x',
  ]);
  const gpt = sortie.find((j) => j.title.includes('gpt-x'));
  assert.match(gpt.contentSnippet, /1 \$ \/ 5 \$ par million de jetons/);
  assert.equal(gpt._feed.a, true); // grand labo : toujours examiné
  assert.equal(sortie.find((j) => j.title.includes('petit-modele'))._feed.a, false);
  assert.match(sortie.find((j) => j.title.includes('nano-gratuit')).contentSnippet, /gratuit/);
});

test('radar OpenRouter : un retrait annoncé est signalé une fois, pas au premier passage', () => {
  const sd = {};
  const cat = (retrait) => ({ data: [modele('anthropic/claude-x', 90, retrait ? { expiration_date: retrait } : {})] });
  const retraits = (sortie) => jsons(sortie).filter((j) => j.title.startsWith('Retrait'));
  assert.equal(retraits(radar(entree([cat('2026-12-01')]), () => sd)).length, 0); // amorçage
  assert.equal(retraits(radar(entree([cat('2026-12-01')]), () => sd)).length, 0); // déjà connu
  const nouveau = retraits(radar(entree([cat('2027-01-15')]), () => sd));
  assert.equal(nouveau.length, 1);
  assert.match(nouveau[0].title, /après le 2027-01-15/);
});

// ---- Hugging Face ----
const labos = noeud('labos-hf.js');
const mapHf = noeud('map-hf-labos.js', '$input', '$getWorkflowStaticData', '$');
const reglages = labos().map((o) => ({ json: o.json }));
const $ = () => ({ all: () => reglages });
const depot = (id, likes, joursAvant, extra = {}) => Object.assign({ id, likes, createdAt: new Date(Date.now() - joursAvant * JOUR).toISOString(), tags: [] }, extra);

test('Hugging Face : noms d\'organisation exacts, Meta par meta-models', () => {
  const orgs = reglages.map((r) => r.json.org);
  assert.ok(orgs.includes('Qwen') && !orgs.includes('qwen'));
  assert.ok(orgs.includes('meta-models'));
});

test('Hugging Face : amorçage silencieux, puis une annonce par famille, dérivés et seuils respectés', () => {
  const sd = {};
  assert.equal(jsons(mapHf(entree([depot('mistralai/Ancien-7B', 500, 200)]), () => sd, $)).length, 0);
  const sortie = jsons(mapHf(entree([
    depot('mistralai/Ancien-7B', 500, 200),
    depot('mistralai/Nouveau-24B-Instruct', 40, 2), depot('mistralai/Nouveau-24B-Base', 12, 2),
    depot('mistralai/Nouveau-24B-Instruct-GGUF', 90, 2), depot('mistralai/Discret-1B', 3, 2),
    depot('nvidia/Robot-Policy', 30, 2), depot('nvidia/Nemotron-9-Mega-200B', 400, 2),
  ]), () => sd, $));
  const titres = sortie.map((j) => j.title).sort();
  assert.deepEqual(titres, [
    'Mistral AI publie un nouveau modèle ouvert : Nouveau 24B Instruct',
    'NVIDIA publie un nouveau modèle ouvert : Nemotron 9 Mega 200B',
  ]); // Discret-1B sous le seuil de 10, Robot-Policy sous celui de NVIDIA (50), le GGUF rangé dans sa famille
  assert.equal(jsons(mapHf(entree([depot('mistralai/Nouveau-24B-Instruct', 60, 3)]), () => sd, $)).length, 0);
});

test('Hugging Face : un dépôt créé longtemps avant sa publication est quand même signalé', () => {
  const sd = { hfAmorce: true, hfFamilles: {} };
  const sortie = jsons(mapHf(entree([depot('meta-models/Muse-Spark-Open-816B-A42B', 900, 43)]), () => sd, $));
  assert.equal(sortie.length, 1);
  assert.match(sortie[0].title, /^Meta publie un nouveau modèle ouvert : Muse Spark Open/);
});

// ---- Hacker News ----
test('Hacker News : points, commentaires et lien de discussion', () => {
  const mapHn = noeud('map-hn.js', '$input');
  const [a, b] = jsons(mapHn(entree([{ hits: [
    { objectID: '1', title: 'Un article', url: 'https://exemple.org/a', points: 420, num_comments: 99, created_at: '2026-10-28T08:00:00Z' },
    { objectID: '2', title: 'Ask HN: une question', points: 150, num_comments: 80, created_at: '2026-10-28T09:00:00Z' },
  ] }])));
  assert.deepEqual(a._signals, { hnPoints: 420, hnComments: 99, hnUrl: 'https://news.ycombinator.com/item?id=1' });
  assert.equal(b.link, 'https://news.ycombinator.com/item?id=2'); // pas d'adresse : la discussion
});

// ---- AINews et la collecte ----
const normalize = noeud('normalize.js', '$input', '$getWorkflowStaticData');
const numero = '<h1>AI Twitter Recap</h1><p><b>Genie 4: DeepMind world model</b></p><ul><li>…</li></ul>'
  + '<p><b>Top tweets (by engagement)</b></p><h1>AI Reddit Recap</h1><h3>1. Claude Code Usage Limits</h3>';

test('AINews : le numéro est gardé sous son nom, et ses sujets du jour sont relevés', () => {
  const sd = {};
  const sortie = jsons(normalize(entree([
    { title: '[AINews] Genie 4 day', link: 'https://latent.space/p/ainews-1', isoDate: new Date().toISOString(),
      'content:encoded': numero, _feed: { s: 'Latent Space', c: 'ia', w: 1.2, k: 'newsletter' } },
  ]), () => sd));
  assert.equal(sortie.length, 1);
  assert.equal(sortie[0].source, 'AINews');
  assert.equal(sortie[0].kind, 'buzz');
  assert.deepEqual(sd.ainews.sujets, ['Genie 4: DeepMind world model', 'Claude Code Usage Limits']);
});

test('Bluesky et Techmeme : titre de repli, lien de l\'article d\'origine', () => {
  const sortie = jsons(normalize(entree([
    { title: '', link: 'https://bsky.app/profile/x/post/1', contentSnippet: 'Première ligne du message\nla suite',
      isoDate: new Date().toISOString(), _feed: { s: 'Quelqu\'un (Bluesky)', c: 'ia', k: 'bluesky' } },
    { title: 'Un titre', link: 'https://www.techmeme.com/261028/p1', isoDate: new Date().toISOString(),
      content: '<A HREF="https://www.techmeme.com/x">T</A><A HREF="https://exemple.org/origine">A</A>', _feed: { s: 'Techmeme', k: 'news' } },
  ]), () => ({})));
  assert.equal(sortie[0].title, 'Première ligne du message');
  assert.equal(sortie[1].url, 'https://exemple.org/origine');
});

test('la collecte est due au réveil du Mac, au plus toutes les trois heures, et avant le brief', () => {
  const due = noeud('collecte-due.js', '$now', '$getWorkflowStaticData');
  const a = (iso, sd) => due(paris(iso), () => sd).length > 0;
  const il = (iso) => paris(iso).toMillis();
  // n8n passe jour et nuit (un minuteur ne compte que le temps où le Mac est allumé) ; la nuit, rien.
  const [wf] = JSON.parse(readFileSync(new URL('../veille-pro-v2.json', import.meta.url), 'utf8'));
  assert.equal(wf.nodes.find((n) => n.name === 'Toutes les 30 min').parameters.rule.interval[0].expression, '0 */30 * * * *');
  for (const nuit of ['2026-10-28T23:00', '2026-10-29T02:30', '2026-10-28T06:30']) assert.equal(a(nuit, {}), false, nuit);
  assert.equal(a('2026-10-28T10:00', { lastCollectAt: il('2026-10-28T09:00'), lastDigestAt: il('2026-10-28T08:40') }), false);
  assert.equal(a('2026-10-28T12:00', { lastCollectAt: il('2026-10-28T09:00'), lastDigestAt: il('2026-10-28T08:40') }), true);
  assert.equal(a('2026-10-28T08:30', { lastCollectAt: il('2026-10-28T07:30'), lastDigestAt: il('2026-10-27T08:40') }), true);
});

// ---- Regroupement ----
test('regroupement : deux titres différents sur le même modèle forment un seul sujet, mené par la source officielle', () => {
  const cluster = noeud('cluster.js', '$input', '$getWorkflowStaticData');
  const article = (title, source, kind, w, url) => ({ title, url, canonicalKey: url.replace('https://', ''), source, kind,
    weight: w, cat: 'ia', publishedAt: new Date().toISOString(), snippet: '', signals: {}, preScore: 5 });
  const sortie = jsons(cluster(entree([
    article('GPT-6.1 Terra benchmark thread', 'Reddit IA', 'reddit', 1.0, 'https://reddit.com/r/x/1'),
    article('Nouveau modèle OpenAI : GPT-6.1 Terra', 'OpenRouter (nouveaux modèles)', 'radar', 1.3, 'https://openrouter.ai/openai/gpt-6.1-terra'),
    article('Introducing GPT-6.1 Terra for computer use', 'OpenAI', 'lab', 1.4, 'https://openai.com/index/gpt-6-1-terra'),
    article('Claude Platform release notes — October 21, 2026', 'Claude Platform (notes de version)', 'lab', 1.4, 'https://platform.claude.com/a'),
    article('Claude Platform release notes — October 23, 2026', 'Claude Platform (notes de version)', 'lab', 1.4, 'https://platform.claude.com/b'),
  ]), () => ({})));
  const terra = sortie.find((s) => s.title.includes('Terra'));
  assert.equal(terra.sources[0].s, 'OpenAI');
  assert.equal(terra.sourceCount, 3);
  assert.equal(terra.labo, true);
  assert.equal(sortie.length, 3); // les deux notes de version restent deux sujets
});

// ---- Messages Discord ----
test('brief et bilan : le bloc de code dont un modèle entoure sa réponse est retiré', () => {
  const $ = () => ({ first: () => ({ json: { count: 3, periode: 'depuis hier' } }) });
  const reponse = '```markdown\n**🎯 L\'essentiel** — un sujet.\n```';
  for (const nom of ['digest-cv2.js', 'hebdo-cv2.js']) {
    const sd = {};
    const mettreEnForme = noeud(nom, '$input', '$getWorkflowStaticData', '$now', '$');
    const sortie = mettreEnForme(entree([{ text: reponse }]), () => sd, paris('2026-10-28T15:40'), $);
    const blocs = sortie[0].json.payload.components[0].components;
    assert.equal(blocs.at(-1).content, '**🎯 L\'essentiel** — un sujet.', nom);
  }
});

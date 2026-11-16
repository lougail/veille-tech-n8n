// Les outils communs de la veille ParlIA (src-parlia/outils.js), placés par build_parlia.py en tête des nœuds Code
// qui s'en servent. Lance avec : npm test
import assert from 'node:assert/strict';
import test from 'node:test';
import { OUTILS } from './aide-parlia.mjs';

const o = new Function(OUTILS + '\nreturn { PARLIA, texteSimple, tronquer, hacher, domaineDe, cleAdresse, cellule, pourDiscord, dateLongue, dateDansTexte, noterSante, pousserAlerte, nomsSuivisDans, ligneHorsTexte, lignesHorsTexte, deRetraitsTexte, hypotheseFautive };')();

test('le texte lisible : sans balises ni entités, espaces réduits ; coupé au mot, avec des points de suspension', () => {
  assert.equal(o.texteSimple('<p>Le&nbsp;prix &amp; la <b>date</b>&#39;</p>\n  suite'), "Le prix & la date ' suite");
  assert.equal(o.texteSimple(null), '');
  assert.equal(o.tronquer('court', 10), 'court');
  assert.equal(o.tronquer('Un modèle cent fois moins cher', 20), 'Un modèle cent fois…');
  assert.equal(o.tronquer('abcdefghijklmnopqrstuvwxyz', 10), 'abcdefghi…');
});

test("l'empreinte est stable et courte ; le domaine et la clé d'une adresse ignorent www, le suivi et la barre finale", () => {
  assert.equal(o.hacher('Decisions API'), o.hacher('Decisions API'));
  assert.notEqual(o.hacher('Decisions API'), o.hacher('Decisions api'));
  assert.match(o.hacher('x'), /^[0-9a-z]{1,7}$/);
  assert.equal(o.domaineDe('https://www.cnil.fr/fr/actualites?x=1'), 'cnil.fr');
  assert.equal(o.domaineDe('pas une adresse'), '');
  assert.equal(o.cleAdresse('https://www.openai.com/index/decisions-api/?utm_source=x&b=2&a=1#haut'), 'openai.com/index/decisions-api?a=1&b=2');
  assert.equal(o.cleAdresse('http://m.example.org/a/'), 'example.org/a');
  assert.equal(o.cleAdresse(''), '');
});

test('une cellule de tableau Markdown, un texte pour Discord', () => {
  assert.equal(o.cellule('Prix | nouveaux\n  modèles '), 'Prix \\| nouveaux modèles');
  assert.equal(o.cellule(undefined), '');
  assert.equal(o.pourDiscord('@everyone et @Here'), '@\u200beveryone et @\u200bHere');
});

test('les dates : en toutes lettres, et la première date écrite dans un texte, sous quatre formes', () => {
  assert.equal(o.dateLongue('2026-12-01'), '1er décembre 2026');
  assert.equal(o.dateLongue('2026-11-04T09:00:00Z'), '4 novembre 2026');
  assert.equal(o.dateLongue('n importe quoi'), '');
  assert.equal(o.dateDansTexte('Publié le 2026-10-22, mis à jour le 2026-10-23'), '2026-10-22');
  assert.equal(o.dateDansTexte('October 14, 2026 — Jev 1.14'), '2026-10-14');
  assert.equal(o.dateDansTexte('Sept 3 2026'), '2026-09-03');
  assert.equal(o.dateDansTexte('le 1er février 2027, puis le 2026-12-02'), '2027-02-01'); // la première dans le texte
  assert.equal(o.dateDansTexte('Liquid AI · 10.22.2026'), '2026-10-22');
  assert.equal(o.dateDansTexte('2026-13-40 et rien'), '');
});

test("la santé d'une source : une alerte au troisième échec de suite, une seule ; un retour annoncé", () => {
  const sd = {};
  for (let i = 0; i < 4; i++) o.noterSante(sd, 'A08', 'CNIL, actualités', false, 'code 503', i);
  assert.deepEqual(sd._passage.flux, [{ id: 'A08', s: 'CNIL, actualités', echecs: 3, detail: 'code 503' }]);
  assert.equal(sd.sante.A08.echecs, 4);
  o.noterSante(sd, 'A08', 'CNIL, actualités', true, '', 10);
  assert.deepEqual(sd._passage.flux.at(-1), { id: 'A08', s: 'CNIL, actualités', retour: true });
  assert.deepEqual([sd.sante.A08.echecs, sd.sante.A08.alerte, sd.sante.A08.dernierOk], [0, false, 10]);
});

test("une alerte n'est déposée qu'une fois par passage, d'après sa clé", () => {
  const sd = {};
  o.pousserAlerte(sd, { type: 'remaniement', id: 'JORFTEXT1', titre: 'Décret relatif à la composition du Gouvernement' });
  o.pousserAlerte(sd, { type: 'remaniement', id: 'JORFTEXT1', titre: 'Décret relatif à la composition du Gouvernement' });
  o.pousserAlerte(sd, { type: 'attributions', id: 'JORFTEXT2', titre: 'Décret relatif aux attributions du ministre' });
  assert.deepEqual(sd._alertes.map((a) => a.type), ['remaniement', 'attributions']);
  assert.ok(sd._alertes.every((a) => a.cle));
});

test('les modèles suivis et le thème', () => {
  assert.ok(o.PARLIA.NOMS_SUIVIS.test('Retiring gpt-4o-mini on January 14'));
  assert.ok(o.PARLIA.NOMS_SUIVIS.test('Build more responsive apps with the Decisions API'));
  assert.ok(!o.PARLIA.NOMS_SUIVIS.test('GPT-4o arrives in Europe'));
  // Mistral Large 4, Kev et Zuse, candidats possibles du comparatif (séance 03, 16 novembre 2026).
  assert.ok(o.PARLIA.SUIVI.includes('mistralai/mistral-large-4-0'));
  for (const t of ['Mistral Large 4 (Le Chonk) is now open weight', "Changement de prix d'un modèle suivi : mistralai/mistral-large-4-0",
    'Zuse: A Decision Model for European Languages', 'Kev 1.1 is out']) assert.ok(o.PARLIA.NOMS_SUIVIS.test(t), t);
  assert.ok(!o.PARLIA.NOMS_SUIVIS.test('The Zuse Institute Berlin releases a new solver'));
  assert.deepEqual(o.PARLIA.AXES, ['fournisseurs', 'qualite', 'conformite', 'exploitation']);
  assert.match(o.PARLIA.THEME, /^« Étiqueter les questions écrites du Sénat/);
});

// Des lignes réelles de la page des retraits d'OpenAI et du billet de Cloudflare du 5 novembre 2026, relues le
// 16 novembre 2026 : la page d'OpenAI compte 60 lignes hors texte sur 158, le billet de Cloudflare 8 sur 24 modèles.
test("les retraits d'OpenAI et de Cloudflare : une ligne qui ne nomme que des modèles d'image, de son, de vidéo, de plongements ou de modération", () => {
  for (const l of [
    '§L Shutdown date : Dec 1, 2026 · Affected model : gpt-image-1-mini · Status : Deprecated · Recommended replacement : gpt-image-2.6-sunburst or gpt-image-2.6-flare · Notice date : Jun 2, 2026',
    '§L Shutdown date : Jan 6, 2027 · Affected model : tts-1 · Status : Deprecated · Recommended replacement : gpt-realtime-2.1-mini · Notice date : Oct 1, 2026',
    '§L Shutdown date : Feb 26, 2027 · Affected model : whisper-1 · Status : Deprecated · Recommended replacement : gpt-live-transcribe or gpt-transcribe · Notice date : Aug 26, 2026',
    '§L Shutdown date : Sep 24, 2026 · Affected model or feature : sora-2 · Listed replacement : No one-to-one replacement · Notice date : Mar 24, 2026',
    '§L Shutdown date : Jan 4, 2024 · Affected model or feature : text-similarity-ada-001 Historical price $4.00 / 1M tokens · Listed replacement : text-embedding-3-small · Notice date : Jul 6, 2023',
    '§L Shutdown date : Oct 27, 2025 · Affected model or feature : text-moderation-007 · Listed replacement : omni-moderation · Notice date : Apr 28, 2025',
    '@cf/myshell-ai/melotts → @cf/deepgram/aura-2-en',
    '@cf/stabilityai/stable-diffusion-xl-base-1.0 → @cf/black-forest-labs/flux-2-klein-9b',
    '@cf/llava-hf/llava-1.5-7b-hf → @cf/moondream/moondream3.1-9B-A2B',
    '@cf/google/embeddinggemma-300m → @cf/google/embeddinggemma-2 (available soon)',
  ]) assert.equal(o.ligneHorsTexte(l), true, l);
  for (const l of [
    '§L Shutdown date : Jan 14, 2027 · Affected model : GPT-4o ( gpt-4o-2024-08-06 , gpt-4o-2024-11-20 ) · Status : Deprecated · Recommended replacement : gpt-6-luna · Notice date : Oct 14, 2026',
    '§L Shutdown date : Feb 1, 2027 · Affected model : gpt-5.5-cyber-preview · Status : Deprecated · Recommended replacement : The most capable cyber model available to you. · Notice date : Nov 5, 2026',
    '§L Shutdown date : Dec 6, 2024 · Affected model or feature : gpt-4-vision-preview Historical price $10.00 / 1M input tokens + $30 / 1M output tokens · Listed replacement : gpt-4o · Notice date : Jun 6, 2024',
    '§L Shutdown date : Nov 30, 2026 · Affected feature or endpoint : /v1/prompts and reusable prompt objects · Status : Deprecated · Recommended replacement : Move prompt content into your application code. · Notice date : May 7, 2026',
    '@cf/meta/llama-3.2-1b-instruct',
    'For frontier model needs: @cf/deepseek-ai/deepseek-v4.1-flash-1017 and @cf/zai-org/glm-5.3 .',
    'Starting November 20, 2026, these models will stop returning responses.',
  ]) assert.equal(o.ligneHorsTexte(l), false, l);
  assert.equal(o.deRetraitsTexte('F02', '', 'OpenAI, retraits de modèles'), true);
  assert.equal(o.deRetraitsTexte('X01', 'Workers AI - Planned model deprecations on Workers AI', ''), true);
  assert.equal(o.deRetraitsTexte('X01', 'Workers AI - EmbeddingGemma 2 now available on Workers AI', 'Cloudflare, journal de Workers AI'), false);
  assert.equal(o.deRetraitsTexte('F13', '', 'Google, retraits de modèles Gemini'), false);
});

// La relecture du 16 novembre 2026 : une ligne sur un modèle suivi, écrit seul, était écartée pour un mot de son
// (« realtime », « audio »), même écrit avec un trait d'union typographique ; « tts » et « voice » comptaient au milieu
// d'un nom (mattshumer, invoice). gpt-4o-mini-tts, lui, reste un modèle de voix : ce n'est pas gpt-4o-mini.
test("les retraits : un modèle suivi écrit seul garde sa ligne ; tts et voice ne comptent pas au milieu d'un nom", () => {
  for (const l of [
    'Decisions API realtime : a lower-latency mode for streaming decisions',
    'Shutdown date : Mar 3, 2027 · Affected model : GPT\u20116 Luna audio',
    '@cf/mattshumer/reflection-llama-3.1-70b',
    'Affected model : invoice-parser-7b',
  ]) assert.equal(o.ligneHorsTexte(l), false, l);
  for (const l of [
    'Affected model : gpt-4o-mini-tts · Recommended replacement : gpt-realtime-2.1-mini',
    '@cf/myshell-ai/melotts → @cf/deepgram/aura-2-en',
  ]) assert.equal(o.ligneHorsTexte(l), true, l);
});

test("les retraits : la section d'un intertitre qui ne nomme que des modèles d'image est écartée jusqu'à l'intertitre suivant", () => {
  assert.deepEqual(o.lignesHorsTexte([
    '§T Upcoming deprecations', 'On November 5, 2026, we notified developers.',
    '§T 2026-11-10: gpt-image-2 and dall-e-3', 'On November 10, 2026, we notified developers using these models.',
    '§L Shutdown date : Feb 10, 2027 · Notice date : Nov 10, 2026',
    '§T 2026-10-14: GPT-4o and GPT-4.1', '§L Shutdown date : Jan 14, 2027 · Affected model : tts-1',
  ]), [false, false, true, true, true, false, true]);
});

// Le contrôle des hypothèses (sources.md, 5.3), sur les cas réels : le rejeu de la semaine 46 et l'essai du
// 16 novembre 2026 (182 hypothèses, 5 écartées, toutes à raison), puis les tournures qui doivent rester.
test("le contrôle des hypothèses : aucun service n'est utilisé par ParlIA ; un retrait n'est prêté qu'à un modèle nommé", () => {
  const billet = 'Workers AI - Planned model deprecations on Workers AI Starting November 20, 2026, these models will stop returning responses. · LLMs · @cf/meta/llama-3.2-1b-instruct · @cf/qwen/qwq-32b';
  const usage = "elle dit « utilisés par ParlIA », alors qu'aucun service n'est utilisé ni choisi";
  assert.equal(o.hypotheseFautive("Le retrait de gpt-5.5-cyber-preview au 1er février 2027 pourrait impacter les services d'OpenAI utilisés par ParlIA si un modèle suivi est concerné.", 'OpenAI, retraits de modèles'), usage);
  assert.equal(o.hypotheseFautive('Les résultats pourraient inspirer des optimisations pour les modèles de décision utilisés par ParlIA.', 'From Large Language Models to Efficient System One Models'), usage);
  assert.equal(o.hypotheseFautive('Si Clef ou Clef-flash de Cloudflare entraient au comparatif, leur retrait prévu le 15 novembre 2026 obligerait à les remplacer.', billet),
    "elle prête un retrait à Clef, que l'article ne nomme pas");
  assert.equal(o.hypotheseFautive('Cela pourrait remettre en cause le choix de ParlIA pour Jev.', 'Jev 1.14'),
    "elle dit « choix de ParlIA pour Jev », alors qu'aucun service n'est utilisé ni choisi");
  // La condition est dans la proposition d'avant : celle-ci affirme.
  assert.match(o.hypotheseFautive('Si ce retrait se confirmait, ParlIA utilise déjà la Decisions API et devrait migrer.', billet), /« ParlIA utilise »/);
  for (const h of [
    "Si ParlIA utilise des modèles de Workers AI, il faudrait mettre à jour les références avant le 20 novembre 2026 pour éviter des erreurs d'API.",
    "Le modèle Drex, s'il entrait au comparatif, pourrait être une alternative open-weight aux modèles de décision suivis (Jev, d1, etc.) pour ParlIA.",
    "Si Muse Ember entrait au comparatif, son prix compétitif et ses performances en extraction de texte pourraient influencer le choix de ParlIA pour l'étiquetage.",
    "Le cadre AAELI pourrait optimiser le budget d'audit humain, en utilisant des processus de confiance séquentiels pour décider quand valider une étiquette.",
    "Gemini 4 Carbon pourrait, s'il entrait au comparatif, être utilisé par ParlIA pour des tâches de décision.",
    'Ces modèles, qui ne sont pas utilisés par ParlIA, pourraient servir de point de comparaison.',
    // Ce qui est vrai : ParlIA utilise le modèle que Louis entraîne.
    'Cette méthode pourrait améliorer le modèle utilisé par ParlIA, celui que Louis entraîne.',
    "ParlIA utilise son propre modèle : ce prix ne change rien aujourd'hui.",
    'Un changement de format des données du Sénat utilisées par ParlIA pourrait casser la collecte.',
    "Clef n'est pas concerné par ce retrait, qui ne vise que des modèles de texte de Workers AI.",
    'Si Clef entrait au comparatif, son prix pourrait compter.',
    'rien',
  ]) assert.equal(o.hypotheseFautive(h, billet), '', h);
  // La Decisions API d'OpenAI repose sur GPT-6 Luna : un retrait de l'une concerne l'autre.
  assert.equal(o.hypotheseFautive("L'arrêt de GPT-6 Luna arrêterait aussi la Decisions API, candidate du comparatif.", 'Affected model : gpt-6-luna'), '');
});

// La relecture du lot, le 16 novembre 2026 : le point d'un nombre, les négations, une condition, une relative, un
// trait d'union typographique, un nom de modèle prolongé.
test("les modèles suivis qu'un texte nomme : une clé par modèle ; gpt-4o-mini-tts n'est pas gpt-4o-mini, jev-1.14.0 est Jev", () => {
  assert.deepEqual([...o.nomsSuivisDans('Retiring gpt-4o-mini-tts and jev-1.14.0; GPT\u20116 Luna and gpt-6-luna stay').entries()],
    [['jev', 'jev'], ['gpt 6 luna', 'GPT-6 Luna']]);
});

test("le contrôle des hypothèses : décimales, négations, conditions, relatives et traits d'union", () => {
  for (const h of [
    'ParlIA utilise Mistral Small 3.2 pour étiqueter les questions.',
    'Claude Haiku 5.5 utilisé par ParlIA pourrait coûter plus cher.',
    'Louis a choisi GPT-6.1 Terra pour le comparatif.',
    'La Decisions API que ParlIA utilise pourrait changer de prix.',
  ]) assert.match(o.hypotheseFautive(h, 'un article'), /^elle dit « /, h);
  assert.equal(o.hypotheseFautive('Le retrait de GPT\u20116 Luna obligerait à changer de service.', 'OpenAI retire gpt-4.1-mini'),
    "elle prête un retrait à GPT-6 Luna, que l'article ne nomme pas");
  assert.equal(o.hypotheseFautive('Le retrait de gpt-4o-mini pourrait toucher le comparatif.', 'Shutdown date : Jan 6, 2027 · Affected model : gpt-4o-mini-tts'),
    "elle prête un retrait à gpt-4o-mini, que l'article ne nomme pas");
  for (const h of [
    "Aucun service du marché n'est utilisé par ParlIA : ce retrait ne change rien.",
    'Si les modèles de Workers AI sont utilisés par ParlIA, il faudrait les remplacer.',
    "Aucun candidat (Clef, Jev) n'est concerné par ce retrait.",
    'Ce retrait ne concerne aucun modèle suivi (GPT-6 Luna).',
    "Ce retrait n'affecte pas Clef.",
    "Ce prix pourrait peser dans le choix de ParlIA pour l'étiquetage, face à Jev.",
    "Le modèle que ParlIA utilise aujourd'hui reste celui de Louis.",
  ]) assert.equal(o.hypotheseFautive(h, 'Workers AI - Planned model deprecations'), '', h);
});

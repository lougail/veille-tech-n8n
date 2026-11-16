// Les outils communs de la veille ParlIA (src-parlia/outils.js), placés par build_parlia.py en tête des nœuds Code
// qui s'en servent. Lance avec : npm test
import assert from 'node:assert/strict';
import test from 'node:test';
import { OUTILS } from './aide-parlia.mjs';

const o = new Function(OUTILS + '\nreturn { PARLIA, texteSimple, tronquer, hacher, domaineDe, cleAdresse, cellule, pourDiscord, dateLongue, dateDansTexte, noterSante, pousserAlerte, ligneHorsTexte, deRetraitsTexte };')();

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

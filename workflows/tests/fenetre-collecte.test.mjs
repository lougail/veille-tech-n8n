// Fenêtre de collecte (normalize.js) et taille du pré-classement (prerank.js).
// Lance avec : node --test "workflows/tests/*.test.mjs"
// Les nœuds Code de n8n sont des corps de fonction : on les exécute en fournissant
// les deux variables qu'ils utilisent, $input et $getWorkflowStaticData.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const src = (nom) => readFileSync(new URL('../src/' + nom, import.meta.url), 'utf8');
const normalize = new Function('$input', '$getWorkflowStaticData', src('normalize.js'));
const prerank = new Function('$input', '$getWorkflowStaticData', src('prerank.js'));

const H = 3600 * 1000;
const feed = { s: 'Test', c: 'ia', w: 1, k: 'blog' };

function collecter(derniereIlYaH, ages) {
  const sd = {};
  if (derniereIlYaH !== null) sd.lastCollectAt = Date.now() - derniereIlYaH * H;
  const articles = ages.map((age, n) => ({ json: {
    title: 'Article ' + n,
    link: 'https://exemple.org/a' + n,
    isoDate: age === null ? undefined : new Date(Date.now() - age * H).toISOString(),
    _feed: feed,
  } }));
  const avant = Date.now();
  const sortie = normalize({ all: () => articles }, () => sd);
  return {
    fenetre: sd._runStats.windowHours,
    gardes: sortie.filter((o) => !o.json._none).map((o) => o.json.title),
    dateMiseAJour: sd.lastCollectAt >= avant,
  };
}

test('première collecte : 24 h, les articles non datés sont gardés', () => {
  const r = collecter(null, [23, 25, null]);
  assert.equal(r.fenetre, 24);
  assert.deepEqual(r.gardes, ['Article 0', 'Article 2']);
  assert.ok(r.dateMiseAJour);
});

test('après trois jours de sommeil, tout ce qui a été publié depuis est gardé', () => {
  const r = collecter(72, [70, 73, 80]);
  assert.equal(r.fenetre, 74);
  assert.deepEqual(r.gardes, ['Article 0', 'Article 1']);
});

test('après dix jours de sommeil, la fenêtre est plafonnée à sept jours', () => {
  const r = collecter(240, [160, 170]);
  assert.equal(r.fenetre, 168);
  assert.deepEqual(r.gardes, ['Article 0']);
});

test('deux collectes rapprochées gardent une fenêtre de 24 h au moins', () => {
  const r = collecter(2, [20, 30]);
  assert.equal(r.fenetre, 24);
  assert.deepEqual(r.gardes, ['Article 0']);
});

test('le pré-classement garde 130 articles par jour collecté, 260 au plus', () => {
  const taille = (windowHours) => {
    const items = Array.from({ length: 400 }, (_, i) => ({ json: {
      title: 't' + i, snippet: '', publishedAt: new Date().toISOString(),
      canonicalKey: 'k' + i, signals: {}, weight: 1,
    } }));
    return prerank({ all: () => items }, () => ({ _runStats: { windowHours } })).length;
  };
  assert.equal(taille(24), 130);
  assert.equal(taille(36), 195);
  assert.equal(taille(74), 260);
});

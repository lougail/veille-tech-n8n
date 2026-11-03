// Les outils communs de la veille ParlIA (src-parlia/outils.js), placés par build_parlia.py en tête des nœuds Code
// qui s'en servent. Lance avec : npm test
import assert from 'node:assert/strict';
import test from 'node:test';
import { OUTILS } from './aide-parlia.mjs';

const o = new Function(OUTILS + '\nreturn { PARLIA, texteSimple, tronquer, hacher, domaineDe, cleAdresse, cellule, pourDiscord, dateLongue, dateDansTexte, noterSante, pousserAlerte };')();

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
  assert.deepEqual(o.PARLIA.AXES, ['fournisseurs', 'qualite', 'conformite', 'exploitation']);
  assert.match(o.PARLIA.THEME, /^« Étiqueter les questions écrites du Sénat/);
});

// Ce que le résumé relit dans le registre des stories (prompt-digest.js).
// Lance avec : npm test
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DateTime } from 'luxon';

const code = readFileSync(new URL('../src/prompt-digest.js', import.meta.url), 'utf8');
const preparer = new Function('$now', '$input', '$getWorkflowStaticData', code);
const paris = (iso) => DateTime.fromISO(iso, { zone: 'Europe/Paris' });

function story(iso, publiee = true) {
  return { t: 'Sujet ' + iso, u: 'https://exemple.org/' + iso, c: 'ia', s: 7, p: publiee, f: paris(iso).toUTC().toISO() };
}
const registre = {
  stories: [story('2026-10-19T09:00'), story('2026-10-21T13:00'), story('2026-10-22T19:00'),
    story('2026-10-23T08:00'), story('2026-10-23T13:00', false)],
};
function preparerA(maintenant, depuisIso) {
  const plan = { depuisResume: depuisIso ? paris(depuisIso).toMillis() : 0 };
  return preparer(paris(maintenant), { first: () => ({ json: plan }) }, () => registre);
}

test('le résumé du soir relit ce qui a été publié depuis le résumé précédent', () => {
  const [r] = preparerA('2026-10-23T18:30', '2026-10-22T18:35');
  assert.equal(r.json.count, 2); // le 22 à 19 h et le 23 à 8 h ; la story non publiée est ignorée
  assert.equal(r.json.periode, 'depuis jeudi 22 octobre à 18 h');
});

test('un résumé parti le matin même donne une période « aujourd’hui »', () => {
  const [r] = preparerA('2026-10-23T18:30', '2026-10-23T07:30');
  assert.equal(r.json.count, 1);
  assert.equal(r.json.periode, "aujourd'hui");
});

test('sans résumé depuis longtemps, il relit au plus les trois derniers jours', () => {
  const [r] = preparerA('2026-10-23T18:30', null);
  assert.equal(r.json.count, 3); // la story du 19 a plus de trois jours
});

test('rien de publié depuis le résumé précédent : pas de résumé', () => {
  assert.deepEqual(preparerA('2026-10-23T18:30', '2026-10-23T12:00'), []);
});

// Quand le résumé du jour et le bilan de la semaine doivent partir (planifier-resumes.js).
// Lance avec : npm test
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DateTime } from 'luxon';

const code = readFileSync(new URL('../src/planifier-resumes.js', import.meta.url), 'utf8');
const planifier = new Function('$now', '$getWorkflowStaticData', code);
const paris = (iso) => DateTime.fromISO(iso, { zone: 'Europe/Paris' });
const ms = (iso) => paris(iso).toMillis();

function plan(maintenant, sd) {
  return planifier(paris(maintenant), () => sd)[0].json;
}

// Le vendredi 23 octobre 2026 ; le dimanche 18 octobre est le dernier dimanche passé.
test('le résumé parti la veille au soir ne repart pas avant 17 h', () => {
  assert.equal(plan('2026-10-23T13:00', { lastDigestAt: ms('2026-10-22T18:35') }).resumeDu, false);
});

test('le résumé part au premier passage après 17 h', () => {
  assert.equal(plan('2026-10-23T18:30', { lastDigestAt: ms('2026-10-22T18:35') }).resumeDu, true);
});

test('le résumé manqué la veille au soir part dès le matin', () => {
  assert.equal(plan('2026-10-23T08:00', { lastDigestAt: ms('2026-10-21T18:35') }).resumeDu, true);
});

test('après un rattrapage le matin, le résumé du soir part quand même', () => {
  const sd = { lastDigestAt: ms('2026-10-23T08:05') };
  assert.equal(plan('2026-10-23T13:00', sd).resumeDu, false);
  assert.equal(plan('2026-10-23T18:30', sd).resumeDu, true);
});

test("l'ancien format, la seule date du dernier résumé, est encore compris", () => {
  const r = plan('2026-10-23T08:00', { lastDigest: { d: '2026-10-09', text: '…' } });
  assert.equal(r.resumeDu, true);
  assert.equal(r.depuisResume, Date.parse('2026-10-09T18:30:00+02:00'));
});

test('le bilan part le dimanche après 17 h, une seule fois', () => {
  assert.equal(plan('2026-10-25T13:00', { lastHebdoAt: ms('2026-10-18T18:40') }).bilanDu, false);
  assert.equal(plan('2026-10-25T18:30', { lastHebdoAt: ms('2026-10-18T18:40') }).bilanDu, true);
  assert.equal(plan('2026-10-25T18:45', { lastHebdoAt: ms('2026-10-25T18:31') }).bilanDu, false);
});

test('le bilan manqué le dimanche part au passage suivant, puis plus de la semaine', () => {
  assert.equal(plan('2026-10-26T08:00', { lastHebdoAt: ms('2026-10-18T18:40') }).bilanDu, true);
  assert.equal(plan('2026-10-27T13:00', { lastHebdoAt: ms('2026-10-26T08:02') }).bilanDu, false);
});

test('sans aucun envoi enregistré, résumé et bilan sont dus', () => {
  const r = plan('2026-10-23T13:00', {});
  assert.equal(r.resumeDu, true);
  assert.equal(r.bilanDu, true);
});

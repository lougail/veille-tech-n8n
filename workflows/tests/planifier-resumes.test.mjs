// Quand le brief du matin et le bilan de la semaine doivent partir (planifier-resumes.js).
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
test('le brief parti ce matin ne repart pas avant demain 8 h 30', () => {
  assert.equal(plan('2026-10-23T13:00', { lastDigestAt: ms('2026-10-23T08:35') }).resumeDu, false);
  assert.equal(plan('2026-10-24T08:00', { lastDigestAt: ms('2026-10-23T08:35') }).resumeDu, false);
});

test('le brief part au premier passage après 8 h 30', () => {
  assert.equal(plan('2026-10-23T08:30', { lastDigestAt: ms('2026-10-22T09:00') }).resumeDu, true);
});

test('le brief manqué le matin part au passage suivant, même tard', () => {
  assert.equal(plan('2026-10-23T19:00', { lastDigestAt: ms('2026-10-22T09:00') }).resumeDu, true);
});

test('avant 8 h 30, le brief de la veille suffit', () => {
  assert.equal(plan('2026-10-23T07:30', { lastDigestAt: ms('2026-10-22T18:35') }).resumeDu, false);
});

test("l'ancien format, la seule date du dernier résumé, est encore compris", () => {
  const r = plan('2026-10-23T08:40', { lastDigest: { d: '2026-10-09', text: '…' } });
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

test('sans aucun envoi enregistré, brief et bilan sont dus', () => {
  const r = plan('2026-10-23T13:00', {});
  assert.equal(r.resumeDu, true);
  assert.equal(r.bilanDu, true);
});

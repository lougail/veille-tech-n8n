// Planification de la veille ParlIA (planifier-parlia.js) : rien n'a d'heure fixe, chaque tâche part au
// premier passage après son heure, une seule fois. Lance avec : npm test
import assert from 'node:assert/strict';
import test from 'node:test';
import { executer, ms } from './aide-parlia.mjs';

const REGLAGES = { prepJour: '1', prepHeure: '06:00', rappelJour: '4', rappelHeure: '16:30', collecteHeures: '4',
  candidatsMax: '8', forum: '0', discord: '1', statut: '1', mention: '', essai: '0' };
async function passage(maintenant, sd, reglages = {}) {
  const sortie = await executer('planifier-parlia.js', { input: [Object.assign({}, REGLAGES, reglages)], sd, maintenant });
  return sortie[0] || null;
}
// Le lundi 2 novembre 2026 ouvre la semaine 45.
const faite = (iso) => ({ semaine: '2026-S45', at: ms(iso), rappel: false });

test('la préparation part au premier réveil du lundi, une seule fois', async () => {
  const p = await passage('2026-11-02T09:15', { lastCollectAt: ms('2026-11-01T20:00') });
  assert.equal(p.preparation, true);
  assert.equal(p.semaine.cle, '2026-S45');
  assert.equal(p.semaine.lundi, '2026-11-02');
  assert.equal(p.semaine.dimanche, '2026-11-08');
  assert.equal(await passage('2026-11-02T13:45', { lastCollectAt: ms('2026-11-02T13:30'), prep: faite('2026-11-02T09:15') }), null);
});

test('Mac éteint le lundi : la préparation part au réveil suivant, puis plus de la semaine', async () => {
  const p = await passage('2026-11-04T09:15', { lastCollectAt: ms('2026-10-30T17:00'), prep: { semaine: '2026-S44', at: ms('2026-10-26T09:15') } });
  assert.equal(p.preparation, true);
  assert.equal(p.collecte, true); // toujours une collecte avant la préparation
  const apres = await passage('2026-11-08T21:45', {
    lastCollectAt: ms('2026-11-08T20:00'), prep: Object.assign(faite('2026-11-04T09:15'), { rappel: true }),
  });
  assert.equal(apres, null);
});

test('la semaine suivante, une nouvelle préparation, précédée d\'une collecte si la dernière date de plus de 30 minutes', async () => {
  const p = await passage('2026-11-09T07:15', { lastCollectAt: ms('2026-11-09T07:00'), prep: faite('2026-11-02T09:15') });
  assert.equal(p.preparation, true);
  assert.equal(p.semaine.cle, '2026-S46');
  assert.equal(p.collecte, false); // la collecte de 7 h 00 suffit
  const q = await passage('2026-11-09T07:45', { lastCollectAt: ms('2026-11-09T07:00'), prep: faite('2026-11-02T09:15') });
  assert.equal(q.collecte, true);
});

test('le rappel part au premier passage après le jeudi 16 h 30, une fois', async () => {
  const sd = { lastCollectAt: ms('2026-11-05T16:00'), prep: faite('2026-11-02T09:15') };
  assert.equal(await passage('2026-11-05T16:15', sd), null);
  assert.equal((await passage('2026-11-05T16:45', sd)).rappel, true);
  assert.equal((await passage('2026-11-07T10:15', sd)).rappel, true); // Mac éteint jeudi soir : samedi
  sd.prep.rappel = true;
  assert.equal(await passage('2026-11-05T17:15', sd), null);
});

test('pas de rappel pour une préparation partie après le jeudi 16 h 30, ni sans préparation', async () => {
  assert.equal(await passage('2026-11-06T10:15', { lastCollectAt: ms('2026-11-06T10:00'), prep: faite('2026-11-05T18:00') }), null);
  const sans = await passage('2026-11-05T16:45', { lastCollectAt: ms('2026-11-05T16:00'), prep: { semaine: '2026-S44', at: ms('2026-10-26T09:00') } });
  assert.equal(sans.rappel, false);
  assert.equal(sans.preparation, true);
});

test('la collecte : au plus toutes les 4 heures, la marge du pas de 30 minutes comprise', async () => {
  const sd = (iso) => ({ lastCollectAt: ms(iso), prep: faite('2026-11-02T09:15') });
  assert.equal(await passage('2026-11-03T12:45', sd('2026-11-03T09:15')), null);
  const p = await passage('2026-11-03T13:15', sd('2026-11-03T09:15'));
  assert.equal(p.collecte, true);
  assert.equal(p.jorf, true);
  assert.equal(p.preparation, false);
});

test('les pages sans flux : une fois par jour, avec la collecte', async () => {
  const sd = { lastCollectAt: ms('2026-11-03T08:00'), pagesJour: '2026-11-03', prep: faite('2026-11-02T09:15') };
  assert.equal((await passage('2026-11-03T13:15', sd)).pages, false);
  sd.pagesJour = '2026-11-02';
  assert.equal((await passage('2026-11-03T13:15', sd)).pages, true);
});

test('les réglages : préparation le mercredi à 20 h, rappel le samedi à 10 h, collecte toutes les 8 heures', async () => {
  const r = { prepJour: '3', prepHeure: '20h', rappelJour: '6', rappelHeure: '10:00', collecteHeures: '8' };
  const sd = { lastCollectAt: ms('2026-11-04T15:00'), prep: { semaine: '2026-S44', at: ms('2026-10-28T20:15') } };
  assert.equal(await passage('2026-11-04T19:45', sd, r), null);
  assert.equal((await passage('2026-11-04T20:15', sd, r)).preparation, true);
  const apres = { lastCollectAt: ms('2026-11-07T08:00'), prep: faite('2026-11-04T20:15') };
  assert.equal(await passage('2026-11-07T09:45', apres, r), null);
  assert.equal((await passage('2026-11-07T10:15', apres, r)).rappel, true);
});

test('des réglages invalides reprennent les valeurs par défaut', async () => {
  const p = await passage('2026-11-02T09:15', {}, { prepJour: '9', prepHeure: 'midi', candidatsMax: 'x', mention: 'louis' });
  assert.equal(p.reglages.prepJour, 1);
  assert.deepEqual(p.reglages.prepHeure, { h: 6, mn: 0 });
  assert.equal(p.reglages.candidatsMax, 8);
  assert.equal('candidatsMin' in p.reglages, false);
  assert.equal(p.reglages.mention, '');
  assert.equal(p.reglages.discord, true);
  assert.equal(p.reglages.forum, false);
});

test("en mode essai, tout est dû, et le carnet du passage est ouvert", async () => {
  const sd = { lastCollectAt: ms('2026-11-03T09:00'), pagesJour: '2026-11-03', prep: Object.assign(faite('2026-11-02T09:15'), { rappel: true }) };
  const p = await passage('2026-11-03T09:20', sd, { essai: '1' });
  assert.deepEqual([p.collecte, p.pages, p.jorf, p.preparation, p.rappel, p.essai], [true, true, true, true, true, true]);
  assert.equal(sd._passage.essai, true);
});

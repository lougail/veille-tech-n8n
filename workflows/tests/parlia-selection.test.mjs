// La sélection de la semaine (selection-parlia.js) : au plus 8 fiches, sans minimum, d'après les règles de sources.md, 6.2.
// Lance avec : npm test
import assert from 'node:assert/strict';
import test from 'node:test';
import { executer, plan, ms } from './aide-parlia.mjs';

const MAINTENANT = '2026-11-02T09:15';
let n = 0;
// Un mot propre à chaque entrée (12 → « qxbczz ») : deux titres n'ont jamais deux mots en commun.
const motUnique = (k) => 'qx' + String(k).split('').map((d) => 'abcdefghij'[d]).join('') + 'zz';
// Une entrée du registre, sous sa forme courte ; chaque titre a son propre mot, pour ne pas être pris pour un doublon.
const r = (axe, p, extra = {}) => {
  const id = 'e' + n++;
  return Object.assign({
    id, t: 'Annonce ' + motUnique(n), u: 'https://exemple.org/' + id, s: 'Source ' + id, sid: 'S' + id, axe, p,
    pr: true, na: 'editeur', r: 'Résumé de ' + id, c: 'À chercher dans ' + id, h: 'Hypothèse sur ' + id, f: {}, de: null,
    d: '2026-10-30', vu: ms('2026-11-01T10:00'), ax: false, cn: false, dc: false, sec: '', v: 0, pl: '',
  }, extra);
};
async function choisir(registre, sd = {}, extra = {}) {
  const [s] = await executer('selection-parlia.js', { sd: Object.assign({ registre }, sd), maintenant: MAINTENANT, sorties: { 'Que faire ?': [plan(extra)] } });
  return s;
}
const parAxe = (s) => s.candidats.reduce((o, c) => Object.assign(o, { [c.axe]: (o[c.axe] || 0) + 1 }), {});

test("pas de préparation due : pas de sélection", async () => {
  assert.equal(await choisir([r('fournisseurs', 9)], {}, { preparation: false }), undefined);
});

test('au plus 8 fiches, les mieux notées, au plus 5 par axe, et jamais hors thème', async () => {
  const reg = [];
  for (const axe of ['fournisseurs', 'qualite', 'conformite', 'exploitation']) for (let i = 0; i < 7; i++) reg.push(r(axe, 6 + (i % 4)));
  for (let i = 0; i < 5; i++) reg.push(r('hors_theme', 10));
  const s = await choisir(reg);
  assert.equal(s.candidats.length, 8);
  assert.ok(s.candidats.every((c) => c.p >= 8));
  assert.ok(s.candidats.every((c) => c.axe !== 'hors_theme'));
  assert.deepEqual(s.candidats.map((c) => c.n), Array.from({ length: 8 }, (_, i) => i + 1));
  assert.equal(s.stats.horsTheme, 5);
  // Un axe très fourni ne prend pas plus de 5 fiches.
  const fourni = [];
  for (let i = 0; i < 9; i++) fourni.push(r('fournisseurs', 9));
  fourni.push(r('qualite', 6), r('qualite', 6), r('conformite', 6));
  assert.deepEqual(parAxe(await choisir(fourni)), { fournisseurs: 5, qualite: 2, conformite: 1 });
});

test('seulement les notes de 6 ou plus, sans minimum : les notes de 5 vont en réserve', async () => {
  const reg = [r('fournisseurs', 8), r('fournisseurs', 6), r('qualite', 7), r('conformite', 9), r('exploitation', 6)];
  for (let i = 0; i < 8; i++) reg.push(r(i % 2 ? 'qualite' : 'conformite', 5));
  reg.push(r('fournisseurs', 4));
  const s = await choisir(reg);
  assert.equal(s.candidats.length, 5);
  assert.ok(s.candidats.every((c) => c.p >= 6 && c.raison === 'note de 6 ou plus'));
  assert.deepEqual(s.reserve.map((x) => x.p), [5, 5, 5, 5, 5, 5, 5, 5, 4]);
  // Rangés par axe, puis par note.
  assert.deepEqual(s.candidats.map((c) => c.axe + ' ' + c.p), ['fournisseurs 8', 'fournisseurs 6', 'qualite 7', 'conformite 9', 'exploitation 6']);
});

test("sans équilibre forcé : un axe sans note de 6 n'a pas de fiche", async () => {
  const reg = [];
  for (let i = 0; i < 4; i++) reg.push(r('fournisseurs', 9));
  reg.push(r('qualite', 5), r('qualite', 5), r('exploitation', 5));
  const s = await choisir(reg);
  assert.deepEqual(parAxe(s), { fournisseurs: 4 });
  assert.equal(s.reserve.filter((x) => x.p === 5).length, 3);
});

test('les plafonds : 3 prépublications arXiv et 2 articles par source', async () => {
  const reg = [];
  for (let i = 0; i < 5; i++) reg.push(r('qualite', 8, { ax: true, na: 'auteurs' }));
  for (let i = 0; i < 4; i++) reg.push(r('fournisseurs', 9, { sid: 'A03', s: 'OpenAI, actualités' }));
  const s = await choisir(reg);
  assert.equal(s.candidats.filter((c) => c.arxiv).length, 3);
  assert.equal(s.candidats.filter((c) => c.sid === 'A03').length, 2);
});

test('la CNIL ou le CEPD : toujours sur sa ligne à part ; une fiche seulement à partir de 6 ; hors thème, jamais', async () => {
  const texteCnil = (p) => r('conformite', p, { cn: true, sid: 'A08', s: 'CNIL, actualités', t: 'La CNIL publie ses recommandations' });
  const bas = await choisir([r('fournisseurs', 9), texteCnil(4)]);
  assert.ok(!bas.candidats.some((c) => c.cnil));
  assert.deepEqual([bas.cnil.n, bas.cnil.p, bas.cnil.horsTheme], [null, 4, false]);
  const haut = await choisir([r('fournisseurs', 9), texteCnil(6)]);
  const fiche = haut.candidats.find((c) => c.cnil);
  assert.equal(fiche.raison, 'la CNIL et le CEPD cette semaine');
  assert.equal(haut.cnil.n, fiche.n);
  const ht = await choisir([r('fournisseurs', 9), r('hors_theme', 1, { cn: true, sid: 'A09', s: 'CEPD, actualités' })]);
  assert.ok(!ht.candidats.some((c) => c.cnil));
  assert.equal(ht.cnil.horsTheme, true);
  assert.equal(ht.cnil.n, null);
});

test('toujours les drapeaux vérifiés : modèle suivi, modèle de décision primaire, échéance avant février 2027', async () => {
  const reg = [];
  for (let i = 0; i < 20; i++) reg.push(r(['fournisseurs', 'qualite', 'conformite', 'exploitation'][i % 4], 9));
  reg.push(r('fournisseurs', 3, { v: 1, f: { retrait_modele: true }, de: '2027-01-14', t: 'Retrait de gpt-4o-mini' }));
  reg.push(r('fournisseurs', 4, { f: { nouveau_modele_decision: true }, t: 'Un modèle de décision chez Liquid AI' }));
  reg.push(r('fournisseurs', 4, { pr: false, na: 'presse', f: { nouveau_modele_decision: true }, t: 'Rumeur sur un modèle de décision' }));
  reg.push(r('conformite', 3, { f: { echeance_reglementaire: true }, de: '2026-12-02', t: 'Règlement IA : échéance de décembre' }));
  reg.push(r('conformite', 3, { f: { echeance_reglementaire: true }, de: '2027-08-02', t: 'Règlement IA : échéance lointaine' }));
  const s = await choisir(reg);
  const raisons = s.candidats.map((c) => c.raison);
  assert.ok(raisons.includes("retrait d'un modèle suivi"));
  assert.ok(raisons.includes('nouveau modèle de décision'));
  assert.ok(raisons.includes('échéance réglementaire'));
  assert.ok(!s.candidats.some((c) => /Rumeur|lointaine/.test(c.titre)));
  assert.equal(s.candidats.length, 8);
});

test("un événement, une ligne : la source primaire en tête, « couvert aussi par » ensuite ; seul, un article non primaire est à recouper", async () => {
  const reg = [
    r('fournisseurs', 6, { pr: false, na: 'praticien', s: 'Simon Willison', sid: 'A07', t: 'OpenAI launches the Decisions API for classification' }),
    r('fournisseurs', 9, { s: 'OpenAI, actualités', sid: 'A03', t: 'Build more responsive apps with the Decisions API for classification' }),
    r('qualite', 6, { pr: false, na: 'praticien', s: 'Hamel Husain', sid: 'A14', t: 'Calibration des seuils de confiance' }),
  ];
  const s = await choisir(reg);
  assert.equal(s.candidats.length, 2);
  const tete = s.candidats.find((c) => c.sid === 'A03');
  assert.deepEqual(tete.aussi, [{ s: 'Simon Willison', u: reg[0].u }]);
  assert.equal(tete.aRecouper, false);
  assert.equal(s.candidats.find((c) => c.sid === 'A14').aRecouper, true);
});

test('la fenêtre : depuis la dernière préparation, 14 jours au plus ; 7 jours la première fois et en mode essai', async () => {
  const reg = [r('fournisseurs', 9, { vu: ms('2026-10-20T10:00') }), r('qualite', 9, { vu: ms('2026-10-27T10:00') }), r('conformite', 9, { vu: ms('2026-10-30T10:00') })];
  const ids = (s) => s.candidats.map((c) => c.axe).sort();
  assert.deepEqual(ids(await choisir(reg)), ['conformite', 'qualite']);
  assert.deepEqual(ids(await choisir(reg, { prep: { semaine: '2026-S44', at: ms('2026-10-28T09:00') } })), ['conformite']);
  assert.deepEqual(ids(await choisir(reg, { prep: { semaine: '2026-S42', at: ms('2026-10-01T09:00') } })), ['conformite', 'fournisseurs', 'qualite']);
  assert.deepEqual(ids(await choisir(reg, { prep: { semaine: '2026-S44', at: ms('2026-10-28T09:00') } }, { essai: true })), ['conformite', 'qualite']);
});

test("par où commencer : les trois mieux notés, d'axes différents si possible", async () => {
  const reg = [r('fournisseurs', 10), r('fournisseurs', 9), r('qualite', 7), r('conformite', 6), r('exploitation', 8)];
  const s = await choisir(reg);
  const une = s.aLaUne.map((k) => s.candidats.find((c) => c.n === k));
  assert.deepEqual(une.map((c) => c.axe + ' ' + c.p), ['fournisseurs 10', 'qualite 7', 'exploitation 8']);
});

test('les échéances des 90 jours : les dates connues, celles des articles, celles du catalogue d\'OpenRouter', async () => {
  const sd = {
    echeances: [{ date: '2026-11-20', titre: 'Fin de la consultation', url: 'https://exemple.org/c', s: 'CNIL' }, { date: '2027-03-01', titre: 'Trop loin', url: 'u', s: 's' }],
    openrouter: { suivi: { 'openai/gpt-4o-mini': { p: 0.15, c: 0.6, e: '2027-01-14' }, 'openai/gpt-6-luna': { p: 0.1, c: 0.5, e: '' } } },
  };
  const s = await choisir([r('fournisseurs', 9)], sd);
  const dates = s.echeances.map((e) => e.date);
  assert.deepEqual(dates, [...dates].sort());
  assert.ok(dates.includes('2026-11-20') && dates.includes('2026-12-02') && dates.includes('2027-01-14'));
  assert.ok(!dates.includes('2027-03-01'));
  assert.ok(s.echeances.some((e) => /gpt-4o-mini chez OpenRouter/.test(e.titre)));
  assert.ok(s.echeances.length <= 10);
});

test("les dates : publié avant la période lue, signalé ; sans date, le jour où le bot l'a vu ; les échéances changées par la source", async () => {
  const vu = ms('2026-11-05T10:02');
  const reg = [
    r('fournisseurs', 7, { d: '2026-11-03', vu }), r('qualite', 7, { d: '', vu }), r('conformite', 7, { d: '2026-11-04', vu }),
  ];
  const sd = {
    registre: reg, prep: { semaine: '2026-S45', at: ms('2026-11-04T16:38') },
    echeances: [
      { date: '2026-11-20', avant: '2026-11-15', titre: 'Workers AI - Planned model deprecations', url: 'https://exemple.org/cf', s: 'Cloudflare' },
      { date: '2026-12-01', changee: '2026-11-08', titre: 'Une ligne changée sur la page des retraits', url: 'https://exemple.org/oa', s: 'OpenAI' },
    ],
  };
  const [s] = await executer('selection-parlia.js', { sd, maintenant: '2026-11-09T07:15', sorties: { 'Que faire ?': [plan({ semaine: { cle: '2026-S46', numero: 46, lundi: '2026-11-09', dimanche: '2026-11-15' } })] } });
  assert.equal(s.jourDebut, '2026-11-04');
  const parAxe = Object.fromEntries(s.candidats.map((c) => [c.axe, c]));
  assert.deepEqual([parAxe.fournisseurs.date, parAxe.fournisseurs.avantPeriode], ['2026-11-03', true]);
  assert.deepEqual([parAxe.qualite.date, parAxe.qualite.vu, parAxe.qualite.avantPeriode], ['', '2026-11-05', false]);
  assert.equal(parAxe.conformite.avantPeriode, false); // le jour même où commence la période
  const cf = s.echeances.find((e) => /Workers AI/.test(e.titre));
  assert.equal(cf.avant, '2026-11-15');
  assert.ok(!s.echeances.some((e) => /ligne changée/.test(e.titre)));
  assert.deepEqual(s.echeancesChangees.map((e) => [e.date, e.changee]), [['2026-12-01', '2026-11-08']]);
});

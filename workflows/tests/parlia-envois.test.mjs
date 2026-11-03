// Les envois de la veille ParlIA : l'ouverture, les fiches dans le post de la semaine, le rappel du jeudi, les
// alertes immédiates et le message de #status, avec ses alertes d'échecs répétés. Lance avec : npm test
import assert from 'node:assert/strict';
import test from 'node:test';
import { executer, plan, ms } from './aide-parlia.mjs';

const MAINTENANT = '2026-11-02T09:20';
const OUVERTURE = { payload: { username: 'Veille · ParlIA', content: 'Ouverture' }, cv2: false };
const FICHES = [{ payload: { components: [] }, cv2: true }, { payload: { components: [] }, cv2: true }];
const PREP = { semaine: '2026-S45', discord: { ouverture: OUVERTURE, fiches: FICHES } };

test("l'ouverture ne part que si le webhook de ParlIA est réglé", async () => {
  assert.deepEqual(await executer('ouverture-parlia.js', { input: [PREP], sorties: { 'Que faire ?': [plan({ reglages: { discord: false } })] } }), []);
  const [o] = await executer('ouverture-parlia.js', { input: [PREP], sorties: { 'Que faire ?': [plan()] } });
  assert.deepEqual(o, { threadId: null, payload: OUVERTURE.payload, cv2: false });
});

async function fiches(reponse, sd, extra = {}) {
  return executer('fiches-parlia.js', { input: [reponse], sd, sorties: { 'Que faire ?': [plan(extra)], 'Préparation': [PREP] } });
}
const prepFaite = () => ({ semaine: '2026-S45', at: ms('2026-11-02T09:15'), fichier: 'f.md', nb: 2, threadId: null, messageId: null, rappel: false });

test('en forum, les fiches suivent dans le post créé par l\'ouverture ; son identifiant est gardé pour le rappel', async () => {
  const sd = { prep: prepFaite(), _passage: {} };
  const sortie = await fiches({ id: '1301', channel_id: '1301' }, sd, { reglages: { forum: true } });
  assert.deepEqual(sortie.map((f) => f.threadId), ['1301', '1301']);
  assert.equal(sd.prep.threadId, '1301');
  assert.equal(sd.prep.messageId, '1301');
  assert.deepEqual(sd._passage.discord, { ouverture: 'ok', fiches: 2 });
});

test('en salon, les fiches vont dans le salon, sans fil', async () => {
  const sd = { prep: prepFaite(), _passage: {} };
  const sortie = await fiches({ id: '1302', channel_id: '900' }, sd);
  assert.deepEqual(sortie.map((f) => f.threadId), [null, null]);
  assert.equal(sd.prep.threadId, null);
  assert.equal(sd.prep.messageId, '1302');
});

test("l'ouverture refusée : rien ne part, la préparation repart au passage suivant, trois fois au plus", async () => {
  const avant = { prep: { semaine: '2026-S44', at: ms('2026-10-26T09:00') }, semaine: { collectes: 9, parSource: {} } };
  const sd = { prep: prepFaite(), semaine: { collectes: 0, parSource: {} }, _passage: { prepAvant: avant } };
  assert.deepEqual(await fiches({ error: { message: '404 - Unknown Webhook' } }, sd), []);
  assert.equal(sd.prep.semaine, '2026-S44');
  assert.equal(sd.semaine.collectes, 9);
  assert.deepEqual(sd._passage.discord, { ouverture: 'échec', detail: '404 - Unknown Webhook', essai: 1, abandon: false });
  for (const n of [2, 3]) {
    sd.prep = prepFaite();
    sd._passage = { prepAvant: avant };
    await fiches({ error: 'ETIMEDOUT' }, sd);
    assert.equal(sd._passage.discord.essai, n);
  }
  assert.equal(sd._passage.discord.abandon, true);
  assert.equal(sd.prep.semaine, '2026-S45'); // abandon : la préparation de la semaine reste faite
});

test('en mode essai, le nœud Discord est désactivé : les fiches sont seulement préparées', async () => {
  const sd = { prep: prepFaite(), _passage: {} };
  const sortie = await fiches(Object.assign({ threadId: null }, OUVERTURE), sd, { essai: true, reglages: { forum: true } });
  assert.equal(sortie.length, 2);
  assert.equal(sd._passage.discord.ouverture, 'essai');
});

async function rappel(sd, extra = {}) {
  return executer('rappel-parlia.js', { sd, maintenant: '2026-11-05T16:45', sorties: { 'Que faire ?': [plan(Object.assign({ preparation: false, rappel: true }, extra))] } });
}

test('le rappel du jeudi : dans le post de la semaine, avec la mention, une seule fois', async () => {
  const sd = { prep: Object.assign(prepFaite(), { threadId: '1301', nb: 12 }) };
  const [r] = await rappel(sd, { reglages: { forum: true, mention: '123456789012345678' } });
  assert.equal(r.threadId, '1301');
  assert.equal(r.payload.thread_name, undefined);
  assert.match(r.payload.content, /^<@123456789012345678> ⏰ Petit rappel : le dossier de la semaine 45 t'attend \(12 fiches\), jusqu'à dimanche soir\./);
  assert.match(r.payload.content, /Si c'est fait, ignore ce message\.$/);
  assert.equal(sd.prep.rappel, true);
  assert.deepEqual(await executer('rappel-parlia.js', { sd, sorties: { 'Que faire ?': [plan({ rappel: false })] } }), []);
});

test("le rappel sans post connu ouvre son propre post ; sans webhook, il est seulement noté", async () => {
  const [r] = await rappel({ prep: prepFaite() }, { reglages: { forum: true } });
  assert.equal(r.payload.thread_name, 'Rappel · semaine 45');
  const sd = { prep: prepFaite() };
  assert.deepEqual(await rappel(sd, { reglages: { discord: false } }), []);
  assert.equal(sd.prep.rappel, true);
});

const alerte = (type, extra = {}) => Object.assign({ type, id: type + '1', titre: 'Décret ' + type, url: 'https://www.legifrance.gouv.fr/jorf/id/' + type,
  date: '2026-11-02', origine: 'Journal officiel, archive JORF_20261102-002304.tar.gz', cle: 'c-' + type }, extra);
async function alertes(sd, extra = {}) {
  return executer('alertes-parlia.js', { sd, maintenant: MAINTENANT, sorties: { 'Que faire ?': [plan(extra)] } });
}

test('les alertes partent ensemble, la plus grave en tête, une seule fois', async () => {
  const sd = { _alertes: [alerte('retrait', { date: '2027-01-14', origine: 'OpenRouter, catalogue des modèles' }), alerte('attributions'), alerte('remaniement')] };
  const [a] = await alertes(sd);
  const lignes = a.payload.content.split('\n');
  assert.match(lignes[0], /^🚨 \*\*Remaniement publié au Journal officiel du 2 novembre 2026\*\* — « Décret remaniement »\. À faire : vérifier la table des ministères/);
  assert.match(lignes[1], /^📌 \*\*Attributions publiées au Journal officiel du 2 novembre 2026\*\*.*mettre à jour la table de correspondance des périmètres/);
  assert.match(lignes[2], /^⏳ \*\*Retrait annoncé d'un modèle suivi\*\*, le 14 janvier 2027/);
  assert.equal(a.payload.flags, undefined); // une alerte notifie
  assert.equal(sd._alertes, undefined);
  assert.equal(sd.alertesJournal.length, 3);
  sd._alertes = [alerte('remaniement')];
  assert.deepEqual(await alertes(sd), []);
});

test("le secours de l'Élysée ; en forum, le post de la semaine ou un post à part ; la mention", async () => {
  const elysee = alerte('remaniement', { origine: 'Élysée, communiqués', titre: 'Nomination du Gouvernement', cle: 'e1' });
  const [a] = await alertes({ _alertes: [elysee], prep: Object.assign(prepFaite(), { threadId: '1301' }) }, { reglages: { forum: true, mention: '123456789012345678' } });
  assert.match(a.payload.content, /^<@123456789012345678> 🚨 \*\*Remaniement annoncé par l'Élysée\*\*/);
  assert.equal(a.threadId, '1301');
  const [b] = await alertes({ _alertes: [alerte('attributions')] }, { reglages: { forum: true } });
  assert.equal(b.payload.thread_name, 'Alerte · Attributions · 2 novembre 2026');
});

test('sans webhook, les alertes restent dans le journal, pour le fichier de la semaine', async () => {
  const sd = { _alertes: [alerte('remaniement')] };
  assert.deepEqual(await alertes(sd, { reglages: { discord: false } }), []);
  assert.equal(sd.alertesJournal[0].type, 'remaniement');
  assert.deepEqual(sd._passage.alertes, { nouvelles: 1, types: ['remaniement'] });
});

async function statut(p, sorties = {}, extra = {}) {
  const sd = { _passage: p };
  const s = await executer('statut-parlia.js', { sd, maintenant: MAINTENANT, sorties: Object.assign({ 'Que faire ?': [plan(extra)] }, sorties) });
  assert.equal(sd._passage, undefined); // le carnet du passage est effacé
  return s[0];
}
const COLLECTE = { collecte: true, collecteStats: { lus: 130, nouveaux: 41 }, tri: { nouveaux: 41, secours: 0, horsTheme: 12, parAxe: { fournisseurs: 20, qualite: 9 } },
  pages: { lues: 16, echecs: [], nouveautes: 2, refaites: [], premiers: 0 }, jorf: { archives: 2, textes: 160, decrets: 60, alertes: 0, erreur: '' } };

test('#status : un passage sans problème, en silence', async () => {
  const s = await statut(COLLECTE);
  assert.equal(s.payload.flags, 4096);
  const lignes = s.payload.content.split('\n');
  assert.equal(lignes[0], '**Veille ParlIA** — lundi 2 novembre, 9 h 20');
  assert.equal(lignes[1], '📥 130 lus → 🆕 41 nouveaux → 🏷️ 29 dans le thème (fournisseurs 20 · qualite 9), 12 hors thème');
  assert.match(lignes[2], /🌐 pages et API : 16\/16 lues, 2 nouveauté\(s\) · ⚖️ Journal officiel : 2 archive\(s\), 60 décret\(s\)/);
});

test('#status : une source en échec trois fois de suite fait sonner le message, et son retour est annoncé', async () => {
  const s = await statut(Object.assign({}, COLLECTE, { flux: [{ id: 'A08', s: 'CNIL, actualités', echecs: 3, detail: 'code 503' }, { id: 'F01', s: "OpenAI, journal de l'API", retour: true }] }));
  assert.equal(s.payload.flags, undefined);
  assert.match(s.payload.content, /⚠️ En échec 3 fois de suite : CNIL, actualités \(code 503\)/);
  assert.match(s.payload.content, /✅ De retour : OpenAI, journal de l'API/);
});

test('#status : la préparation, le fichier écrit ou non, les envois Discord', async () => {
  const prep = { preparation: { fichier: '2026-11-02-preparation.md', candidats: 12, reserve: 5 }, discord: { ouverture: 'ok', fiches: 13 } };
  const ok = await statut(prep, { 'Écrire le fichier': [{ fileName: '/home/node/.n8n-files/parlia/2026-11-02-preparation.md' }], 'Discord fiches': Array.from({ length: 13 }, (_, i) => ({ id: String(i) })) });
  assert.equal(ok.payload.flags, 4096);
  assert.match(ok.payload.content, /📂 Préparation de la semaine 45 : 12 candidat\(s\), 5 en réserve\n📄 2026-11-02-preparation\.md écrit/);
  assert.match(ok.payload.content, /💬 Discord : ouverture publiée, 13\/13 fiche\(s\) et réserve/);
  const ko = await statut(prep, { 'Écrire le fichier': [{ error: "EACCES: permission denied, open '/home/node/.n8n-files/parlia/x.md'" }], 'Discord fiches': [{ id: '1' }, { error: { message: '429' } }] });
  assert.equal(ko.payload.flags, undefined);
  assert.match(ko.payload.content, /❌ fichier non écrit : EACCES: permission denied/);
  assert.match(ko.payload.content, /12\/13 fiche\(s\) et réserve · ❌ 429/);
  const refus = await statut({ preparation: prep.preparation, discord: { ouverture: 'échec', detail: '404 - Unknown Webhook', essai: 1, abandon: false } }, { 'Écrire le fichier': [{ fileName: 'x' }] });
  assert.match(refus.payload.content, /❌ ouverture refusée par Discord \(404 - Unknown Webhook\) : nouvel essai au prochain passage/);
});

test('#status : rien ne part sans le webhook de #status ; le mode essai est signalé', async () => {
  const sd = { _passage: COLLECTE };
  assert.deepEqual(await executer('statut-parlia.js', { sd, sorties: { 'Que faire ?': [plan({ reglages: { statut: false } })] } }), []);
  assert.equal(sd._passage, undefined);
  const s = await statut({ rappel: 'préparé' }, { 'Discord rappel': [{ payload: {} }] }, { essai: true });
  assert.match(s.payload.content, /· ESSAI\n⏰ Rappel du jeudi : préparé \(essai\)/);
});

// Le tri de la veille ParlIA : la consigne (sources.md, 5.2), la lecture contrôlée des réponses de Mistral Small,
// les plafonds, le tri de secours, puis le registre et ses alertes. Lance avec : npm test
import assert from 'node:assert/strict';
import test from 'node:test';
import { executer, ms, JOUR } from './aide-parlia.mjs';

const MAINTENANT = '2026-11-02T09:15';
const art = (id, extra = {}) => Object.assign({
  id, titre: 'Article ' + id, url: 'https://openai.com/index/' + id, date: '2026-10-30T10:00:00.000Z',
  extrait: 'Extrait de ' + id, officiel: true,
  source: { id: 'A03', s: 'OpenAI, actualités', axe: 'fournisseurs', nature: 'editeur', primaire: true, cnil: false, decision: false, arxiv: false, kind: 'flux' },
  verifie: null,
}, extra);
const avis = (id, extra = {}) => Object.assign({
  id, axe: 'fournisseurs', pertinence: 7, hypothese: 'Cela pourrait changer le comparatif.', source_primaire: true, nature: 'editeur',
  resume: 'Deux lignes de résumé.', a_chercher: 'Le prix.', drapeaux: { changement_prix: false, retrait_modele: false, nouveau_modele_decision: false, echeance_reglementaire: false },
  date_effet: null,
}, extra);

test('la consigne : des lots de 12, la date du jour, la liste de suivi, les articles', async () => {
  const articles = Array.from({ length: 25 }, (_, i) => art('a' + i));
  articles[3].extrait = 'Un extrait avec $& et {DATE} dedans';
  const lots = await executer('consigne-tri-parlia.js', { input: articles, maintenant: MAINTENANT });
  assert.deepEqual(lots.map((l) => l._articles.length), [12, 12, 1]);
  const p = lots[0].prompt;
  assert.match(p, /Nous sommes le 2 novembre 2026\./);
  assert.match(p, /openai\/gpt-6-luna/);
  assert.match(p, /--- ARTICLE id=a0 ---/);
  assert.match(p, /Un extrait avec \$& et \{DATE\} dedans/);
  assert.doesNotMatch(p, /\{ARTICLES\}|\{LISTE_DE_SUIVI\}/);
  assert.equal(lots[0]._version, 'sources.md 5.2 du 29 octobre 2026');
  assert.deepEqual(await executer('consigne-tri-parlia.js', { input: [{ _rien: true }] }), []);
});

async function lire(lots, reponses) {
  return executer('lire-tri-parlia.js', { input: reponses, sorties: { 'Consigne de tri': lots }, maintenant: MAINTENANT });
}

test('une réponse valable, même entourée de texte ou de balises de code, est reprise telle quelle', async () => {
  const lot = { _articles: [art('a1')], _version: 'v' };
  const texte = 'Voici :\n' + String.fromCharCode(96).repeat(3) + 'json\n' + JSON.stringify({ articles: [avis('a1', { pertinence: 9 })] }) + '\n' + String.fromCharCode(96).repeat(3);
  const [a] = await lire([lot], [{ text: texte }]);
  assert.equal(a.tri.pertinence, 9);
  assert.equal(a.tri.secours, '');
  assert.equal(a.consigne, 'v');
  assert.match(a.brut, /"pertinence":9/);
});

test("« null » écrit en toutes lettres donne un champ vide ; une nature « inconnu » reprend celle de la source", async () => {
  const lot = { _articles: [art('a1')], _version: 'v' };
  const texte = JSON.stringify({ articles: [avis('a1', { a_chercher: 'null', resume: 'None', nature: 'inconnu' })] });
  const [a] = await lire([lot], [{ text: texte }]);
  assert.equal(a.tri.a_chercher, '');
  assert.equal(a.tri.resume, '');
  assert.equal(a.tri.nature, 'editeur');
  assert.equal(a.tri.secours, '');
});

test('les plafonds : source non primaire 6, prépublication 8, annonce hors domaine officiel 2', async () => {
  const lot = { _articles: [
    art('np', { source: Object.assign({}, art('x').source, { nature: 'praticien', primaire: false }) }),
    art('ax', { source: Object.assign({}, art('x').source, { arxiv: true, nature: 'auteurs' }) }),
    art('faux', { officiel: false }),
  ] };
  const rep = { articles: [
    avis('np', { pertinence: 8, source_primaire: false, nature: 'praticien' }),
    avis('ax', { pertinence: 10, nature: 'auteurs' }),
    avis('faux', { pertinence: 7 }),
  ] };
  const sortie = await lire([lot], [{ text: JSON.stringify(rep) }]);
  assert.deepEqual(sortie.map((a) => [a.id, a.tri.pertinence, a.tri.plafonds.join(',')]), [
    ['np', 6, 'source non primaire'], ['ax', 8, 'prépublication'], ['faux', 2, 'domaine non officiel'],
  ]);
});

test('une proposition hors des listes est rejetée : tri de secours, marqué comme tel', async () => {
  const cnil = art('c', { source: Object.assign({}, art('x').source, { id: 'A08', cnil: true, axe: 'conformite', nature: 'institution' }) });
  const lot = { _articles: [art('a1'), art('a2'), cnil] };
  const rep = { articles: [avis('a1', { axe: 'autre' }), avis('a2', { pertinence: 7.5 })] };
  const sortie = await lire([lot], [{ text: JSON.stringify(rep) }]);
  assert.deepEqual(sortie.map((a) => [a.tri.pertinence, a.tri.secours]), [
    [3, 'réponse invalide'], [3, 'réponse invalide'], [5, 'réponse invalide'],
  ]);
  assert.equal(sortie[2].tri.axe, 'conformite');
});

test("un modèle en erreur ou une réponse illisible : tout le lot au tri de secours, les autres lots intacts", async () => {
  const lots = [{ _articles: [art('a1')] }, { _articles: [art('b1')] }, { _articles: [art('c1')] }];
  const sortie = await lire(lots, [{ error: { message: '429' } }, { text: 'Je ne peux pas.' }, { text: JSON.stringify([avis('c1')]) }]);
  assert.deepEqual(sortie.map((a) => a.tri.secours), ['erreur du modèle', 'réponse illisible', '']);
});

test('les drapeaux vérifiés par le programme l\'emportent sur le modèle', async () => {
  const lot = { _articles: [art('p', { verifie: { changement_prix: true, date_effet: '2026-11-02' } })] };
  const [a] = await lire([lot], [{ text: JSON.stringify({ articles: [avis('p')] }) }]);
  assert.equal(a.tri.drapeaux.changement_prix, true);
  assert.equal(a.tri.date_effet, '2026-11-02');
});

const trie = (id, tri, extra = {}) => Object.assign(art(id, extra), { tri: Object.assign({
  axe: 'fournisseurs', pertinence: 7, hypothese: 'h', source_primaire: true, nature: 'editeur', resume: 'r', a_chercher: 'c',
  drapeaux: { changement_prix: false, retrait_modele: false, nouveau_modele_decision: false, echeance_reglementaire: false },
  date_effet: null, secours: '', plafonds: [],
}, tri) });

test('le registre garde 16 jours, compte les hors thème, et sonne pour un retrait de modèle suivi à moins de 90 jours', async () => {
  const sd = { registre: [{ id: 'vieux', vu: ms(MAINTENANT) - 17 * JOUR }, { id: 'recent', vu: ms(MAINTENANT) - 2 * JOUR }] };
  const retrait = { retrait_modele: true, changement_prix: false, nouveau_modele_decision: false, echeance_reglementaire: false };
  await executer('registre-parlia.js', { sd, maintenant: MAINTENANT, input: [
    trie('suivi', { drapeaux: retrait, date_effet: '2027-01-14' }, { titre: 'Retiring gpt-4o-mini' }),
    trie('loin', { drapeaux: retrait, date_effet: '2027-06-01' }, { titre: 'Retiring gpt-4o-mini later' }),
    trie('autre', { drapeaux: retrait, date_effet: '2026-12-01' }, { titre: 'Retiring some other model' }),
    trie('ht', { axe: 'hors_theme', pertinence: 1 }),
  ] });
  assert.deepEqual(sd.registre.map((a) => a.id), ['recent', 'suivi', 'loin', 'autre', 'ht']);
  assert.deepEqual(sd._alertes.map((a) => [a.type, a.id, a.date]), [['retrait', 'suivi', '2027-01-14']]);
  assert.deepEqual(sd._passage.tri, { nouveaux: 4, secours: 0, horsTheme: 1, parAxe: { fournisseurs: 3, hors_theme: 1 } });
  // Les échéances sont gardées à part, jusqu'à leur date.
  assert.deepEqual(sd.echeances.map((e) => e.date), ['2026-12-01', '2027-01-14', '2027-06-01']);
  const entree = sd.registre.find((a) => a.id === 'suivi');
  assert.equal(entree.de, '2027-01-14');
  assert.equal(entree.f.retrait_modele, true);
  assert.equal(entree.h, 'h');
  assert.deepEqual([sd.registre.at(-1).r, sd.registre.at(-1).h], ['', '']); // hors thème : pas de textes longs
});

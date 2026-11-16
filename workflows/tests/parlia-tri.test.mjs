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
  assert.doesNotMatch(p, /\{ETAT_DU_PROJET\}|\{DATE\}\./);
  assert.equal(lots[0]._version, 'sources.md 5.2 du 15 novembre 2026');
  assert.deepEqual(await executer('consigne-tri-parlia.js', { input: [{ _rien: true }] }), []);
});

// Semaine 46 : la consigne du 29 octobre disait « Le 8 novembre 2026, Louis compare des services d'étiquetage. Le
// comparatif inclut des modèles de décision : la Decisions API d'OpenAI (GPT-6 Luna), Jev de TypeSafe AI, Clef de
// Cloudflare, d1 de Liquid AI. » Mistral Small en a tiré « le choix de ParlIA pour Jev », « les modèles de décision
// utilisés par ParlIA ». Rien n'était choisi : l'application utilise le modèle entraîné par Louis.
test("la consigne ne dit jamais qu'un modèle est utilisé par ParlIA : les modèles de décision sont des candidats à l'étude", async () => {
  const [lot] = await executer('consigne-tri-parlia.js', { input: [art('a0')], maintenant: MAINTENANT });
  const consigne = lot.prompt.slice(0, lot.prompt.indexOf('\nARTICLES\n'));
  assert.doesNotMatch(consigne, /Louis compare|comparatif inclut/i);
  assert.match(consigne, /l'application n'utilise aucun service d'IA du marché/);
  // Chaque phrase où un service ou un modèle est utilisé est une négation (« utilisable », un adjectif, ne compte pas).
  const phrases = consigne.split(/[.;]\s|\n/).filter((ph) => /utilis(?:e|é|ée|és|ées|ent|er|ons|ez)?(?![a-zà-ÿ])/i.test(ph));
  assert.ok(phrases.length >= 3);
  for (const ph of phrases) assert.match(ph, /\baucun\b|\bjamais\b|n'utilise/, ph);
  // La Decisions API, Jev, Clef et d1 n'apparaissent dans l'état du projet que comme candidats à l'étude.
  const etat = consigne.slice(consigne.indexOf("L'ÉTAT DU PROJET"), consigne.indexOf('LE THÈME'));
  const candidats = etat.split('\n').filter((l) => /Decisions API|Jev|Clef|\bd1\b/.test(l) && !l.startsWith('Modèles suivis'));
  assert.equal(candidats.length, 1);
  assert.match(candidats[0], /^- Les candidats à l'étude pour ce comparatif, dont aucun n'est utilisé : /);
  for (const nom of ["la Decisions API d'OpenAI", 'Jev de TypeSafe AI', 'Clef de Cloudflare', 'd1 de Liquid AI']) assert.ok(candidats[0].includes(nom), nom);
  // L'état du projet ne porte aucune date au jour près : il ne peut pas vieillir comme celui du 29 octobre.
  const sansAujourdhui = etat.replace(/Nous sommes le .*\./, '');
  assert.doesNotMatch(sansAujourdhui, /\b\d{1,2}(er)? (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre) 20\d{2}\b|\b20\d{2}-\d{2}-\d{2}\b/);
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
  // Une échéance relevée par l'ancien tri (sans identifiant) est oubliée ; une échéance passée depuis plus de
  // 14 jours aussi ; une échéance passée depuis moins de 14 jours reste, pour qu'un report de dernière minute se voie.
  const sd = { registre: [{ id: 'vieux', vu: ms(MAINTENANT) - 17 * JOUR }, { id: 'recent', vu: ms(MAINTENANT) - 2 * JOUR }], echeances: [
    { date: '2026-12-01', titre: 'OpenAI, retraits de modèles — gpt-image-2.6-sunburst or gpt-image-2.6-flare', url: 'u', s: 's' },
    { date: '2026-10-10', titre: 'Passée depuis longtemps', url: 'u', s: 's', id: 'p1' },
    { date: '2026-10-25', titre: 'Passée depuis peu', url: 'u', s: 's', id: 'p2' },
  ] };
  const retrait = { retrait_modele: true, changement_prix: false, nouveau_modele_decision: false, echeance_reglementaire: false };
  await executer('registre-parlia.js', { sd, maintenant: MAINTENANT, input: [
    trie('suivi', { drapeaux: retrait, date_effet: '2027-01-14' }, { titre: 'Retiring gpt-4o-mini' }),
    trie('loin', { drapeaux: retrait, date_effet: '2027-06-01' }, { titre: 'Retiring gpt-4o-mini later' }),
    trie('autre', { drapeaux: retrait, date_effet: '2026-12-01' }, { titre: 'Retiring some other model' }),
    trie('ht', { axe: 'hors_theme', pertinence: 1 }),
  ] });
  assert.deepEqual(sd.registre.map((a) => a.id), ['recent', 'suivi', 'loin', 'autre', 'ht']);
  assert.deepEqual(sd._alertes.map((a) => [a.type, a.id, a.date]), [['retrait', 'suivi', '2027-01-14']]);
  assert.deepEqual(sd._passage.tri, { nouveaux: 4, secours: 0, horsTheme: 1, parAxe: { fournisseurs: 3, hors_theme: 1 }, majEcheances: 0 });
  // Les échéances sont gardées à part, jusqu'à leur date.
  assert.deepEqual(sd.echeances.map((e) => e.date), ['2026-10-25', '2026-12-01', '2027-01-14', '2027-06-01']);
  assert.ok(!sd.echeances.some((e) => /sunburst/.test(e.titre)));
  assert.deepEqual(sd.echeances.find((e) => e.date === '2027-01-14').id, 'suivi');
  const entree = sd.registre.find((a) => a.id === 'suivi');
  assert.equal(entree.de, '2027-01-14');
  assert.equal(entree.f.retrait_modele, true);
  assert.equal(entree.h, 'h');
  assert.deepEqual([sd.registre.at(-1).r, sd.registre.at(-1).h], ['', '']); // hors thème : pas de textes longs
});

test("une échéance changée par la source : la nouvelle date remplace l'ancienne, gardée, et l'article revient ; la même date ne change rien", async () => {
  const retrait = { retrait_modele: true, changement_prix: false, nouveau_modele_decision: false, echeance_reglementaire: false };
  const echeance = () => ({ date: '2026-11-15', titre: 'Workers AI - Planned model deprecations on Workers AI', url: 'https://developers.cloudflare.com/x', s: 'Cloudflare', id: 'cf', cle: 'k', empreinte: 'ancienne' });
  const avant = ms(MAINTENANT) - 4 * JOUR;
  const sd = { registre: [{ id: 'cf', t: 'Workers AI', vu: avant }], echeances: [echeance()] };
  const relu = (dateEffet, axe = 'fournisseurs') => trie('cf', { axe, drapeaux: retrait, date_effet: dateEffet },
    { url: 'https://developers.cloudflare.com/x', cle: 'k', empreinte: 'nouvelle', maj: { date: '2026-11-15' } });
  await executer('registre-parlia.js', { sd, maintenant: MAINTENANT, input: [relu('2026-11-20')] });
  assert.deepEqual([sd.echeances[0].date, sd.echeances[0].avant, sd.echeances[0].empreinte], ['2026-11-20', '2026-11-15', 'nouvelle']);
  assert.equal(sd.echeances.length, 1);
  assert.deepEqual(sd.registre.map((a) => [a.id, a.vu, a.da]), [['cf', ms(MAINTENANT), '2026-11-15']]);
  // La même date : seule l'empreinte change ; l'article ne revient pas dans la préparation.
  const meme = { registre: [{ id: 'cf', t: 'Workers AI', vu: avant }], echeances: [echeance()] };
  await executer('registre-parlia.js', { sd: meme, maintenant: MAINTENANT, input: [relu('2026-11-15')] });
  assert.deepEqual([meme.echeances[0].date, meme.echeances[0].empreinte, meme.echeances[0].avant], ['2026-11-15', 'nouvelle', undefined]);
  assert.deepEqual(meme.registre.map((a) => [a.id, a.vu]), [['cf', avant]]);
  assert.deepEqual([meme._passage.tri.nouveaux, meme._passage.tri.majEcheances], [0, 1]);
  // Plus de date lisible : l'échéance est à vérifier.
  const perdue = { registre: [], echeances: [echeance()] };
  await executer('registre-parlia.js', { sd: perdue, maintenant: MAINTENANT, input: [relu(null)] });
  assert.equal(perdue.echeances[0].changee, '2026-11-02');
  // Une échéance de l'ancien tri, sans identifiant, prend celui de l'article trié de nouveau, et sa nouvelle date.
  const ancienne = { registre: [], echeances: [{ date: '2026-11-15', titre: 'Workers AI', url: 'https://developers.cloudflare.com/x', s: 'Cloudflare' }] };
  await executer('registre-parlia.js', { sd: ancienne, maintenant: MAINTENANT, input: [relu('2026-11-20')] });
  assert.deepEqual(ancienne.echeances.map((e) => [e.date, e.avant, e.id, e.cle]), [['2026-11-20', '2026-11-15', 'cf', 'k']]);
});

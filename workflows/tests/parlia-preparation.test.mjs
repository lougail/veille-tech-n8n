// La préparation de la semaine (preparation-parlia.js) : le fichier Markdown au format de la partie « Préparation »
// de la note de séance du 28 octobre 2026, et les messages Discord (ouverture, une fiche guidée par candidat,
// réserve). Lance avec : npm test
import assert from 'node:assert/strict';
import test from 'node:test';
import { executer, plan, ms } from './aide-parlia.mjs';

const MAINTENANT = '2026-11-02T09:15';
// L'en-tête des tableaux de la note du 28 octobre 2026, recopié tel quel.
const ENTETE = '| N° | Élément et date | Source et nature | Lien | Ce que ça pourrait changer pour ParlIA (hypothèse) |';
const cand = (n, axe, extra = {}) => Object.assign({
  id: 'c' + n, titre: 'Titre ' + n, url: 'https://exemple.org/' + n, source: 'Source ' + n, sid: 'S' + n, axe, p: 7, primaire: true,
  nature: 'editeur', resume: 'Résumé ' + n + '.', aChercher: 'Chercher ' + n, hypothese: 'Hypothèse ' + n, drapeaux: {}, dateEffet: null,
  date: '2026-10-30', arxiv: false, cnil: false, decision: false, secours: '', verifie: false, plafonds: '', aRecouper: false, aussi: [],
  raison: 'note de 6 ou plus', n,
}, extra);
const SEL = {
  semaine: { cle: '2026-S45', numero: 45, lundi: '2026-11-02', dimanche: '2026-11-08' },
  essai: false,
  depuis: ms('2026-10-26T09:05'),
  candidats: [
    cand(1, 'fournisseurs', { titre: 'Prix | nouveaux', aussi: [{ s: 'Simon Willison', u: 'https://simonwillison.net/x' }] }),
    cand(2, 'fournisseurs', { primaire: false, nature: 'praticien', aRecouper: true, plafonds: 'source non primaire', p: 6 }),
    cand(3, 'qualite', { secours: 'réponse illisible', hypothese: 'rien', date: '' }),
    cand(4, 'conformite', { cnil: true, nature: 'institution', raison: 'la CNIL et le CEPD cette semaine', titre: '@everyone regardez' }),
  ],
  aLaUne: [1, 3, 4],
  reserve: [{ titre: 'Réserve 1', url: 'https://exemple.org/r1', source: 'Source R', axe: 'qualite', p: 5, primaire: true }],
  cnil: { n: 4, titre: '@everyone regardez', url: 'https://exemple.org/4', source: 'CNIL, actualités', p: 7, horsTheme: false },
  echeances: [{ date: '2026-11-30', titre: "Arrêt d'OpenAI Evals", url: 'https://developers.openai.com/api/docs/deprecations', source: 'sources.md, 6.4' }],
  stats: { lus: 40, horsTheme: 12, secours: 1, parAxe: { fournisseurs: 20, qualite: 5, conformite: 3 }, notes6: 3 },
};
const SD = () => ({
  semaine: { depuis: ms('2026-10-26T09:05'), collectes: 9, parSource: {
    A08: { s: 'CNIL, actualités', lus: 10, echecs: 2, k: 'flux' }, S1: { s: 'Source 1', lus: 5, echecs: 0, k: 'flux' },
    F01: { s: "OpenAI, journal de l'API", lus: 1, echecs: 0, k: 'autre' },
  } },
  sante: { A08: { s: 'CNIL, actualités', echecs: 1, detail: 'code 503' }, A12: { s: 'Journal officiel (DILA)', echecs: 0 } },
  alertesJournal: [{ type: 'attributions', titre: 'Décret relatif aux attributions du ministre du travail', url: 'https://www.legifrance.gouv.fr/jorf/id/X',
    date: '2026-10-30', origine: 'Journal officiel, archive JORF_20261030-210000.tar.gz', at: ms('2026-10-30T10:00') }],
  prep: { semaine: '2026-S44', at: ms('2026-10-26T09:05') },
});
async function preparer(sel = SEL, sd = SD(), extra = {}) {
  const [s] = await executer('preparation-parlia.js', { input: [sel], sd, maintenant: MAINTENANT, sorties: { 'Que faire ?': [plan(extra)] } });
  return { s, sd };
}

test('le fichier : même plan que la partie « Préparation » de la note de séance, signé et daté', async () => {
  const { s } = await preparer();
  const md = s.markdown;
  assert.ok(md.startsWith('# Préparation de la veille ParlIA — semaine 45, du lundi 2 au dimanche 8 novembre 2026\n'));
  assert.match(md, /> Écrit par le bot de veille le lundi 2 novembre 2026 à 9 h 15 \(heure de Paris\)/);
  assert.match(md, /> Période lue : du lundi 26 octobre 2026 à 9 h 05 au lundi 2 novembre 2026 à 9 h 15\./);
  const titres = md.split('\n').filter((l) => /^#{2,3} /.test(l));
  assert.deepEqual(titres.slice(0, 7), ['## Depuis la dernière séance', '## Préparation', '### Sources interrogées',
    '### Candidats, par axe', "### Ce qui n'a pas pu être vérifié", '### Fiches guidées', '### Réserve']);
  assert.equal(md.split('\n').filter((l) => l === ENTETE).length, 3); // fournisseurs, qualité, conformité
  for (const axe of ['**Fournisseurs et coûts**', "**Qualité de l'étiquetage**", '**Conformité**', '**Exploitation**']) assert.ok(md.includes(axe), axe);
  assert.match(md, /\*\*Exploitation\*\*\n\nAucun candidat cette semaine\./);
  assert.match(md, /\| 1 \| « Prix \\\| nouveaux » : Résumé 1\. 30 octobre 2026 \| Source 1 : éditeur, primaire\. Couvert aussi par : Simon Willison \| https:\/\/exemple\.org\/1 \| Hypothèse 1 \|/);
  assert.match(md, /\| 2 \| .* \| Source 2 : praticien, non primaire, à recouper \|/);
});

test('les sources interrogées et ce qui n\'a pas pu être vérifié', async () => {
  const { s } = await preparer();
  const md = s.markdown;
  assert.match(md, /Du lundi 26 octobre 2026 à 9 h 05 au lundi 2 novembre 2026 à 9 h 15 : 9 collecte\(s\), 3 sources \(2 flux, 1 page sans flux ou API\), plus le Journal officiel, lu sans problème\./);
  assert.match(md, /En échec au moins une fois : CNIL, actualités \(2 fois sur 9 ; dernier motif : code 503\)/);
  assert.match(md, /triés par le modèle : 40, dont 12 hors thème et 1 au tri de secours ; notés 6 ou plus : 3 ; proposés : 4, et 1 en réserve\./);
  assert.match(md, /- CNIL, actualités : 1 échec\(s\) de suite à la dernière lecture \(code 503\)\./);
  assert.match(md, /- Fiche 2 : source non primaire ; l'original reste à trouver\./);
  assert.match(md, /- Fiche 3 : le tri automatique n'a pas répondu \(réponse illisible\)/);
  assert.match(md, /- Fiche 3 : date de publication inconnue\./);
});

test('les fiches guidées : deux lignes, quoi chercher, les deux questions, l\'hypothèse, la nature de la source et le lien', async () => {
  const { s } = await preparer();
  const md = s.markdown;
  assert.match(md, /Par où commencer : les fiches 1, 3 et 4\./);
  const fiche1 = md.slice(md.indexOf('#### Fiche 1 '), md.indexOf('#### Fiche 2 '));
  assert.match(fiche1, /^#### Fiche 1 · Fournisseurs et coûts · éditeur, source primaire · note du tri : 7\/10\n/);
  for (const l of ["- En deux lignes (résumé automatique, à vérifier dans l'original) : Résumé 1.", "- À chercher dans l'original : Chercher 1",
    "- Qu'est-ce qui sort ?", '- Est-ce que ça pourrait servir à ParlIA ?', "- L'hypothèse du tri : Hypothèse 1", '- Lien : https://exemple.org/1']) {
    assert.ok(fiche1.includes(l), l);
  }
  assert.match(md, /#### Fiche 2 · Fournisseurs et coûts · praticien, source non primaire, à recouper · note du tri : 6\/10/);
  assert.match(md, /- L'hypothèse du tri : Rien pour ParlIA, d'après le tri : à confirmer ou à contredire en séance\./);
  assert.match(md, /\*\*La CNIL et le CEPD cette semaine\*\* : « @everyone regardez » \(CNIL, actualités\), fiche 4/);
  assert.match(md, /- 30 novembre 2026 : Arrêt d'OpenAI Evals \(sources\.md, 6\.4\)/);
  assert.match(md, /- Attributions : « Décret relatif aux attributions du ministre du travail » \(30 octobre 2026/);
  assert.match(md, /- « Réserve 1 » — Source R \(Qualité de l'étiquetage, note 5\/10\) — https:\/\/exemple\.org\/r1/);
});

test('le nom du fichier : la date du jour ; « essai- » devant en mode test', async () => {
  const { s } = await preparer();
  assert.equal(s.nom, '2026-11-02-preparation.md');
  assert.equal(s.chemin, '/home/node/.n8n-files/parlia/2026-11-02-preparation.md');
  const essai = await preparer(SEL, SD(), { essai: true });
  assert.equal(essai.s.nom, 'essai-2026-11-02-preparation.md');
  assert.ok(essai.s.markdown.startsWith('# [ESSAI] '));
});

test("Discord, en salon : l'ouverture notifie et dit par où commencer ; une fiche par candidat, en silence, puis la réserve", async () => {
  const { s } = await preparer();
  const o = s.discord.ouverture;
  assert.equal(o.cv2, false);
  assert.equal(o.payload.thread_name, undefined);
  assert.deepEqual(o.payload.allowed_mentions, { parse: [] });
  assert.equal(o.payload.flags, undefined);
  assert.ok(o.payload.content.startsWith('📂 **Veille ParlIA · semaine 45** — du lundi 2 au dimanche 8 novembre 2026\n'));
  assert.match(o.payload.content, /\*\*Par où commencer : les fiches 1, 3 et 4\.\*\*/);
  assert.match(o.payload.content, /Fournisseurs et coûts : fiches 1 et 2 · Qualité de l'étiquetage : fiche 3 · Conformité : fiche 4/);
  assert.match(o.payload.content, /La CNIL et le CEPD cette semaine : fiche 4, « @\u200beveryone regardez »/);
  assert.ok(o.payload.content.length <= 2000);
  const f = s.discord.fiches;
  assert.equal(f.length, 5);
  for (const m of f) {
    assert.equal(m.cv2, true);
    assert.equal(m.payload.flags, 36864);
    const texte = JSON.stringify(m.payload.components);
    assert.ok(texte.length < 4000);
    assert.ok(!/@everyone/.test(texte.replace(/@\\u200beveryone|@\u200beveryone/g, '')));
  }
  const carte = f[0].payload.components[0].components;
  assert.match(carte[0].content, /^### Fiche 1\/4 · Fournisseurs et coûts\n\*\*Prix \| nouveaux\*\*\n-# 30 octobre 2026 · Source 1 · éditeur, source primaire · note du tri 7\/10$/);
  assert.match(carte[1].content, /\*\*En deux lignes\*\* : Résumé 1\.\n\*\*À chercher dans l'original\*\* : Chercher 1/);
  assert.match(carte[2].content, /qu'est-ce qui sort \? Est-ce que ça pourrait servir à ParlIA \?\n\*\*L'hypothèse du tri\*\* : Hypothèse 1/);
  assert.deepEqual(carte.find((c) => c.type === 1).components[0], { type: 2, style: 5, label: "Lire l'original", url: 'https://exemple.org/1' });
  assert.match(JSON.stringify(f[4].payload), /Réserve · 1 autre lien/);
  assert.match(JSON.stringify(f[4].payload), /\[Réserve 1\]\(https:\/\/exemple\.org\/r1\)/);
});

test('Discord, en forum : un post par semaine, et la mention de Louis', async () => {
  const { s } = await preparer(SEL, SD(), { reglages: { forum: true, mention: '123456789012345678' } });
  const o = s.discord.ouverture.payload;
  assert.equal(o.thread_name, 'Semaine 45 · du 2 au 8 novembre 2026');
  assert.ok(o.content.startsWith('<@123456789012345678> 📂'));
  assert.deepEqual(o.allowed_mentions, { parse: [], users: ['123456789012345678'] });
  const fin = await preparer(Object.assign({}, SEL, { semaine: { cle: '2026-S49', numero: 49, lundi: '2026-11-30', dimanche: '2026-12-06' } }), SD(), { reglages: { forum: true } });
  assert.equal(fin.s.discord.ouverture.payload.thread_name, 'Semaine 49 · du 30 novembre au 6 décembre 2026');
});

test('la mémoire : la préparation de la semaine est notée, le carnet des collectes repart à zéro', async () => {
  const { sd } = await preparer();
  assert.deepEqual(sd.prep, { semaine: '2026-S45', at: ms(MAINTENANT), fichier: '2026-11-02-preparation.md', nb: 4, threadId: null, messageId: null, rappel: false });
  assert.deepEqual(sd.semaine, { depuis: ms(MAINTENANT), collectes: 0, parSource: {} });
  assert.equal(sd._passage.prepAvant.prep.semaine, '2026-S44');
  assert.equal(sd._passage.prepAvant.semaine.collectes, 9);
});

test('une semaine sans candidat : le fichier et le message le disent', async () => {
  const vide = Object.assign({}, SEL, { candidats: [], aLaUne: [], reserve: [], cnil: null });
  const { s } = await preparer(vide);
  assert.equal(s.markdown.split('Aucun candidat cette semaine.').length - 1, 4);
  assert.match(s.markdown, /Aucun candidat cette semaine : aucune source n'a publié d'article noté 5 ou plus dans le thème\./);
  assert.match(s.markdown, /\*\*La CNIL et le CEPD cette semaine\*\* : aucun texte lu depuis la dernière préparation\./);
  assert.match(s.discord.ouverture.payload.content, /Rien de neuf noté 5 ou plus dans le thème cette semaine\./);
  assert.equal(s.discord.fiches.length, 0);
});

// Ce que le nœud Notes a lu dans les notes de séance (sd._passage.notes).
const NOTES = {
  lisibles: true, motif: '', lues: 2, tenues: 1, seanceSemaine: null,
  seancePrecedente: { numero: '01', debut: '2026-10-29', fin: '2026-11-02', fichier: '2026-10-28-seance-01.md' },
  derniere: {
    numero: '01', debut: '2026-10-29', fin: '2026-11-02', fichier: '2026-10-28-seance-01.md',
    aSurveiller: [
      { point: '2', titre: 'Un modèle cent fois moins cher, conçu pour classer', classement: 'à surveiller : le point revient au comparatif' },
      { point: '3', titre: 'Les scores moyens cachent les échecs', classement: 'à surveiller' },
      { point: '4', titre: 'Un quatrième point', classement: 'à surveiller' },
    ],
    piste: 'Essayer la Decisions API et Jev au comparatif.',
  },
};
const avecNotes = (notes) => Object.assign(SD(), { _passage: { notes } });

test('depuis la dernière séance : les points « à surveiller » et la piste, en tête du fichier et dans l\'ouverture', async () => {
  const { s } = await preparer(SEL, avecNotes(NOTES));
  const md = s.markdown;
  const depuis = md.slice(md.indexOf('## Depuis la dernière séance'), md.indexOf('## Préparation'));
  assert.match(depuis, /Dernière séance tenue : séance 01, du 29 octobre au 2 novembre 2026 \(2026-10-28-seance-01\.md\)\. La semaine dernière : séance 01, du 29 octobre au 2 novembre 2026\./);
  assert.match(depuis, /hors quota, jusqu'à ce qu'une séance les classe autrement :\n- Point 2 : Un modèle cent fois moins cher, conçu pour classer — à surveiller : le point revient au comparatif\n- Point 3 : /);
  assert.match(depuis, /La piste notée pour la suite : « Essayer la Decisions API et Jev au comparatif\. »/);
  const o = s.discord.ouverture.payload.content;
  assert.match(o, /🟡 À surveiller depuis la séance 01 : « Un modèle cent fois moins cher, conçu pour classer », « Les scores moyens cachent les échecs » et 1 autre\n/);
  assert.match(o, /🧭 Piste notée : Essayer la Decisions API et Jev au comparatif\./);
});

test('depuis la dernière séance : notes illisibles, ou aucune séance tenue, le fichier le dit ; rien dans l\'ouverture', async () => {
  const illisibles = await preparer(SEL, avecNotes({ lisibles: false, motif: 'aucune note trouvée : dossier des notes non monté, ou vide', lues: 0, tenues: 0, derniere: null }));
  assert.match(illisibles.s.markdown, /## Depuis la dernière séance\n\nLe bot n'a pas pu lire les notes de séance \(aucune note trouvée : dossier des notes non monté, ou vide\) : reprendre à la main/);
  assert.doesNotMatch(illisibles.s.discord.ouverture.payload.content, /🟡|🧭/);
  const aucune = await preparer(SEL, avecNotes({ lisibles: true, motif: '', lues: 1, tenues: 0, seanceSemaine: null, seancePrecedente: null, derniere: null }));
  assert.match(aucune.s.markdown, /Aucune séance tenue dans les 1 note\(s\) lue\(s\) : rien à reprendre\./);
  const sansPoint = await preparer(SEL, avecNotes(Object.assign({}, NOTES, { seancePrecedente: null, derniere: Object.assign({}, NOTES.derniere, { aSurveiller: [], piste: '' }) })));
  assert.match(sansPoint.s.markdown, /La semaine dernière : aucune séance notée\.\n\nAucun point « à surveiller » dans cette séance\.\n\n## Préparation/);
});

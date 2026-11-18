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
  // Les flux redonnent leurs derniers articles à chaque collecte : les éléments reçus ne sont pas des articles lus.
  assert.match(md, /Reçus des sources : 16 éléments, déjà vus compris ; nouveaux, triés par le modèle : 40, dont 12 hors thème et 1 au tri de secours ; notés 6 ou plus : 3 ; proposés : 4, et 1 en réserve\./);
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

test('la CNIL ou le CEPD noté moins de 6 : signalé sur sa ligne, sans fiche', async () => {
  const sel = Object.assign({}, SEL, {
    candidats: SEL.candidats.slice(0, 3), aLaUne: [1, 3],
    cnil: { n: null, titre: 'La CNIL publie son rapport annuel', url: 'https://www.cnil.fr/fr/rapport', source: 'CNIL, actualités', p: 4, horsTheme: false },
  });
  const { s } = await preparer(sel);
  assert.match(s.markdown, /\*\*La CNIL et le CEPD cette semaine\*\* : « La CNIL publie son rapport annuel » \(CNIL, actualités\), noté 4\/10 par le tri : signalé ici, sans fiche \(une fiche demande une note de 6 ou plus\) — https:\/\/www\.cnil\.fr\/fr\/rapport/);
  assert.match(s.discord.ouverture.payload.content, /La CNIL et le CEPD cette semaine : « La CNIL publie son rapport annuel »/);
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
  assert.match(s.markdown, /Aucun candidat cette semaine : aucune source n'a publié d'article noté 6 ou plus dans le thème\./);
  assert.match(s.markdown, /\*\*La CNIL et le CEPD cette semaine\*\* : aucun texte lu depuis la dernière préparation\./);
  assert.match(s.discord.ouverture.payload.content, /Rien de neuf noté 6 ou plus dans le thème cette semaine\./);
  assert.equal(s.discord.fiches.length, 0);
});

test('les sources sur quatre semaines : une ligne par source du bot, articles proposés et gardés en séance, sans le Journal officiel', async () => {
  const sd = SD();
  sd._passage = { notes: { lisibles: true, lues: 3, tenues: 3, derniere: null, seancePrecedente: null, sources: {
    depuis: '2026-10-26', seances: [{ numero: '03', preparation: '2026-11-09-preparation.md' }],
    nonComptees: [{ numero: '01', motif: 'préparée à la main' }, { numero: '02', motif: 'préparée à la main' }],
    parSource: { 'arXiv : modèles de décision et calibration': { proposes: 2, gardes: 2 }, 'CNIL, actualités': { proposes: 2, gardes: 0 }, 'TypeSafe AI, blog': { proposes: 1, gardes: 0 } },
  } } };
  const { s } = await preparer(SEL, sd);
  const md = s.markdown;
  const partie = md.slice(md.indexOf('### Les sources sur quatre semaines'), md.indexOf('### Classer en séance'));
  assert.match(partie, /Depuis le lundi 26 octobre 2026\. Séances comptées, tenues sur une préparation du bot : séance 03 \(préparation du 9 novembre 2026\)\. Pas comptées : séance 01, préparée à la main ; séance 02, préparée à la main\./);
  assert.match(partie, /Le bot ne retire aucune source/);
  const rangees = partie.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Source |'));
  assert.deepEqual(rangees, [
    '| arXiv : modèles de décision et calibration | 2 | 2 |',
    '| CNIL, actualités | 2 | 0 |',
    '| TypeSafe AI, blog | 1 | 0 |',
    "| OpenAI, journal de l'API | 0 | 0 |",
    '| Source 1 | 0 | 0 |',
  ]);
  assert.doesNotMatch(partie, /Journal officiel \(DILA\) \|/);
  // Sans notes lisibles, pas de bilan.
  const sansNotes = (await preparer()).s.markdown;
  assert.match(sansNotes, /### Les sources sur quatre semaines\n\nLes notes de séance n'ont pas pu être lues : pas de bilan des sources cette semaine\.\n/);
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

test("les dates : inconnue, avec le jour où le bot l'a vu ; avant la période lue, signalée ; les échéances changées par la source", async () => {
  const sel = Object.assign({}, SEL, {
    jourDebut: '2026-10-26',
    candidats: [
      cand(1, 'fournisseurs', { date: '', vu: '2026-10-28', titre: 'TypeSafe AI, blog — Un billet sans date' }),
      cand(2, 'fournisseurs', { date: '2026-10-23', avantPeriode: true, titre: 'Un article ancien' }),
      cand(3, 'qualite', { date: '2026-10-23', vu: '2026-10-27', avantPeriode: true, arxiv: true, titre: 'Une étude annoncée après son dépôt' }),
    ],
    aLaUne: [1, 2, 3],
    echeances: [{ date: '2026-11-20', avant: '2026-11-15', titre: 'Workers AI - Planned model deprecations', url: 'https://exemple.org/cf', source: 'Cloudflare' }],
    echeancesChangees: [{ date: '2026-12-01', changee: '2026-10-30', titre: 'Une ligne changée', url: 'https://exemple.org/oa', source: 'OpenAI' }],
  });
  const { s } = await preparer(sel);
  const md = s.markdown;
  assert.match(md, /\| 1 \| « TypeSafe AI, blog — Un billet sans date » : Résumé 1\. date inconnue \(vu le 28 octobre 2026\) \|/);
  assert.match(md, /\*\*« TypeSafe AI, blog — Un billet sans date »\*\* — date inconnue \(vu le 28 octobre 2026\) — Source 1/);
  assert.match(md, /- Fiche 1 : date de publication inconnue ; le bot l'a vue le 28 octobre 2026\./);
  assert.match(md, /\| 2 \| « Un article ancien » : Résumé 2\. 23 octobre 2026, avant la période lue \|/);
  assert.match(md, /- Fiche 2 : publiée le 23 octobre 2026, avant la période lue \(qui commence le 26 octobre 2026\) : un article ancien, ou la mise à jour d'un avis ancien\./);
  assert.match(md, /\| 3 \| « Une étude annoncée après son dépôt » : Résumé 3\. 23 octobre 2026, déposée sur arXiv avant la période lue, vue par le bot le 27 octobre 2026 \|/);
  assert.doesNotMatch(md, /- Fiche 3 : publiée le/);
  assert.match(md, /- 20 novembre 2026 : Workers AI - Planned model deprecations \(date changée par la source : c'était le 15 novembre 2026\) \(Cloudflare\)/);
  assert.match(md, /Changées ou retirées par la source depuis leur relevé, à vérifier dans l'original :\n- 1er décembre 2026 : Une ligne changée \(texte changé le 30 octobre 2026\)/);
  const carte = s.discord.fiches[0].payload.components[0].components;
  assert.match(carte[0].content, /\n-# date inconnue \(vu le 28 octobre 2026\) · Source 1 · /);
});

test("les originaux : lus ou non, et pourquoi, fiche par fiche ; ce que l'original contredit ; hors thème d'après l'original", async () => {
  const sel = Object.assign({}, SEL, {
    candidats: [
      cand(1, 'fournisseurs', { original: { lu: true, comment: 'billet', taille: 12166, resume: 'original' }, resume: "Un billet d'opinion.",
        ecart: "Aucun nouveau modèle de décision : un billet d'opinion." }),
      cand(2, 'fournisseurs', { original: { lu: false, motif: 'Légifrance refuse les programmes (erreur 403)', resume: 'tri' },
        hypothese: '', hypotheseEcartee: "elle prête un retrait à Clef, que l'article ne nomme pas" }),
      cand(3, 'qualite', { original: { lu: true, comment: 'page', taille: 2439, retrouvePar: 'gpt-5.5-cyber', resume: 'original' }, horsThemeOriginal: true, hypothese: 'rien' }),
      cand(4, 'conformite', { original: { sansObjet: true, motif: "la fiche vient du catalogue d'OpenRouter, relevé par le programme", resume: 'tri' } }),
    ],
    originaux: { modele: 'anthropic/claude-haiku-5.5' },
  });
  const { s } = await preparer(sel);
  const md = s.markdown;
  assert.match(md, /> Le bot a lu l'original de 2 fiches sur 4 et en a écrit le résumé \(anthropic\/claude-haiku-5\.5\) ; pour les autres, /);
  assert.match(md, /- Originaux lus et résumés par le bot : 2 sur 4 ; résumé du tri, sur un extrait : la fiche 2\./);
  assert.match(md, /- Fiche 2 : l'original n'a pas été lu : Légifrance refuse les programmes \(erreur 403\) ; le résumé vient du tri, sur le titre et un extrait\./);
  const fiche = (n) => md.slice(md.indexOf('#### Fiche ' + n + ' '), md.indexOf('#### Fiche ' + (n + 1) + ' ') > 0 ? md.indexOf('#### Fiche ' + (n + 1) + ' ') : undefined);
  assert.match(fiche(1), /- L'original : lu par le bot \(le billet, 12 166 caractères\)\.\n- En deux lignes \(d'après l'original, résumé automatique\) : Un billet d'opinion\./);
  assert.match(fiche(1), /- Ce que l'original contredit dans le tri : Aucun nouveau modèle de décision : un billet d'opinion\./);
  assert.match(fiche(2), /- L'original : non lu : Légifrance refuse les programmes \(erreur 403\) ; le résumé vient du tri, sur le titre et un extrait\.\n- En deux lignes \(résumé du tri, sur un extrait ; à vérifier dans l'original\) : Résumé 2\./);
  assert.match(fiche(3), /partie retrouvée par « gpt-5\.5-cyber »/);
  assert.match(fiche(3), /- D'après l'original, aucun lien concret avec ParlIA : à écarter, sauf avis contraire en séance\./);
  // L'hypothèse dit d'où elle vient ; écartée par le contrôle, la fiche dit pourquoi.
  assert.match(fiche(1), /- L'hypothèse, d'après l'original : Hypothèse 1\n/);
  assert.match(fiche(2), /- L'hypothèse du tri : Hypothèse écartée par le contrôle du bot : elle prête un retrait à Clef, que l'article ne nomme pas\. À formuler en séance\./);
  assert.match(fiche(3), /- L'hypothèse, d'après l'original : Rien pour ParlIA, d'après l'original : à confirmer ou à contredire en séance\./);
  assert.match(fiche(4), /- L'original : sans objet : la fiche vient du catalogue d'OpenRouter, relevé par le programme\./);
  const carte = JSON.stringify(s.discord.fiches[0].payload.components);
  assert.match(carte, /Ce que l'original contredit dans le tri/);
  assert.match(carte, /résumé d'après l'original/);
});

// La semaine du dernier mercredi du mois : la matière de la synthèse (nœud Notes), à la fin du fichier.
const S48_SYN = { cle: '2026-S48', numero: 48, lundi: '2026-11-23', dimanche: '2026-11-29', mercredi: '2026-11-25', synthese: '2026-11' };
const SYNTHESE = {
  mois: '2026-11', mercredi: '2026-11-25',
  seances: [
    { numero: '02', debut: '2026-11-04', fin: '2026-11-04', fichier: '2026-11-04-seance-02.md', points: [
      { point: '1', type: 'decision', titre: 'Un modèle devine à partir des noms', effet: 'Mesurer avec et sans la formule', classement: 'décision à ouvrir : D21',
        sources: 'Wang et Song, arXiv, https://arxiv.org/abs/2611.02273' },
    ] },
    { numero: '03', debut: '2026-11-13', fin: '2026-11-16', fichier: '2026-11-13-seance-03.md', points: [
      { point: 'Séance 02, point 2', type: 'surveiller', titre: 'Mistral Large 4', effet: 'À revoir', classement: 'à surveiller : reclassé', sources: '' },
    ] },
  ],
  semaines: [
    { mercredi: '2026-11-04', seances: [{ numero: '02', debut: '2026-11-04', fin: '2026-11-04' }] },
    { mercredi: '2026-11-11', seances: [{ numero: '03', debut: '2026-11-13', fin: '2026-11-16' }] },
    { mercredi: '2026-11-18', seances: [] },
    { mercredi: '2026-11-25', seances: [] },
  ],
};

test("la semaine du dernier mercredi du mois : la matière de la synthèse à la fin du fichier, et une ligne dans l'ouverture", async () => {
  const sel = Object.assign({}, SEL, { semaine: S48_SYN });
  const { s } = await preparer(sel, avecNotes(Object.assign({}, NOTES, { synthese: SYNTHESE })));
  const md = s.markdown;
  const matiere = md.slice(md.indexOf('## La matière de la synthèse de novembre'));
  assert.ok(md.indexOf('### Classer en séance') < md.indexOf('## La matière de la synthèse de novembre'));
  assert.match(matiere, /celle du mercredi 25 novembre 2026, d'après `GABARIT-SYNTHESE\.md`\. Elle ne reprend que les points classés « à surveiller » ou « décision à ouvrir » dans les notes du mois\. Les voici/);
  assert.match(matiere, /### Séance 02, le 4 novembre 2026 \(2026-11-04-seance-02\.md\)\n\n- \*\*Point 1 : Un modèle devine à partir des noms\*\* — décision à ouvrir : D21\n  - Ce que ça change : Mesurer avec et sans la formule\n  - Sources : Wang et Song, arXiv, https:\/\/arxiv\.org\/abs\/2611\.02273\n/);
  assert.match(matiere, /- \*\*Séance 02, point 2 : Mistral Large 4\*\* — à surveiller : reclassé\n  - Ce que ça change : À revoir\n  - Sources : aucune dans le paragraphe du point : voir la note\n/);
  assert.match(matiere, /- Semaine du mercredi 11 novembre : séance 03, du 13 au 16 novembre 2026\.\n- Semaine du mercredi 18 novembre : aucune séance tenue\.\n- Semaine du mercredi 25 novembre : cette semaine, la dernière du mois\.\n$/);
  assert.match(s.discord.ouverture.payload.content, /🗓️ Cette semaine, la synthèse de novembre : 2 points des notes du mois à reprendre, listés à la fin du fichier\./);
  // Notes illisibles : à relever à la main. Les autres semaines : rien.
  const illisibles = await preparer(sel, avecNotes({ lisibles: false, motif: 'aucune note trouvée : dossier des notes non monté, ou vide', lues: 0, tenues: 0, derniere: null }));
  assert.match(illisibles.s.markdown, /## La matière de la synthèse de novembre\n\n.*\n\nLe bot n'a pas pu lire les notes de séance \(aucune note trouvée : dossier des notes non monté, ou vide\) : les points sont à relever à la main, dans les notes du mois\.\n$/);
  assert.match(illisibles.s.discord.ouverture.payload.content, /🗓️ Cette semaine, la synthèse de novembre : le bot n'a pas pu lire les notes, les points sont à relever à la main\./);
  const autre = await preparer(SEL, avecNotes(NOTES));
  assert.doesNotMatch(autre.s.markdown, /La matière de la synthèse/);
  assert.doesNotMatch(autre.s.discord.ouverture.payload.content, /🗓️/);
});

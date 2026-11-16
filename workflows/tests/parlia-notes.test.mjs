// Les notes de séance, relues en lecture seule (notes-dues-parlia.js, notes-parlia.js) : quand les lire, les séances
// tenues, la séance de la semaine, les points « à surveiller » et la piste de la dernière séance. Lance avec : npm test
import assert from 'node:assert/strict';
import test from 'node:test';
import { executer, plan } from './aide-parlia.mjs';

// Une note au format des notes de séance (gabarit et séance 01), raccourcie.
const NOTE_01 = [
  '# Veille — séance 01 — prévue le mercredi 28 octobre 2026, tenue les 29 octobre et 2 novembre',
  '',
  'Thème : « Étiqueter les questions écrites du Sénat… »',
  '',
  '## Séance',
  '',
  '| Champ | Valeur |',
  '|---|---|',
  '| Date | 2026-10-29 et 2026-11-02. La séance était prévue le mercredi 28 octobre de 20 h à 21 h |',
  '| Séance n° | 01 |',
  "| Points « à surveiller » des séances précédentes | aucun : c'est la première séance |",
  "| Synthèse d'octobre | prévue le 31 octobre ; date d'envoi : [À COMPLÉTER À L'ENVOI] |",
  '',
  '## Préparation',
  '',
  '### Candidats, par axe',
  '',
  '| N° | Élément et date | Lien |',
  '|---|---|---|',
  '| 1 | Claude Haiku 5.5, 7 octobre 2026 | https://exemple.org/1 |',
  '',
  '## Points retenus (trois à cinq)',
  '',
  '1. **Les modèles de décision arrivent chez les grands fournisseurs** (candidat 2). Une interface choisit une réponse dans une liste fermée.',
  '',
  '2. **Un modèle cent fois moins cher, conçu pour classer** (candidat 1). Il refuse le réglage de la température.',
  '',
  "3. Les scores moyens cachent les échecs de l'étiquetage. Le pire ministère est loin sous la moyenne.",
  '',
  '## Ce que ça change, ou pourrait changer, pour le projet',
  '',
  '| Point | Effet | Classement |',
  '|---|---|---|',
  "| 1 | Ces modèles font exactement l'étiquetage de ParlIA | décision à ouvrir : D18 |",
  "| 2 | Un candidat sérieux pour le comparatif | à surveiller : proposé par l'assistant, accepté en séance ; le point revient au comparatif |",
  "| 3 | Mesurer ministère par ministère | À surveiller jusqu'au comparatif |",
  '',
  '## Décision ou non-décision',
  '',
  'Point 1 : décision D18.',
  '',
  '## Prochaine piste',
  '',
  'Au comparatif, prévu pour le 8 novembre : essayer la Decisions API et Jev.',
  '',
  'Séance 02, le mercredi 4 novembre : reprendre les candidats 10 et 15.',
  '',
  '## Hors thème (facultatif, non compté)',
  '',
  'Rien.',
  '',
].join('\n');
// Une note préparée à l'avance : la date prévue, avec son repère à remplir (entre accents graves, comme dans les notes).
const NOTE_02 = [
  '# Veille — séance 02 — mercredi 4 novembre 2026',
  '',
  '## Séance',
  '',
  '| Champ | Valeur |',
  '|---|---|',
  '| Date | 2026-11-04 \x60[À REMPLIR EN SÉANCE : la date réelle, si la séance se tient un autre jour]\x60 |',
  '| Séance n° | 02 |',
  '| Durée | \x60[À REMPLIR EN SÉANCE]\x60 |',
  '',
  '## Prochaine piste',
  '',
  '\x60[À REMPLIR EN SÉANCE]\x60',
  '',
].join('\n');
const NOTE_02_TENUE = NOTE_02.replace(/\| Date \| .* \|/, '| Date | 2026-11-04 |');

const note = (fileName, texte) => ({ fileName, mimeType: 'text/markdown', texte });
async function lire(notes, maintenant = '2026-11-05T16:45', lecture = null) {
  const sd = { _passage: {} };
  const sorties = { 'Que faire ?': [plan({ rappel: true, preparation: false })] };
  if (lecture) sorties['Lire les notes'] = lecture;
  const [s] = await executer('notes-parlia.js', { input: notes, sd, maintenant, sorties });
  return { s, n: sd._passage.notes };
}

test('les notes ne se lisent que pour la préparation ou le rappel', async () => {
  const due = (extra) => executer('notes-dues-parlia.js', { sorties: { 'Que faire ?': [plan(extra)] } });
  assert.deepEqual(await due({ preparation: false, rappel: false }), []);
  assert.deepEqual(await due({ preparation: true, rappel: false }), [{ notes: true }]);
  assert.deepEqual(await due({ preparation: false, rappel: true }), [{ notes: true }]);
});

test('une séance tenue : ses dates, ses points « à surveiller » avec leur titre, et sa piste', async () => {
  const { s, n } = await lire([note('2026-10-28-seance-01.md', NOTE_01), note('2026-11-04-seance-02.md', NOTE_02)]);
  assert.deepEqual(s, { lues: 2, tenues: 1, lisibles: true });
  assert.equal(n.lisibles, true);
  assert.equal(n.motif, '');
  const d = n.derniere;
  assert.deepEqual([d.numero, d.debut, d.fin, d.fichier], ['01', '2026-10-29', '2026-11-02', '2026-10-28-seance-01.md']);
  assert.deepEqual(d.aSurveiller.map((p) => p.point), ['2', '3']);
  assert.equal(d.aSurveiller[0].titre, 'Un modèle cent fois moins cher, conçu pour classer');
  assert.match(d.aSurveiller[0].classement, /^à surveiller : proposé par l'assistant/);
  assert.equal(d.aSurveiller[1].titre, "Les scores moyens cachent les échecs de l'étiquetage.");
  assert.equal(d.piste, 'Au comparatif, prévu pour le 8 novembre : essayer la Decisions API et Jev. Séance 02, le mercredi 4 novembre : reprendre les candidats 10 et 15.');
  // La séance 01 a commencé le 29 octobre : c'est celle de la semaine précédente, pas celle du 2 novembre.
  assert.equal(n.seanceSemaine, null);
  assert.equal(n.seancePrecedente.numero, '01');
});

test("une note préparée à l'avance ne compte pas ; remplie, elle compte pour la semaine de sa première date, une fois passée", async () => {
  assert.equal((await lire([note('2026-11-04-seance-02.md', NOTE_02)])).n.tenues, 0);
  const { n } = await lire([note('2026-10-28-seance-01.md', NOTE_01), note('2026-11-04-seance-02.md', NOTE_02_TENUE)]);
  assert.deepEqual(n.seanceSemaine, { numero: '02', debut: '2026-11-04', fin: '2026-11-04', fichier: '2026-11-04-seance-02.md' });
  assert.equal(n.derniere.numero, '02');
  assert.deepEqual(n.derniere.aSurveiller, []);
  assert.equal(n.derniere.piste, ''); // la piste est encore à remplir
  // Avant le jour de la séance, la date prévue ne vaut rien.
  assert.equal((await lire([note('2026-11-04-seance-02.md', NOTE_02_TENUE)], '2026-11-03T10:15')).n.tenues, 0);
});

test('dossier des notes absent ou vide, fichier illisible : notes non lues, avec le motif', async () => {
  const absent = await lire([{ error: 'No binary data exists on item!' }], undefined, [{ error: 'No file(s) found' }]);
  assert.deepEqual(absent.s, { lues: 0, tenues: 0, lisibles: false });
  assert.equal(absent.n.motif, 'aucune note trouvée : dossier des notes non monté, ou vide');
  assert.equal(absent.n.derniere, null);
  const refus = await lire([{ error: 'No binary data exists on item!' }], undefined, [{ error: 'EACCES: permission denied' }]);
  assert.equal(refus.n.motif, 'EACCES: permission denied');
  const rien = await lire([]);
  assert.equal(rien.n.motif, 'aucune note trouvée : dossier des notes non monté, ou vide');
});

test('fins de ligne Windows, sections absentes, numéro tiré du nom du fichier', async () => {
  const windows = await lire([note('2026-10-28-seance-01.md', NOTE_01.replace(/\n/g, '\r\n'))]);
  assert.deepEqual(windows.n.derniere.aSurveiller.map((p) => p.point), ['2', '3']);
  assert.match(windows.n.derniere.piste, /^Au comparatif/);
  const courte = ['## Séance', '', '| Champ | Valeur |', '|---|---|', '| Date | 2026-10-21 |', ''].join('\n');
  const { n } = await lire([note('2026-10-21-seance-7.md', courte)]);
  assert.deepEqual([n.derniere.numero, n.derniere.debut, n.derniere.aSurveiller.length, n.derniere.piste], ['07', '2026-10-21', 0, '']);
});

// Les sources sur quatre semaines (sources.md, 6.2, règle 10), d'après la séance 03 : tenue sur la préparation du bot
// du 9 novembre 2026, dont la note donne le lien ; ses points retenus citent l'alerte et les fiches 9, 6, 3 et 7.
const ENTETE_PREP = ['| N° | Élément et date | Source et nature | Lien | Ce que ça pourrait changer pour ParlIA (hypothèse) |', '|---|---|---|---|---|'];
const PREP_0911 = ['# Préparation de la veille ParlIA — semaine 46', '', '## Préparation', '', '### Candidats, par axe', '', '**Fournisseurs et coûts**', '']
  .concat(ENTETE_PREP, [
    '| 1 | « Don’t Call It a Decision Model ». 3 novembre 2026 | TypeSafe AI, blog : éditeur, primaire | https://typesafe.ai/blog | Rien pour ParlIA. |',
    "| 3 | « Planned model deprecations on Workers AI ». 5 novembre 2026 | Cloudflare, journal de Workers AI : éditeur, primaire. Couvert aussi par : OpenAI, journal de l'API | https://developers.cloudflare.com/changelog/ | Hypothèse. |",
    '', "**Qualité de l'étiquetage**", '',
  ], ENTETE_PREP, [
    '| 6 | « Presentation Sensitivity ». 4 novembre 2026 | arXiv : modèles de décision et calibration : auteurs, primaire | https://arxiv.org/abs/2611.06384v1 | Hypothèse. |',
    '| 7 | « Zuse ». 4 novembre 2026 | arXiv : modèles de décision et calibration : auteurs, primaire | https://arxiv.org/abs/2611.06238v1 | Hypothèse. |',
    '', '**Conformité**', '',
  ], ENTETE_PREP, [
    '| 8 | « Outils de rejeu de session ». 5 novembre 2026 | CNIL, actualités : institution, primaire | https://www.cnil.fr/fr/rejeu | Hypothèse. |',
    '| 9 | « Beyond accuracy ». 4 novembre 2026 | arXiv : textes parlementaires ou administratifs : auteurs, primaire | https://arxiv.org/abs/2611.06655v1 | Hypothèse. |',
    '', "### Ce qui n'a pas pu être vérifié", '', '- Fiche 1 : publiée le 3 novembre 2026.', '',
  ]).join('\n');
const NOTE_03 = [
  '# Veille — séance 03 — vendredi 13 novembre 2026', '', '## Séance', '', '| Champ | Valeur |', '|---|---|',
  '| Date | 2026-11-13, 2026-11-15 et 2026-11-16 |', '| Séance n° | 03 |',
  '| Outil | Le bot de veille, par sa préparation du lundi 9 novembre 2026 à 7 h 15 |', '',
  '## Préparation', '',
  'La préparation est le fichier du bot, gardé tel quel : [`preparations/2026-11-09-preparation.md`](preparations/2026-11-09-preparation.md).', '',
  '## Points retenus (trois à cinq)', '',
  '1. **Un petit remaniement le 7 novembre** (alerte). Arnaud Viala est nommé ministre délégué.', '',
  '2. **Changer la façon de poser la question change les étiquettes** (fiche 9). Huit façons de poser la question.', '',
  '3. **Un modèle de décision change de réponse quand on change la présentation** (fiche 6). Sur 702 000 jugements.', '',
  "4. **Un fournisseur peut arrêter un modèle quinze jours après l'avoir annoncé** (fiche 3). La fiche 1 n'en disait rien.", '',
  '5. **Zuse, un modèle de décision hébergé en Europe** (fiche 7). Bineric le propose par son API.', '',
].join('\n');
const S48 = { cle: '2026-S48', numero: 48, lundi: '2026-11-23', dimanche: '2026-11-29' };
const prep = (fileName, texte) => ({ fileName, mimeType: 'text/markdown', texte });
async function bilan(notes, preparations, semaine = S48, maintenant = semaine.lundi + 'T09:15') {
  const sd = { _passage: {} };
  const sorties = { 'Que faire ?': [plan({ semaine })] };
  if (preparations) sorties['Texte des préparations'] = preparations;
  await executer('notes-parlia.js', { input: notes, sd, maintenant, sorties });
  return sd._passage.notes.sources;
}

test("les sources sur quatre semaines : la préparation du bot dont la note donne le lien, et les fiches que citent les points retenus", async () => {
  const aLaMain = NOTE_01.replace('| Séance n° | 01 |', "| Séance n° | 01 |\n| Outil | Préparation faite à la main par l'assistant |");
  const b = await bilan([note('2026-10-28-seance-01.md', aLaMain), note('2026-11-13-seance-03.md', NOTE_03)],
    [prep('2026-11-09-preparation.md', PREP_0911), prep('2026-11-16-preparation.md', PREP_0911.replace('TypeSafe AI, blog', 'Liquid AI, actualités des modèles'))]);
  assert.equal(b.depuis, '2026-10-26');
  assert.deepEqual(b.seances, [{ numero: '03', preparation: '2026-11-09-preparation.md' }]);
  assert.deepEqual(b.nonComptees, [{ numero: '01', motif: 'préparée à la main' }]);
  assert.deepEqual(b.parSource, {
    'TypeSafe AI, blog': { proposes: 1, gardes: 0 },
    'Cloudflare, journal de Workers AI': { proposes: 1, gardes: 1 },
    'arXiv : modèles de décision et calibration': { proposes: 2, gardes: 2 },
    'CNIL, actualités': { proposes: 1, gardes: 0 },
    'arXiv : textes parlementaires ou administratifs': { proposes: 1, gardes: 1 },
  });
});

test("sans lien, la dernière préparation du bot des sept jours d'avant ; introuvable, la séance n'est pas comptée ; au-delà de quatre semaines, elle sort du bilan", async () => {
  const sansLien = NOTE_03.replace(/La préparation est le fichier du bot.*\n/, '').replace('(fiche 9)', '(candidat 9, 4 novembre 2026)');
  const b = await bilan([note('2026-11-13-seance-03.md', sansLien)], [prep('2026-11-02-preparation.md', PREP_0911), prep('2026-11-09-preparation.md', PREP_0911)]);
  assert.deepEqual(b.seances, [{ numero: '03', preparation: '2026-11-09-preparation.md' }]);
  // « candidat 9, 4 novembre 2026 » cite la fiche 9, pas une fiche 4 ; la fiche 1, citée après la parenthèse, ne compte pas.
  assert.deepEqual(b.parSource['arXiv : textes parlementaires ou administratifs'], { proposes: 1, gardes: 1 });
  assert.deepEqual(b.parSource['TypeSafe AI, blog'], { proposes: 1, gardes: 0 });
  for (const preparations of [[], null]) {
    const introuvable = await bilan([note('2026-11-13-seance-03.md', NOTE_03)], preparations);
    assert.deepEqual(introuvable.nonComptees, [{ numero: '03', motif: 'préparation du bot introuvable (2026-11-09-preparation.md)' }]);
    assert.deepEqual(introuvable.parSource, {});
  }
  const tard = await bilan([note('2026-11-13-seance-03.md', NOTE_03)], [prep('2026-11-09-preparation.md', PREP_0911)],
    { cle: '2026-S51', numero: 51, lundi: '2026-12-14', dimanche: '2026-12-20' });
  assert.deepEqual([tard.depuis, tard.seances, tard.nonComptees, tard.parSource], ['2026-11-16', [], [], {}]);
});

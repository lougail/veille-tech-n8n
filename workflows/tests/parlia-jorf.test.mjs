// Le détecteur de remaniement (jorf-parlia.js) : les archives du Journal officiel, décompressées et lues sans le
// module zlib, et le filtre sur la date de publication (sources.md, 6.3). Les archives sont fabriquées ici, au format
// de la DILA ; un essai sur deux vraies archives du 1er novembre 2026 a donné les mêmes comptes que les fichiers
// extraits (126 textes, 59 décrets), en 0,2 seconde pour 3,3 Mo. Lance avec : npm test
import assert from 'node:assert/strict';
import test from 'node:test';
import zlib from 'node:zlib';
import { executer, http } from './aide-parlia.mjs';

const LISTE = 'https://echanges.dila.gouv.fr/OPENDATA/JORF/';
function entete(nom, taille, type = '0', prefixe = '') {
  const h = Buffer.alloc(512, 0);
  h.write(nom, 0, 'utf8');
  h.write('0000644\0', 100);
  h.write('0000000\0', 108);
  h.write('0000000\0', 116);
  h.write(taille.toString(8).padStart(11, '0') + '\0', 124);
  h.write('00000000000\0', 136);
  h.write('        ', 148);
  h.write(type, 156);
  h.write('ustar\0', 257);
  h.write('00', 263);
  if (prefixe) h.write(prefixe, 345);
  let somme = 0;
  for (const b of h) somme += b;
  h.write(somme.toString(8).padStart(6, '0') + '\0 ', 148);
  return h;
}
const bourrage = (n) => Buffer.alloc((512 - (n % 512)) % 512);
function tar(fichiers) {
  const parts = [];
  for (const f of fichiers) {
    const data = Buffer.from(f.contenu || '', 'utf8');
    if (f.dossier) parts.push(entete(f.nom, 0, '5'));
    else if (f.long) {
      const nom = Buffer.from(f.nom + '\0', 'utf8');
      parts.push(entete('././@LongLink', nom.length, 'L'), nom, bourrage(nom.length), entete(f.nom.slice(0, 99), data.length));
    } else if (f.prefixe) {
      const i = f.nom.indexOf('/jorf/');
      parts.push(entete(f.nom.slice(i + 1), data.length, '0', f.nom.slice(0, i)));
    } else parts.push(entete(f.nom, data.length));
    if (!f.dossier) parts.push(data, bourrage(data.length));
  }
  parts.push(Buffer.alloc(1024));
  return Buffer.concat(parts);
}
let numero = 1000;
function texte(racine, nature, datePubli, titre, options = {}) {
  const id = 'JORFTEXT0000550' + numero++;
  const contenu = '<?xml version="1.0" encoding="UTF-8"?>\n<TEXTE_VERSION>\n<META>\n<META_COMMUN>\n<ID>' + id + '</ID>\n'
    + '<NATURE>' + nature + '</NATURE>\n</META_COMMUN>\n<META_SPEC>\n<META_TEXTE_CHRONICLE>\n<NOR>PRMX2600001D</NOR>\n'
    + '<DATE_PUBLI>' + datePubli + '</DATE_PUBLI>\n</META_TEXTE_CHRONICLE>\n<META_TEXTE_VERSION>\n<TITRE>' + titre.slice(0, 30)
    + '</TITRE>\n<TITREFULL>' + titre + '</TITREFULL>\n</META_TEXTE_VERSION>\n</META_SPEC>\n</META>\n'
    + '<CONTENU>' + 'Article 1er. Le présent décret sera publié au Journal officiel. '.repeat(options.long || 3) + '</CONTENU>\n</TEXTE_VERSION>\n';
  return Object.assign({ nom: racine + '/jorf/global/texte/version/JORF/TEXT/00/00/55/04/11/' + id + '.xml', contenu, id }, options);
}
const archive = (fichiers, niveau = 6) => zlib.gzipSync(tar(fichiers), { level: niveau });
const listeHtml = (noms) => '<html><body><pre>' + noms.map((n) => '<a href="' + n + '">' + n + '</a>').join('\n') + '</pre></body></html>';
const passer = (sd, table, maintenant = '2026-11-02T09:15', jorf = true) => executer('jorf-parlia.js', {
  sd, maintenant, sorties: { 'Que faire ?': [{ jorf }] }, helpers: http(table),
});

test("la première fois, seule l'archive la plus récente ; seuls les décrets publiés depuis la précédente sonnent", async () => {
  const r = '20261102-002304';
  const compo = texte(r, 'DECRET', '2026-11-02', 'Décret du 1er novembre 2026 relatif à la composition du Gouvernement');
  const attrib = texte(r, 'DECRET', '2026-11-02', "Décret n° 2026-1201 du 1er novembre 2026 relatif aux attributions de la ministre du travail");
  const ancien = texte(r, 'DECRET', '2025-10-12', 'Décret du 12 octobre 2025 relatif à la composition du Gouvernement');
  const arrete = texte(r, 'ARRETE', '2026-11-02', 'Arrêté relatif à la composition du Gouvernement de la commission');
  const struct = { nom: r + '/jorf/global/texte/struct/JORF/TEXT/00/00/55/04/11/JORFTEXT000055041999.xml', contenu: '<x/>' };
  const sd = {};
  const table = {
    [LISTE]: { statusCode: 200, body: listeHtml(['JORF_20261101-210226.tar.gz', 'JORF_20261102-002304.tar.gz']) },
    [LISTE + 'JORF_20261102-002304.tar.gz']: { statusCode: 200, body: archive([{ nom: r + '/', dossier: true }, compo, attrib, ancien, arrete, struct]) },
  };
  const [sortie] = await passer(sd, table);
  assert.deepEqual(sortie.jorf, { archives: 1, textes: 4, decrets: 3, alertes: 2, erreur: '' });
  assert.deepEqual(sd._alertes.map((a) => [a.type, a.date]), [['remaniement', '2026-11-02'], ['attributions', '2026-11-02']]);
  assert.equal(sd._alertes[0].url, 'https://www.legifrance.gouv.fr/jorf/id/' + compo.id);
  assert.equal(sd.jorf.derniere, 'JORF_20261102-002304.tar.gz');
  assert.equal(sd.sante.A12.echecs, 0);
});

test('un décret republié le lendemain ne sonne pas deux fois ; au plus quatre archives par passage, de la plus ancienne à la plus récente', async () => {
  const compo = texte('20261102-002304', 'DECRET', '2026-11-02', 'Décret du 1er novembre 2026 relatif à la composition du Gouvernement');
  const noms = ['JORF_20261102-002304.tar.gz', 'JORF_20261102-210000.tar.gz', 'JORF_20261103-002304.tar.gz',
    'JORF_20261103-210000.tar.gz', 'JORF_20261104-002304.tar.gz', 'JORF_20261104-210000.tar.gz'];
  const sd = { jorf: { derniere: 'JORF_20261102-002304.tar.gz', vus: { [compo.id]: Date.now() } } };
  const table = { [LISTE]: { statusCode: 200, body: listeHtml(noms) } };
  const republie = Object.assign({}, compo, { nom: compo.nom.replace('20261102-002304', '20261102-210000') });
  table[LISTE + noms[1]] = { statusCode: 200, body: archive([republie]) };
  for (const n of noms.slice(2)) table[LISTE + n] = { statusCode: 200, body: archive([texte(n.slice(5, 20), 'ARRETE', '2026-11-03', 'Arrêté')]) };
  const [sortie] = await passer(sd, table, '2026-11-05T09:15');
  assert.equal(sortie.jorf.archives, 4);
  assert.equal(sortie.jorf.alertes, 0);
  assert.equal(sd.jorf.derniere, 'JORF_20261104-002304.tar.gz'); // la cinquième attend le passage suivant
  assert.equal(sd._alertes, undefined);
  const [suite] = await passer(sd, table, '2026-11-05T13:15');
  assert.equal(suite.jorf.archives, 1);
  assert.equal(sd.jorf.derniere, 'JORF_20261104-210000.tar.gz');
});

test('les formats : blocs stockés, compression forte, noms longs du tar, réponse passée en JSON', async () => {
  for (const niveau of [0, 1, 9]) {
    const r = '20261102-002304';
    const long = texte(r, 'DECRET', '2026-11-02', 'Décret relatif aux attributions du ministre des armées', { long: 400 });
    long.nom = r + '/jorf/global/texte/version/JORF/TEXT/00/00/55/04/11/un-dossier-au-nom-tres-long-pour-depasser-cent-caracteres/' + long.id + '.xml';
    long.long = true;
    const prefixe = texte(r, 'DECRET', '2026-11-02', 'Décret relatif à la composition du Gouvernement', { prefixe: true });
    const gz = archive([long, prefixe], niveau);
    const sd = {};
    const [sortie] = await passer(sd, {
      [LISTE]: { statusCode: 200, body: listeHtml(['JORF_20261102-002304.tar.gz']) },
      [LISTE + 'JORF_20261102-002304.tar.gz']: { statusCode: 200, body: JSON.parse(JSON.stringify(gz)) },
    });
    assert.deepEqual(sortie.jorf, { archives: 1, textes: 2, decrets: 2, alertes: 2, erreur: '' }, 'niveau ' + niveau);
  }
});

test("une archive illisible bloque deux passages, puis elle est sautée ; la santé compte les échecs", async () => {
  const sd = { jorf: { derniere: 'JORF_20261101-210226.tar.gz', vus: {} } };
  const table = {
    [LISTE]: { statusCode: 200, body: listeHtml(['JORF_20261101-210226.tar.gz', 'JORF_20261102-002304.tar.gz']) },
    [LISTE + 'JORF_20261102-002304.tar.gz']: { statusCode: 200, body: Buffer.from('pas une archive') },
  };
  for (let i = 1; i <= 2; i++) {
    const [s] = await passer(sd, table);
    assert.match(s.jorf.erreur, /pas au format gzip/);
    assert.equal(sd.jorf.derniere, 'JORF_20261101-210226.tar.gz');
    assert.equal(sd.sante.A12.echecs, i);
  }
  const [s3] = await passer(sd, table);
  assert.equal(s3.jorf.erreur, 'JORF_20261102-002304.tar.gz sautée après trois échecs');
  assert.equal(sd.jorf.derniere, 'JORF_20261102-002304.tar.gz');
  assert.equal(sd.sante.A12.echecs, 0);
});

test("la liste des archives indisponible : un échec noté, rien d'autre ; pas de collecte, pas de lecture", async () => {
  const sd = {};
  const [s] = await passer(sd, { [LISTE]: { statusCode: 503, body: '' } });
  assert.equal(s.jorf.erreur, 'liste des archives : code 503');
  assert.equal(sd.sante.A12.echecs, 1);
  const h = http({});
  const sortie = await executer('jorf-parlia.js', { sd: {}, sorties: { 'Que faire ?': [{ jorf: false }] }, helpers: h });
  assert.deepEqual(sortie, [{ jorf: 'non dû' }]);
  assert.equal(h.appels.length, 0);
});

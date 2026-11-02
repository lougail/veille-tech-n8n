// Détecteur de remaniement : le Journal officiel, lu dans les archives quotidiennes de la DILA (sources.md, 6.3).
// Un filtre sur le seul titre aurait sonné 27 fois en octobre 2026, à cause des anciens textes republiés dans les
// archives ; un filtre sur la date de publication (DATE_PUBLI), aucune fois. Pour chaque archive nouvelle (deux
// par jour), seuls les décrets publiés depuis l'archive précédente sont examinés :
// - « relatif à la composition du Gouvernement » ou « portant nomination du Premier ministre » : alerte de
//   remaniement, vérifier la table des ministères ;
// - « relatif aux attributions du ministre » (de la ministre, du secrétaire d'État…) : alerte d'attributions ;
//   c'est ce décret qui fixe les périmètres, donc la table de correspondance de ParlIA (en 2025, il est paru
//   deux semaines après la composition).
// La première fois, seule l'archive la plus récente est lue. Quatre archives au plus par passage.
// Les archives sont des .tar.gz de 0,1 à 6 Mo, 40 Mo une fois décompressées : le nœud Code n'a pas le module
// zlib, d'où la décompression en JavaScript pur, et la lecture du format tar à la main.
const sd = $getWorkflowStaticData('global');
const plan = $('Que faire ?').first().json;
if (!plan.jorf) return [{ json: { jorf: 'non dû' } }];
const LISTE = 'https://echanges.dila.gouv.fr/OPENDATA/JORF/';
const MAX_ARCHIVES = 4;
const maintenant = $now.toMillis();
const J = 24 * 3600 * 1000;

// ---- inflate (RFC 1951) ----
const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097,
  6145, 8193, 12289, 16385, 24577];
const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const ORDRE = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

// Table de décodage d'un code de Huffman canonique : indexée par les bits à venir (poids faible d'abord),
// elle donne (symbole << 4) | longueur.
function tableHuffman(longueurs) {
  let max = 0;
  for (const l of longueurs) if (l > max) max = l;
  if (max === 0) return { t: new Int32Array(2).fill(-1), max: 1 };
  const compte = new Array(16).fill(0);
  for (const l of longueurs) compte[l]++;
  compte[0] = 0;
  const prochain = new Array(16).fill(0);
  let code = 0;
  for (let l = 1; l <= 15; l++) {
    code = (code + compte[l - 1]) << 1;
    prochain[l] = code;
  }
  const taille = 1 << max;
  const t = new Int32Array(taille).fill(-1);
  for (let s = 0; s < longueurs.length; s++) {
    const l = longueurs[s];
    if (!l) continue;
    let c = prochain[l]++;
    let inverse = 0;
    for (let k = 0; k < l; k++) {
      inverse = (inverse << 1) | (c & 1);
      c >>>= 1;
    }
    for (let j = inverse; j < taille; j += 1 << l) t[j] = (s << 4) | l;
  }
  return { t, max };
}

function inflerBrut(src, debut, tailleAttendue) {
  let pos = debut;
  let tampon = 0;
  let nb = 0;
  let o = 0;
  let out = new Uint8Array(Math.max(1024, tailleAttendue || src.length * 4));
  const besoin = (n) => {
    while (nb < n) {
      if (pos >= src.length) throw new Error('archive tronquée');
      tampon |= src[pos++] << nb;
      nb += 8;
    }
  };
  const bits = (n) => {
    if (n === 0) return 0;
    besoin(n);
    const v = tampon & ((1 << n) - 1);
    tampon >>>= n;
    nb -= n;
    return v;
  };
  const symbole = (h) => {
    while (nb < h.max && pos < src.length) {
      tampon |= src[pos++] << nb;
      nb += 8;
    }
    const e = h.t[tampon & ((1 << h.max) - 1)];
    const l = e & 15;
    if (e < 0 || l > nb) throw new Error('code de Huffman invalide');
    tampon >>>= l;
    nb -= l;
    return e >> 4;
  };
  const place = (n) => {
    if (o + n <= out.length) return;
    if (o + n > 400 * 1024 * 1024) throw new Error('archive trop grosse');
    const plus = new Uint8Array(Math.max(out.length * 2, o + n));
    plus.set(out.subarray(0, o));
    out = plus;
  };
  let fixeL = null;
  let fixeD = null;
  let dernier = 0;
  while (!dernier) {
    dernier = bits(1);
    const type = bits(2);
    if (type === 0) {
      // Bloc stocké : on repart au début de l'octet suivant.
      tampon >>>= nb & 7;
      nb -= nb & 7;
      const len = bits(16);
      const nlen = bits(16);
      if ((len ^ 0xffff) !== nlen) throw new Error('bloc stocké invalide');
      pos -= nb >> 3;
      tampon = 0;
      nb = 0;
      if (pos + len > src.length) throw new Error('archive tronquée');
      place(len);
      out.set(src.subarray(pos, pos + len), o);
      o += len;
      pos += len;
      continue;
    }
    let hl;
    let hd;
    if (type === 1) {
      if (!fixeL) {
        const l = new Array(288);
        for (let i = 0; i < 144; i++) l[i] = 8;
        for (let i = 144; i < 256; i++) l[i] = 9;
        for (let i = 256; i < 280; i++) l[i] = 7;
        for (let i = 280; i < 288; i++) l[i] = 8;
        fixeL = tableHuffman(l);
        fixeD = tableHuffman(new Array(30).fill(5));
      }
      hl = fixeL;
      hd = fixeD;
    } else if (type === 2) {
      const hlit = bits(5) + 257;
      const hdist = bits(5) + 1;
      const hclen = bits(4) + 4;
      const lc = new Array(19).fill(0);
      for (let i = 0; i < hclen; i++) lc[ORDRE[i]] = bits(3);
      const hc = tableHuffman(lc);
      const longueurs = [];
      while (longueurs.length < hlit + hdist) {
        const s = symbole(hc);
        if (s < 16) longueurs.push(s);
        else if (s === 16) {
          if (!longueurs.length) throw new Error('longueurs de codes invalides');
          const precedente = longueurs[longueurs.length - 1];
          for (let n = 3 + bits(2); n > 0; n--) longueurs.push(precedente);
        } else if (s === 17) {
          for (let n = 3 + bits(3); n > 0; n--) longueurs.push(0);
        } else {
          for (let n = 11 + bits(7); n > 0; n--) longueurs.push(0);
        }
      }
      if (longueurs.length > hlit + hdist) throw new Error('longueurs de codes invalides');
      hl = tableHuffman(longueurs.slice(0, hlit));
      hd = tableHuffman(longueurs.slice(hlit));
    } else {
      throw new Error('type de bloc invalide');
    }
    for (;;) {
      const s = symbole(hl);
      if (s < 256) {
        place(1);
        out[o++] = s;
      } else if (s === 256) {
        break;
      } else {
        const i = s - 257;
        if (i >= 29) throw new Error('longueur invalide');
        const len = LBASE[i] + bits(LEXT[i]);
        const ds = symbole(hd);
        if (ds >= 30) throw new Error('distance invalide');
        const dist = DBASE[ds] + bits(DEXT[ds]);
        if (dist > o) throw new Error('distance hors du texte');
        place(len);
        for (let k = 0; k < len; k++) {
          out[o] = out[o - dist];
          o++;
        }
      }
    }
  }
  return out.subarray(0, o);
}

// ---- gzip (RFC 1952) ----
function gunzip(octets) {
  if (octets.length < 18 || octets[0] !== 0x1f || octets[1] !== 0x8b || octets[2] !== 8) {
    throw new Error("l'archive n'est pas au format gzip");
  }
  const drapeaux = octets[3];
  let p = 10;
  if (drapeaux & 4) p += 2 + (octets[p] | (octets[p + 1] << 8));
  if (drapeaux & 8) { while (p < octets.length && octets[p] !== 0) p++; p++; }
  if (drapeaux & 16) { while (p < octets.length && octets[p] !== 0) p++; p++; }
  if (drapeaux & 2) p += 2;
  const n = octets.length;
  const taille = (octets[n - 4] | (octets[n - 3] << 8) | (octets[n - 2] << 16) | (octets[n - 1] << 24)) >>> 0;
  return inflerBrut(octets, p, taille);
}

// ---- tar ----
function ascii(octets, debut, longueur) {
  let s = '';
  for (let i = debut; i < debut + longueur && i < octets.length && octets[i] !== 0; i++) s += String.fromCharCode(octets[i]);
  return s;
}
function metaJorf(xml) {
  const champ = (nom) => {
    const m = new RegExp('<' + nom + '>([\\s\\S]*?)</' + nom + '>').exec(xml);
    return m ? texteSimple(m[1]) : '';
  };
  return {
    id: champ('ID'), nature: champ('NATURE'), datePubli: champ('DATE_PUBLI'),
    titre: champ('TITREFULL') || champ('TITRE'), nor: champ('NOR'),
  };
}
// Les textes (fichiers .../texte/version/...xml) d'une archive, avec leurs métadonnées : les 12 premiers Ko
// de chaque fichier suffisent, la nature, le titre et la date de publication sont en tête.
function textesDeLArchive(tar) {
  const dec = new TextDecoder('utf-8');
  const textes = [];
  let p = 0;
  let nomLong = '';
  while (p + 512 <= tar.length) {
    if (tar[p] === 0) break;
    let nom = ascii(tar, p, 100);
    const taille = parseInt(ascii(tar, p + 124, 12).trim() || '0', 8) || 0;
    const type = String.fromCharCode(tar[p + 156] || 48);
    if (ascii(tar, p + 257, 6) === 'ustar') {
      const prefixe = ascii(tar, p + 345, 155);
      if (prefixe) nom = prefixe + '/' + nom;
    }
    p += 512;
    if (type === 'L') {
      nomLong = ascii(tar, p, taille);
      p += Math.ceil(taille / 512) * 512;
      continue;
    }
    if (nomLong) {
      nom = nomLong;
      nomLong = '';
    }
    if (type === '0' && nom.includes('/texte/version/') && nom.endsWith('.xml')) {
      textes.push(metaJorf(dec.decode(tar.subarray(p, p + Math.min(taille, 12000)))));
    }
    p += Math.ceil(taille / 512) * 512;
  }
  return textes;
}

function enOctets(x) {
  if (x instanceof Uint8Array) return x;
  if (x instanceof ArrayBuffer) return new Uint8Array(x);
  if (x && x.type === 'Buffer' && Array.isArray(x.data)) return Uint8Array.from(x.data);
  if (x && x.body !== undefined) return enOctets(x.body);
  throw new Error("réponse illisible pour l'archive");
}
const dateDuNom = (nom) => nom.slice(5, 9) + '-' + nom.slice(9, 11) + '-' + nom.slice(11, 13);
function typeAlerte(titre) {
  const t = String(titre || '').replace(/\s+/g, ' ');
  if (/relatif à la composition du Gouvernement|portant nomination du Premier ministre/i.test(t)) return 'remaniement';
  if (/relatif aux attributions d(u|e la|es) (ministre|secr[ée]taire)/i.test(t)) return 'attributions';
  return '';
}

const etat = sd.jorf || { derniere: '', vus: {} };
if (!etat.vus) etat.vus = {};
for (const [cle, t] of Object.entries(etat.vus)) if (maintenant - t > 120 * J) delete etat.vus[cle];
const bilan = { archives: 0, textes: 0, decrets: 0, alertes: 0, erreur: '' };
try {
  const liste = await helpers.httpRequest({
    url: LISTE, method: 'GET', headers: { 'User-Agent': PARLIA.UA }, timeout: 30000,
    returnFullResponse: true, ignoreHttpStatusErrors: true,
  });
  const code = Number(liste.statusCode || 0);
  if (code !== 200) throw new Error('liste des archives : code ' + code);
  const noms = [...new Set(Array.from(String(liste.body || '').matchAll(/href="(JORF_\d{8}-\d{6}\.tar\.gz)"/g), (m) => m[1]))].sort();
  if (!noms.length) throw new Error('aucune archive dans la liste');
  const aLire = etat.derniere ? noms.filter((n) => n > etat.derniere).slice(0, MAX_ARCHIVES) : noms.slice(-1);
  for (const nom of aLire) {
    const seuil = etat.derniere ? dateDuNom(etat.derniere) : dateDuNom(nom);
    let textes;
    try {
      const corps = await helpers.httpRequest({
        url: LISTE + nom, method: 'GET', encoding: 'arraybuffer', headers: { 'User-Agent': PARLIA.UA }, timeout: 90000,
      });
      textes = textesDeLArchive(gunzip(enOctets(corps)));
    } catch (e) {
      // Une archive illisible trois fois de suite est sautée, pour ne pas bloquer les suivantes.
      const echec = etat.echec && etat.echec.nom === nom ? etat.echec.n + 1 : 1;
      etat.echec = { nom, n: echec };
      if (echec < 3) throw new Error(nom + ' : ' + (e && e.message ? e.message : e));
      bilan.erreur = nom + ' sautée après trois échecs';
      etat.derniere = nom;
      continue;
    }
    etat.echec = null;
    bilan.archives++;
    bilan.textes += textes.length;
    for (const t of textes) {
      if (t.nature !== 'DECRET') continue;
      bilan.decrets++;
      if (!t.datePubli || t.datePubli < seuil) continue; // un ancien texte republié
      const type = typeAlerte(t.titre);
      const cle = t.id || hacher(t.titre);
      if (!type || etat.vus[cle]) continue;
      etat.vus[cle] = maintenant;
      bilan.alertes++;
      pousserAlerte(sd, {
        type, id: cle, titre: tronquer(t.titre, 300), date: t.datePubli,
        url: t.id ? 'https://www.legifrance.gouv.fr/jorf/id/' + t.id : LISTE + nom,
        origine: 'Journal officiel, archive ' + nom,
      });
    }
    etat.derniere = nom;
  }
  noterSante(sd, 'A12', 'Journal officiel (DILA)', true, '', maintenant);
} catch (e) {
  bilan.erreur = String(e && e.message ? e.message : e).slice(0, 160);
  noterSante(sd, 'A12', 'Journal officiel (DILA)', false, bilan.erreur, maintenant);
}
sd.jorf = etat;
sd._passage = Object.assign(sd._passage || {}, { jorf: bilan });
return [{ json: { jorf: bilan } }];

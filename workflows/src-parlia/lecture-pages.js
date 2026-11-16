// ---- Lecture des pages (workflows/src-parlia/lecture-pages.js) ----
// Commun à la collecte des pages sans flux (collecte-pages-api.js) et à la lecture des originaux
// (originaux-parlia.js) : build_parlia.py place ce fichier, après outils.js, en tête des nœuds qui s'en servent.
// Le corps d'une réponse en texte : chaîne, tampon d'octets (éventuellement passé en JSON), ou objet.
function texteDe(corps) {
  if (corps == null) return '';
  if (typeof corps === 'string') return corps;
  if (corps instanceof Uint8Array) return new TextDecoder('utf-8').decode(corps);
  if (corps.type === 'Buffer' && Array.isArray(corps.data)) return new TextDecoder('utf-8').decode(Uint8Array.from(corps.data));
  return JSON.stringify(corps);
}
// Une réponse en HTML ? Un site de documentation peut répondre en Markdown à l'en-tête Accept de n8n
// (« application/json, text/plain, */* ») : Mintlify, pour la page des modèles de TypeSafe (16 novembre 2026). Lue
// comme du HTML, elle tenait sur une seule ligne. Une page HTML commence par une balise, ou en contient une <html>
// ou <body> ; une réponse sans elles est lue comme du Markdown (lignesDuMarkdown).
function estHtml(corps) {
  const t = String(corps == null ? '' : corps);
  return /^\s*</.test(t) || /<(?:html|body)\b/i.test(t);
}
// ---- Pages : le texte visible, en lignes ; « §T » marque un intertitre, « §L » une rangée de tableau ----
// Le format des lignes : quand il change, chaque page est réapprise une fois, sans rien proposer (comparer).
// 2 (15 novembre 2026) : une rangée de tableau en une seule ligne, avec les en-têtes des colonnes.
const FORMAT_PAGES = 2;
// Une rangée de tableau : chaque cellule précédée de l'en-tête de sa colonne ; une cellule vide est omise.
function rangee(entetes, valeurs) {
  const morceaux = valeurs.map((v, i) => (v && entetes[i] && entetes[i] !== v ? entetes[i] + ' : ' + v : v)).filter(Boolean);
  return morceaux.length ? '§L ' + morceaux.join(' · ') : '';
}
// Des rangées (listes de cellules) en lignes ; avecEntetes : la première rangée donne les en-têtes.
function rangeesEnLignes(rangees, avecEntetes) {
  const pleines = rangees.filter((r) => r.some(Boolean));
  if (!pleines.length) return [];
  const entetes = avecEntetes ? pleines[0] : [];
  return (avecEntetes ? pleines.slice(1) : pleines).map((r) => rangee(entetes, r)).filter(Boolean);
}
// Un tableau HTML : une cellule fusionnée (rowspan, colspan) est recopiée partout où elle s'étend. Le texte d'un
// bouton est gardé : chez Anthropic, le nom du modèle est un bouton qui le copie.
function tableauHtml(t) {
  const texteCellule = (c) => texteSimple(String(c).replace(/<(svg|script|style)\b[\s\S]*?<\/\1>/gi, ' '));
  const finEntete = t.search(/<\/thead>/i);
  const rangees = [];
  const report = [];
  let entetes = null;
  for (const tr of t.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cellules = Array.from(tr[1].matchAll(/<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi), (c) => ({
      th: c[1].toLowerCase() === 'th',
      texte: texteCellule(c[3]),
      hauteur: Math.min(50, Number((/rowspan\s*=\s*["']?(\d+)/i.exec(c[2]) || [])[1]) || 1),
      largeur: Math.min(20, Number((/colspan\s*=\s*["']?(\d+)/i.exec(c[2]) || [])[1]) || 1),
    }));
    const valeurs = [];
    let k = 0;
    let col = 0;
    while (col < 60 && (k < cellules.length || report.some((r, i) => i >= col && r && r.reste > 0))) {
      if (report[col] && report[col].reste > 0) {
        valeurs.push(report[col].texte);
        report[col].reste--;
        col++;
      } else if (k < cellules.length) {
        const c = cellules[k++];
        for (let s = 0; s < c.largeur; s++, col++) {
          valeurs.push(c.texte);
          report[col] = c.hauteur > 1 ? { texte: c.texte, reste: c.hauteur - 1 } : null;
        }
      } else {
        valeurs.push('');
        col++;
      }
    }
    const dansEntete = finEntete > 0 && tr.index < finEntete;
    if (!entetes && !rangees.length && cellules.length && (dansEntete || cellules.every((c) => c.th))) entetes = valeurs;
    else rangees.push(valeurs);
  }
  return rangeesEnLignes(entetes ? [entetes].concat(rangees) : rangees, !!entetes);
}
// Une page en Markdown : une ligne par paragraphe ou par élément de liste, même coupé à 80 colonnes dans le
// fichier ; « # Titre » devient un intertitre ; les liens gardent leur texte, les marques de mise en forme, les
// balises Markdoc (« {% id=… %} ») et les blocs de code partent.
// Les tableaux, à barres verticales ou Markdoc (« {% table %} », une cellule par « * », des « --- » entre les
// rangées, comme sur la page des retraits de Gemini), donnent une ligne par rangée, avec les en-têtes.
function lignesDuMarkdown(texte) {
  const lignes = [];
  let dansCode = false;
  let markdoc = null;
  let barres = [];
  let paragraphe = '';
  const nettoyer = (s) => texteSimple(String(s)
    .replace(/\{%[^%]*%\}/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*\x60]+/g, ''));
  const finirParagraphe = () => {
    const l = nettoyer(paragraphe);
    if (l.length > 1) lignes.push(l);
    paragraphe = '';
  };
  const separateur = (l) => /^\s*\|?[\s:|-]+\|?\s*$/.test(l) && l.includes('-');
  const finirBarres = () => {
    if (!barres.length) return;
    const rangees = barres.filter((l) => !separateur(l))
      .map((l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(nettoyer));
    lignes.push(...rangeesEnLignes(rangees, barres.length > 1 && separateur(barres[1])));
    barres = [];
  };
  for (const brute of String(texte).replace(/\r\n?/g, '\n').split('\n')) {
    if (/^\s*(\x60\x60\x60|~~~)/.test(brute)) { finirBarres(); finirParagraphe(); dansCode = !dansCode; continue; }
    if (dansCode || /^\s*>/.test(brute)) continue;
    if (markdoc) {
      if (/^\s*\{%\s*\/table\s*%\}/.test(brute)) {
        lignes.push(...rangeesEnLignes(markdoc.rangees.concat([markdoc.courante]), true));
        markdoc = null;
      } else if (/^\s*-{3,}\s*$/.test(brute)) {
        markdoc.rangees.push(markdoc.courante);
        markdoc.courante = [];
      } else {
        const cellule = /^\s*[*+-]\s?(.*)$/.exec(brute);
        if (cellule) markdoc.courante.push(nettoyer(cellule[1]));
        else if (brute.trim() && markdoc.courante.length) markdoc.courante[markdoc.courante.length - 1] += ' ' + nettoyer(brute);
      }
      continue;
    }
    if (/^\s*\{%\s*table\b[^%]*%\}/.test(brute)) { finirBarres(); finirParagraphe(); markdoc = { rangees: [], courante: [] }; continue; }
    if (/^\s*\|/.test(brute)) { finirParagraphe(); barres.push(brute); continue; }
    finirBarres();
    if (!brute.trim() || /^\s*\{%[^%]*%\}\s*$/.test(brute) || /^\s*([-*_])(\s*\1){2,}\s*$/.test(brute)) { finirParagraphe(); continue; }
    const titre = /^\s*#{1,6}\s+(.+)$/.exec(brute);
    if (titre) {
      finirParagraphe();
      const l = nettoyer(titre[1]);
      if (l.length > 1) lignes.push('§T ' + l);
      continue;
    }
    const element = /^\s*([*+-]|\d+\.)\s+(.*)$/.exec(brute);
    if (element) {
      finirParagraphe();
      paragraphe = element[2];
    } else {
      paragraphe += (paragraphe ? ' ' : '') + brute.trim();
    }
  }
  finirParagraphe();
  finirBarres();
  if (markdoc) lignes.push(...rangeesEnLignes(markdoc.rangees.concat([markdoc.courante]), true));
  return lignes;
}
// Un article (options.article) : son texte est dans <article> quand la page en a un, pour laisser de côté les
// billets voisins et les menus ; sinon, comme une page, dans <main>, ou dans <body>.
function lignesDe(html, options = {}) {
  let h = String(html);
  const a1 = options.article ? h.search(/<article\b/i) : -1;
  const a2 = a1 >= 0 ? h.search(/<\/article>/i) : -1;
  if (a1 >= 0 && a2 > a1) h = h.slice(a1, a2);
  const m1 = h.search(/<main\b/i);
  const m2 = h.search(/<\/main>/i);
  if (m1 >= 0 && m2 > m1) h = h.slice(m1, m2);
  else {
    const b = h.search(/<body\b/i);
    if (b >= 0) h = h.slice(b);
  }
  // Un retour à la ligne du code HTML n'en est pas un à l'écran : les lignes ne naissent que des balises de bloc.
  // Sinon, une balise écrite sur plusieurs lignes laissait des morceaux (« href=… », « class=… ») devenus des lignes
  // de texte (page du Bureau de l'IA, 6 novembre 2026). Les tableaux passent avant que les boutons partent.
  h = h.replace(/<!--[\s\S]*?-->/g, ' ').replace(/\s+/g, ' ');
  h = h.replace(/<table\b[\s\S]*?<\/table>/gi, (t) => '\n' + tableauHtml(t).join('\n') + '\n');
  h = h.replace(/<(script|style|noscript|svg|template|iframe|head|button|form|select)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(nav|footer|aside)\b[\s\S]*?<\/\1>/gi, ' ');
  h = h.replace(/<(h[1-6])\b[^>]*>/gi, '\n§T ').replace(/<\/(h[1-6])>/gi, '\n')
    .replace(/<(br|hr)\b[^>]*>/gi, '\n')
    .replace(/<\/?(p|div|li|ul|ol|tr|td|th|table|section|article|header|dt|dd|dl|blockquote|pre|figure|figcaption|main|summary|details|time)\b[^>]*>/gi, '\n');
  return h.split('\n')
    .map((l) => texteSimple(l))
    .filter((l) => l.length > 1 && l !== '§T');
}
// Le texte d'un bloc : ses lignes séparées par « · », ses rangées de tableau par « ; ».
const estRangee = (l) => l.startsWith('§L ');
const sansMarque = (l) => (estRangee(l) ? l.slice(3) : l);
function texteDuBloc(lignes) {
  return lignes.reduce((t, l, i) => t + (i ? (estRangee(l) || estRangee(lignes[i - 1]) ? ' ; ' : ' · ') : '') + sansMarque(l), '');
}
// ---- Fin de la lecture des pages ----

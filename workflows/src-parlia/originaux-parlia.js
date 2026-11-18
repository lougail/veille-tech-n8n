// La lecture des originaux (15 novembre 2026) : pour chaque candidat retenu par la sélection, 8 au plus par
// semaine, le bot lit l'original avant d'écrire le résumé de la fiche. Jusque-là, le résumé et l'hypothèse venaient
// du tri, qui ne voit que le titre et un extrait ; la lecture des originaux, le 13 novembre 2026, a corrigé huit des
// dix fiches de la semaine 46.
// Ce qui est lu :
// - une prépublication d'arXiv : le résumé de l'étude, par l'API d'arXiv (l'article entier est un PDF). Toutes les
//   études de la semaine sont lues en une seule demande (id_list) : l'API demande trois secondes entre deux demandes,
//   et des demandes en parallèle pouvaient recevoir l'erreur 429. Après une erreur 429 ou 503, une seconde demande,
//   quatre secondes plus tard (18 novembre 2026) ;
// - une page sans flux : la page, puis la partie où se trouve le bloc retenu (son intertitre, les rangées de tableau
//   avec leurs en-têtes) ; pour une page qui liste des billets (blog, actualités), le billet lui-même, retrouvé par
//   le lien qui porte son titre : le blog de TypeSafe ne date pas ses billets, le billet, si ;
// - un dépôt Hugging Face (comptes de Cloudflare et de Perplexity) : sa fiche (README.md), sans son en-tête ; la page
//   du dépôt n'a pas de texte lisible pour un programme (essai du 16 novembre 2026) ;
// - les autres : la page de l'article, le texte de <article>, sinon de <main>.
// Une page servie en Markdown est lue comme telle : la page des modèles de TypeSafe, et toute réponse sans HTML.
// Le catalogue d'OpenRouter n'a pas d'original à lire : ses chiffres sont relevés par le programme.
// Sur la page des retraits d'OpenAI et dans les billets de retraits de Cloudflare (PARLIA.RETRAITS_TEXTE), seules les
// lignes des modèles de texte sont lues, sans les sections dont l'intertitre ne nomme que d'autres modèles
// (16 novembre 2026).
// Un site qui refuse les programmes répond 403 (Légifrance, l'aide d'OpenAI, vérifié le 13 novembre 2026) : la
// fiche dit pourquoi l'original n'a pas été lu, et garde le résumé du tri ; de même pour une page introuvable.
// Un original en PDF (un avis, des lignes directrices) n'est pas lu : son texte arrivait au modèle illisible. La fiche
// le dit, pour que Louis l'ouvre lui-même.
// Sortie : une demande de résumé par original lu, pour la chaîne « Résumé des originaux », un appel après l'autre ;
// le premier élément porte aussi la lecture de chaque candidat (lectures). Sans aucun original lu, une seule demande,
// vide, que le nœud suivant ignore : une chaîne sans élément arrêterait la préparation.
const sel = $input.first().json || {};
const candidats = sel.candidats || [];
const http = (typeof helpers !== 'undefined' && helpers) || this.helpers;
const aujourdhui = $now.toISODate();
const VERSION_RESUME = "résumé de l'original, version du 16 novembre 2026";
const MAX_TEXTE = 12000;
const REFUS = [{ domaine: 'legifrance.gouv.fr', nom: 'Légifrance' }, { domaine: 'help.openai.com', nom: "L'aide d'OpenAI" }, { domaine: 'arxiv.org', nom: 'arXiv' }];
// Les pages construites dans le navigateur : leur version Markdown porte le texte (comme pour la collecte).
const MARKDOWN = {
  'https://aistudio.google.com/docs/changelog?hl=en': 'https://aistudio.google.com/docs/changelog.md',
  'https://aistudio.google.com/docs/deprecations?hl=en': 'https://aistudio.google.com/docs/deprecations.md',
  'https://docs.typesafe.ai/models': 'https://docs.typesafe.ai/models.md',
};
// Un dépôt Hugging Face : huggingface.co/<compte>/<dépôt>, hors des pages du site (blog, documentation…).
const DEPOT_HF = /^https?:\/\/huggingface\.co\/(?!(?:blog|docs|papers|spaces|datasets|models|api|organizations|collections)\/)([\w.-]+\/[\w.-]+)\/?$/i;
// Les pages sans flux qui listent des billets ou des actualités : l'original est le billet.
const LISTES = ['D02', 'D04', 'C11', 'C12'];
// Les pages sans flux (collecte-pages-api.js) : pour un article trié avant le 15 novembre 2026, le registre ne
// garde pas le type de sa source.
const PAGES = ['F01', 'F02', 'F06', 'F09', 'F12', 'F13', 'D02', 'Y02', 'D04', 'C11', 'C12', 'C14'];

const simple = (s) => texteSimple(s).toLowerCase().replace(/[’‘]/g, "'");
const nu = (l) => l.replace(/^§[TL] /, '');
// Le texte lu, pour le modèle : un intertitre après « ## », une rangée de tableau après « - » ; la ligne retenue,
// sur une page, après « [ligne retenue] ».
const enTexte = (lignes, retenue = -1) => lignes.map((l, k) => (k === retenue ? '[ligne retenue] ' : '')
  + (l.startsWith('§T ') ? '## ' + l.slice(3) : l.startsWith('§L ') ? '- ' + l.slice(3) : l)).join('\n');
// Le titre du bloc retenu, sans le nom de la source que la collecte met devant (« TypeSafe AI, blog — … »).
const titreDuBloc = (c) => String(c.titre || '').replace(/^.*? — /, '').replace(/…$/, '').trim();
// La réponse : son code, son texte, et si c'est un PDF (par l'en-tête Content-Type, ou par la signature « %PDF- »).
async function lire(url) {
  const r = await http.httpRequest({
    url, method: 'GET', timeout: 20000, returnFullResponse: true, ignoreHttpStatusErrors: true,
    headers: { 'User-Agent': PARLIA.UA, 'Accept-Language': 'fr,en;q=0.8' },
  });
  const corps = texteDe(r && r.body);
  const type = String((r && r.headers && (r.headers['content-type'] || r.headers['Content-Type'])) || '');
  return { code: Number(r && r.statusCode || 0), corps, pdf: /application\/pdf/i.test(type) || corps.slice(0, 8).includes('%PDF-') };
}
const PDF = "l'original est un PDF, que le bot ne sait pas lire : l'ouvrir à la main";
function refus(url, code) {
  const d = domaineDe(url);
  const site = REFUS.find((r) => d === r.domaine || d.endsWith('.' + r.domaine));
  if (code === 429) return (site ? site.nom : 'Le site') + ' a reçu trop de demandes (erreur 429)';
  if ([401, 403].includes(code)) return (site ? site.nom : 'Le site') + ' refuse les programmes (erreur ' + code + ')';
  return 'la page répond ' + (code ? 'par une erreur ' + code : 'sans code');
}
// Une adresse complète, à partir d'un lien de la page (new URL() n'existe pas dans le bac à sable de n8n).
function absolue(lien, base) {
  const l = String(lien || '').trim().replace(/&amp;/g, '&');
  if (/^https?:\/\//i.test(l)) return l;
  if (l.startsWith('//')) return 'https:' + l;
  const m = /^(https?:\/\/[^/?#]+)([^?#]*)/i.exec(base);
  if (!m) return '';
  if (l.startsWith('/')) return m[1] + l;
  return m[1] + m[2].replace(/[^/]*$/, '') + l.replace(/^\.\//, '');
}
// Le lien qui porte le titre du billet, sur la page qui liste les billets.
function lienDuTitre(html, titre, base) {
  const cherche = simple(titre).slice(0, 60);
  if (cherche.length < 8) return '';
  for (const m of String(html).matchAll(/<a\b[^>]*?href\s*=\s*["']([^"'#]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    if (simple(m[2]).includes(cherche)) return absolue(m[1], base);
  }
  return '';
}
// La date de publication que la page déclare (données structurées, balise <time>), si elle est passée.
function dateDeLaPage(html) {
  const motifs = [/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})/, /article:published_time["'][^>]*content=["'](\d{4}-\d{2}-\d{2})/i,
    /<time\b[^>]*datetime=["'](\d{4}-\d{2}-\d{2})/i];
  for (const m of motifs) {
    const x = m.exec(String(html));
    if (x && x[1] <= aujourdhui) return x[1];
  }
  return '';
}
// Sinon, la date écrite près du titre : la ligne d'avant ou l'une des trois d'après (« Nov 3, 2026 » sous le titre
// du billet de TypeSafe, « 05 novembre 2026 » sous ceux de la CNIL, vu le 15 novembre 2026), si elle est passée.
function dateSousLeTitre(lignes, titre) {
  const cherche = simple(titre).slice(0, 40);
  const i = cherche.length >= 8 ? lignes.findIndex((l) => l.startsWith('§T ') && simple(l.slice(3)).includes(cherche)) : -1;
  if (i < 0) return '';
  for (const k of [i - 1, i + 1, i + 2, i + 3]) {
    const d = k >= 0 && k < lignes.length ? datesDansTexte(nu(lignes[k])).find((x) => x <= aujourdhui) : '';
    if (d) return d;
  }
  return '';
}
// La partie d'une page où se trouve le bloc retenu : la ligne qui porte le titre de la fiche, avec les quatre lignes
// d'avant et les huit d'après, sans passer d'intertitre, et l'intertitre qui la précède. La page a pu changer de
// forme depuis la collecte (OpenAI a refait sa page des retraits entre le 6 et le 15 novembre 2026, et écrit
// désormais « GPT-6 Cyber ») : sans le titre, la ligne est cherchée par le nom le plus long du titre qui porte un
// chiffre et une lettre (« gpt-5.5-cyber »), et la fiche dit que la page a changé.
function partieDuBloc(lignes, titre) {
  const cherche = simple(titre).slice(0, 60);
  let i = cherche.length >= 8 ? lignes.findIndex((l) => simple(nu(l)).includes(cherche)) : -1;
  let par = '';
  if (i < 0) {
    const noms = simple(titre).split(/[^a-z0-9.-]+/).map((t) => t.replace(/^[.-]+|[.-]+$/g, ''))
      .filter((t) => t.length >= 5 && /\d/.test(t) && /[a-z]/.test(t)).sort((a, b) => b.length - a.length);
    for (const nom of noms) {
      i = lignes.findIndex((l) => simple(nu(l)).includes(nom));
      if (i >= 0) { par = nom; break; }
    }
  }
  if (i < 0) return null;
  let debut = i;
  while (debut > 0 && !lignes[debut].startsWith('§T ') && i - debut < 4) debut--;
  let fin = i + 1;
  while (fin < lignes.length && !lignes[fin].startsWith('§T ') && fin - i < 9) fin++;
  const partie = lignes.slice(debut, fin);
  let retenue = i - debut;
  if (!partie[0].startsWith('§T ')) {
    const titrePrecedent = lignes.slice(0, debut).reverse().find((l) => l.startsWith('§T '));
    if (titrePrecedent) {
      partie.unshift(titrePrecedent);
      retenue++;
    }
  }
  return { lignes: partie, retenue, par };
}

// La lecture d'un candidat : { lu, comment, adresse, texte, datePage, motif, retrouvePar }.
const rien = (c) => ({ n: c.n, lu: false, comment: '', adresse: c.url, texte: '', datePage: '', motif: '', retrouvePar: '' });
const pasDeReponse = (e) => 'pas de réponse (' + String(e && e.message ? e.message : e).slice(0, 80) + ')';

// Les études d'arXiv, en une seule demande : une lecture par candidat, rangée par numéro de fiche. Le numéro d'une
// étude (2611.06655, ou cs/0112017 pour les plus anciennes) est comparé sans sa version : sans version, l'API donne
// la dernière.
const estArxiv = (c) => !!c.arxiv || /^https?:\/\/arxiv\.org\/abs\//i.test(c.url);
const NUMERO_ARXIV = /^(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[a-z]{2})?\/\d{7})(?:v\d+)?$/i;
const sansVersion = (id) => String(id).replace(/v\d+$/i, '');
async function etudesArxiv(liste) {
  const lues = {};
  const numeros = {};
  for (const c of liste) {
    const id = String(c.url).split('/abs/').pop().replace(/[?#].*$/, '').replace(/\/+$/, '');
    if (NUMERO_ARXIV.test(id)) numeros[c.n] = id;
    else lues[c.n] = Object.assign(rien(c), { motif: "l'adresse ne donne pas le numéro de l'étude sur arXiv" });
  }
  const ids = Object.values(numeros);
  if (!ids.length) return lues;
  const adresse = 'https://export.arxiv.org/api/query?id_list=' + ids.join(',') + '&max_results=' + ids.length;
  let r;
  try {
    r = await lire(adresse);
    if (r.code === 429 || r.code === 503) {
      await new Promise((fin) => setTimeout(fin, 4000));
      r = await lire(adresse);
    }
  } catch (e) {
    r = { code: 0, corps: '', erreur: pasDeReponse(e) };
  }
  const entrees = {};
  for (const m of r.corps.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const id = (/<id>[^<]*?\/abs\/([^<\s]+)\s*<\/id>/.exec(m[1]) || [])[1];
    if (id) entrees[sansVersion(id)] = m[1];
  }
  for (const c of liste.filter((x) => numeros[x.n])) {
    if (r.code !== 200) {
      lues[c.n] = Object.assign(rien(c), { motif: r.erreur || refus(c.url, r.code) });
      continue;
    }
    const entree = entrees[sansVersion(numeros[c.n])] || '';
    const champ = (nom) => texteSimple((new RegExp('<' + nom + '>([\\s\\S]*?)</' + nom + '>').exec(entree) || [])[1] || '');
    const auteurs = Array.from(entree.matchAll(/<name>([\s\S]*?)<\/name>/g), (m) => texteSimple(m[1])).slice(0, 8).join(', ');
    lues[c.n] = champ('summary')
      ? Object.assign(rien(c), { lu: true, comment: 'arxiv', datePage: champ('published').slice(0, 10),
        texte: 'Titre : ' + champ('title') + '\nAuteurs : ' + auteurs + '\nRésumé : ' + champ('summary') })
      : Object.assign(rien(c), { motif: "l'API d'arXiv ne donne pas le résumé de l'étude" });
  }
  return lues;
}

// L'original d'un autre candidat.
async function original(c) {
  const base = rien(c);
  if (c.sid === 'A02') return Object.assign(base, { sansObjet: true, motif: "la fiche vient du catalogue d'OpenRouter, relevé par le programme" });
  const kind = c.kind || (PAGES.includes(c.sid) ? 'page' : 'flux');
  try {
    const depot = DEPOT_HF.exec(String(c.url || ''));
    if (depot) {
      // Sans fiche lisible (code autre que 200, fiche presque vide, pas de réponse), la page du dépôt est lue comme les
      // autres.
      const fiche = 'https://huggingface.co/' + depot[1] + '/raw/main/README.md';
      const rf = await lire(fiche).catch(() => ({ code: 0, corps: '' }));
      const texte = rf.code === 200 ? enTexte(lignesDuMarkdown(rf.corps.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, ''))) : '';
      if (texte.length >= 200) return Object.assign(base, { lu: true, comment: 'readme', adresse: fiche, texte });
    }
    const markdown = MARKDOWN[c.url];
    let r = await lire(markdown || c.url);
    if (r.code !== 200) return Object.assign(base, { motif: refus(c.url, r.code) });
    if (r.pdf) return Object.assign(base, { motif: PDF });
    if (kind === 'page' && LISTES.includes(c.sid)) {
      const lien = lienDuTitre(r.corps, titreDuBloc(c), c.url);
      if (!lien) return Object.assign(base, { motif: "le billet n'a pas été retrouvé sur la page qui le liste" });
      r = await lire(lien);
      if (r.code !== 200) return Object.assign(base, { adresse: lien, motif: refus(lien, r.code) });
      if (r.pdf) return Object.assign(base, { adresse: lien, motif: PDF });
      const lignesBillet = estHtml(r.corps) ? lignesDe(r.corps, { article: true }) : lignesDuMarkdown(r.corps);
      const texte = enTexte(lignesBillet);
      return Object.assign(base, { lu: !!texte, comment: 'billet', adresse: lien, texte, motif: texte ? '' : 'le billet est sans texte lisible',
        datePage: dateDeLaPage(r.corps) || dateSousLeTitre(lignesBillet, titreDuBloc(c)) });
    }
    const lues = markdown || !estHtml(r.corps) ? lignesDuMarkdown(r.corps) : lignesDe(r.corps, { article: kind !== 'page' });
    const horsTexte = deRetraitsTexte(c.sid, c.titre, c.source) ? lignesHorsTexte(lues) : null;
    const lignes = horsTexte ? lues.filter((l, i) => !horsTexte[i]) : lues;
    if (kind === 'page') {
      const partie = partieDuBloc(lignes, titreDuBloc(c));
      if (!partie) return Object.assign(base, { motif: "le bloc retenu n'est plus sur la page" });
      return Object.assign(base, { lu: true, comment: 'page', texte: enTexte(partie.lignes, partie.retenue), retrouvePar: partie.par });
    }
    const texte = enTexte(lignes);
    if (texte.length < 200) return Object.assign(base, { motif: 'la page est sans texte lisible (construite dans le navigateur ?)' });
    return Object.assign(base, { lu: true, comment: 'article', texte, datePage: dateDeLaPage(r.corps) || dateSousLeTitre(lignes, c.titre) });
  } catch (e) {
    return Object.assign(base, { motif: pasDeReponse(e) });
  }
}

const QUOI = {
  arxiv: "le résumé de l'étude sur arXiv", page: 'la partie de la page où se trouve le bloc retenu', billet: 'le billet',
  readme: 'la fiche du dépôt sur Hugging Face', article: "la page de l'article",
};
const DEMANDE = `Tu lis l'original d'un article retenu pour la séance de veille de Louis sur son projet ParlIA, et tu écris sa fiche. Louis lira ta fiche avant l'original : elle doit être exacte, et ne rien ajouter à l'original.

L'ÉTAT DU PROJET
{ETAT_DU_PROJET}
Nous sommes le {DATE}.

CE QUE LE TRI A PROPOSÉ (sur le titre et un court extrait ; il peut se tromper)
{TRI}

L'ARTICLE
{ARTICLE}

LE TEXTE DE L'ORIGINAL ({QUOI})
<<<
{TEXTE}
>>>

Écris, d'après l'original seul :
- resume : deux phrases au plus, en français simple : ce que dit l'original. Pour une ligne d'un tableau de retraits : le modèle arrêté, sa date d'arrêt, puis le remplaçant conseillé, qui, lui, continue.
- a_chercher : ce que Louis doit encore vérifier en lisant l'original, en une phrase, ou « rien ».
- hypothese : une phrase au conditionnel, « ce que ça pourrait changer pour ParlIA », à partir d'un lien concret avec l'état du projet ; « rien » sans lien concret. Ne jamais écrire qu'un service ou un modèle est utilisé, choisi ou comparé par ParlIA ou par Louis : aucun ne l'est.
- hors_theme : true si l'original n'a aucun lien concret avec ParlIA (la sécurité informatique, la santé, les images, la vidéo, la voix, les robots ne sont pas des liens), false sinon.
- date_publication : la date de publication écrite dans l'original (AAAA-MM-JJ), sinon null.
- date_effet : la date d'arrêt, de prix ou d'échéance écrite dans l'original (AAAA-MM-JJ), sinon null.
- ecart : ce que l'original contredit dans la proposition du tri, en une phrase, ou « rien ».
Ne jamais inventer un prix, une date, un nom de modèle ou une disponibilité.
Réponds uniquement par un JSON valide, sans texte autour :
{"resume": "...", "a_chercher": "...", "hypothese": "...", "hors_theme": false, "date_publication": null, "date_effet": null, "ecart": "..."}`;
const DRAPEAUX = { changement_prix: 'changement de prix', retrait_modele: 'retrait de modèle', nouveau_modele_decision: 'nouveau modèle de décision', echeance_reglementaire: 'échéance réglementaire' };
function demande(c, o) {
  const drapeaux = Object.keys(DRAPEAUX).filter((d) => c.drapeaux && c.drapeaux[d]).map((d) => DRAPEAUX[d]);
  const tri = [
    '- axe : ' + c.axe + ' ; note : ' + c.p + '/10 ; drapeaux : ' + (drapeaux.join(', ') || 'aucun') + (c.dateEffet ? ' ; date d\'effet : ' + c.dateEffet : ''),
    '- résumé : ' + (c.resume || 'aucun'),
    '- à chercher : ' + (c.aChercher || 'rien'),
    '- hypothèse : ' + (c.hypothese || 'aucune'),
    '- pourquoi la fiche est retenue : ' + (c.raison || 'sélection'),
  ].join('\n');
  const article = [
    'Titre : ' + c.titre,
    'Source : ' + c.source + ' (' + (PARLIA.NOM_NATURE[c.nature] || 'nature inconnue') + ', ' + (c.primaire ? 'source primaire' : 'source non primaire') + ')',
    'Adresse lue : ' + o.adresse,
    'Date de publication donnée par la source : ' + (c.date || 'inconnue' + (c.vu ? ' (vu par le bot le ' + c.vu + ')' : '')),
  ].join('\n');
  return DEMANDE
    .replace('{ETAT_DU_PROJET}', () => PARLIA.ETAT_DU_PROJET)
    .replace('{DATE}', () => dateLongue(aujourdhui))
    .replace('{TRI}', () => tri)
    .replace('{ARTICLE}', () => article)
    .replace('{QUOI}', () => QUOI[o.comment] + ', ' + Math.min(o.texte.length, MAX_TEXTE) + ' caractères')
    .replace('{TEXTE}', () => tronquer(o.texte, MAX_TEXTE));
}

const etudes = await etudesArxiv(candidats.filter(estArxiv));
const lus = await Promise.all(candidats.map((c) => etudes[c.n] || original(c)));
const lectures = lus.map((o) => ({ n: o.n, lu: o.lu, comment: o.comment, adresse: o.adresse, datePage: o.datePage, motif: o.motif,
  retrouvePar: o.retrouvePar, sansObjet: !!o.sansObjet, taille: o.texte.length, version: VERSION_RESUME }));
const demandes = lus.filter((o) => o.lu).map((o) => ({ prompt: demande(candidats.find((c) => c.n === o.n), o), n: o.n }));
if (!demandes.length) demandes.push({ prompt: 'Réponds seulement : {}', n: null, vide: true });
demandes[0].lectures = lectures;
return demandes.map((d) => ({ json: d }));

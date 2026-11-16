// Les pages sans flux et les API (sources.md, 4.1 et 4.5) : une fois par jour, avec la première collecte du jour.
// Ce nœud reçoit les articles des flux RSS et les fait suivre ; il y ajoute ce qu'il trouve de nouveau :
// - 12 pages sans flux (journaux et retraits des éditeurs, pages des modèles de décision, pages européennes et
//   dossier de l'Assemblée) : le texte du bloc <main> est découpé en lignes ; une ligne inconnue la veille est
//   nouvelle ; les lignes nouvelles qui se suivent forment un bloc, et chaque bloc de 60 caractères au moins
//   devient un article. Garde-fous : un code autre que 200, ou une page qui perd plus de 70 % de ses lignes, est
//   une panne, pas une nouveauté ; une page dont plus de 40 % des lignes sont nouvelles a été refaite : elle est
//   relue comme au premier jour, sans rien proposer. Le premier passage ne propose rien : il apprend la page.
//   Une rangée de tableau forme une seule ligne, chaque cellule précédée de son en-tête : « Shutdown date : Dec 1,
//   2026 · Affected model : chatgpt-image-latest · Recommended replacement : gpt-image-2.6-sunburst ». Sans les
//   en-têtes, le tri avait pris le 6 novembre 2026 les remplaçants pour les modèles arrêtés (fiche 4, semaine 46).
//   La date de publication d'un bloc est sa première date déjà passée : une date à venir est une date d'effet.
//   Sur la page des retraits d'OpenAI (PARLIA.RETRAITS_TEXTE), une ligne qui ne nomme que des modèles d'image, de
//   son, de vidéo, de plongements ou de modération n'entre dans aucun bloc, ni la section entière d'un intertitre
//   qui ne nomme qu'eux (16 novembre 2026).
//   Une page servie en Markdown est lue comme telle (markdown, ou une réponse sans HTML : estHtml).
// - Le catalogue d'OpenRouter (A02) : les nouveaux modèles des fournisseurs suivis ; pour la liste de suivi
//   (sources.md, 4.4), un changement de prix, une date de retrait annoncée, une disparition. Ces deux drapeaux
//   sont calculés par le programme (_verifie) : le tri ne peut pas les oublier.
// - La fiche data.gouv.fr des questions du Sénat (A11) : sa date de modification et la liste de ses fichiers.
//   Les fichiers sont republiés chaque nuit : leurs dates ne comptent pas, seuls leurs noms et formats. Elle a
//   parfois mis plus de 20 secondes à répondre (essai du 16 novembre 2026) : elle en a 45.
// - Les comptes Hugging Face de Cloudflare et de Perplexity (Y01, X10) : les nouveaux dépôts, sans les dérivés.
// Chaque source donne un élément { _sante } que lit normaliser-parlia.js (trois échecs de suite : une alerte).
const sd = $getWorkflowStaticData('global');
const plan = $('Que faire ?').first().json;
const sortie = $input.all().map((i) => ({ json: i.json }));
if (!plan.pages) return sortie.length ? sortie : [{ json: { _rien: true } }];
const http = (typeof helpers !== 'undefined' && helpers) || this.helpers;
const aujourdhui = $now.toISODate();

const PAGES = [
  { id: 'F01', s: "OpenAI, journal de l'API", u: 'https://developers.openai.com/api/docs/changelog', axe: 'fournisseurs', nature: 'editeur' },
  { id: 'F02', s: 'OpenAI, retraits de modèles', u: 'https://developers.openai.com/api/docs/deprecations', axe: 'fournisseurs', nature: 'editeur' },
  { id: 'F06', s: 'Anthropic, retraits de modèles', u: 'https://platform.claude.com/docs/en/about-claude/model-deprecations', axe: 'fournisseurs', nature: 'editeur' },
  { id: 'F09', s: 'Mistral, journal des modifications', u: 'https://docs.mistral.ai/resources/changelogs', axe: 'fournisseurs', nature: 'editeur' },
  // Google a déplacé sa documentation sur aistudio.google.com, dont les pages se construisent dans le navigateur
  // (vu le 4 novembre 2026 : aucun texte dans le HTML) ; la version Markdown de chaque page, elle, porte le texte.
  // Le lien montré dans la préparation reste la page lisible.
  { id: 'F12', s: "Google, journal de l'API Gemini", u: 'https://aistudio.google.com/docs/changelog.md', voir: 'https://aistudio.google.com/docs/changelog?hl=en', axe: 'fournisseurs', nature: 'editeur', anglais: true, markdown: true },
  { id: 'F13', s: 'Google, retraits de modèles Gemini', u: 'https://aistudio.google.com/docs/deprecations.md', voir: 'https://aistudio.google.com/docs/deprecations?hl=en', axe: 'fournisseurs', nature: 'editeur', anglais: true, markdown: true },
  { id: 'D02', s: 'TypeSafe AI, blog', u: 'https://typesafe.ai/blog', axe: 'fournisseurs', nature: 'editeur', decision: true },
  // La documentation de TypeSafe (Mintlify) donne chaque page en Markdown (models.md) : un tableau par colonne de
  // modèles, « Model ID · Jev 1.14 : jev-1.14.0 · Jev 1.13 : jev-1.13.0 ». Le lien montré reste la page lisible.
  { id: 'Y02', s: 'TypeSafe AI, page des modèles', u: 'https://docs.typesafe.ai/models.md', voir: 'https://docs.typesafe.ai/models', axe: 'fournisseurs', nature: 'editeur', decision: true, markdown: true },
  { id: 'D04', s: 'Liquid AI, actualités des modèles', u: 'https://www.liquid.ai/news/models', axe: 'fournisseurs', nature: 'editeur', decision: true },
  { id: 'C11', s: "Service d'assistance du règlement IA, ressources", u: 'https://ai-act-service-desk.ec.europa.eu/fr/resources', axe: 'conformite', nature: 'institution' },
  { id: 'C12', s: "Commission européenne, Bureau de l'IA", u: 'https://digital-strategy.ec.europa.eu/en/policies/ai-office', axe: 'conformite', nature: 'institution' },
  { id: 'C14', s: 'Assemblée nationale, dossier de la loi DDADUE', u: 'https://www.assemblee-nationale.fr/dyn/17/dossiers/DLR5L17N53140', axe: 'conformite', nature: 'institution' },
];
const OPENROUTER = { id: 'A02', s: "OpenRouter, catalogue des modèles", u: 'https://openrouter.ai/api/v1/models', axe: 'fournisseurs', nature: 'agregateur', primaire: false };
// Les fournisseurs du thème, et ceux des modèles de décision.
const FOURNISSEURS = /^(openai|anthropic|mistralai|google|typesafe|liquid|perplexity)\//;
const DATAGOUV = { id: 'A11', s: 'data.gouv.fr, questions du Sénat', u: 'https://www.data.gouv.fr/api/1/datasets/questions-du-senat/', axe: 'exploitation', nature: 'institution' };
const HF = [
  { id: 'Y01', s: 'Hugging Face, compte de Cloudflare', org: 'Cloudflare' },
  { id: 'X10', s: 'Hugging Face, compte de Perplexity', org: 'perplexity-ai' },
];
const DERIVE = /(gguf|mlx|onnx|awq|gptq|exl2|bnb|int4|int8|fp8|nvfp4|4bit|8bit|quant)/i;

const source = (c, kind) => ({
  id: c.id, s: c.s, u: c.u, axe: c.axe || 'fournisseurs', nature: c.nature || 'editeur',
  primaire: c.primaire !== false, filtre: '', cnil: false, decision: !!c.decision, arxiv: false, role: 'tri', kind,
});
const jsonDe = (corps) => (typeof corps === 'object' && corps && corps.type !== 'Buffer' && !(corps instanceof Uint8Array) ? corps : JSON.parse(texteDe(corps)));
async function lire(url, anglais, delai = 20000) {
  const r = await http.httpRequest({
    url, method: 'GET', timeout: delai, returnFullResponse: true, ignoreHttpStatusErrors: true,
    headers: Object.assign({ 'User-Agent': PARLIA.UA }, anglais ? { 'Accept-Language': 'en' } : {}),
  });
  const code = Number(r && r.statusCode || 0);
  if (code !== 200) throw new Error('code ' + (code || 'inconnu'));
  return r.body;
}
const prixM = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1e6 * 10000) / 10000 : null;
};
const dollars = (n) => (n == null ? '?' : String(n).replace('.', ',') + ' $');

// ---- Pages : lues en lignes par lecture-pages.js (lignesDe, lignesDuMarkdown, texteDuBloc), commun avec la
// lecture des originaux ; ici, la comparaison avec la veille et la date de chaque bloc ----
const MOIS_JOUR = /\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b/i;
// Un intertitre qui n'est qu'une date (« October 30 », « 27 octobre 2026 ») ne fait pas un bon titre.
const estUneDate = (t) => t.length < 32 && (!!dateDansTexte(t) || MOIS_JOUR.test(t));
// La date de publication d'un bloc : sa première date déjà passée, sinon celle de son intertitre ; sinon aucune
// (« date inconnue »). Une date à venir est une date d'effet (« Shutdown date : Dec 1, 2026 ») : le 6 novembre
// 2026, elle était devenue la date de publication de la fiche 4. Une date sans année (« Oct 30 », journal
// d'OpenAI) prend l'année en cours, ou la précédente si elle tombait plus tard dans l'année.
function dateDuBloc(texte, avant) {
  for (const t of [texte, avant || '']) {
    const avecAnnee = datesDansTexte(t);
    if (avecAnnee.length) {
      const passee = avecAnnee.find((d) => d <= aujourdhui);
      if (passee) return passee;
      continue;
    }
    const m = MOIS_JOUR.exec(t);
    if (!m) continue;
    let annee = $now.year;
    const iso = (a) => a + '-' + String(MOIS_EN[m[1].toLowerCase()]).padStart(2, '0') + '-' + String(m[2]).padStart(2, '0');
    if (iso(annee) > aujourdhui) annee--;
    return iso(annee);
  }
  return '';
}
// Compare la page à la veille. etat : { h : empreintes des 400 premières lignes, n : nombre de lignes, v : format }.
// ignorees : les lignes qui n'entrent dans aucun bloc (un booléen par ligne) ; elles restent dans l'empreinte de la
// page. Un intertitre ignoré ferme le bloc en cours : sa section ne prolonge pas celle d'avant.
function comparer(lignes, etat, ignorees) {
  const tete = lignes.slice(0, 400);
  const empreintes = tete.map((l) => hacher(l));
  const nouveau = { h: empreintes.join(','), n: lignes.length, v: FORMAT_PAGES };
  if (lignes.length < 5) return { erreur: 'page presque vide (' + lignes.length + ' lignes)' };
  if (!etat || !etat.h || etat.v !== FORMAT_PAGES) return { nouveau, blocs: [], premier: true };
  if (lignes.length < 0.3 * (etat.n || 0)) return { erreur: 'page réduite à ' + lignes.length + ' lignes, contre ' + etat.n };
  const connues = new Set(String(etat.h).split(','));
  const neuves = empreintes.map((h) => !connues.has(h));
  const nb = neuves.filter(Boolean).length;
  if (nb > 0.4 * tete.length) return { nouveau, blocs: [], refaite: true };
  // Les lignes nouvelles qui se suivent forment un bloc ; une ou deux lignes courtes déjà connues
  // (« Feature », « Models ») entre deux lignes nouvelles n'interrompent pas le bloc.
  const blocs = [];
  let courant = null;
  let attente = [];
  let dernierTitre = '';
  tete.forEach((l, i) => {
    if (ignorees && ignorees[i]) {
      if (courant && l.startsWith('§T ')) {
        blocs.push(courant);
        courant = null;
        attente = [];
      }
      return;
    }
    const titre = l.startsWith('§T ') ? l.slice(3) : '';
    const texte = titre || l;
    if (neuves[i]) {
      if (!courant) courant = { lignes: [], empreintes: [], titre: '', avant: dernierTitre };
      else courant.lignes.push(...attente);
      attente = [];
      courant.lignes.push(texte);
      courant.empreintes.push(empreintes[i]);
      if (titre && !courant.titre) courant.titre = titre;
    } else if (courant) {
      if (attente.length < 2 && texte.length < 40) attente.push(texte);
      else {
        blocs.push(courant);
        courant = null;
        attente = [];
      }
    }
    if (titre) dernierTitre = titre;
  });
  if (courant) blocs.push(courant);
  return { nouveau, blocs: blocs.filter((b) => texteDuBloc(b.lignes).length >= 60).slice(0, 5) };
}
async function page(p) {
  const corps = texteDe(await lire(p.u, p.anglais));
  const lignes = p.markdown || !estHtml(corps) ? lignesDuMarkdown(corps) : lignesDe(corps);
  if (!sd.pages) sd.pages = {};
  const r = comparer(lignes, sd.pages[p.id], deRetraitsTexte(p.id, '', p.s) ? lignesHorsTexte(lignes) : null);
  if (r.erreur) throw new Error(r.erreur);
  sd.pages[p.id] = r.nouveau;
  // Les échéances relevées sur cette page : si plus aucune de leurs lignes n'y figure, la source les a changées ou
  // retirées. Une page réapprise ou refaite ne compte pas : ses lignes ne sont plus comparables.
  if (!r.premier && !r.refaite) {
    const presentes = new Set(lignes.map((l) => hacher(l)));
    for (const e of sd.echeances || []) {
      if (e.page === p.id && Array.isArray(e.lignes) && e.lignes.length && !e.changee && !e.lignes.some((h) => presentes.has(h))) e.changee = aujourdhui;
    }
  }
  const items = r.blocs.map((b) => {
    const texte = texteDuBloc(b.lignes);
    const tete = sansMarque((b.titre && !estUneDate(b.titre) ? b.titre : '') || b.lignes.find((l) => sansMarque(l).length >= 25) || b.lignes[0]);
    const date = dateDuBloc(texte, b.avant);
    return { json: {
      title: tronquer(p.s + ' — ' + tete, 200),
      link: p.voir || p.u,
      isoDate: date ? date + 'T12:00:00.000Z' : undefined,
      contentSnippet: tronquer((b.avant && !b.titre ? 'Sous « ' + b.avant + ' » : ' : '') + texte, 1200),
      _cle: 'page:' + p.id + ':' + hacher(texte),
      _lignes: b.empreintes,
      _source: source(p, 'page'),
    } };
  });
  return { items, note: r.premier ? 'premier passage' : (r.refaite ? 'page refaite' : '') };
}

// ---- OpenRouter ----
async function openrouter() {
  const corps = jsonDe(await lire(OPENROUTER.u));
  const data = corps && Array.isArray(corps.data) ? corps.data : null;
  if (!data || data.length < 50) throw new Error('catalogue incomplet (' + (data ? data.length : 0) + ' modèles)');
  const etat = sd.openrouter;
  const maxCree = data.reduce((m, x) => Math.max(m, Number(x.created) || 0), 0);
  const suivi = {};
  const items = [];
  const article = (titre, url, extrait, cle, verifie, quand) => ({ json: {
    title: titre, link: url, isoDate: quand, contentSnippet: extrait, _cle: cle,
    _verifie: verifie || undefined, _source: source(OPENROUTER, 'api'),
  } });
  if (etat) {
    for (const m of data) {
      const id = String(m.id || '');
      if (!FOURNISSEURS.test(id) || /[:~]/.test(id) || (Number(m.created) || 0) <= (etat.dernierCree || 0)) continue;
      const p = m.pricing || {};
      const quand = new Date(Number(m.created) * 1000).toISOString();
      items.push(article(
        'Nouveau modèle au catalogue d\'OpenRouter : ' + (m.name || id),
        'https://openrouter.ai/' + id,
        'Ajouté le ' + dateLongue(quand) + '. Prix : ' + dollars(prixM(p.prompt)) + ' en entrée, ' + dollars(prixM(p.completion))
          + ' en sortie, par million de jetons. Contexte : ' + (m.context_length || '?') + ' jetons. '
          + tronquer(texteSimple(m.description), 400),
        'or:nouveau:' + id, null, quand,
      ));
    }
  }
  for (const id of PARLIA.SUIVI) {
    const m = data.find((x) => x.id === id);
    const avant = etat && etat.suivi ? etat.suivi[id] : null;
    if (!m) {
      if (avant && !avant.absent) {
        items.push(article(
          'Modèle suivi retiré du catalogue d\'OpenRouter : ' + id, 'https://openrouter.ai/models',
          'Le modèle ' + id + " n'apparaît plus dans le catalogue d'OpenRouter le " + dateLongue(aujourdhui)
            + ". À vérifier chez l'éditeur : retrait, ou simple changement de nom ?",
          'or:absent:' + id + ':' + aujourdhui, { retrait_modele: true, date_effet: aujourdhui }, $now.toUTC().toISO(),
        ));
      }
      if (avant) suivi[id] = Object.assign({}, avant, { absent: true });
      continue;
    }
    const p = m.pricing || {};
    const maintenant = { p: prixM(p.prompt), c: prixM(p.completion), e: /^\d{4}-\d{2}-\d{2}/.test(String(m.expiration_date || '')) ? String(m.expiration_date).slice(0, 10) : '' };
    suivi[id] = maintenant;
    if (!avant || avant.absent) continue;
    if (maintenant.p !== avant.p || maintenant.c !== avant.c) {
      items.push(article(
        'Changement de prix d\'un modèle suivi : ' + (m.name || id),
        'https://openrouter.ai/' + id,
        'Prix chez OpenRouter, par million de jetons : ' + dollars(avant.p) + ' → ' + dollars(maintenant.p) + ' en entrée, '
          + dollars(avant.c) + ' → ' + dollars(maintenant.c) + ' en sortie (constaté le ' + dateLongue(aujourdhui) + ").",
        'or:prix:' + id + ':' + maintenant.p + ':' + maintenant.c, { changement_prix: true, date_effet: aujourdhui }, $now.toUTC().toISO(),
      ));
    }
    if (maintenant.e && maintenant.e !== avant.e) {
      items.push(article(
        'Retrait annoncé d\'un modèle suivi : ' + (m.name || id) + ', le ' + dateLongue(maintenant.e),
        'https://openrouter.ai/' + id,
        "OpenRouter annonce l'arrêt de " + id + ' le ' + dateLongue(maintenant.e) + ". À vérifier sur la page des retraits de l'éditeur.",
        'or:retrait:' + id + ':' + maintenant.e, { retrait_modele: true, date_effet: maintenant.e }, $now.toUTC().toISO(),
      ));
    }
  }
  sd.openrouter = { dernierCree: Math.max(etat ? etat.dernierCree || 0 : 0, maxCree), suivi };
  return { items, note: etat ? '' : 'premier passage' };
}

// ---- data.gouv.fr ----
async function datagouv() {
  const d = jsonDe(await lire(DATAGOUV.u, false, 45000));
  if (!d || !Array.isArray(d.resources)) throw new Error('fiche illisible');
  const fichiers = d.resources.map((x) => tronquer(texteSimple(x.title || x.id), 80) + ' (' + (x.format || '?') + ')').sort();
  const lm = String(d.last_modified || '').slice(0, 10);
  const sig = hacher(lm + '|' + fichiers.join('|'));
  const avant = sd.datagouv;
  sd.datagouv = { sig, lm, f: fichiers };
  if (!avant || avant.sig === sig) return { items: [], note: avant ? '' : 'premier passage' };
  const ajoutes = fichiers.filter((f) => !(avant.f || []).includes(f));
  const retires = (avant.f || []).filter((f) => !fichiers.includes(f));
  const details = [];
  if (lm !== avant.lm) details.push('fiche modifiée le ' + (dateLongue(lm) || lm) + ' (avant : ' + (dateLongue(avant.lm) || avant.lm || 'inconnu') + ')');
  if (ajoutes.length) details.push('fichiers ajoutés : ' + ajoutes.join(', '));
  if (retires.length) details.push('fichiers retirés : ' + retires.join(', '));
  return { items: [{ json: {
    title: 'data.gouv.fr : la fiche des questions du Sénat a changé',
    link: d.page || 'https://www.data.gouv.fr/fr/datasets/questions-du-senat/',
    isoDate: $now.toUTC().toISO(),
    contentSnippet: tronquer('Changements : ' + details.join(' ; ') + '. Vérifier si le format ou le contenu des fichiers change pour ParlIA.', 900),
    _cle: 'dg:' + sig,
    _source: source(DATAGOUV, 'api'),
  } }], note: '' };
}

// ---- Hugging Face ----
async function huggingface(c) {
  const depots = jsonDe(await lire('https://huggingface.co/api/models?author=' + c.org + '&sort=createdAt&direction=-1&limit=20'));
  if (!Array.isArray(depots)) throw new Error('réponse illisible');
  if (!sd.hf) sd.hf = {};
  const avant = sd.hf[c.org] || '';
  const plusRecent = depots.reduce((m, x) => (String(x.createdAt || '') > m ? String(x.createdAt) : m), avant);
  sd.hf[c.org] = plusRecent;
  if (!avant) return { items: [], note: 'premier passage' };
  const desc = { id: c.id, s: c.s, axe: 'fournisseurs', nature: 'editeur', decision: true };
  const items = depots
    .filter((x) => String(x.createdAt || '') > avant && !DERIVE.test(String(x.id || '')))
    .slice(0, 5)
    .map((x) => ({ json: {
      title: 'Hugging Face : nouveau dépôt de ' + c.org + ', ' + String(x.id).split('/').pop(),
      link: 'https://huggingface.co/' + x.id,
      isoDate: x.createdAt,
      contentSnippet: 'Dépôt créé le ' + dateLongue(x.createdAt) + (x.pipeline_tag ? ' ; tâche : ' + x.pipeline_tag : '')
        + (Array.isArray(x.tags) && x.tags.length ? ' ; étiquettes : ' + x.tags.slice(0, 8).join(', ') : '') + '.',
      _cle: 'hf:' + x.id,
      _source: source(Object.assign({ u: 'https://huggingface.co/' + c.org }, desc), 'api'),
    } }));
  return { items, note: '' };
}

const taches = PAGES.map((p) => ({ c: p, f: () => page(p) }))
  .concat([{ c: OPENROUTER, f: openrouter }, { c: DATAGOUV, f: datagouv }])
  .concat(HF.map((c) => ({ c, f: () => huggingface(c) })));
const resultats = await Promise.all(taches.map((t) => t.f().then(
  (r) => ({ c: t.c, ok: true, items: r.items, note: r.note }),
  (e) => ({ c: t.c, ok: false, items: [], detail: String(e && e.message ? e.message : e).slice(0, 160) }),
)));
const bilan = { lues: resultats.length, echecs: [], nouveautes: 0, refaites: [], premiers: 0 };
for (const r of resultats) {
  sortie.push({ json: { _sante: { id: r.c.id, s: r.c.s, ok: r.ok, detail: r.detail || '' } } });
  if (!r.ok) bilan.echecs.push(r.c.id);
  if (r.note === 'page refaite') bilan.refaites.push(r.c.id);
  if (r.note === 'premier passage') bilan.premiers++;
  bilan.nouveautes += r.items.length;
  for (const it of r.items) sortie.push(it);
}
// Plus de la moitié en échec (le Mac qui se réveille sans réseau, par exemple) : on réessaiera à la prochaine collecte.
if (bilan.echecs.length * 2 <= resultats.length) sd.pagesJour = aujourdhui;
sd._passage = Object.assign(sd._passage || {}, { pages: bilan });
return sortie;

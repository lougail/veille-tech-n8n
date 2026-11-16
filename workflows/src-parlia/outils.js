// ---- Outils communs de la veille ParlIA (workflows/src-parlia/outils.js) ----
// build_parlia.py place ce fichier en tête de chaque nœud Code : n8n ne permet pas d'importer un module.
const PARLIA = {
  AXES: ['fournisseurs', 'qualite', 'conformite', 'exploitation'],
  NOM_AXE: {
    fournisseurs: 'Fournisseurs et coûts', qualite: "Qualité de l'étiquetage", conformite: 'Conformité',
    exploitation: 'Exploitation', hors_theme: 'Hors thème',
  },
  NATURES: ['editeur', 'institution', 'auteurs', 'praticien', 'presse', 'agregateur', 'inconnu'],
  NOM_NATURE: {
    editeur: 'éditeur', institution: 'institution', auteurs: 'auteurs', praticien: 'praticien', presse: 'presse',
    agregateur: 'agrégateur', inconnu: 'nature inconnue',
  },
  THEME: "« Étiqueter les questions écrites du Sénat avec un modèle de langage commercial : choisir, mesurer et pouvoir remplacer le fournisseur, dans le respect du RGPD et du règlement européen sur l'IA. »",
  // Les modèles suivis (sources.md, 4.4) : leurs changements de prix et leurs retraits sont toujours proposés.
  // Mistral Large 4 depuis le 16 novembre 2026 : un candidat possible du comparatif (séances 02 et 03).
  SUIVI: [
    'openai/gpt-6-luna', 'anthropic/claude-haiku-5.5', 'mistralai/mistral-small-3.2-24b-instruct',
    'openai/gpt-4o-mini', 'openai/gpt-6.1-terra', 'google/gemini-4-argon', 'mistralai/mistral-large-4-0',
  ],
  // Les mêmes, et les modèles de décision, tels qu'on les reconnaît dans un titre ou un extrait ; Kev et Zuse depuis
  // le 16 novembre 2026 (séance 03). L'institut Zuse de Berlin n'est pas le modèle de Bineric.
  NOMS_SUIVIS: /\b(gpt-6-luna|gpt-6 luna|decisions api|claude haiku 5\.5|claude-haiku-5\.5|mistral small 3\.2|mistral-small-3\.2|gpt-4o mini|gpt-4o-mini|gpt-6\.1[- ]terra|gemini 4 argon|gemini-4-argon|mistral large 4|mistral-large-4|jev|kev|clef|clef-flash|zuse(?![- ]institut)|d1|d1-ultra|decider)\b/i,
  // L'état du projet, écrit sans date : le seul bloc à mettre à jour quand le projet avance (le comparatif commencé,
  // un service choisi…). Il entre dans la consigne du tri (consigne-tri-parlia.js) et dans la demande de résumé des
  // originaux (originaux-parlia.js) : changer alors leur version (VERSION, VERSION_RESUME).
  ETAT_DU_PROJET: `- ParlIA propose les trois ministères les plus probables pour une question écrite de sénateur, à partir du titre et du texte de la question (données publiques du Sénat). Ces propositions viennent du modèle que Louis entraîne lui-même : l'application n'utilise aucun service d'IA du marché.
- Une étape à venir : un service d'IA du marché, modèle de langage ou modèle de décision, pourrait étiqueter, hors ligne, les questions sans réponse publiée, en choisissant un ministère dans une liste fermée, avec un score de confiance ; une personne validerait chaque proposition. Le comparatif qui choisira ce service n'a pas commencé : aucun service n'est choisi.
- Les candidats à l'étude pour ce comparatif, dont aucun n'est utilisé : la Decisions API d'OpenAI (GPT-6 Luna), Jev de TypeSafe AI, Kev (une reproduction ouverte de Jev), Clef de Cloudflare, Zuse de Bineric et d1 de Liquid AI, qui sont des modèles de décision, et les modèles de langage de la liste de suivi, dont Mistral Large 4.
- Le protocole prévu pour le comparatif : mesurer d'abord l'accord du service avec 3 267 questions dont le ministère est connu ; consigner la version du modèle et la date de chaque appel ; garder la réponse brute ; ne jamais mettre une étiquette du service dans le jeu de test ; garder l'étiquetage assisté seulement s'il améliore le macro-F1.
- L'épreuve E5 porte sur un remaniement du Gouvernement qui change la liste des ministères. La soutenance a lieu en janvier 2027.`,
  UA: 'veille-parlia/1.0 (veille de certification de Louis; +https://github.com/lougail)',
  // Les retraits d'OpenAI (sa page des retraits, F02) et de Cloudflare (les billets de retraits du journal de Workers
  // AI, X01) : le bot n'en garde que les lignes des modèles de texte (ligneHorsTexte). Le 5 novembre 2026, Cloudflare
  // arrêtait seize modèles de texte et huit autres (son, image, vision, plongements) ; la page d'OpenAI mêle aux
  // modèles de texte ceux d'image, de son, de vidéo, de plongements et de modération.
  RETRAITS_TEXTE: ['F02', 'X01'],
};

// Texte lisible : sans balises ni entités, espaces réduits.
function texteSimple(s) {
  return String(s == null ? '' : s)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;|&#x27;|&rsquo;|&lsquo;/gi, "'").replace(/&laquo;/gi, '«').replace(/&raquo;/gi, '»')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ').trim();
}
function tronquer(s, n) {
  const t = String(s == null ? '' : s);
  if (t.length <= n) return t;
  const coupe = t.lastIndexOf(' ', n - 1);
  return t.slice(0, coupe > n * 0.6 ? coupe : n - 1).trim() + '…';
}
// Empreinte courte et stable (djb2), pour reconnaître un texte déjà vu sans le garder.
function hacher(s) {
  let h = 5381;
  const t = String(s);
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
// Le domaine d'une adresse ; new URL() n'existe pas dans le bac à sable de n8n.
function domaineDe(url) {
  const m = /^https?:\/\/([^/?#:]+)/i.exec(String(url || ''));
  return m ? m[1].toLowerCase().replace(/^www\./, '') : '';
}
// La clé d'une adresse, pour le dédoublonnage : sans protocole, sans www, sans paramètres de suivi.
function cleAdresse(url) {
  const m = /^https?:\/\/([^/?#]+)([^?#]*)(\?[^#]*)?/i.exec(String(url || '').trim());
  if (!m) return '';
  const hote = m[1].toLowerCase().replace(/^(www|m)\./, '');
  const chemin = m[2].replace(/\/+$/, '');
  let requete = '';
  if (m[3]) {
    const garde = m[3].slice(1).split('&').filter((p) => p && !/^(utm_|ref=|fbclid|gclid)/i.test(p)).sort();
    if (garde.length) requete = '?' + garde.join('&');
  }
  return hote + chemin + requete;
}
// Une cellule de tableau Markdown : ni barre verticale ni retour à la ligne.
function cellule(s) {
  return String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim();
}
// Un texte pour Discord : mentions collectives neutralisées.
function pourDiscord(s) {
  return String(s == null ? '' : s).replace(/@(everyone|here)/gi, '@\u200b$1');
}
// Une date ISO (AAAA-MM-JJ) en toutes lettres : « 4 novembre 2026 », « 1er décembre 2026 ».
const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function dateLongue(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return '';
  return Number(m[3]) + (m[3] === '01' ? 'er' : '') + ' ' + MOIS_FR[Number(m[2]) - 1] + ' ' + m[1];
}
// Les dates écrites dans un texte (pages sans flux), dans l'ordre : 2026-10-14, October 14, 2026, 14 octobre 2026,
// ou 10.22.2026 (mois.jour.année, chez Liquid AI). Renvoie une liste de AAAA-MM-JJ.
// Une date collée à un nom (« gpt-image-2-2026-04-21 », une version datée) n'est pas une date.
const MOIS_EN = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
function datesDansTexte(texte) {
  const t = String(texte || '');
  const deux = (n) => String(n).padStart(2, '0');
  const candidats = [];
  for (const m of t.matchAll(/(?<![\w-])(20\d{2})-(\d{2})-(\d{2})(?=T\d|[^\w-]|$)/g)) {
    if (Number(m[2]) <= 12 && Number(m[3]) <= 31) candidats.push({ i: m.index, d: m[1] + '-' + m[2] + '-' + m[3] });
  }
  for (const m of t.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})\b/gi)) {
    candidats.push({ i: m.index, d: m[3] + '-' + deux(MOIS_EN[m[1].toLowerCase()]) + '-' + deux(m[2]) });
  }
  for (const m of t.matchAll(/\b(\d{1,2})(?:er)?\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(20\d{2})\b/gi)) {
    const mois = m[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const n = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'].indexOf(mois) + 1;
    if (n) candidats.push({ i: m.index, d: m[3] + '-' + deux(n) + '-' + deux(m[1]) });
  }
  for (const m of t.matchAll(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/g)) {
    if (Number(m[1]) <= 12 && Number(m[2]) <= 31) candidats.push({ i: m.index, d: m[3] + '-' + deux(m[1]) + '-' + deux(m[2]) });
  }
  candidats.sort((a, b) => a.i - b.i);
  return candidats.map((c) => c.d);
}
// La première date écrite dans un texte, ou une chaîne vide.
function dateDansTexte(texte) {
  return datesDansTexte(texte)[0] || '';
}
// ---- Les modèles de texte, sur les pages de retraits (PARLIA.RETRAITS_TEXTE) ----
// Un modèle d'image, de son, de vidéo, de plongements (embeddings) ou de modération se reconnaît à son nom : chez
// OpenAI gpt-image-1-mini, chatgpt-image-latest, dall-e-3, tts-1, whisper-1, gpt-realtime, gpt-4o-mini-transcribe,
// sora-2, text-embedding-3-small, omni-moderation ; chez Cloudflare melotts, stable-diffusion, dreamshaper, flux,
// llava, embeddinggemma, deepgram/aura, deepgram/nova.
const MODELES_HORS_TEXTE = /image|dall-?e|flux|stable-diffusion|sdxl|dreamshaper|inpaint|tts|whisper|transcri|audio|realtime|speech|voice|sora|video|embedding|similarity|search-(ada|babbage|curie|davinci)|rerank|moderation|llama-guard|llava|resnet|detr|uform|deepgram\/|^aura\b|^nova-\d/i;
// Un modèle de texte se reconnaît à sa famille : gpt-6-luna, o3, claude-haiku-5.5, llama-3.2-1b-instruct, qwq-32b…
const MODELES_TEXTE = /^(gpt-|o\d|chatgpt-|codex|babbage-002|davinci-002|claude|llama|meta-llama|mistral|mixtral|ministral|magistral|codestral|devstral|qwen|qwq|gemma|gemini|deepseek|phi-\d|hermes|openhermes|falcon|tinyllama|openchat|zephyr|starling|sqlcoder|discolm|granite|kimi|glm|nemotron|jev|kev|clef|zuse|decider)/i;
// Une ligne qui nomme au moins un modèle d'image, de son, de vidéo, de plongements ou de modération, et aucun modèle
// de texte : « Affected model : gpt-image-1-mini · Recommended replacement : gpt-image-2.6-sunburst », ou
// « @cf/myshell-ai/melotts → @cf/deepgram/aura-2-en ». Une ligne qui ne nomme aucun modèle est gardée.
function ligneHorsTexte(ligne) {
  let texte = 0;
  let autre = 0;
  for (const jeton of String(ligne || '').match(/[@\w][\w@./:-]*/g) || []) {
    const nom = jeton.toLowerCase().replace(/[.:-]+$/, '');
    const dernier = nom.split('/').pop();
    if (MODELES_HORS_TEXTE.test(nom) || MODELES_HORS_TEXTE.test(dernier)) autre++;
    else if (MODELES_TEXTE.test(dernier)) texte++;
  }
  return autre > 0 && texte === 0;
}
// Un article d'une source de PARLIA.RETRAITS_TEXTE qui porte sur des retraits : toute la page des retraits d'OpenAI ;
// dans le journal de Workers AI, les seuls billets de retraits (« Planned model deprecations »).
function deRetraitsTexte(sid, titre, source) {
  return PARLIA.RETRAITS_TEXTE.includes(sid) && /deprecat|retir|retrait|sunset|shut ?down/i.test(String(titre || '') + ' ' + String(source || ''));
}
// La santé d'une source : un échec de plus, ou un retour. Au troisième échec de suite, une seule alerte
// (sd._passage.flux, lue par le message de #status) ; au retour, un message de retour.
function noterSante(sd, id, nom, ok, detail, maintenant) {
  if (!sd.sante) sd.sante = {};
  if (!sd._passage) sd._passage = {};
  if (!sd._passage.flux) sd._passage.flux = [];
  const e = sd.sante[id] || { s: nom, echecs: 0, alerte: false };
  e.s = nom || e.s;
  if (ok) {
    if (e.alerte) sd._passage.flux.push({ id, s: e.s, retour: true });
    e.echecs = 0;
    e.alerte = false;
    e.detail = '';
    e.dernierOk = maintenant;
  } else {
    e.echecs = (e.echecs || 0) + 1;
    e.detail = String(detail || '').slice(0, 160);
    if (e.echecs >= 3 && !e.alerte) {
      e.alerte = true;
      sd._passage.flux.push({ id, s: e.s, echecs: e.echecs, detail: e.detail });
    }
  }
  sd.sante[id] = e;
}
// Une alerte immédiate (remaniement, attributions, retrait d'un modèle suivi), envoyée par le nœud Alertes.
function pousserAlerte(sd, alerte) {
  if (!sd._alertes) sd._alertes = [];
  alerte.cle = alerte.cle || hacher(alerte.type + '|' + (alerte.id || alerte.url || alerte.titre));
  if (!sd._alertes.some((a) => a.cle === alerte.cle)) sd._alertes.push(alerte);
}
// ---- Fin des outils communs ----

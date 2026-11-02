// Lecture du tri. Chaque réponse du modèle est contrôlée comme ParlIA contrôle un ministère proposé : un axe ou
// une nature hors des listes, une pertinence qui n'est pas un entier de 0 à 10, et la proposition est rejetée
// (sources.md, 5.3). Un article sans réponse valable reçoit un tri de secours, marqué comme tel.
// Plafonds, appliqués ici plutôt que confiés au modèle :
// - une source non primaire ne dépasse pas 6 ; une prépublication (arXiv) ne dépasse pas 8 ;
// - une annonce d'éditeur publiée hors d'un domaine officiel : 2 au plus.
// Les drapeaux calculés par le programme (prix et retraits des modèles suivis) s'ajoutent à ceux du modèle.
// La réponse brute et la version de la consigne sont gardées, pour pouvoir rejouer le tri.
const lots = $('Consigne de tri').all().map((i) => i.json);
const reponses = $input.all().map((i) => i.json || {});
const AXES = PARLIA.AXES.concat(['hors_theme']);
const DRAPEAUX = ['changement_prix', 'retrait_modele', 'nouveau_modele_decision', 'echeance_reglementaire'];

function lireJson(texte) {
  let t = String(texte || '').trim();
  const bloc = /\x60\x60\x60(?:json)?\s*([\s\S]*?)\x60\x60\x60/.exec(t);
  if (bloc) t = bloc[1];
  const iObj = t.indexOf('{');
  const iTab = t.indexOf('[');
  const debut = iTab !== -1 && (iObj === -1 || iTab < iObj) ? iTab : iObj;
  const fin = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (debut === -1 || fin <= debut) return null;
  try {
    const v = JSON.parse(t.slice(debut, fin + 1));
    return Array.isArray(v) ? v : (Array.isArray(v.articles) ? v.articles : null);
  } catch (e) {
    return null;
  }
}
const texteCourt = (v, n) => tronquer(texteSimple(v == null ? '' : v), n);

function secours(a, motif) {
  return {
    axe: a.source.axe,
    pertinence: a.source.cnil || a.source.decision ? 5 : 3,
    hypothese: '',
    source_primaire: !!a.source.primaire,
    nature: a.source.nature || 'inconnu',
    resume: texteCourt(a.extrait, 220),
    a_chercher: "Le tri automatique n'a pas répondu : lire l'original en entier.",
    drapeaux: { changement_prix: false, retrait_modele: false, nouveau_modele_decision: false, echeance_reglementaire: false },
    date_effet: null,
    secours: motif,
  };
}

function valider(a, p) {
  if (!p || typeof p !== 'object') return null;
  const pertinence = typeof p.pertinence === 'number' ? p.pertinence : Number(p.pertinence);
  if (!AXES.includes(p.axe) || !Number.isInteger(pertinence) || pertinence < 0 || pertinence > 10) return null;
  const drapeaux = {};
  for (const d of DRAPEAUX) drapeaux[d] = !!(p.drapeaux && p.drapeaux[d] === true);
  return {
    axe: p.axe,
    pertinence,
    hypothese: texteCourt(p.hypothese, 320),
    source_primaire: typeof p.source_primaire === 'boolean' ? p.source_primaire : !!a.source.primaire,
    nature: PARLIA.NATURES.includes(p.nature) ? p.nature : 'inconnu',
    resume: texteCourt(p.resume, 320),
    a_chercher: texteCourt(p.a_chercher, 320),
    drapeaux,
    date_effet: /^\d{4}-\d{2}-\d{2}$/.test(String(p.date_effet || '')) ? p.date_effet : null,
    secours: '',
  };
}

const sortie = [];
lots.forEach((lot, i) => {
  const rep = reponses[i] || {};
  const brut = String(rep.text || rep.output || '');
  const liste = rep.error ? null : lireJson(brut);
  const parId = {};
  for (const p of liste || []) if (p && p.id != null) parId[String(p.id)] = p;
  for (const a of lot._articles || []) {
    let tri = valider(a, parId[a.id]);
    if (!tri) tri = secours(a, rep.error ? 'erreur du modèle' : (liste ? 'réponse invalide' : 'réponse illisible'));
    // Plafonds.
    const plafonds = [];
    if (!tri.source_primaire && tri.pertinence > 6) { tri.pertinence = 6; plafonds.push('source non primaire'); }
    if (a.source.arxiv && tri.pertinence > 8) { tri.pertinence = 8; plafonds.push('prépublication'); }
    if (!a.officiel && tri.nature === 'editeur' && tri.pertinence > 2) { tri.pertinence = 2; plafonds.push('domaine non officiel'); }
    tri.plafonds = plafonds;
    // Les drapeaux vérifiés par le programme l'emportent.
    if (a.verifie) {
      for (const d of DRAPEAUX) if (a.verifie[d]) tri.drapeaux[d] = true;
      if (a.verifie.date_effet) tri.date_effet = a.verifie.date_effet;
    }
    sortie.push({ json: Object.assign({}, a, { tri, consigne: lot._version || '', brut: brut.slice(0, 1500) }) });
  }
});
return sortie.length ? sortie : [{ json: { _rien: true } }];

// Lecture du tri. Chaque réponse du modèle est contrôlée comme ParlIA contrôle un ministère proposé : un axe ou
// une nature hors des listes, une pertinence qui n'est pas un entier de 0 à 10, et la proposition est rejetée
// (sources.md, 5.3). Un article sans réponse valable reçoit un tri de secours, marqué comme tel.
// Plafonds, appliqués ici plutôt que confiés au modèle :
// - une source non primaire ne dépasse pas 6 ; une prépublication (arXiv) ne dépasse pas 8 ;
// - une annonce d'éditeur publiée hors d'un domaine officiel : 2 au plus.
// L'hypothèse est contrôlée (hypotheseFautive, outils.js) : une hypothèse qui dit ParlIA équipé d'un service, ou qui
// prête un retrait à un modèle suivi absent du titre et de l'extrait, est écartée ; le motif suit l'article jusqu'à
// sa fiche (hypothese_ecartee).
// Les drapeaux calculés par le programme (prix et retraits des modèles suivis) s'ajoutent à ceux du modèle.
// La nature d'une source et son caractère primaire viennent de la liste des sources (sources.md, 4.1), pas du modèle :
// le 16 novembre 2026, il avait classé le journal de l'API Gemini, écrit par Google, « agrégateur, non primaire »
// (fiche 6 de la semaine 47), ce qui plafonnait sa note et le marquait « à recouper ». Sa réponse reste dans le brut.
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
// « null », « none » ou « n/a » écrits en toutes lettres par le modèle (vu le 4 novembre 2026) : un champ vide.
const VIDE = /^(null|none|n\/?a|undefined|aucun|aucune|néant)$/i;
const texteCourt = (v, n) => {
  const t = texteSimple(v == null ? '' : v);
  return VIDE.test(t) ? '' : tronquer(t, n);
};

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
    hypothese_ecartee: '',
  };
}

function valider(a, p) {
  if (!p || typeof p !== 'object') return null;
  const pertinence = typeof p.pertinence === 'number' ? p.pertinence : Number(p.pertinence);
  if (!AXES.includes(p.axe) || !Number.isInteger(pertinence) || pertinence < 0 || pertinence > 10) return null;
  const drapeaux = {};
  for (const d of DRAPEAUX) drapeaux[d] = !!(p.drapeaux && p.drapeaux[d] === true);
  const hypothese = texteCourt(p.hypothese, 320);
  const ecartee = hypotheseFautive(hypothese, a.titre + ' ' + (a.extrait || ''));
  return {
    axe: p.axe,
    pertinence,
    hypothese: ecartee ? '' : hypothese,
    source_primaire: !!a.source.primaire,
    // Celle de la liste des sources ; sans elle, celle du modèle, si elle est dans la liste des natures.
    nature: PARLIA.NATURES.includes(a.source.nature) && a.source.nature !== 'inconnu' ? a.source.nature
      : (PARLIA.NATURES.includes(p.nature) ? p.nature : 'inconnu'),
    resume: texteCourt(p.resume, 320),
    a_chercher: texteCourt(p.a_chercher, 320),
    drapeaux,
    date_effet: /^\d{4}-\d{2}-\d{2}$/.test(String(p.date_effet || '')) ? p.date_effet : null,
    secours: '',
    hypothese_ecartee: ecartee,
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

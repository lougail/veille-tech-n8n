// Les résumés des originaux, rapprochés des candidats de la sélection (15 novembre 2026). Pour chaque original lu,
// la réponse du modèle est contrôlée : une erreur, une réponse illisible ou un résumé vide, et la fiche garde le
// résumé du tri, avec le motif. Sinon, le résumé, ce qu'il faut chercher et l'hypothèse viennent de l'original ;
// ceux du tri restent à côté (tri), pour comparer.
// Ce que l'original apprend de plus :
// - sa date de publication, quand la source n'en donnait pas : déclarée par la page, sinon lue par le modèle. La
//   fiche est datée, et signalée si cette date précède la période lue (fiche 1 de la semaine 46) ;
// - une date d'effet autre que celle de l'échéance relevée : l'échéance la prend, et garde l'ancienne ;
// - aucun lien concret avec ParlIA : la fiche le dit, et son hypothèse devient « rien » ;
// - ce que l'original contredit dans la proposition du tri (ecart).
// La sortie a la forme de celle de la sélection : la préparation la lit telle quelle.
const sd = $getWorkflowStaticData('global');
const plan = $('Que faire ?').first().json;
const sel = $('Sélection').first().json;
const demandes = $('Originaux').all().map((i) => i.json);
const reponses = $input.all().map((i) => i.json || {});
const aujourdhui = $now.toISODate();
const lectures = (demandes[0] && demandes[0].lectures) || [];
const VIDE = /^(null|none|n\/?a|undefined|aucun|aucune|néant)$/i;
const texteCourt = (v, n) => {
  const t = texteSimple(v == null ? '' : v);
  return VIDE.test(t) ? '' : tronquer(t, n);
};
const rien = (t) => /^rien\.?$/i.test(String(t || '').trim());
const dateValide = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) ? String(d) : '');
function lireJson(texte) {
  let t = String(texte || '').trim();
  const bloc = /\x60\x60\x60(?:json)?\s*([\s\S]*?)\x60\x60\x60/.exec(t);
  if (bloc) t = bloc[1];
  const debut = t.indexOf('{');
  const fin = t.lastIndexOf('}');
  if (debut === -1 || fin <= debut) return null;
  try {
    const v = JSON.parse(t.slice(debut, fin + 1));
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch (e) {
    return null;
  }
}
const reponseDe = {};
demandes.forEach((d, i) => { if (d.n != null && !d.vide) reponseDe[d.n] = reponses[i] || {}; });
const echeances = (sel.echeances || []).map((e) => Object.assign({}, e));
const bilan = { total: 0, lus: 0, sansObjet: 0, resumes: 0, echecs: [], nonLus: [] };

const candidats = (sel.candidats || []).map((avant) => {
  const c = Object.assign({}, avant);
  const l = lectures.find((x) => x.n === c.n);
  bilan.total++;
  if (!l) {
    c.original = { lu: false, motif: "l'original n'a pas été lu", resume: 'tri' };
    bilan.nonLus.push(c.n);
    return c;
  }
  c.original = {
    lu: !!l.lu, comment: l.comment || '', adresse: l.adresse || c.url, motif: l.motif || '', sansObjet: !!l.sansObjet,
    taille: l.taille || 0, retrouvePar: l.retrouvePar || '', version: l.version || '', resume: 'tri',
  };
  if (l.sansObjet) { bilan.sansObjet++; return c; }
  if (!l.lu) { bilan.nonLus.push(c.n); return c; }
  bilan.lus++;
  // Le billet retrouvé sur la page d'un blog devient le lien de la fiche.
  if (l.comment === 'billet' && l.adresse && l.adresse !== c.url) {
    c.urlListe = c.url;
    c.url = l.adresse;
  }
  const rep = reponseDe[c.n] || {};
  const r = rep.error ? null : lireJson(rep.text || rep.output || '');
  const resume = r ? texteCourt(r.resume, 400) : '';
  if (!resume) {
    c.original.echec = rep.error ? 'erreur du modèle' : (r ? 'résumé vide' : 'réponse illisible');
    bilan.echecs.push(c.n);
  } else {
    bilan.resumes++;
    c.tri = { resume: c.resume, aChercher: c.aChercher, hypothese: c.hypothese };
    c.resume = resume;
    c.aChercher = rien(r.a_chercher) ? '' : texteCourt(r.a_chercher, 320);
    c.hypothese = texteCourt(r.hypothese, 320) || 'rien';
    c.original.resume = 'original';
    if (r.hors_theme === true) {
      c.horsThemeOriginal = true;
      c.hypothese = 'rien';
    }
    const ecart = texteCourt(r.ecart, 320);
    if (ecart && !rien(ecart)) c.ecart = ecart;
  }
  // La date de publication : déclarée par la page, sinon lue par le modèle ; jamais une date à venir.
  const publiee = [l.datePage, r ? dateValide(r.date_publication) : ''].find((d) => d && d <= aujourdhui) || '';
  if (publiee && publiee !== c.date) {
    if (c.date) c.dateSource = c.date;
    c.date = publiee;
    c.avantPeriode = !!sel.jourDebut && publiee < sel.jourDebut;
  }
  // La date d'effet : si l'original en donne une autre que l'échéance relevée, l'échéance la prend.
  const effet = r ? dateValide(r.date_effet) : '';
  if (effet && c.dateEffet && effet !== c.dateEffet && effet >= aujourdhui) {
    const e = (sd.echeances || []).find((x) => x.id === c.id);
    if (e) {
      const x = echeances.find((y) => y.titre === e.titre && y.date === e.date);
      if (x) Object.assign(x, { avant: x.date, date: effet });
      Object.assign(e, { avant: e.date, date: effet, changee: '' });
    }
    c.dateAvant = c.dateEffet;
    c.dateEffet = effet;
  }
  return c;
});
echeances.sort((x, y) => x.date.localeCompare(y.date));
const modele = (plan.reglages && plan.reglages.modeleResumes) || '';
sd._passage = Object.assign(sd._passage || {}, { originaux: Object.assign({ modele }, bilan) });
return [{ json: Object.assign({}, sel, { candidats, echeances, originaux: Object.assign({ modele }, bilan) }) }];

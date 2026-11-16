// Aide aux tests de la veille ParlIA : exécute un nœud Code comme le fait n8n, assemblé comme le fait
// build_parlia.py (les modules communs dont il se sert en tête), avec $input, $getWorkflowStaticData, $now (Luxon,
// heure de Paris), $ (les sorties des nœuds précédents) et helpers (httpRequest simulé).
import { readFileSync } from 'node:fs';
import { DateTime } from 'luxon';

const dossier = new URL('../src-parlia/', import.meta.url);
export const source = (nom) => readFileSync(new URL(nom, dossier), 'utf8');
export const OUTILS = source('outils.js');
export const LECTURE = source('lecture-pages.js');
export const MODULES = ['outils.js', 'lecture-pages.js'];
const OUTILS_NOMS = ['PARLIA', 'texteSimple', 'tronquer', 'hacher', 'domaineDe', 'cleAdresse', 'cellule', 'pourDiscord', 'MOIS_FR',
  'dateLongue', 'MOIS_EN', 'datesDansTexte', 'dateDansTexte', 'noterSante', 'pousserAlerte', 'ligneHorsTexte', 'deRetraitsTexte'];
const LECTURE_NOMS = ['texteDe', 'lignesDe', 'lignesDuMarkdown', 'texteDuBloc', 'sansMarque', 'estRangee', 'FORMAT_PAGES'];
const utilise = (code, noms) => noms.some((nom) => new RegExp('\\b' + nom + '\\b').test(code));
// Le code d'un nœud, tel que build_parlia.py l'assemble : la lecture des pages se sert des outils.
export function assembler(nom) {
  const code = source(nom);
  const lecture = utilise(code, LECTURE_NOMS);
  const outils = lecture || utilise(code, OUTILS_NOMS);
  return (outils ? OUTILS + '\n' : '') + (lecture ? LECTURE + '\n' : '') + code;
}
const AsyncFunction = (async () => {}).constructor;

export const paris = (iso) => DateTime.fromISO(iso, { zone: 'Europe/Paris' });
export const ms = (iso) => paris(iso).toMillis();
export const JOUR = 24 * 3600 * 1000;

// $input à partir d'une liste d'objets json.
export const entree = (liste) => ({
  all: () => liste.map((json) => ({ json })),
  first: () => ({ json: liste[0] }),
});

// $('Nœud') : un nœud absent de « sorties » n'a pas tourné, comme dans n8n.
export function noeuds(sorties = {}) {
  return (nom) => {
    if (!(nom in sorties)) {
      const refus = () => { throw new Error("Referenced node is unexecuted: " + nom); };
      return { isExecuted: false, all: refus, first: refus };
    }
    const liste = sorties[nom];
    return { isExecuted: true, all: () => liste.map((json) => ({ json })), first: () => ({ json: liste[0] }) };
  };
}

// La sortie de « Que faire ? » pour un passage donné (valeurs par défaut des réglages).
export function plan(extra = {}) {
  return Object.assign({
    collecte: true, pages: true, jorf: true, preparation: true, rappel: false, essai: false,
    semaine: { cle: '2026-S45', numero: 45, lundi: '2026-11-02', dimanche: '2026-11-08' },
    reglages: {
      prepJour: 1, prepHeure: { h: 6, mn: 0 }, rappelJour: 4, rappelHeure: { h: 16, mn: 30 }, collecteHeures: 4,
      candidatsMax: 8, forum: false, discord: true, statut: true, mention: '', essai: false,
    },
  }, extra, extra.reglages ? { reglages: Object.assign({}, plan().reglages, extra.reglages) } : {});
}

// Exécute un nœud et renvoie la liste des json de sortie.
export async function executer(nom, { input = [], sd = {}, maintenant = '2026-11-02T09:15', sorties = {}, helpers = null } = {}) {
  const f = new AsyncFunction('$input', '$getWorkflowStaticData', '$now', '$', 'helpers', assembler(nom));
  const res = await f(entree(input), () => sd, paris(maintenant), noeuds(sorties), helpers);
  return (res || []).map((o) => o.json);
}

// helpers.httpRequest simulé : une table adresse → réponse ({ statusCode, body }) ou fonction ; le reste : 404.
export function http(table) {
  const appels = [];
  return {
    appels,
    httpRequest: async (opts) => {
      appels.push(opts.url);
      let r = table[opts.url];
      if (typeof r === 'function') r = await r(opts);
      if (r instanceof Error) throw r;
      if (!r) r = { statusCode: 404, body: 'introuvable' };
      return opts.returnFullResponse ? r : r.body;
    },
  };
}

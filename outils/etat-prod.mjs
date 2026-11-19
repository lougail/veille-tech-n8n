// Quelle version tourne dans n8n ? Une commande, qui ne modifie rien :   npm run etat
//
// 1. Reconstruit les workflows du dépôt dans un dossier temporaire (build_v2.py, build_parlia.py) ; l'Error Handler
//    est le fichier workflows/error-handler.json.
// 2. Exporte de n8n les versions publiées, celles qui tournent (n8n export:workflow --published, dans le conteneur :
//    la base ne s'ouvre jamais depuis le Mac pendant que n8n tourne).
// 3. Compare chaque version publiée à celle du dépôt : nom, nœuds (type, version, paramètres, identifiants, réglages
//    d'erreur), connexions et réglages du workflow.
// 4. Donne l'état du dépôt (branche, dernier commit, fichiers non enregistrés, commits absents de GitHub) et, pour
//    chaque workflow, son dernier passage (journal de n8n) et ses repères (dernière collecte, dernier brief…).
// L'export contient la mémoire des workflows : seules les dates des repères en sont lues, et il est effacé à la fin.
// Code de sortie : 0 si tout ce qui tourne est identique au dépôt, 1 sinon.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('../', import.meta.url));
const CONTENEUR = 'veille-tech-n8n-n8n-1';

// Les workflows qui tournent, et comment les obtenir. Veille Stack (VeilleStackHlmr1) est archivée depuis le
// 19 novembre 2026 : elle ne tourne plus, et n'est plus suivie ici.
export const WORKFLOWS = [
  { id: 'VeilleProV2story', construire: 'workflows/build_v2.py' },
  { id: 'VeilleParlIAprod', construire: 'workflows/build_parlia.py' },
  { id: 'yrUX1IcjTyIwpWqG', fichier: 'workflows/error-handler.json' },
];

// Ce qui compte dans un nœud : n8n ajoute à l'import un identifiant, une position ou un webhookId, sans effet.
const CHAMPS = {
  type: 'type', typeVersion: 'version du nœud', parameters: 'paramètres', disabled: 'désactivation',
  continueOnFail: "réglages d'erreur", onError: "réglages d'erreur", retryOnFail: "réglages d'erreur",
  maxTries: "réglages d'erreur", waitBetweenTries: "réglages d'erreur", alwaysOutputData: 'sortie',
  executeOnce: 'exécution unique',
};
const canon = (v) => (Array.isArray(v) ? v.map(canon)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
const egal = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const identifiants = (n) => Object.fromEntries(Object.entries(n.credentials || {}).map(([k, c]) => [k, c && c.id]));

// Les différences entre le workflow du dépôt et celui de n8n, en phrases ; aucune : identiques.
export function differences(depot, n8n) {
  const d = [];
  if (depot.name !== n8n.name) d.push('nom : « ' + n8n.name + ' » dans n8n, « ' + depot.name + ' » dans le dépôt');
  const dansN8n = new Map(n8n.nodes.map((n) => [n.name, n]));
  const dansDepot = new Set(depot.nodes.map((n) => n.name));
  for (const n of depot.nodes) {
    const m = dansN8n.get(n.name);
    if (!m) { d.push('nœud « ' + n.name + ' » : absent de n8n'); continue; }
    const champs = new Set(Object.keys(CHAMPS).filter((k) => !egal(n[k], m[k])).map((k) => CHAMPS[k]));
    if (champs.has('paramètres') && n.parameters && m.parameters && n.parameters.jsCode !== m.parameters.jsCode) {
      champs.delete('paramètres');
      champs.add('code');
    }
    if (!egal(identifiants(n), identifiants(m))) champs.add('identifiants');
    if (champs.size) d.push('nœud « ' + n.name + ' » : diffère (' + [...champs].join(', ') + ')');
  }
  for (const nom of dansN8n.keys()) if (!dansDepot.has(nom)) d.push('nœud « ' + nom + ' » : en plus dans n8n');
  if (!egal(depot.connections, n8n.connections)) d.push('connexions différentes');
  for (const [k, v] of Object.entries(depot.settings || {})) {
    if (!egal(v, (n8n.settings || {})[k])) d.push('réglage « ' + k + ' » différent');
  }
  return d;
}

// Le dernier passage de chaque workflow, lu dans les journaux de n8n (du plus ancien au plus récent).
export function derniersPassages(textes) {
  const res = {};
  for (const texte of textes) {
    for (const ligne of texte.split('\n')) {
      if (!ligne.includes('"eventName":"n8n.workflow.')) continue;
      let e;
      try { e = JSON.parse(ligne); } catch { continue; }
      const issue = { 'n8n.workflow.success': 'réussi', 'n8n.workflow.failed': 'ÉCHEC', 'n8n.workflow.crashed': 'PLANTÉ' }[e.eventName];
      const id = e.payload && e.payload.workflowId;
      if (issue && id) res[id] = { quand: e.ts, issue };
    }
  }
  return res;
}

// La date la plus ancienne des journaux : n8n n'en garde que quelques fichiers, parfois un seul jour.
export function debutDuJournal(textes) {
  for (const texte of textes) {
    const m = /"ts":"([^"]+)"/.exec(texte);
    if (m) return m[1];
  }
  return null;
}

// Les repères gardés dans la mémoire d'un workflow : seulement des dates.
export function reperes(staticData) {
  const m = typeof staticData === 'string' ? JSON.parse(staticData || '{}') : staticData || {};
  const g = m.global || {};
  const r = [];
  if (Number(g.lastCollectAt)) r.push(['dernière collecte', Number(g.lastCollectAt)]);
  if (Number(g.lastDigestAt)) r.push(['dernier brief', Number(g.lastDigestAt)]);
  if (g.prep && Number(g.prep.at)) r.push(['préparation ' + (g.prep.semaine || ''), Number(g.prep.at)]);
  return r;
}

const date = (v) => new Date(v).toLocaleString('fr-FR', {
  timeZone: 'Europe/Paris', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});

function sortie(cmd, args, options = {}) {
  return execFileSync(cmd, args, { cwd: RACINE, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, ...options }).trim();
}

function etatGit() {
  const git = (...a) => { try { return sortie('git', a, { stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
  const nonEnregistres = (git('status', '--porcelain') || '').split('\n').filter(Boolean).length;
  const absents = git('rev-list', '--count', 'origin/master..HEAD');
  return [
    'Dépôt : branche ' + git('rev-parse', '--abbrev-ref', 'HEAD') + ', dernier commit ' + git('log', '-1', '--format=%h « %s »')
      + (nonEnregistres ? ' ; ' + nonEnregistres + ' fichier(s) modifié(s) non enregistré(s)' : ' ; tout est enregistré'),
    absents === null ? 'GitHub : branche origin/master inconnue.'
      : Number(absents) ? 'GitHub : ' + absents + ' commit(s) du Mac absents de GitHub (origin/master, à la dernière synchronisation).'
        : 'GitHub : à jour (origin/master, à la dernière synchronisation).',
  ];
}

function exporterN8n() {
  const fichier = '/tmp/etat-prod-' + process.pid + '.json';
  try {
    sortie('docker', ['exec', CONTENEUR, 'n8n', 'export:workflow', '--all', '--published', '--output=' + fichier], { stdio: ['ignore', 'pipe', 'pipe'] });
    return JSON.parse(sortie('docker', ['exec', CONTENEUR, 'cat', fichier]));
  } finally {
    try { sortie('docker', ['exec', CONTENEUR, 'rm', '-f', fichier]); } catch { /* le conteneur ne répond plus : rien à effacer */ }
  }
}

function construire(dossier) {
  const res = {};
  for (const w of WORKFLOWS) {
    try {
      let chemin = w.fichier && join(RACINE, w.fichier);
      if (w.construire) {
        chemin = join(dossier, w.id + '.json');
        sortie('python3', [w.construire, '-o', chemin]);
      }
      res[w.id] = { wf: [].concat(JSON.parse(readFileSync(chemin, 'utf8')))[0] };
    } catch (e) {
      res[w.id] = { manque: 'construction impossible (' + String(e.message).split('\n')[0] + ')' };
    }
  }
  return res;
}

function principal() {
  const lignes = etatGit();
  const dossier = mkdtempSync(join(tmpdir(), 'etat-prod-'));
  let toutVa = true;
  try {
    const depot = construire(dossier);
    let publies;
    try {
      publies = exporterN8n();
    } catch (e) {
      lignes.push('', 'n8n ne répond pas : OrbStack et le conteneur ' + CONTENEUR + ' tournent-ils ? (' + String(e.message).split('\n')[0] + ')');
      process.stdout.write(lignes.join('\n') + '\n');
      return 1;
    }
    const journaux = ['n8nEventLog-3.log', 'n8nEventLog-2.log', 'n8nEventLog-1.log', 'n8nEventLog.log']
      .map((f) => join(RACINE, 'n8n-data', f)).filter(existsSync).map((f) => readFileSync(f, 'utf8'));
    const passages = derniersPassages(journaux);
    const debut = debutDuJournal(journaux);
    lignes.push('');
    const vus = new Set();
    for (const w of WORKFLOWS) {
      const enService = publies.find((p) => p.id === w.id);
      vus.add(w.id);
      const { wf, manque } = depot[w.id];
      if (!enService) {
        lignes.push('⚪ ' + ((wf && wf.name) || w.id) + ' (' + w.id + ') : pas publié dans n8n, donc ne tourne pas.');
        continue;
      }
      const ecarts = wf ? differences(wf, enService) : null;
      if (!ecarts || ecarts.length) toutVa = false;
      const version = enService.versionMetadata && enService.versionMetadata.name ? ' (version « ' + enService.versionMetadata.name + ' »)' : '';
      lignes.push((ecarts && !ecarts.length ? '✅ ' : '❌ ') + enService.name + ' (' + w.id + ')' + version);
      if (!ecarts) lignes.push('   comparaison impossible : ' + manque);
      else if (!ecarts.length) lignes.push('   ce qui tourne est identique au dépôt');
      else for (const e of ecarts) lignes.push('   ' + e);
      const p = passages[w.id];
      const r = reperes(enService.staticData).map(([nom, quand]) => nom + ' ' + date(quand));
      const rien = debut ? 'aucun passage depuis ' + date(debut) + ' (début du journal de n8n)' : 'aucun passage dans le journal de n8n';
      lignes.push('   ' + (p ? 'dernier passage ' + date(p.quand) + ', ' + p.issue : rien) + (r.length ? ' · ' + r.join(' · ') : ''));
    }
    for (const p of publies) if (!vus.has(p.id)) lignes.push('⚠️ ' + p.name + ' (' + p.id + ') : publié dans n8n, absent du dépôt.');
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
  lignes.push('', toutVa ? 'Tout ce qui tourne est la version du dépôt.' : 'Au moins un workflow ne tourne pas dans la version du dépôt : voir ci-dessus.');
  process.stdout.write(lignes.join('\n') + '\n');
  return toutVa ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = principal();

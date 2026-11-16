// Le workflow généré (workflows/veille-parlia.json, par build_parlia.py) : à jour avec src-parlia/, valide, dans le
// bon ordre d'exécution, et sans secret : le dépôt est public. Lance avec : npm test
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { MODULES, assembler, source } from './aide-parlia.mjs';

const racine = new URL('../../', import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, racine), 'utf8');
const [wf] = JSON.parse(lire('workflows/veille-parlia.json'));
const parNom = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));
const fichiers = readdirSync(new URL('workflows/src-parlia/', racine)).filter((f) => f.endsWith('.js') && !MODULES.includes(f));
const codes = wf.nodes.filter((n) => n.type === 'n8n-nodes-base.code');
const AsyncFunction = (async () => {}).constructor;

test('le JSON est à jour : chaque nœud Code reprend son fichier de src-parlia/, les modules communs en tête quand il en a besoin', () => {
  const utilises = new Set();
  for (const n of codes) {
    const code = n.parameters.jsCode;
    const fichier = fichiers.find((f) => code.endsWith(source(f)));
    assert.ok(fichier, 'nœud « ' + n.name + " » : aucun fichier de src-parlia/ ne correspond (relancer build_parlia.py)");
    utilises.add(fichier);
    assert.equal(code, assembler(fichier), 'nœud « ' + n.name + ' » pas à jour (relancer build_parlia.py)');
  }
  assert.deepEqual([...utilises].sort(), fichiers.sort());
  // La lecture des pages n'alourdit que les nœuds qui découpent une page ou un billet en lignes : l'étiquetage des flux
  // (les billets de retraits de Cloudflare), la collecte des pages et les originaux.
  assert.deepEqual(codes.filter((n) => n.parameters.jsCode.includes('---- Lecture des pages')).map((n) => n.name), ['Étiqueter la source', 'Pages et API', 'Originaux']);
});

test('chaque nœud Code se compile comme dans n8n (corps de fonction asynchrone)', () => {
  for (const n of codes) {
    assert.doesNotThrow(() => new AsyncFunction('$input', '$getWorkflowStaticData', '$now', '$', 'helpers', n.parameters.jsCode), n.name);
  }
});

test("les connexions, et l'ordre d'exécution v1 : de haut en bas, le statut en dernier, le fichier avant Discord", () => {
  assert.equal(wf.settings.executionOrder, 'v1');
  assert.equal(wf.settings.timezone, 'Europe/Paris');
  assert.equal(wf.settings.errorWorkflow, 'yrUX1IcjTyIwpWqG');
  for (const [src, sorties] of Object.entries(wf.connections)) {
    assert.ok(parNom[src], src);
    for (const liste of Object.values(sorties)) for (const sortie of liste) for (const c of sortie) assert.ok(parNom[c.node], c.node);
  }
  const enfants = (nom) => wf.connections[nom].main[0].map((c) => c.node);
  const y = (nom) => parNom[nom].position[1];
  const ordonne = (liste) => liste.every((nom, i) => i === 0 || y(liste[i - 1]) < y(nom));
  assert.deepEqual(enfants('Que faire ?'), ['Sources ParlIA', 'Notes à lire ?', 'Sélection', 'Rappel', 'Statut']);
  assert.ok(ordonne(enfants('Que faire ?')));
  assert.ok(ordonne(enfants('Normaliser')));
  assert.ok(ordonne(enfants('Préparation')));
  assert.deepEqual(wf.connections['Flux ParlIA'].main.map((s) => s[0].node), ['Pages et API', 'Lire le flux']);
  assert.equal(parNom['Toutes les 30 min'].parameters.rule.interval[0].expression, '0 15,45 7-22 * * *');
});

test('les notes de séance : lues dans le seul dossier monté, sans écriture, erreurs tolérées, nom du fichier gardé', () => {
  const chaine = ['Notes à lire ?', 'Lire les notes', 'Texte des notes', 'Notes'];
  chaine.slice(0, -1).forEach((nom, i) => assert.deepEqual(wf.connections[nom].main[0].map((c) => c.node), [chaine[i + 1]]));
  const lire = parNom['Lire les notes'];
  assert.equal(lire.type, 'n8n-nodes-base.readWriteFile');
  assert.equal(lire.typeVersion, 1.1); // 1.1 : « aucun fichier » est une erreur, donc un élément, pas un silence
  assert.equal(lire.parameters.operation, 'read');
  assert.equal(lire.parameters.fileSelector, '/home/node/.n8n-files/parlia-notes/*-seance-*.md');
  assert.equal(lire.continueOnFail, true);
  const texte = parNom['Texte des notes'];
  assert.equal(texte.type, 'n8n-nodes-base.extractFromFile');
  assert.deepEqual([texte.parameters.operation, texte.parameters.binaryPropertyName, texte.parameters.destinationKey], ['text', 'data', 'texte']);
  assert.equal(texte.parameters.options.keepSource, 'json');
  assert.equal(texte.continueOnFail, true);
  // Aucun nœud n'écrit ailleurs que dans le dossier des préparations.
  const ecritures = wf.nodes.filter((n) => n.type === 'n8n-nodes-base.readWriteFile' && n.parameters.operation === 'write');
  assert.deepEqual(ecritures.map((n) => n.name), ['Écrire le fichier']);
  assert.match(parNom['Préparation'].parameters.jsCode, /chemin: '\/home\/node\/\.n8n-files\/parlia\/' \+ nom/);
});

test("la chaîne LLM : un lot après l'autre, avec Mistral Small 3.2", () => {
  const tri = parNom['Tri Mistral Small'];
  assert.deepEqual(tri.parameters.batching, { batchSize: 1 });
  assert.equal(tri.continueOnFail, true);
  assert.deepEqual(wf.connections['OpenRouter Mistral Small'].ai_languageModel[0].map((c) => c.node), ['Tri Mistral Small']);
});

test("les originaux : lus entre la sélection et la préparation, résumés un par un par le modèle choisi, avec un secours", () => {
  const suite = ['Sélection', 'Originaux', 'Résumé des originaux', 'Lire les résumés', 'Préparation'];
  suite.slice(0, -1).forEach((nom, i) => assert.deepEqual(wf.connections[nom].main[0].map((c) => c.node), [suite[i + 1]], nom));
  const chaine = parNom['Résumé des originaux'];
  assert.deepEqual(chaine.parameters.batching, { batchSize: 1 });
  assert.equal(chaine.continueOnFail, true);
  const modele = parNom['OpenRouter résumés'].parameters.model;
  assert.deepEqual(wf.connections['OpenRouter résumés'].ai_languageModel[0], [{ node: 'Résumé des originaux', type: 'ai_languageModel', index: 0 }]);
  const reglages = Object.fromEntries(parNom['Réglages'].parameters.assignments.assignments.map((a) => [a.name, a.value]));
  assert.equal(reglages.modeleResumes, modele);
  const tri = parNom['OpenRouter Mistral Small'].parameters.model;
  if (modele === tri) {
    assert.equal(chaine.parameters.needsFallback, undefined);
    assert.equal(parNom['OpenRouter résumés secours'], undefined);
  } else {
    assert.equal(chaine.parameters.needsFallback, true);
    assert.equal(parNom['OpenRouter résumés secours'].parameters.model, tri);
    assert.deepEqual(wf.connections['OpenRouter résumés secours'].ai_languageModel[0], [{ node: 'Résumé des originaux', type: 'ai_languageModel', index: 1 }]);
  }
});

test('Discord et OpenRouter : adresses lues dans les variables d\'environnement, erreurs tolérées, un seul identifiant', () => {
  const discord = wf.nodes.filter((n) => n.name.startsWith('Discord '));
  assert.equal(discord.length, 5);
  for (const n of discord) {
    assert.match(n.parameters.url, /^=\{\{ \$env\.DISCORD_WEBHOOK_(PARLIA|STATUS) \+ '\?wait=true'/);
    assert.equal(n.continueOnFail, true);
    assert.equal(n.disabled, undefined);
  }
  assert.equal(parNom['Écrire le fichier'].continueOnFail, true);
  const identifiants = wf.nodes.filter((n) => n.credentials).map((n) => JSON.stringify(n.credentials));
  assert.ok(identifiants.length >= 2);
  assert.deepEqual([...new Set(identifiants)], ['{"openRouterApi":{"id":"w6TWAQpgn7TIxlYq","name":"OpenRouter account"}}']);
  assert.equal(parNom['OpenRouter Mistral Small'].parameters.model, 'mistralai/mistral-small-3.2-24b-instruct');
  const reglages = Object.fromEntries(parNom['Réglages'].parameters.assignments.assignments.map((a) => [a.name, a.value]));
  assert.equal(reglages.essai, '0');
  assert.match(reglages.discord, /\$env\.DISCORD_WEBHOOK_PARLIA \? '1' : '0'/);
  assert.match(reglages.forum, /\$env\.DISCORD_PARLIA_FORUM \|\| '0'/);
});

test('aucun secret ni chemin personnel dans ce qui est versionné', () => {
  const textes = [lire('workflows/veille-parlia.json'), lire('workflows/build_parlia.py'), lire('.env.example'), lire('docker-compose.yml')]
    .concat(fichiers.concat(MODULES).map(source));
  if (existsSync(new URL('docs/veille-parlia.md', racine))) textes.push(lire('docs/veille-parlia.md'));
  const interdits = [/discord(app)?\.com\/api\/webhooks\/\d/i, /sk-or-v1-[0-9a-f]{16,}/i, /\bsk-[A-Za-z0-9]{24,}/, /Bearer [A-Za-z0-9._-]{20,}/,
    /\/Users\//, /[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}/];
  for (const texte of textes) for (const motif of interdits) assert.doesNotMatch(texte, motif);
});

test('le mode essai : déclencheur manuel, Discord désactivé, tout est dû, identifiant à part', (t) => {
  let python = 'python3';
  try { execFileSync(python, ['--version']); } catch { t.skip('python3 absent'); return; }
  const dossier = mkdtempSync(join(tmpdir(), 'parlia-'));
  try {
    const sortie = join(dossier, 'essai.json');
    execFileSync(python, [new URL('workflows/build_parlia.py', racine).pathname, '--test', '-o', sortie]);
    const [essai] = JSON.parse(readFileSync(sortie, 'utf8'));
    assert.equal(essai.id, 'VeilleParlIAtest');
    const noms = Object.fromEntries(essai.nodes.map((n) => [n.name, n]));
    assert.ok(noms['Essai manuel']);
    assert.deepEqual(essai.connections['Essai manuel'].main[0].map((c) => c.node), ['Réglages']);
    for (const n of essai.nodes.filter((x) => x.name.startsWith('Discord '))) assert.equal(n.disabled, true, n.name);
    const reglages = Object.fromEntries(noms['Réglages'].parameters.assignments.assignments.map((a) => [a.name, a.value]));
    assert.deepEqual([reglages.essai, reglages.discord, reglages.statut], ['1', '1', '1']);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
});

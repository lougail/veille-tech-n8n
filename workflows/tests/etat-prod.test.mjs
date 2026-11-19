// L'outil « ce qui tourne » (outils/etat-prod.mjs, npm run etat) : la comparaison d'un workflow du dépôt à la version
// publiée dans n8n, le dernier passage lu dans le journal, les repères de la mémoire, et le dossier du bot ParlIA.
// Lance avec : npm test
import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import test from 'node:test';
import { debutDuJournal, derniersPassages, differences, dossierDuBot, reperes } from '../../outils/etat-prod.mjs';

const noeud = (name, extra = {}) => Object.assign({ name, type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: 'return [];' } }, extra);
const workflow = (nodes, extra = {}) => Object.assign({
  name: 'Veille', nodes, connections: { A: { main: [[{ node: 'B', type: 'main', index: 0 }]] } }, settings: { timezone: 'Europe/Paris' },
}, extra);

test("identiques, malgré ce que n8n ajoute à l'import : identifiant, position, webhookId, nom d'identifiant, réglage en plus", () => {
  const depot = workflow([noeud('A'), noeud('B', { credentials: { openRouterApi: { id: 'x1', name: 'OpenRouter account' } } })]);
  const n8n = workflow([
    noeud('A', { id: 'uuid-1', position: [0, 0], webhookId: 'w' }),
    noeud('B', { id: 'uuid-2', credentials: { openRouterApi: { id: 'x1', name: 'Autre nom' } } }),
  ], { settings: { timezone: 'Europe/Paris', binaryMode: 'separate' } });
  assert.deepEqual(differences(depot, n8n), []);
});

test('un nom, un code, un identifiant, des connexions ou un réglage qui changent sont signalés', () => {
  const depot = workflow([noeud('A'), noeud('B', { credentials: { openRouterApi: { id: 'x1' } } })]);
  const n8n = workflow([noeud('A', { parameters: { jsCode: 'return [1];' } }), noeud('B', { credentials: { openRouterApi: { id: 'x2' } } })],
    { name: 'Veille v2', connections: {}, settings: { timezone: 'UTC' } });
  assert.deepEqual(differences(depot, n8n), [
    'nom : « Veille v2 » dans n8n, « Veille » dans le dépôt',
    'nœud « A » : diffère (code)',
    'nœud « B » : diffère (identifiants)',
    'connexions différentes',
    'réglage « timezone » différent',
  ]);
});

test("un nœud absent ou en plus, un réglage d'erreur et un paramètre hors code", () => {
  const depot = workflow([noeud('A'), noeud('B'), noeud('D', { type: 'n8n-nodes-base.scheduleTrigger', parameters: { rule: '0 */30 * * * *' } })]);
  const n8n = workflow([noeud('A', { continueOnFail: true }), noeud('C'),
    noeud('D', { type: 'n8n-nodes-base.scheduleTrigger', parameters: { rule: '0 */30 7-22 * * *' } })]);
  assert.deepEqual(differences(depot, n8n), [
    "nœud « A » : diffère (réglages d'erreur)",
    'nœud « B » : absent de n8n',
    'nœud « D » : diffère (paramètres)',
    'nœud « C » : en plus dans n8n',
  ]);
});

test('le dernier passage de chaque workflow, du plus ancien journal au plus récent ; les lignes coupées sont ignorées', () => {
  const ligne = (ts, evt, id) => JSON.stringify({ ts, eventName: 'n8n.workflow.' + evt, payload: { executionId: '1', workflowId: id } });
  const ancien = [ligne('2026-11-18T22:33:00+01:00', 'success', 'V'), ligne('2026-11-18T22:48:00+01:00', 'failed', 'P')].join('\n');
  const recent = [ligne('2026-11-19T10:15:00+01:00', 'started', 'P'),
    '{"ts":"2026-11-19T10:16:00+01:00","eventName":"n8n.workflow.success","payload":{"workflowId":"P"',
    ligne('2026-11-19T10:30:00+01:00', 'crashed', 'V')].join('\n');
  assert.deepEqual(derniersPassages([ancien, recent]), {
    V: { quand: '2026-11-19T10:30:00+01:00', issue: 'PLANTÉ' },
    P: { quand: '2026-11-18T22:48:00+01:00', issue: 'ÉCHEC' },
  });
  assert.equal(debutDuJournal(['', ancien, recent]), '2026-11-18T22:33:00+01:00');
  assert.equal(debutDuJournal([]), null);
});

test('les repères de la mémoire : seulement des dates, mémoire en texte comprise', () => {
  const at = Date.parse('2026-11-19T09:30:00Z');
  assert.deepEqual(reperes({ global: { lastCollectAt: at, lastDigestAt: at, prep: { semaine: '2026-S47', at }, seen: { cle: 1 } } }),
    [['dernière collecte', at], ['dernier brief', at], ['préparation 2026-S47', at]]);
  assert.deepEqual(reperes(JSON.stringify({ global: { lastCollectAt: String(at) } })), [['dernière collecte', at]]);
  assert.deepEqual(reperes(null), []);
  assert.deepEqual(reperes({}), []);
});

test('le dossier du bot ParlIA : PARLIA_BOT_DIR, sinon PARLIA_NOTES_DIR suivi de /bot ; environnement, puis .env', () => {
  const env = 'DISCORD_WEBHOOK_PARLIA=https://exemple.org/w\n# PARLIA_BOT_DIR=/ancien\nPARLIA_NOTES_DIR="/coffre/VEILLE"\n';
  assert.equal(dossierDuBot(env, {}), '/coffre/VEILLE/bot');
  assert.equal(dossierDuBot('PARLIA_NOTES_DIR=/coffre/VEILLE # les notes\n', {}), '/coffre/VEILLE/bot');
  assert.equal(dossierDuBot(env + 'PARLIA_BOT_DIR=~/bot\n', {}), homedir() + '/bot');
  assert.equal(dossierDuBot(env, { PARLIA_BOT_DIR: '/ailleurs' }), '/ailleurs');
  assert.equal(dossierDuBot('PARLIA_NOTES_DIR=\n', {}), '');
  assert.equal(dossierDuBot('', {}), '');
});

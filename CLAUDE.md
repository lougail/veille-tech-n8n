# Veille Tech N8N + Discord

Automatisation de veille technologique avec N8N (self-hosted) et Discord.
**v3 prête, pas encore en service** (branche `veille/refonte`, essais dans n8n le 28 octobre 2026) : les publications des labos, les radars de nouveaux modèles, les capteurs de bruit et le brief du matin — `docs/veille-v3.md`. Elle remplacera la v2 quand Louis l'aura validée. Architecture de base (stories, chaleur, Components V2) : `docs/veille-pro-v2.md`.

**Stack** : N8N 2.10.3 (Docker, image pinnée, TZ Europe/Paris), Discord Webhooks (Components V2), OpenRouter (Mistral Small 3.2 + Mistral Large), JavaScript

## Structure

| Dossier/Fichier | Rôle |
|-----------------|------|
| `docker-compose.yml` | N8N self-hosted |
| `n8n-data/` | Volume persistant N8N (non versionné) |
| `workflows/src/*.js` | **Source de vérité** : code des 18 Code nodes de la v2 |
| `workflows/build_v2.py` | Builder → génère `veille-pro-v2.json` (`--test` / `--preprod`) |
| `workflows/src-parlia/*.js`, `workflows/build_parlia.py` | Veille ParlIA : son code et son builder → `veille-parlia.json` (`--test`) — `docs/veille-parlia.md` |
| `workflows/*.json` | Exports/artefacts d'import n8n |
| `docs/veille-pro-v2.md` | Architecture v2, sources auditées, pièges connus |

## Règles N8N (v2.10.3, vérifiées)

- Workflow v2 : ne JAMAIS éditer le JSON à la main → modifier `workflows/src/*.js` puis `python3 workflows/build_v2.py` et réimporter (`docker exec veille-tech-n8n-n8n-1 n8n import:workflow --input=...`)
- Code nodes en **JavaScript** ; sandbox task runner : PAS de `new URL()`, pas de `$env`/`process.env` — `$now` (Luxon) et `$getWorkflowStaticData` OK
- staticData sauvegardé seulement en fin d'exécution réussie d'un workflow actif (les exécutions CLI persistent aussi)
- Test CLI sans toucher l'instance : `docker exec -e N8N_RUNNERS_BROKER_PORT=5699 -e N8N_PORT=5698 veille-tech-n8n-n8n-1 n8n execute --id <ID>` (nécessite un Manual Trigger dans le workflow)
- `docker compose restart` ne recharge PAS les env vars → `down && up -d`
- ⚠️ Clé API n8n (`.mcp.json`) expirée depuis avril 2026 → n8n-mcp HS, passer par le CLI docker ; à régénérer dans Settings → n8n API
- Toujours consulter la doc N8N via Context7 avant de guider sur les nœuds

## Workflows en production

| Workflow | ID | État |
|----------|----|------|
| Veille Pro v2, avec le rattrapage du résumé et du bilan | `VeilleProV2story` | **actif** — 8 h, 13 h et 18 h 30, en retard quand le Mac dort ; la v3 (59 nœuds : collecte au réveil du Mac, brief après 8 h 30, bilan le dimanche) la remplacera |
| Veille Stack (26 nœuds) | `VeilleStackHlmr1` | **actif** — 9h30 Paris, digest lundi ; org via `GITHUB_STACK_ORG`, token `GITHUB_STACK_TOKEN`, sortie `DISCORD_WEBHOOK_STACK` |
| Error Handler - Discord Alert | `yrUX1IcjTyIwpWqG` | actif |
| Veille ParlIA (37 nœuds) | `VeilleParlIAprod` | **actif** depuis le 4 novembre 2026 ; les corrections du 15 novembre (consigne, extraits et dates, lecture des originaux) attendent d'être réimportées ; essai : `VeilleParlIAtest` — `docs/veille-parlia.md` |
| Veille Pro v1 | `OfUjCc9fcrInTX3M` | désactivé (rollback) |
| Brief Simplon phases 1-2 | — | désactivés (archive) |

⚠️ Veille Stack : `workflows/src-stack/config-stack.js` et les JSON générés contiennent des détails
internes de la plateforme surveillée → **gitignorés** (le repo est public). Template : `config-stack.example.js`.

## Discord

- 9 webhooks dans `.env` (CRITIQUE, IA, DEV, CLOUD, SECURITE, TENDANCES, DIGEST, HEBDO, STATUS)
- Messages **Components V2** : URL webhook + `?with_components=true&wait=true`, flag `36864` (CV2 + silencieux) — le message ne contient QUE `components` (jamais content/embeds avec ce flag)
- #critique reste en embeds classiques + `@here` (seul canal notifiant) ; #status reçoit les métriques du funnel à chaque run

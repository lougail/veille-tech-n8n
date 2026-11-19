# Veille Tech N8N + Discord

Automatisation de veille technologique avec N8N (self-hosted) et Discord.
**v3 en service** : le workflow `VeilleProV2story` contient la v3 depuis son import du 5 novembre 2026, sous le nom « Veille Pro — labos, bruit et brief » depuis le 19 novembre (avant : « Veille Pro v2 — Stories & Tendances ») : les publications des labos, les radars de nouveaux modèles, les capteurs de bruit et le brief du matin — `docs/veille-v3.md`. Architecture de base (stories, chaleur, Components V2) : `docs/veille-pro-v2.md`.

**Stack** : N8N 2.48.5 depuis le 18 novembre 2026 (Docker, image pinnée, TZ Europe/Paris, planificateur en mémoire), Discord Webhooks (Components V2), OpenRouter (Mistral Small 3.2 + Mistral Large), JavaScript

## Structure

| Dossier/Fichier | Rôle |
|-----------------|------|
| `docker-compose.yml` | N8N self-hosted |
| `n8n-data/` | Volume persistant N8N (non versionné) |
| `workflows/src/*.js` | **Source de vérité** : code des 18 Code nodes de la v2 |
| `workflows/build_v2.py` | Builder → génère `veille-pro-v2.json` (`--test` / `--preprod`) |
| `workflows/src-parlia/*.js`, `workflows/build_parlia.py` | Veille ParlIA : son code et son builder → `veille-parlia.json` (`--test`) — `docs/veille-parlia.md` |
| `workflows/*.json` | Exports/artefacts d'import n8n |
| `outils/etat-prod.mjs` (`npm run etat`) | Ce qui tourne dans n8n est-il la version du dépôt ? Compare les versions publiées aux builds, donne le dernier passage et l'état Git ; ne modifie rien |
| `docs/veille-pro-v2.md` | Architecture v2, sources auditées, pièges connus |

## Règles N8N (v2.48.5, vérifiées le 18 novembre 2026)

- Workflow v2 : ne JAMAIS éditer le JSON à la main → modifier `workflows/src/*.js` puis `python3 workflows/build_v2.py` et réimporter (`docker exec veille-tech-n8n-n8n-1 n8n import:workflow --input=...`), puis `n8n publish:workflow --id=<ID>` : appliqué en ~15 s sans redémarrage (2.48.5) ; l'import garde la mémoire (staticData) tant que le JSON n'en contient pas. Ensuite `npm run etat` : tout doit être ✅
- Code nodes en **JavaScript** ; sandbox task runner : PAS de `new URL()`, pas de `$env`/`process.env` — `$now` (Luxon) et `$getWorkflowStaticData` OK
- staticData sauvegardé seulement en fin d'exécution réussie d'un workflow actif (les exécutions CLI persistent aussi)
- Test CLI sans toucher l'instance : `docker exec -e N8N_RUNNERS_BROKER_PORT=5699 -e N8N_PORT=5698 veille-tech-n8n-n8n-1 n8n execute --id <ID>` (nécessite un Manual Trigger dans le workflow)
- `docker compose restart` ne recharge PAS les env vars → `down && up -d`
- Planificateur : l'ancien, en mémoire, gardé par `N8N_SCHEDULER_ENABLED=false` (docker-compose.yml) : il lance le passage manqué quand son minuteur arrive au bout ; le planificateur « durable », par défaut depuis 2.45, le jetterait (Stack, à 9 h 30, aurait perdu 5 passages sur 7). n8n le déclare déprécié : à revoir avant n8n 3 ; Stack archivée, les deux veilles passent toutes les 30 min, le planificateur par défaut est à essayer sur une copie
- ⚠️ Un minuteur de n8n ne compte que le temps où le Mac est allumé (la VM d'OrbStack s'arrête avec lui) : un déclencheur espacé de plusieurs heures part des heures après le réveil. Les déclencheurs passent donc toutes les 30 min, jour et nuit, et le code décide s'il y a du travail (de 7 h à 23 h) — `docs/veille-parlia.md`, « Les passages, jour et nuit »
- Une pause « Wait » de moins de 65 s reste en mémoire (2.48.5) ; un nœud qui continue en cas d'erreur est relancé par `retryOnFail` quand son premier élément porte l'erreur
- ⚠️ JAMAIS ouvrir `n8n-data/database.sqlite` depuis le Mac (sqlite3, python, DB Browser) pendant que n8n tourne, même en lecture seule : les verrous de SQLite ne traversent pas la VM d'OrbStack, le sqlite du Mac remet à zéro le fichier `-shm` et n8n meurt (SIGBUS, 18 novembre 2026). Lire depuis le conteneur (`docker exec … node` avec le module sqlite3 de n8n), une copie faite par le conteneur (`VACUUM INTO`, comme `outils/rendement-sources.py`), ou la base d'un n8n arrêté. Sans risque : `n8n export:workflow` et les journaux `n8n-data/n8nEventLog*.log`
- Mettre n8n à jour : d'abord sur une copie de la base (`VACUUM INTO` fait par le conteneur, ou n8n arrêté ; workflows désactivés, second conteneur sur un autre port, sans webhooks) — `docs/veille-parlia.md`, « La mise à jour de n8n »
- ⚠️ Clé API n8n (`.mcp.json`) expirée depuis avril 2026 → n8n-mcp HS, passer par le CLI docker ; à régénérer dans Settings → n8n API
- Toujours consulter la doc N8N via Context7 avant de guider sur les nœuds

## Workflows en production

| Workflow | ID | État |
|----------|----|------|
| Veille Pro — labos, bruit et brief (la v3, 59 nœuds) | `VeilleProV2story` | **actif** depuis le 5 novembre 2026 — passage toutes les 30 min, jour et nuit (depuis le 19 novembre) ; collecte de 7 h à 23 h, au plus toutes les 3 h ; brief après 8 h 30, bilan le dimanche |
| Veille Stack (26 nœuds) | `VeilleStackHlmr1` | archivée le 19 novembre 2026, au choix de Louis : en panne depuis au moins le 12 novembre (GitHub refusait le jeton et Discord le webhook, 401, et l'exécution se disait réussie, `continueOnFail`). Son code reste ici ; pour la relancer : un jeton (`GITHUB_STACK_TOKEN`, org `GITHUB_STACK_ORG`) et un webhook (`DISCORD_WEBHOOK_STACK`) valides, `python3 workflows/build_stack.py`, import, publication, et la remettre dans `WORKFLOWS` d'`outils/etat-prod.mjs` |
| Error Handler - Discord Alert | `yrUX1IcjTyIwpWqG` | actif |
| Veille ParlIA (39 nœuds) | `VeilleParlIAprod` | **actif** depuis le 4 novembre 2026 ; la version du 18 novembre (arXiv sur 14 jours, matière de la synthèse mensuelle, et les trois erreurs de la semaine 47 : annonces anciennes des pages, prix des modèles suivis, doublons d'un même éditeur) en service depuis le 18 novembre ; passages jour et nuit depuis le 19 novembre ; essai : `VeilleParlIAtest` — `docs/veille-parlia.md` |
| Veille Pro v1 | `OfUjCc9fcrInTX3M` | archivé le 18 novembre 2026 |
| Brief Simplon phases 1-2 (« RSS -> Discord », « LLM Veille -> Discord ») | `4loivX52UgWdVVmf`, `yoigEpQm19BRiixF` | archivés le 18 novembre 2026 |
| Copies d'essai, rejeu de la semaine 46 | `VeilleProV2test01`, `VeilleParlIAtest`, `VeilleParlIArejeu` | archivés le 18 novembre 2026 ; l'import d'un build `--test` ressort la copie d'essai |

Les workflows archivés restent dans n8n (filtre « Show archived workflows »), et leur export dans `sauvegardes/2026-11-18-archives/` (ignoré par Git).

⚠️ Veille Stack : `workflows/src-stack/config-stack.js` et les JSON générés contiennent des détails
internes de la plateforme surveillée → **gitignorés** (le repo est public). Template : `config-stack.example.js`.

## Discord

- 9 webhooks dans `.env` (CRITIQUE, IA, DEV, CLOUD, SECURITE, TENDANCES, DIGEST, HEBDO, STATUS)
- Messages **Components V2** : URL webhook + `?with_components=true&wait=true`, flag `36864` (CV2 + silencieux) — le message ne contient QUE `components` (jamais content/embeds avec ce flag)
- #critique reste en embeds classiques + `@here` (seul canal notifiant) ; #status reçoit les métriques du funnel à chaque run

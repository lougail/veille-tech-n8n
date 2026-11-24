# n8n : l'instance qui fait tourner les veilles

Mise à jour du 19 novembre 2026. n8n tourne sur le Mac, dans Docker (OrbStack), à partir de ce dépôt :
`docker-compose.yml`, ses réglages dans `.env` (non versionné), ses données dans `n8n-data/` (non versionné).
On l'ouvre à l'adresse http://localhost:5678.

## Ce qui tourne

| Workflow | Identifiant | Son code |
|---|---|---|
| Veille Pro — labos, bruit et brief (la veille personnelle) | `VeilleProV2story` | ce dépôt : `workflows/src/` et `workflows/build_v2.py` ; `docs/veille-v3.md` |
| Veille ParlIA — préparation de la semaine | `VeilleParlIAprod` | le projet ParlIA, dépôt privé certification-dev-ia-2027 : `04-apprentissage/VEILLE/bot/` et son README |
| Error Handler - Discord Alert | `yrUX1IcjTyIwpWqG` | ce dépôt : `workflows/error-handler.json` |

Les workflows archivés restent dans n8n (filtre « Show archived workflows ») : Veille Stack, le 19 novembre 2026 ;
Veille Pro v1, les deux workflows du brief Simplon, les copies d'essai et le rejeu de la semaine 46, le 18 novembre.
Leurs exports sont dans `sauvegardes/2026-11-18-archives/`, ignoré par Git.

## Savoir ce qui tourne

`npm run etat` reconstruit chaque workflow à partir de son dépôt, le compare à la version publiée dans n8n et donne
son dernier passage. Il donne aussi l'état Git de ce dépôt et du dossier du bot ParlIA : fichiers non enregistrés,
commits absents de GitHub. Il ne modifie rien. Un ✅ devant un workflow veut dire que ce qui tourne est la version de
son dépôt. Le dossier du bot est lu dans `.env` : `PARLIA_BOT_DIR`, sinon `PARLIA_NOTES_DIR` suivi de `/bot`.

## Mettre en ligne une nouvelle version

Après les tests (`npm test`), et hors des minutes de passage (la veille personnelle passe aux minutes 0 et 30,
ParlIA aux minutes 15 et 45) :

1. construire le workflow ;
2. le copier dans le conteneur ;
3. l'importer : n8n le dépublie, et garde sa mémoire tant que le fichier n'en contient pas ;
4. le publier : depuis n8n 2.48.5, il tourne dans sa nouvelle version 15 secondes plus tard environ, sans redémarrer ;
5. vérifier : un ✅ devant le workflow.

Pour la veille personnelle :

~~~bash
python3 workflows/build_v2.py
docker cp workflows/veille-pro-v2.json veille-tech-n8n-n8n-1:/tmp/v2.json
docker exec veille-tech-n8n-n8n-1 n8n import:workflow --input=/tmp/v2.json
docker exec veille-tech-n8n-n8n-1 n8n publish:workflow --id=VeilleProV2story
npm run etat
~~~

Pour ParlIA : le README du bot, « Installer », étape 5.

## La mise à jour de n8n, le 18 novembre 2026

De 2.10.3 à 2.48.5, la version « stable » de n8n ce jour-là (sur Docker Hub, `stable` et `latest` désignent 2.48.5 ;
la 3.x est une version majeure). Elle corrige les avis de sécurité du 28 octobre (GHSA-prmc-fg87-r4gh,
GHSA-f2cw-9483-7vcp, GHSA-9p7v-45m2-wxgj) et du 13 novembre (GHSA-c772-hjfp-gfc2, GHSA-h59h-rf6m-7jp5,
GHSA-q8rc-7m84-mfvj, jugé élevé, GHSA-g333-hr44-g82p). La liste des changements incompatibles de n8n
(`BREAKING-CHANGES.md`) ne signale rien qui touche ces workflows.

- **D'abord sur une copie.** La base copiée, les workflows désactivés, dans un second conteneur sur un autre port,
  sans webhooks : 202 migrations sans erreur ; le bot ParlIA en mode test, avec la vraie mémoire, a tout fait (18 flux,
  16 pages et API, 46 nouveaux articles, 4 demandes de tri, 8 fiches, 7 originaux sur 8 lus et résumés, fichier
  écrit). Deux appels à OpenRouter sont d'abord restés sans réponse (« Provider timed out ») : un appel s'arrête
  désormais après 90 secondes, et n'est refait qu'une fois avant que le nœud le relance (`build_parlia.py` du bot).
- **Le planificateur.** Depuis 2.45, n8n planifie par défaut avec un planificateur « durable », qui jette un passage
  en retard de plus d'une minute : le Mac endormi, la veille Stack de 9 h 30 aurait perdu 5 de ses 7 passages du 11
  au 18 novembre. `N8N_SCHEDULER_ENABLED=false` (`docker-compose.yml`) garde l'ancien, qui lance le passage manqué
  quand son minuteur arrive au bout (vérifié sur la copie) ; ce minuteur ne compte que le temps où le Mac est allumé
  (section suivante). n8n le déclare déprécié : voir « Avant n8n 3 », plus bas.
- **Le reste, vérifié** : une pause « Wait » de moins de 65 secondes reste en mémoire ; `retryOnFail` relance bien un
  nœud qui continue en cas d'erreur ; le temps maximal d'un nœud Code reste de 300 secondes
  (`N8N_RUNNERS_TASK_TIMEOUT`), la lecture des pages et des originaux pouvant dépasser la minute.
- **Trouvé le lendemain** : depuis 2.48.5, le nœud de lecture de fichiers prend `[ ]` et `( )` pour des caractères
  ordinaires (option « Treat Brackets and Parentheses as Literal », activée par défaut). « Lire les préparations », dans ParlIA
  (`[0-9]*-preparation.md`) ne trouvait plus rien, sans autre signe qu'une erreur tolérée : la préparation du
  23 novembre aurait marqué chaque séance « préparation du bot introuvable » dans le bilan des sources. Le sélecteur
  est devenu `*-preparation.md`, et le nœud Notes écarte les essais. C'est la seule régression : chaque nœud de ParlIA
  et de la veille personnelle a été comparé, erreur par erreur, sur leurs exécutions du 11 au 19 novembre.
- **La base ne s'ouvre jamais depuis le Mac pendant que n8n tourne**, même en lecture seule. Le 18 novembre, à
  11 h 32, une lecture faite depuis le Mac a fait tomber n8n (SIGBUS ; l'exécution en cours de la veille personnelle
  notée « crashed », rien de perdu) : les verrous de SQLite ne traversent pas la machine virtuelle d'OrbStack, et le
  sqlite du Mac, se croyant seul, a remis à zéro la mémoire partagée de la base (`-shm`). Lire depuis le conteneur, ou
  une copie faite par le conteneur (`VACUUM INTO`, comme `outils/rendement-sources.py`), ou la base d'un n8n arrêté.
  `n8n export:workflow` et les journaux `n8n-data/n8nEventLog*.log` se lisent sans risque.
- **La sauvegarde** : `sauvegardes/2026-11-18-avant-2.48.5/` (la base et le fichier `config`, copiés n8n arrêté),
  ignorée par Git, à garder deux semaines. Pour revenir en arrière : `docker compose down`, mettre de côté la base
  actuelle, recopier la sauvegarde dans `n8n-data/`, remettre `n8nio/n8n:2.10.3` dans `docker-compose.yml`, puis
  `docker compose up -d`. Ne jamais lancer 2.10.3 sur la base migrée.

## Les passages, jour et nuit, le 19 novembre 2026

Le 19 novembre, Mac rallumé à 9 h 02, aucune des deux veilles n'était encore passée à 9 h 30 : leurs passages
seraient partis vers 11 h 20 et 11 h 35. Un minuteur de n8n compte le temps de la machine virtuelle d'OrbStack, qui
s'arrête quand le Mac dort : ce matin-là, elle comptait 12 heures depuis son démarrage, alors que n8n tournait depuis
plus de 18 heures. Le dernier passage du soir réglait le suivant 8 h 30 plus tard, et ces 8 h 30 ne s'écoulaient que
Mac allumé. Le calcul « minuteur arrêté pendant le sommeil », fait sur le journal de veille du Mac (`pmset -g log`),
retrouve à la minute près les départs du 13 novembre (prévu à 7 h 15, parti à 14 h 29), du 14 (prévu à 8 h 45, parti
à 11 h 35) et du 18 (prévu à 20 h 45, parti à 22 h 48). Le premier passage du 17 novembre de la veille personnelle
est parti à 15 h 24.

Depuis le 19 novembre, les deux veilles passent toutes les 30 minutes, jour et nuit : le premier passage suit le
réveil de 30 minutes au plus. La nuit, de 23 h à 7 h, « Que faire ? » (ParlIA) et « Collecte due ? » (veille
personnelle) ne font rien. La veille Stack, qui passait une fois par jour à 9 h 30, en souffrait le plus : son passage du
16 novembre est parti le 17 à 17 h 54. Elle est archivée depuis le 19 novembre au soir.

## Avant n8n 3

Le planificateur en mémoire, gardé par `N8N_SCHEDULER_ENABLED=false`, est déprécié. Depuis l'archivage de Stack,
les deux veilles passent toutes les 30 minutes, jour et nuit : avec le planificateur par défaut, un passage jeté
pendant le sommeil du Mac devrait être suivi d'un autre au plus 30 minutes après le réveil. À vérifier sur une copie
de la base, comme pour la mise à jour (section « La mise à jour de n8n »), avant de retirer cette variable de
`docker-compose.yml`.

Le task runner, qui exécute les nœuds Code, tourne dans le conteneur de n8n (mode interne). n8n annonce à chaque
démarrage que ce mode sera retiré (`N8N_RUNNERS_MODE`, n8n 2.48.5, 21 novembre 2026). Le mode externe demande un
second conteneur, l'image `n8nio/runners` de la même version, et un jeton partagé (`N8N_RUNNERS_AUTH_TOKEN`).
À essayer aussi sur une copie de la base, avec les tests CLI des deux veilles.

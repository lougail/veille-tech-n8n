# Veille ParlIA — la séance de la semaine, préparée par le bot

Mise à jour du 3 novembre 2026. Le workflow « Veille ParlIA » (`VeilleParlIAprod`, 33 nœuds) prépare chaque
semaine la séance de veille du projet ParlIA : Louis la tient pour l'épreuve E2 de sa certification (une heure de
veille par semaine, une note datée par séance). Le bot collecte, trie et prépare ; Louis lit les originaux, classe
chaque point (rien, à surveiller, décision à ouvrir) et écrit la note. Le code est dans `workflows/src-parlia/`,
assemblé par `workflows/build_parlia.py`. Le workflow a sa propre mémoire : la veille personnelle (v2 en service,
v3) ne change pas.

**État** : prêt, vérifié par `npm test` ; pas encore importé dans n8n, ni essayé en vrai.

Thème : « Étiqueter les questions écrites du Sénat avec un modèle de langage commercial : choisir, mesurer et pouvoir
remplacer le fournisseur, dans le respect du RGPD et du règlement européen sur l'IA. » Quatre axes : fournisseurs et
coûts, qualité de l'étiquetage, conformité, exploitation.

## Ce que fait le circuit

~~~text
Toutes les 30 min, de 7 h 15 à 22 h 45, quand le Mac est allumé
  └─ Que faire ? (planifier-parlia.js) : chaque tâche part au premier passage après son heure, une seule fois
      ├─ Collecte : au plus toutes les 4 h, et juste avant la préparation
      │    18 flux RSS ; une fois par jour, 12 pages sans flux et 4 API (OpenRouter, data.gouv.fr, Hugging Face)
      │    → Normaliser : tout ce qui est paru depuis la dernière collecte réussie, sans doublon, santé des sources
      │    → Tri par Mistral Small 3.2, par lots de 12 → Lire le tri : contrôles, plafonds, tri de secours
      │    → Registre (16 jours)
      │    → Journal officiel (archives de la DILA) → Alertes immédiates → Discord
      ├─ Notes de séance : relues sans écriture, seulement avant la préparation ou le rappel
      ├─ Préparation : au premier passage à partir du lundi 6 h, de 10 à 15 fiches
      │    → fichier AAAA-MM-JJ-preparation.md → Discord : ouverture, fiches guidées, réserve
      ├─ Rappel : au premier passage à partir du jeudi 16 h 30, si les notes ne montrent pas la séance de la semaine
      └─ Statut → #status, en silence sauf problème
~~~

Le Mac dort souvent : rien n'a d'heure fixe. Mac éteint le lundi, la préparation part au premier réveil, jusqu'au
dimanche ; la collecte reprend tout ce qui est paru depuis la dernière collecte réussie (14 jours au plus).

### Les sources

Les 32 sources « à retenir » de l'étude des sources du 29 octobre 2026 (§4.1), plus un détecteur à l'essai.

| Fichier | Ce qu'il lit |
|---|---|
| `sources-parlia.js` | 18 flux : journal d'OpenRouter ; OpenAI (filtré sur l'API) ; notes de version d'Anthropic ; Mistral ; Google « Developer tools » ; Simon Willison (filtré) ; journal de Workers AI (Cloudflare) ; trois requêtes arXiv ciblées (étiquetage par modèle de langage, modèles de décision et calibration, textes parlementaires ou administratifs) ; Hamel Husain ; Hugging Face (filtré) ; CNIL ; CEPD ; Commission européenne (filtrée sur l'IA) ; dossier de la loi DDADUE au Sénat ; data.senat.fr. Les communiqués de l'Élysée ne sont jamais triés : ils servent de détecteur de remaniement de secours |
| `collecte-pages-api.js` | Une fois par jour : 12 pages sans flux (journaux et pages de retraits d'OpenAI, d'Anthropic, de Mistral et de Google ; blog et page des modèles de TypeSafe ; Liquid AI ; service d'assistance et Bureau de l'IA de la Commission ; dossier DDADUE à l'Assemblée), le catalogue d'OpenRouter, la fiche data.gouv.fr des questions du Sénat, les comptes Hugging Face de Cloudflare et de Perplexity |
| `jorf-parlia.js` | Les archives quotidiennes du Journal officiel, deux par jour |

Une page sans flux est comparée à celle de la veille : les lignes nouvelles qui se suivent forment un article. Le
premier passage apprend la page sans rien proposer ; une page qui perd plus de 70 % de ses lignes est une panne, une
page dont plus de 40 % des lignes changent a été refaite et n'est pas proposée. Le catalogue d'OpenRouter donne les
nouveaux modèles des fournisseurs du thème et, pour la liste de suivi (GPT-6 Luna, Claude Haiku 5.5, Mistral
Small 3.2, GPT-4o mini, GPT-6.1 Terra, Gemini 4 Argon), les changements de prix, les retraits annoncés et les
disparitions : ces drapeaux sont calculés par le programme, le tri ne peut pas les oublier.

### Le tri

La consigne (`consigne-tri-parlia.js`) reprend mot pour mot celle de l'étude (§5.2) : le projet, le thème et ses
axes, un barème de pertinence sur 10, des plafonds, trois exemples, la liste de suivi. Pour chaque article, Mistral
Small 3.2 propose un axe, une note, une hypothèse au conditionnel (« ce que ça pourrait changer pour ParlIA »), la
nature de la source, un résumé de deux lignes, ce qu'il faut chercher dans l'original, quatre drapeaux et une date
d'effet.

Le programme vérifie ce qu'il vérifie mieux que le modèle (`lire-tri-parlia.js`, §5.3) :

- un axe ou une nature hors des listes, ou une note qui n'est pas un entier de 0 à 10 : la proposition est
  rejetée, et l'article reçoit un tri de secours, marqué comme tel ;
- les plafonds : 6 pour une source non primaire, 8 pour une prépublication arXiv, 2 pour une annonce d'éditeur
  publiée hors de son domaine officiel (un site qui imite TypeSafe, par exemple) ;
- les drapeaux calculés par le programme l'emportent sur ceux du modèle ;
- la réponse brute et la version de la consigne sont gardées avec l'article, pour pouvoir rejouer le tri.

Coût : environ 85 articles par semaine, une dizaine de demandes, moins de 5 centimes de dollar par mois.

### La sélection

`selection-parlia.js` applique les règles de l'étude (§6.2) aux articles triés depuis la dernière préparation :

1. toujours un texte de la CNIL ou du CEPD, même noté bas, rappelé sur sa ligne ;
2. toujours les drapeaux vérifiés : retrait ou prix d'un modèle suivi, nouveau modèle de décision annoncé par une
   source primaire, échéance réglementaire avant le 31 janvier 2027 ;
3. les notes de 6 ou plus, par ordre décroissant ; moins de 10, on complète avec les meilleures notes de 5 ; jamais
   plus de 15 ;
4. au moins 2 articles par axe quand l'axe en a de notés 5 ou plus, au plus 5 ;
5. au plus 3 prépublications arXiv et 2 articles d'une même source ;
6. un événement, une ligne : la source primaire en tête, « couvert aussi par » ensuite ;
7. les points « à surveiller » de la dernière séance reviennent en tête, hors quota (lus dans les notes, voir plus
   bas) ;
8. hors thème : jamais.

Le reste, noté 4 ou plus, va dans la réserve. Les échéances des 90 jours suivants (retraits de modèles, dates du
règlement IA) sont rappelées en pied de préparation.

### Le fichier de préparation

`preparation-parlia.js` écrit `AAAA-MM-JJ-preparation.md`, à la date du jour, dans le dossier monté sur
`/home/node/.n8n-files/parlia`. Il suit la partie « Préparation » des notes de séance, pour que l'assistant puisse
la reprendre telle quelle :

- en tête, « Depuis la dernière séance » : la dernière séance tenue, celle de la semaine précédente, ses points
  « à surveiller » et la piste notée ;
- « Sources interrogées », « Candidats, par axe » en tableaux, « Ce qui n'a pas pu être vérifié » ;
- les fiches guidées : deux lignes, ce qu'il faut chercher dans l'original, deux questions (« Qu'est-ce qui sort ? »,
  « Est-ce que ça pourrait servir à ParlIA ? »), l'hypothèse du tri, le lien ;
- la réserve, les échéances des 90 jours, les alertes depuis la dernière préparation.

Le fichier est signé et daté : c'est le travail du bot, pas une lecture. Le bot ne commite jamais : aucun dossier
`.git` n'est monté dans le conteneur. Le fichier entre dans Git avec la note de séance, par le commit de Louis.

### Discord

Tout passe par un webhook, `DISCORD_WEBHOOK_PARLIA`. Sans lui, rien n'est publié : le fichier reste la seule trace.

- **Salon forum** (`DISCORD_PARLIA_FORUM=1`) : le message d'ouverture crée le post de la semaine
  (« Semaine 45 · du 2 au 8 novembre 2026 ») ; les fiches, la réserve et le rappel y vont. Une alerte va dans le post
  de la semaine s'il existe, sinon dans un post à elle.
- **Salon texte** (`DISCORD_PARLIA_FORUM=0`) : les messages se suivent dans le salon.
- L'ouverture notifie, avec la mention de Louis si `PARLIA_DISCORD_MENTION` est réglé : la semaine, par où
  commencer, les fiches par axe, les points « à surveiller », la piste, la CNIL et le CEPD, les échéances. Les fiches
  suivent en silence (Components V2), chacune avec un bouton « Lire l'original » ; puis la réserve, en liste de
  liens.
- Si Discord refuse l'ouverture (réseau absent au réveil, webhook supprimé), rien d'autre ne part : la préparation
  repart au passage suivant, trois fois au plus dans la semaine.
- Le bot ne lit pas Discord : un webhook publie, il ne lit rien. Les réponses de Louis sous le message de la
  semaine (« 2 décision : … », « 5 rien ») servent à la séance ; le classement se recopie dans la note.

### Les notes de séance

Le dossier des notes est monté en lecture seule. `notes-parlia.js` lit les fichiers `AAAA-MM-JJ-seance-NN.md`
et n'en tire que trois choses.

- **Les séances tenues.** Une séance compte comme tenue quand la ligne « Date » du tableau « Séance » porte une date
  AAAA-MM-JJ déjà passée, sans repère « [À REMPLIR …] », « [À COMPLÉTER …] » ni « [EN COURS …] » : une note
  préparée à l'avance ne compte pas. Elle appartient à la semaine de sa première date : la séance 01, tenue les
  29 octobre et 2 novembre 2026, est celle de la semaine du 26 octobre.
- **Les points « à surveiller »** de la dernière séance tenue : les lignes du tableau « Ce que ça change… » dont le
  classement commence par « à surveiller », avec le titre du point retenu. Pour garder un point au-delà, la séance
  suivante le reclasse « à surveiller » dans sa propre note.
- **La « Prochaine piste »** de cette séance.

Le rappel du jeudi ne part pas si une séance de la semaine est notée. Sans notes lisibles (dossier non monté ou
vide), il part quand même, avec « si c'est fait, ignore ce message », et le fichier demande de reprendre les points
à la main.

### Les alertes immédiates

`jorf-parlia.js` lit chaque archive nouvelle du Journal officiel, mais seulement les décrets publiés depuis
l'archive précédente : les archives republient d'anciens textes, et un filtre sur le seul titre aurait sonné 27 fois
en octobre 2026, contre aucune fois avec la date de publication (étude, §6.3).

- **Remaniement** : un décret « relatif à la composition du Gouvernement » ou « portant nomination du Premier
  ministre ». À faire : vérifier la table des ministères de ParlIA, puis attendre les décrets d'attributions.
- **Attributions** : un décret « relatif aux attributions du ministre » (de la ministre, du secrétaire d'État…).
  C'est lui qui fixe les périmètres, donc la table de correspondance de ParlIA ; en 2025, il est paru deux semaines
  après la composition.
- **Secours** : un communiqué de l'Élysée sur la nomination ou la composition du Gouvernement.
- **Retrait d'un modèle suivi** annoncé à moins de 90 jours, par le catalogue d'OpenRouter ou par un texte trié.

Les alertes d'un passage partent dans un seul message, une seule fois (120 jours de mémoire), et restent 60 jours
dans le journal que reprend le fichier de la semaine.

### La surveillance

- **#status** (`DISCORD_WEBHOOK_STATUS`, le même que la veille personnelle) : quelques lignes à chaque passage
  utile, à l'heure de Paris, en silence. Le message sonne s'il y a un problème : une source en échec trois fois de
  suite (une seule alerte, puis « de retour » au premier succès), le fichier non écrit, un envoi refusé par Discord.
- **Plantage** : le workflow d'erreur déjà en place (`yrUX1IcjTyIwpWqG`) est désigné dans les réglages, sans
  être modifié ; il poste dans #status.
- **Mémoire** : elle n'est enregistrée qu'après une exécution réussie ; une exécution qui échoue ne perd rien, la
  suivante repart de la dernière collecte réussie.

La mémoire du workflow garde : la date de la dernière collecte, les adresses déjà vues (45 jours), la santé des
sources, le registre des articles triés (400 au plus, 16 jours), les échéances, les empreintes des pages sans flux,
l'état du catalogue d'OpenRouter, de data.gouv.fr et de Hugging Face, la dernière archive lue du Journal officiel,
les alertes envoyées et la préparation de la semaine.

## Installer

### 1. Le salon Discord et son webhook

1. Dans le serveur Discord, créer le salon `#veille-parlia` : un **forum** (un post par semaine, recommandé) ou un
   salon texte.
2. Paramètres du salon → Intégrations → Webhooks → Nouveau webhook → Copier l'URL du webhook.
3. Pour la mention : activer le mode développeur (Paramètres utilisateur → Avancés), puis clic droit sur son nom →
   Copier l'identifiant de l'utilisateur.

### 2. Les variables, dans `.env`

| Variable | Valeur | Par défaut |
|---|---|---|
| `DISCORD_WEBHOOK_PARLIA` | l'URL du webhook du salon | vide : rien n'est publié |
| `DISCORD_PARLIA_FORUM` | 1 pour un forum, 0 pour un salon texte | 0 |
| `PARLIA_DISCORD_MENTION` | l'identifiant Discord à mentionner (des chiffres) | vide : aucune mention |
| `PARLIA_EXPORT_DIR` | le dossier du Mac où le bot écrit ses préparations | `./exports/veille-parlia` |
| `PARLIA_NOTES_DIR` | le dossier du Mac où sont les notes de séance | `./exports/veille-parlia-notes`, vide |
| `PARLIA_PREPARATION_JOUR`, `PARLIA_PREPARATION_HEURE` | jour (1 = lundi) et heure de la préparation | 1 et 06:00 |
| `PARLIA_RAPPEL_JOUR`, `PARLIA_RAPPEL_HEURE` | jour et heure du rappel | 4 et 16:30 |
| `PARLIA_COLLECTE_HEURES` | une collecte toutes les N heures au plus | 4 |
| `PARLIA_CANDIDATS_MIN`, `PARLIA_CANDIDATS_MAX` | le nombre de fiches | 10 et 15 |

`.env` n'est pas suivi par Git : les chemins du Mac et le webhook n'entrent jamais dans le dépôt public.

### 3. Les dossiers

`docker-compose.yml` monte deux dossiers dans le conteneur, sous `~/.n8n-files`, le seul endroit où n8n 2.x lit
et écrit :

- `PARLIA_EXPORT_DIR` sur `/home/node/.n8n-files/parlia`, en écriture : les préparations ;
- `PARLIA_NOTES_DIR` sur `/home/node/.n8n-files/parlia-notes`, **en lecture seule** : les notes de séance.

Par défaut, ce sont deux dossiers du dépôt, `exports/`, ignorés par Git. Pour que la préparation apparaisse dans
Obsidian, `PARLIA_EXPORT_DIR` peut désigner le dossier `VEILLE/preparations/` du coffre de la certification, et
`PARLIA_NOTES_DIR` son dossier `VEILLE/`. Créer d'abord `preparations/` : Docker crée sans prévenir un dossier
qui manque, et une faute de frappe ferait écrire le bot ailleurs. Ne jamais monter la racine du coffre : le bot ne
doit voir ni les autres dossiers ni `.git`.

### 4. Sauvegarder, puis redémarrer n8n

Les montages et les variables ne comptent qu'après `down` puis `up` (`restart` ne relit pas `.env`). Le
redémarrage arrête quelques minutes les autres workflows, sans les modifier. Un matin de semaine, Mac allumé :

~~~bash
SAUVEGARDE="sauvegardes/$(date +%F)-avant-parlia"
docker exec veille-tech-n8n-n8n-1 n8n export:workflow --backup --output=/home/node/.n8n/export-avant-parlia/
docker compose stop                                   # SQLite : arrêter avant de copier
mkdir -p "$SAUVEGARDE" && cp -Rp n8n-data "$SAUVEGARDE/"   # la base, et le fichier config qui garde la clé des identifiants
docker compose down && docker compose up -d
~~~

### 5. Importer et publier

~~~bash
python3 workflows/build_parlia.py
docker cp workflows/veille-parlia.json veille-tech-n8n-n8n-1:/tmp/parlia.json
docker exec veille-tech-n8n-n8n-1 n8n import:workflow --input=/tmp/parlia.json
docker exec veille-tech-n8n-n8n-1 n8n publish:workflow --id=VeilleParlIAprod
docker compose down && docker compose up -d           # la publication ne compte qu'au redémarrage
docker logs veille-tech-n8n-n8n-1 2>&1 | grep -i "activated workflow"
~~~

Le workflow importé arrive non publié. Il utilise l'identifiant OpenRouter de la veille personnelle (« OpenRouter
account ») : rien à créer. Faire d'abord l'essai ci-dessous.

## Essayer en mode test

Le mode test construit un second workflow, `VeilleParlIAtest`, avec sa propre mémoire : un déclencheur manuel, tout
est dû (collecte, pages, Journal officiel, préparation, rappel), les nœuds Discord sont désactivés, le fichier
s'appelle `essai-AAAA-MM-JJ-preparation.md`. Il demande les montages de l'étape 4 : sans eux, le fichier n'est pas
écrit et les notes ne sont pas lues (le message de #status préparé le dit).

~~~bash
python3 workflows/build_parlia.py --test               # workflows/veille-parlia.test.json, ignoré par Git
docker cp workflows/veille-parlia.test.json veille-tech-n8n-n8n-1:/tmp/parlia-test.json
docker exec veille-tech-n8n-n8n-1 n8n import:workflow --input=/tmp/parlia-test.json
docker exec -e N8N_RUNNERS_BROKER_PORT=5699 -e N8N_PORT=5698 veille-tech-n8n-n8n-1 n8n execute --id VeilleParlIAtest
~~~

Ce qu'il faut regarder :

1. le fichier `essai-…-preparation.md` dans le dossier des préparations : la liste des candidats, les fiches, et
   « Depuis la dernière séance » si les notes sont montées ;
2. dans n8n, l'exécution « Veille ParlIA … [TEST] » : les réponses brutes du modèle (« Lire le tri »), les messages
   Discord préparés (sortie de « Préparation »), le message de #status (sortie de « Statut ») ;
3. le tri, comparé au jeu de contrôle de l'étude (§5.4) : même axe, note à un point près, mêmes drapeaux.

Un essai coûte moins d'un centime (quelques demandes à Mistral Small 3.2) et télécharge une archive du Journal
officiel (de 0,1 à 6 Mo). Il peut être relancé autant de fois que nécessaire : il ne publie rien.

## Revenir en arrière

- **Avant la publication** : rien ne tourne. Le workflow importé se supprime dans l'interface, sans effet sur les
  autres.
- **Après** : le dépublier dans l'interface (effet immédiat), ou en ligne de commande, jamais avec `--all` :

  ~~~bash
  docker exec veille-tech-n8n-n8n-1 n8n unpublish:workflow --id=VeilleParlIAprod
  docker compose down && docker compose up -d
  ~~~

- Les deux montages peuvent rester : sans le workflow, rien ne les lit ni ne les écrit. Pour les retirer, enlever
  leurs deux lignes de `docker-compose.yml`, puis `down` et `up`.
- Les fichiers déjà écrits restent dans le dossier des préparations.
- En dernier recours, la sauvegarde de l'étape 4 remet la base telle qu'elle était.

## Ce qui n'a pas pu être vérifié sans n8n

Les nœuds Code sont testés comme n8n les exécute (`npm test`), et les paramètres des autres nœuds ont été vérifiés
dans le code de n8n 2.10.3 (lecture et écriture de fichiers, extraction du texte, conversion en fichier, chaîne LLM).
Restent à voir au premier essai :

- les lectures des pages, des API et des archives du Journal officiel par `helpers.httpRequest` depuis un nœud
  Code : n8n 2.10.3 l'expose, mais une archive arrive en octets à travers le task runner ;
- la décompression d'une vraie archive (jusqu'à 40 Mo une fois ouverte) : durée et mémoire ;
- les droits d'écriture sur le dossier monté à travers OrbStack, et la lecture des notes en lecture seule ;
- les messages Components V2 publiés par webhook dans un post de forum ;
- la qualité du tri : le jeu de contrôle de l'étude n'a pas encore été rejoué.

## Les décisions qui restent à Louis

1. **Forum ou salon texte.** Avis : forum, un post par semaine, facile à retrouver et à montrer.
2. **Où le bot écrit.** Le dossier d'export du dépôt (par défaut, à recopier), ou `VEILLE/preparations/` du coffre.
   Avis : le coffre ; la préparation apparaît dans Obsidian, et le bot n'y écrit que ses fichiers datés.
3. **Monter les notes en lecture seule.** Avis : oui ; c'est ce qui évite un rappel inutile et ramène les points
   « à surveiller ».
4. **La mention.** Avis : oui ; seuls l'ouverture, le rappel et les alertes notifient.
5. **Les jours et heures** : préparation le lundi dès 6 h, rappel le jeudi dès 16 h 30. Avis : garder, et changer
   par `.env` si le rythme ne tient pas.
6. **Quand mettre en service, et la mise à jour de n8n.** Avis : l'essai en mode test, puis la publication, un même
   matin de semaine, sur n8n 2.10.3, où les nœuds ont été vérifiés ; la mise à jour vers 2.45.6 un autre matin, avec
   un nouvel essai.

## Ce qui reste à faire

- Rejouer le jeu de contrôle du tri (étude, §5.5) à chaque changement de la consigne ou du modèle.
- La revue mensuelle des sources (règle 10) : étendre `outils/rendement-sources.py` à ParlIA.
- La matière de la synthèse mensuelle.
- Lire les réponses et les réactions dans Discord : il faudrait un bot Discord et son jeton, un webhook ne lit rien.
- Les sources à l'essai de l'étude (§4.2), hors Élysée.

## Tests

`npm test` lance aussi les tests de ParlIA (`workflows/tests/parlia-*.test.mjs`) : planification, collecte et
normalisation, pages sans flux et API, Journal officiel, tri et registre, sélection, préparation, notes de séance,
envois Discord et #status, outils communs, et le workflow généré (à jour, connexions et ordre d'exécution, aucun
secret ni chemin personnel, mode test).

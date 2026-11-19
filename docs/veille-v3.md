# Veille v3 — les labos, ce qui fait du bruit, et un brief par jour

Refonte du 28 octobre 2026. Le workflow garde son identifiant (`VeilleProV2story`) et sa mémoire ;
le code est dans `workflows/src/`, assemblé par `workflows/build_v2.py`.

## Pourquoi cette refonte

Louis trouvait sa veille peu intéressante. La relecture des 461 sujets notés du 22 au 28 octobre l'a confirmé :

| Constat | Mesure |
|---|---|
| Le bot tournait rarement | Du 15 au 28 octobre, 5 jours sur 14 : les heures fixes (8 h, 13 h, 18 h 30) tombaient souvent quand le Mac dormait |
| Il publiait trop pour être lu | 227 sujets en trois jours de fonctionnement, environ 75 par jour, dans 9 canaux |
| Deux sources prenaient presque la moitié de la place | r/LocalLLaMA 29 %, The Hacker News 15 % (surtout des failles de logiciels d'entreprise) |
| Les publications des labos passaient mal | OpenAI : 5 billets notés, aucun publié (dont le lancement de l'API Decisions, noté 5) |
| AINews avait disparu | Il paraît depuis janvier 2026 dans le flux de Latent Space, dont le bot écartait les numéros comme doublons ; l'ancienne adresse est figée depuis le 9 septembre |
| Hacker News était en panne | La copie hnrss.org répondait 502 (8 échecs sur 14 exécutions, puis deux fois le 28 octobre) |
| Un même événement arrivait en plusieurs messages | Seuls 4 sujets sur 461 rassemblaient plusieurs sources |

Les sources ont été testées le 28 octobre : 289 adresses pour les labos, une centaine pour les capteurs de bruit
et les personnes (code de réponse, nombre d'éléments, date du plus récent, volume sur 30 jours).

## Ce qui change

### Suivre les labos au jour le jour

- **23 flux officiels** (`k: 'lab'`) : OpenAI et OpenAI Developers, Anthropic (actualités, recherche, ingénierie,
  blog Claude, notes de version de la plateforme Claude), Google (IA, DeepMind, développeurs, Gemini), Mistral,
  Meta (newsroom IA et blog), xAI, Cohere, Z.ai, Baidu, Ai2, Apple, NVIDIA Nemotron, Hugging Face. Les plus
  importants sont toujours examinés par le modèle, quel que soit le pré-classement.
- **Radar OpenRouter** (`radar-openrouter.js`) : le catalogue public d'OpenRouter, sans clé, repère chaque nouveau
  modèle de chaque fournisseur, avec son prix et son contexte ; c'est la seule source fraîche pour Moonshot (Kimi),
  MiniMax ou DeepSeek, qui n'ont pas de flux. Il signale aussi les retraits de modèles (`expiration_date`).
- **Radar Hugging Face** (`labos-hf.js`, `map-hf-labos.js`) : les nouveaux modèles à poids ouverts de 25
  organisations de labos. Une seule annonce par famille (les tailles et variantes d'un même modèle), un seuil
  de « j'aime » par organisation, et une mémoire de 120 jours plutôt qu'un filtre sur la date de création, qui
  n'est pas la date de publication (Muse-Spark-Open : créé le 15 septembre, publié vers le 15 octobre).
- Une publication d'un labo est publiée dès qu'elle est notée 6, en carte, dans #ia.

### Savoir au plus vite ce qui fait du bruit

- **Collecte au réveil du Mac** (`collecte-due.js`) : n8n vérifie toutes les 30 minutes, jour et nuit, si une
  collecte est due ; elle ne l'est que de 7 h à 23 h, au plus toutes les trois heures, et une collecte fraîche précède
  le brief du matin. Jour et nuit, parce qu'un minuteur de n8n ne compte que le temps où le Mac est allumé
  (`docs/veille-parlia.md`, « Les passages, jour et nuit »).
- **Hacker News par l'API d'Algolia** (`map-hn.js`) : les articles de plus de 100 points des dernières 48 heures,
  avec leurs points et leurs commentaires.
- **AINews** (`normalize.js`) : chaque numéro, résumé quotidien de ce qui fait du bruit sur X et Reddit, est gardé ;
  ses sujets du jour servent de capteur, et un sujet qu'il cite devient plus chaud (`cluster.js`).
- **Techmeme**, **The Decoder**, **TestingCatalog** (fuites, poids bas), un **flux Reddit groupé** (Reddit n'accepte
  qu'une requête par minute ; `old.reddit.com` renvoie désormais vers la connexion).
- **Des personnes** : Zvi Mowshowitz, Ethan Mollick, Sean Goedecke, Armin Ronacher, Geoffrey Huntley, en plus de
  Simon Willison, Latent Space et les autres déjà suivis.
- Un sujet chaud ou cité par AINews est publié dès qu'il est noté 6, et rejoint la liste « 🔥 » de #tendances.

### Moins de messages, mieux choisis

- **Un événement, un message** : deux titres qui partagent un nom de modèle ou de version (« GPT-6.1 Terra ») et un
  autre mot significatif forment un seul sujet ; la source principale est la plus proche de l'origine (l'annonce
  officielle, puis le radar, puis les notes de version, la presse, et les forums en dernier). Une même source ne
  parle pas deux fois du même événement : deux notes de version datées restent deux sujets.
- **Une même source ne prend pas plus de 15 % du pré-classement.**
- **Seuil de publication** : 7, ou 6 pour un labo ou un sujet qui fait du bruit (avant : 6 pour tout).
- **Une notation revue** (`prompt-classif.js`) : les labos et le bruit en tête ; la sécurité seulement si elle touche
  les outils de Louis ; les études de cas clients et communiqués en bas.
- **Le brief du matin** (`planifier-resumes.js`, `prompt-digest.js`) remplace le résumé du soir : à la première
  exécution après 8 h 30, une douzaine de sujets en trois rubriques — les labos, ce qui fait du bruit, pour le dev.
  C'est le seul message qui notifie, avec #critique. Manqué, il part à l'exécution suivante.
- Chaque article est allégé dès sa lecture (`tag-source.js`) : la base de n8n grossit moins à chaque exécution.

### Retirées

AINews sur smol.ai, Hacker News par hnrss.org, r/LocalLLaMA seul, Numerama, Ars Technica, TLDR Tech, Fireship,
ThePrimeTime, Theo, bycloud, Karpathy sur YouTube, Azure, HashiCorp, Databricks, dbt, JetBrains AI.

## Ce qui reste à faire

- **Les retours de Louis** : réagir 👍 ou 👎 sous un message pour que le bot apprenne ; il faut un petit bot Discord,
  un webhook ne lit rien.
- **Garder un article** (🔖) et le retrouver dans un export hebdomadaire.
- **Un canal #labos à part** : il suffira d'ajouter `DISCORD_WEBHOOK_LABOS` et une ligne dans le routeur.
- **xAI** n'a pas de flux et la copie tierce est figée depuis le 10 octobre ; ses modèles passent par le radar OpenRouter.
- **Les changelogs de l'API OpenAI et de l'API Gemini** n'ont pas de flux.
- Revoir les seuils de « j'aime » du radar Hugging Face après un mois (calibrés sur septembre et octobre 2026).

## Tests

`npm test` : 29 tests, dont 12 pour la refonte (`workflows/tests/refonte.test.mjs`) : radars, Hacker News, AINews,
Bluesky et Techmeme, collecte au réveil, regroupement des sujets, pré-classement par source, brief du matin, et le
bloc de code qu'un modèle met parfois autour du brief ou du bilan (le bilan du 28 octobre 2026 est arrivé ainsi).


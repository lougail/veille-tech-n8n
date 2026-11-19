# Veille Tech Automatisée — N8N + Discord

Système de veille technologique automatisé qui collecte, regroupe en **stories**, classifie par LLM et distribue sur Discord — avec détection des **sujets chauds** par corrélation multi-sources et signaux de popularité.

> **v3 (28 octobre 2026)** : les publications de tous les grands labos, ce qui fait du bruit, et un brief par jour. Pourquoi et comment : [docs/veille-v3.md](docs/veille-v3.md). La v2 de juillet (stories, sujets chauds) : [docs/veille-pro-v2.md](docs/veille-pro-v2.md).
>
> **Veille ParlIA (novembre 2026)** : un workflow à part prépare chaque semaine la séance de veille du projet ParlIA (32 sources, 8 fiches guidées au plus, un fichier de préparation daté, les alertes de remaniement du Journal officiel) : [docs/veille-parlia.md](docs/veille-parlia.md).

## Architecture (Veille v3)

```
Toutes les 30 min, jour et nuit : une collecte est-elle due ? (de 7 h à 23 h, au plus toutes les 3 h, et avant le brief)
  │   collecte de tout ce qui a été publié depuis la dernière collecte réussie (24 h à 7 jours) :
  │   le Mac qui dort ne fait rien perdre
  ├── 79 flux RSS : 23 flux officiels des labos, outils de code IA, AINews (via Latent Space),
  │   Techmeme, The Decoder, Reddit groupé, des personnes, le dev, le cloud, la sécurité
  ├── Radar OpenRouter : chaque nouveau modèle de chaque fournisseur, avec son prix ; les retraits annoncés
  ├── Radar Hugging Face : les nouveaux modèles ouverts de 25 organisations de labos, une annonce par famille
  ├── Hacker News (API Algolia) : plus de 100 points sur 48 h
  ├── Hugging Face Daily Papers, Trending Models ; Lobsters ; GitHub (nouveaux dépôts qui décollent)
        │
  Normalisation (AINews : ses sujets du jour deviennent un capteur de bruit) → dédoublonnage 7 jours
        │
  Pré-classement : 130 articles par jour collecté, 15 % au plus pour une même source
        │
  Regroupement en sujets : même adresse, titres proches, ou même nom de modèle (« GPT-6.1 Terra ») ;
   la source officielle en tête · chaleur = sources + engagement + citation par AINews · anti-répétition 72 h
        │
  Notation (Mistral Small 3.2) : les labos et le bruit en tête, la sécurité limitée aux outils de Louis
        │
  Discord (Components V2) :
   #ia — les labos en cartes dès 6/10, le reste de l'IA · #dev #cloud #securite — dès 7/10
   #tendances — 🔥 ce qui fait du bruit + 📈 ce qui monte
   #critique — score ≥ 9 : un nouveau modèle de pointe, une faille exploitée dans ses outils (@here)
   #digest — ☕ le brief du matin, après 8 h 30 : une douzaine de sujets en trois rubriques ; manqué, il part
             à l'exécution suivante. Seul message qui notifie, avec #critique
   #hebdo — bilan du dimanche soir · #status — métriques de chaque collecte
```

## Stack

- **N8N** 2.48.5 self-hosted (Docker) — orchestration
- **OpenRouter** — Mistral Small 3.2 (classification, $0.075/M) + Mistral Large 2512 (digests, avec Mistral Small en secours quand OpenRouter refuse Mistral Large) — ~0,60 $/mois
- **Discord Webhooks** — messages Components V2 (containers, boutons-liens, flags silencieux)
- **JavaScript** — 19 Code nodes versionnés dans `workflows/src/`, testés avec `npm test`

## Workflows

| Workflow | Description | Schedule |
|----------|-------------|----------|
| **Veille Pro — labos, bruit et brief** (la v3, 59 nodes) | Labos, radars de modèles, capteurs de bruit, regroupement, notation, distribution, brief du matin | Passage toutes les 30 min, jour et nuit : collecte de 7 h à 23 h, au plus toutes les 3 h ; brief après 8 h 30, bilan le dimanche |
| **Veille Stack** (26 nodes) | Veille de dépendances d'une org GitHub : manifestes → OSV.dev (CVE) → alertes #stack, + digest hebdo (releases sous contrainte, EOL via endoflife.date) | 9h30 (+ hebdo lundi) |
| **Veille ParlIA** (39 nodes, en service depuis le 4 novembre 2026) | Veille du projet ParlIA : flux, pages sans flux et API → tri par Mistral Small 3.2 → 8 fiches par semaine au plus, dont l'original est lu et résumé → fichier de préparation daté, avec le bilan des sources sur quatre semaines, #veille-parlia, alertes de remaniement | Toutes les 30 min, jour et nuit (travail de 7 h 15 à 22 h 45) : collecte toutes les 4 h au plus, préparation le lundi, rappel le jeudi |
| **Veille Pro v1** (34 nodes, désactivé) | Ancien pipeline par articles (rollback possible) | — |
| **Error Handler** (3 nodes) | Alerte Discord si un workflow crash | Sur erreur |

**Savoir ce qui tourne** : `npm run etat` compare chaque workflow publié dans n8n à celui que construit le dépôt,
donne le dernier passage de chacun et le nombre de commits absents de GitHub. Il ne modifie rien ; un ✅ par
workflow veut dire que ce qui tourne est la version du dépôt.

### Veille Stack (générique, réutilisable)

Scanne les manifestes (`requirements.txt`, `package.json`, `pubspec.yaml`/`.lock`, `Dockerfile`)
de tous les repos d'une org GitHub (token fine-grained **lecture seule**, org via `GITHUB_STACK_ORG`),
déduplique les dépendances à l'échelle de la plateforme, interroge **OSV.dev** (gratuit, sans clé)
et n'alerte que sur les **nouvelles** vulnérabilités HIGH/CRITICAL — avec la liste des repos touchés.
Le lundi : digest des dernières versions des paquets sous contrainte + échéances EOL.
La configuration (watchlists) est locale et non versionnée : copier
`workflows/src-stack/config-stack.example.js` vers `config-stack.js` puis `python3 workflows/build_stack.py`.

## Le workflow est GÉNÉRÉ, pas édité à la main

```
workflows/
├── build_v2.py          # Builder : assemble le JSON n8n depuis src/
├── src/*.js             # Code source des 19 Code nodes (la vraie logique)
├── build_parlia.py      # Builder de la veille ParlIA (src-parlia/*.js → veille-parlia.json)
├── tests/*.test.mjs     # Tests du code des nœuds : npm install, puis npm test
├── veille-pro-v2.json   # Sortie du builder (import n8n)
└── veille-pro.json      # v1 (archive)
```

Modifier la veille = éditer `workflows/src/*.js` puis :

```bash
python3 workflows/build_v2.py
docker cp workflows/veille-pro-v2.json veille-tech-n8n-n8n-1:/tmp/v2.json
docker exec veille-tech-n8n-n8n-1 n8n import:workflow --input=/tmp/v2.json
```

Mode test (envois Discord désactivés, résumé et bilan forcés, Manual Trigger pour le CLI, identifiant distinct) :

```bash
python3 workflows/build_v2.py --test
# puis import, et :
docker exec -e N8N_RUNNERS_BROKER_PORT=5699 -e N8N_PORT=5698 \
  veille-tech-n8n-n8n-1 n8n execute --id VeilleProV2test01
```

Rendement de chaque source sur les exécutions gardées par n8n, pour la revue mensuelle des sources. Le script fait
copier la base par le conteneur, la lit, puis efface la copie : la base de n8n ne s'ouvre jamais depuis le Mac
pendant que n8n tourne (voir `CLAUDE.md`).

```bash
python3 outils/rendement-sources.py
```

## Installation

### Prérequis

- Docker + Docker Compose
- Serveur Discord avec 9 webhooks (voir `.env.example`)
- Clé API OpenRouter (~0,60 $/mois pour tout le pipeline)

### Setup

```bash
git clone https://github.com/lougail/veille-tech-n8n.git
cd veille-tech-n8n
cp .env.example .env
# Éditer .env avec vos webhooks Discord
docker compose up -d
```

Accéder à n8n sur `http://localhost:5678`, créer la credential OpenRouter, importer `workflows/veille-pro-v2.json` et `workflows/error-handler.json`, activer.

## Historique

- **v2** (juillet 2026) — stories multi-sources, signaux de popularité (HN/Reddit/Lobsters/HF/GitHub), clustering, sujets chauds, digests avec mémoire, Components V2, sources auditées une à une, coût LLM divisé par 3.
- **v1** (mars 2026) — pipeline articles : 61 feeds → filtre mots-clés → Mistral Small 3.1 → embeds Discord. Brief Simplon : phases 1 & 2 dans `workflows/rss-discord.json` et `workflows/llm-veille-discord.json`.

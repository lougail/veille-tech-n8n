# Veille Tech Automatisée — N8N + Discord

Système de veille technologique automatisé qui collecte, regroupe en **stories**, classifie par LLM et distribue sur Discord — avec détection des **sujets chauds** par corrélation multi-sources et signaux de popularité.

> **v2 (juillet 2026)** : refonte complète orientée stories/tendances. Détails et rationale : [docs/veille-pro-v2.md](docs/veille-pro-v2.md)

## Architecture (Veille Pro v2)

```
Schedule (8h, 13h, 18h30 — Europe/Paris)
  ├── 73 feeds RSS curés (labs IA, blogs, newsletters, releases GitHub, YouTube, Reddit, HN…)
  ├── Hugging Face Daily Papers API (upvotes)
  ├── Hugging Face Trending Models API (trendingScore)
  ├── Lobsters hottest.json (score)
  └── GitHub Search API (nouveaux repos qui explosent)
        │
  Normalisation + extraction de signaux (points HN, rang Reddit, upvotes, stars)
        │
  Remove Duplicates natif (URL canonique, mémoire cross-runs 20 000 entrées)
        │
  Pré-ranking multi-signaux → top 130 (mots-clés 2026 + popularité + poids source + récence)
        │
  CLUSTERING EN STORIES (union-find : URL + similarité de titres)
   → chaleur = nb de sources + engagement · anti-répétition 72h · détection "ça monte"
        │
  Classification LLM (Mistral Small 3.2, batchs de 10, profil éditorial personnalisé)
   → score /10, catégorie, titre + résumé FR, "pourquoi ça compte", tags
        │
  Discord (Components V2) :
   #ia #dev #cloud #securite — cartes riches + liste compacte (silencieux)
   #tendances — 🔥 sujets chauds multi-sources + 📈 escalades
   #critique — score ≥ 9, embed rouge + @here (seul canal qui notifie)
   #digest — digest éditorial quotidien 18h30 (toute la journée, continuité avec la veille)
   #hebdo — bilan du dimanche (tendances montantes/descendantes, signaux faibles)
   #status — métriques du funnel + feeds en erreur
```

## Stack

- **N8N** 2.10.3 self-hosted (Docker) — orchestration
- **OpenRouter** — Mistral Small 3.2 (classification, $0.075/M) + Mistral Large 2512 (digests) — ~0,60 $/mois
- **Discord Webhooks** — messages Components V2 (containers, boutons-liens, flags silencieux)
- **JavaScript** — 18 Code nodes versionnés dans `workflows/src/`

## Workflows

| Workflow | Description | Schedule |
|----------|-------------|----------|
| **Veille Pro v2 — Stories & Tendances** (45 nodes) | Collecte multi-sources + clustering + classification + distribution + digests | 8h, 13h, 18h30 (+ hebdo dimanche) |
| **Veille Pro v1** (34 nodes, désactivé) | Ancien pipeline par articles (rollback possible) | — |
| **Error Handler** (3 nodes) | Alerte Discord si un workflow crash | Sur erreur |

## Le workflow est GÉNÉRÉ, pas édité à la main

```
workflows/
├── build_v2.py          # Builder : assemble le JSON n8n depuis src/
├── src/*.js             # Code source des 18 Code nodes (la vraie logique)
├── veille-pro-v2.json   # Sortie du builder (import n8n)
└── veille-pro.json      # v1 (archive)
```

Modifier la veille = éditer `workflows/src/*.js` puis :

```bash
python3 workflows/build_v2.py
docker cp workflows/veille-pro-v2.json veille-tech-n8n-n8n-1:/tmp/v2.json
docker exec veille-tech-n8n-n8n-1 n8n import:workflow --input=/tmp/v2.json
```

Mode test (envois Discord désactivés, digest forcé, Manual Trigger pour le CLI) :

```bash
python3 workflows/build_v2.py --test
# puis import, et :
docker exec -e N8N_RUNNERS_BROKER_PORT=5699 -e N8N_PORT=5698 \
  veille-tech-n8n-n8n-1 n8n execute --id VeilleProV2story
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

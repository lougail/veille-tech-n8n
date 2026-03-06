# Veille Tech Automatisee — N8N + Discord

Systeme de veille technologique automatise qui collecte, classifie et distribue des articles tech via Discord.

## Architecture

```
61 RSS feeds (IA, Cloud, DevOps, Securite, Data...)
        |
    [n8n] (Docker, self-hosted)
        |
    Deduplication + Filtre 24h (Static Data)
        |
    Pre-filtre par mots-cles (top 50, quota/categorie)
        |
    Jina AI Reader (extraction texte complet)
        |
    LLM Mistral Small (classification + scoring 1-10)
        |
    Routage par categorie
        |
    Discord (6 canaux thematiques)
     + Digest quotidien (apres-midi)
     + Digest hebdomadaire (dimanche, base sur les vrais articles)
     + Alertes erreurs (#bot-status)
```

## Stack

- **N8N** v2.10.3 — orchestration des workflows (Docker)
- **OpenRouter** — acces LLM gratuit (Mistral Small 3.1 24B)
- **Jina AI Reader** — extraction texte complet des articles
- **Discord Webhooks** — distribution multi-canaux
- **JavaScript** — code nodes pour le scoring, parsing, formatage

## Workflows

| Workflow | Description | Schedule |
|----------|-------------|----------|
| **Veille Pro** (34 nodes) | Collecte + Classification + Distribution | 8h + 14h |
| **Error Handler** (3 nodes) | Alerte Discord si un workflow crash | Sur erreur |

### Pipeline detaille (Veille Pro)

1. **Schedule Trigger** — 8h et 14h
2. **RSS Feed URLs** — 61 feeds organises par categorie
3. **Loop Over Feeds** — parcourt chaque feed
4. **RSS Read** — lit les articles du feed
5. **Tag Category** — tag la categorie RSS d'origine
6. **Dedup + Filter 24h** — filtre doublons (Static Data) + articles > 24h
7. **Pre-filtre Keywords** — scoring par mots-cles, quota 10/categorie, top 50
8. **Fetch Full Text** — Jina AI Reader pour le texte complet
9. **Batch pour LLM** — lots de 5 articles
10. **Classification LLM** — Mistral Small classifie (score, priorite, categorie, resume)
11. **Save Week Articles** — accumule dans Static Data pour le digest hebdo
12. **Route par Categorie** — dirige vers le bon canal Discord
13. **Discord Send** — envoie les embeds
14. **Digest quotidien** — resume LLM de la journee (apres-midi)
15. **Digest hebdomadaire** — resume LLM de la semaine (dimanche)

## Installation

### Prerequis

- Docker + Docker Compose
- Compte Discord avec webhooks configures
- Cle API OpenRouter (gratuit)

### Setup

```bash
git clone https://github.com/lougail/veille-tech-n8n.git
cd veille-tech-n8n
cp .env.example .env
# Editer .env avec vos webhooks Discord et cle OpenRouter
docker compose up -d
```

Acceder a n8n sur `http://localhost:5678`, importer les workflows depuis `workflows/`.

## Structure du projet

```
.
├── docker-compose.yml          # N8N self-hosted
├── .env.example                # Variables d'environnement (template)
├── workflows/
│   ├── veille-pro.json         # Workflow principal (34 nodes)
│   ├── error-handler.json      # Error handler Discord
│   ├── rss-discord.json        # Phase 1 brief (RSS simple)
│   ├── llm-veille-discord.json # Phase 2 brief (LLM simple)
│   └── digest-hebdomadaire.json# Backup digest hebdo
├── docs/
│   └── screenshots/            # Captures d'ecran
├── code-node-openrouter.js     # Reference code node OpenRouter
└── openrouter-body.json        # Reference body API OpenRouter
```

## Cout

0 EUR — Mistral Small gratuit (OpenRouter), Jina AI gratuit (10M tokens), n8n self-hosted, Discord gratuit.

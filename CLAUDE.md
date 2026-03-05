# Veille Tech N8N + Discord

Automatisation de veille technologique avec N8N (self-hosted) et Discord.

**Stack** : N8N (Docker), Discord Webhooks, OpenRouter (LLM), JavaScript

## Structure

| Dossier/Fichier | Role |
|-----------------|------|
| `docker-compose.yml` | N8N self-hosted |
| `n8n-data/` | Volume persistant N8N (non versionne) |
| `workflows/` | Exports JSON des workflows N8N |
| `docs/` | Documentation et screenshots |

## Regles N8N

- Utiliser les **noeuds natifs N8N** (Basic LLM Chain, OpenRouter Chat Model, etc.) plutot que des HTTP Request manuels pour les appels LLM
- Code nodes en **JavaScript** (Python non disponible dans l'image Docker standard)
- Toujours consulter la doc N8N via Context7 avant de guider sur les noeuds et leur configuration

## Workflows

### Phase 1 — RSS vers Discord
Schedule Trigger → 5 RSS feeds → Merge → Filter 24h → Code JS (Embeds) → HTTP Request Discord

### Phase 2 — LLM vers Discord
Basic LLM Chain + OpenRouter Chat Model → Code JS (Embeds) → HTTP Request Discord

## Discord

- Webhook pour poster les messages
- Format : Embeds avec titre, description, couleur, footer, timestamp
- Batch interval pour eviter le rate limiting

# Veille Pro v2 — Stories & Tendances

Refonte complète du pipeline de veille (juillet 2026). Changement de paradigme :
la v1 poussait des **articles** filtrés par mots-clés ; la v2 pousse des **stories**
(sujets regroupés multi-sources) avec détection de **sujets chauds**.

## Pourquoi la refonte

Mesuré sur les exécutions réelles de la v1 :

| Problème v1 | Conséquence |
|---|---|
| ~1 000 nouveaux items/run plafonnés à 50 par scoring mots-clés statique | 95 % du flux jeté sans intelligence, nouveautés ratées |
| Dedup par URL uniquement | Une actu couverte par 8 sources = 8 posts séparés |
| Aucun signal de popularité exploité | Impossible de détecter les sujets chauds |
| arXiv brut (500+ items/jour) | Signal/bruit catastrophique |
| Digest « quotidien » limité au run de 14h | La moitié de la journée manquait |
| 7 feeds morts (Papers With Code, Cohere, Airbyte…) | Erreurs silencieuses |
| Sources clés absentes (Anthropic, Mistral, HF Papers, newsletters IA, Lobsters…) | Angles morts sur le cœur dev+IA |

## Architecture v2

```
Schedule (8h, 13h, 18h30, Europe/Paris)
  ├─ 73 feeds RSS curés (loop) ──────────────┐
  ├─ HF Daily Papers API (upvotes) ──────────┤
  ├─ HF Trending Models API (trendingScore) ─┼─ Merge
  ├─ Lobsters hottest.json (score) ──────────┤
  └─ GitHub Search API (nouveaux repos ★) ───┘
        ↓
  Normalisation + extraction de signaux (points HN, rang Reddit, upvotes, stars)
        ↓
  Remove Duplicates natif (URL canonique, cross-exécutions, historique 20 000)
        ↓
  Pré-ranking multi-signaux (mots-clés 2026 + popularité + poids source + récence) → top 130
        ↓
  CLUSTERING EN STORIES (union-find : URL canonique + similarité de titres Jaccard/containment)
    → chaleur = nb sources distinctes + engagement (HN ≥150/400 pts, upvotes, stars…)
    → anti-répétition 72h vs registre + détection d'escalade (« ça monte »)
        ↓
  Classification LLM par batch de 10 stories (profil éditorial Louis + barème 5 niveaux
    + signaux injectés dans le prompt) → score, catégorie, titre FR, résumé, « pourquoi », tags
        ↓
  Filtre score ≥ 6 + registre staticData (7 jours roulants)
        ↓
  Router Discord :
    #ia #dev #cloud #securite : cartes riches Components V2 (score ≥ 7) + liste compacte
    #tendances : 🔥 sujets chauds (≥3 sources ou HN ≥300 pts) + 📈 escalades
    #critique : score ≥ 9 → embed rouge + @here (seul canal qui notifie)
    #status : métriques du funnel + feeds en erreur
        ↓ (run de 18h30)
  Digest quotidien (relit TOUTE la journée depuis le registre, continuité avec hier)
        ↓ (dimanche)
  Bilan hebdo (tendances montantes/descendantes via les 7 digests + top + signaux faibles)
```

## Modèles LLM (OpenRouter, audit pricing du 2026-07-02)

| Usage | Modèle | Prix in/out par M tokens | Pourquoi |
|---|---|---|---|
| Classification | `mistralai/mistral-small-3.2-24b-instruct` | $0.075 / $0.20 | Successeur du 3.1 (4,7× moins cher), meilleur suivi d'instructions JSON, français natif |
| Digest + Hebdo | `mistralai/mistral-large-2512` | $0.50 / $1.50 | Rédaction éditoriale française la plus naturelle du catalogue |

Coût total estimé : **~0,60 $/mois** (3 runs/jour), contre ~0,70 $/mois pour la seule
classification v1 (mistral-small-3.1 facturé $0.351/$0.555).

## Sources (audit de santé complet du 2026-07-02)

- 73 feeds RSS + 4 APIs JSON. Tous vérifiés en ligne (XML valide + items 2026).
- Ajouts majeurs : Anthropic & Meta AI (mirrors Olshansk, pas de RSS officiel), Mistral,
  xAI, HF Daily Papers (remplace arXiv brut ET Papers With Code fermé), AINews/smol.ai,
  Latent Space, Interconnects, Import AI, Simon Willison, Karpathy, Lobsters,
  releases GitHub (Claude Code, Codex, TypeScript, CPython, React, Vite, uv, Ollama),
  Cursor changelog, r/LocalLLaMA, r/MachineLearning, Pragmatic Engineer,
  newsletters hebdo (JS Weekly, Node Weekly, This Week in React, Pycoder's).
- Supprimés : feeds morts (Papers With Code, Cohere, Airbyte, Kafka blog, The Batch),
  arXiv brut (293 items/jour sur cs.AI seul), blogs data-eng marketing, presse générale
  redondante (Verge, Wired, TechCrunch…).

### Pièges connus des feeds
- CERT-FR : items triés en ordre chronologique **ascendant** (le plus récent en dernier) —
  sans impact ici (on filtre par date, pas par position).
- Reddit : risque de 429 → les 2 feeds sont éloignés dans la liste (espacés par le loop) ;
  `old.reddit.com` répond mieux.
- Latent Space : cross-posts `[AINews]` filtrés (doublon avec le feed smol.ai).
- Titres releases GitHub (`v1.0.55`) préfixés par la source pour le clustering.
- Mirrors Olshansk (Anthropic/Meta/xAI) : dépendance à un repo GitHub tiers — surveiller
  via #status si plus d'items pendant 45 jours.

## Format Discord (Components V2)

Les webhooks Discord supportent les Components V2 depuis 2025 :
`?with_components=true` sur l'URL + flag `32768` (IS_COMPONENTS_V2) — le message
n'a alors QUE `components` (pas de content/embeds). Flag combiné `36864` =
CV2 + silencieux (pas de notification push, sauf #critique).

- Carte story : Container (accent color par catégorie) + titre `##` + sous-texte `-#`
  (type, score, chaleur, sources) + résumé + « pourquoi ça compte » + boutons-liens
  (Lire, discussion HN avec points).
- Budget : max 3 cartes par message, ~3 600 chars, 40 composants.
- #critique reste en embed classique (content + embed + boutons) pour avoir la
  notification push avec aperçu.

## Fichiers

| Fichier | Rôle |
|---|---|
| `workflows/veille-pro-v2.json` | Workflow générée (import n8n), mode production |
| `workflows/build_v2.py` | Builder : assemble le JSON depuis `src/` (`--test` = Discord off + digest forcé) |
| `workflows/src/*.js` | Code source des 18 Code nodes (versionné, éditable) |

Modifier un nœud = éditer le `.js` → `python3 build_v2.py` → réimporter :
```bash
docker cp workflows/veille-pro-v2.json veille-tech-n8n-n8n-1:/tmp/v2.json
docker exec veille-tech-n8n-n8n-1 n8n import:workflow --input=/tmp/v2.json
```

Test CLI (sans toucher l'instance web, broker sur port alternatif) :
```bash
python3 workflows/build_v2.py --test
# import puis :
docker exec -e N8N_RUNNERS_BROKER_PORT=5699 -e N8N_PORT=5698 \
  veille-tech-n8n-n8n-1 n8n execute --id VeilleProV2story
```

## État persistant (staticData du workflow)

- `stories[]` : registre 7 jours roulants (anti-répétition 72h, digest du jour, hebdo).
- `lastDigest` / `digestHistory[7]` : continuité éditoriale (« hier on parlait de X »).
- Historique du node Remove Duplicates : 20 000 URLs canoniques (scope workflow).
- ⚠️ staticData n'est sauvegardé qu'en fin d'exécution **réussie** d'un workflow **actif**
  (pas en exécution manuelle/CLI) — comportement n8n documenté.

## Évolutions possibles (non implémentées)

- Migrer le registre vers les **Data Tables natives** n8n (archive requêtable dans l'UI) —
  nécessite de créer les tables dans l'UI et de régénérer la clé API n8n (expirée avril 2026).
- Canal #hebdo en forum Discord (un thread par semaine via `thread_name`).
- Sondage hebdo « quel sujet creuser ? » (webhook poll).
- Transcripts YouTube pour résumer les vidéos retenues.


## Octobre 2026 : rattrapage, secours et revue des sources

Mesuré le 23 octobre 2026 sur les 14 exécutions gardées par n8n, du 9 au 23 octobre :

| Problème | Conséquence | Correction |
|---|---|---|
| Fenêtre fixe de 24 h, alors que le bot ne tourne que Mac allumé | 38 % du temps d'octobre jamais lu ; trois alertes du CERT-FR manquées | La collecte part de la dernière collecte réussie (`lastCollectAt`), entre 24 h et 7 jours ; le pré-classement garde jusqu'à 260 articles après un rattrapage |
| Résumé lié à une exécution après 17 h, bilan à un dimanche après 17 h | Plus de résumé depuis le 9 octobre ; un seul bilan, le 13 septembre | `planifier-resumes.js` : un résumé ou un bilan manqué part à l'exécution suivante (`lastDigestAt`, `lastHebdoAt`), sur tout ce qui a été publié depuis |
| OpenRouter refuse Mistral Large (« trop de requêtes », reproduit en test le 23 octobre) | Résumé et bilan perdus même quand l'exécution a lieu | Modèle de secours sur les deux chaînes (`needsFallback`) : Mistral Small 3.2 |
| r/MachineLearning renvoie une page HTML | 14 échecs sur 14 | Flux retiré |

Tests : `npm install`, puis `npm test` (17 tests). Rendement des sources : `python3 outils/rendement-sources.py`.

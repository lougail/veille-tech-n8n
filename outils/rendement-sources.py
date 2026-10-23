#!/usr/bin/env python3
"""Rendement de chaque source de la veille, mesuré sur les exécutions que n8n a gardées.

Pour chaque source : nombre de passages, d'erreurs et de passages vides, articles lus, dans la
fenêtre de collecte, nouveaux, pré-classés, présents dans un sujet classé, présents dans un sujet
publié, et note moyenne des sujets où elle apparaît. Sert à la revue mensuelle des sources.

Lecture seule : la base de n8n est ouverte en mode lecture, aucun secret n'est affiché.

Usage, depuis la racine du dépôt :
    python3 outils/rendement-sources.py [chemin/vers/database.sqlite]
"""
import collections
import json
import sqlite3
import sys

sys.setrecursionlimit(20000)
BASE = sys.argv[1] if len(sys.argv) > 1 else "n8n-data/database.sqlite"
WORKFLOW = "VeilleProV2story"


def revivre(tableau):
    """Reconstruit un objet enregistré par n8n au format « flatted » (références par indice)."""
    deja = {}

    def lire(i):
        if i in deja:
            return deja[i]
        v = tableau[i]
        if isinstance(v, dict):
            o = deja[i] = {}
            for k, x in v.items():
                o[k] = lire(int(x)) if isinstance(x, str) else x
            return o
        if isinstance(v, list):
            o = deja[i] = []
            o.extend(lire(int(x)) if isinstance(x, str) else x for x in v)
            return o
        deja[i] = v
        return v

    return lire(0)


def sorties(tache):
    """Les articles en sortie principale d'un passage de nœud."""
    return [it for sortie in ((tache or {}).get("data") or {}).get("main") or [] for it in (sortie or [])]


con = sqlite3.connect(f"file:{BASE}?mode=ro", uri=True)
ids = [r[0] for r in con.execute(
    "SELECT id FROM execution_entity WHERE workflowId=? AND status='success' ORDER BY id", (WORKFLOW,))]
S = collections.defaultdict(collections.Counter)
notes = collections.defaultdict(list)
dates = []
for eid in ids:
    debut, donnees = con.execute(
        "SELECT e.startedAt, d.data FROM execution_entity e JOIN execution_data d ON d.executionId=e.id"
        " WHERE e.id=?", (eid,)).fetchone()
    dates.append(debut)
    run = (revivre(json.loads(donnees)).get("resultData") or {}).get("runData") or {}
    for t in run.get("Tag Source", []):
        its = sorties(t)
        if not its:
            continue
        s = ((its[0].get("json") or {}).get("_feed") or {}).get("s") or "?"
        S[s]["passages"] += 1
        if any((i.get("json") or {}).get("error") for i in its):
            S[s]["erreurs"] += 1
            continue
        reels = [i for i in its if (i.get("json") or {}).get("title")]
        S[s]["vides"] += not reels
        S[s]["lus"] += len(reels)
    for noeud, cle in (("Normaliser + Signaux", "fenetre"), ("Dedup 7 Jours", "nouveaux"),
                       ("Pre-Ranking", "preclasses")):
        for t in run.get(noeud, []):
            for i in sorties(t):
                j = i.get("json") or {}
                if j.get("source") and not j.get("_none"):
                    S[j["source"]][cle] += 1
    for noeud, cle in (("Parse Classification", "sujets"), ("Filtre + Registre", "publies")):
        for t in run.get(noeud, []):
            for i in sorties(t):
                j = i.get("json") or {}
                if not j.get("title"):
                    continue
                for m in j.get("sources") or []:
                    S[m.get("s") or "?"][cle] += 1
                    if cle == "sujets" and isinstance(j.get("score"), (int, float)):
                        notes[m.get("s") or "?"].append(j["score"])

if not ids:
    sys.exit("Aucune exécution réussie gardée par n8n.")
print(f"{len(ids)} exécutions réussies, du {dates[0][:16]} au {dates[-1][:16]} (UTC)\n")
cols = ["passages", "erreurs", "vides", "lus", "fenetre", "nouveaux", "preclasses", "sujets", "publies"]
print(f"{'source':<26}" + "".join(f"{c:>11}" for c in cols) + f"{'note':>7}")
for s, c in sorted(S.items(), key=lambda x: (-x[1]["publies"], -x[1]["sujets"], -x[1]["nouveaux"])):
    note = f"{sum(notes[s]) / len(notes[s]):.1f}" if notes[s] else "-"
    print(f"{s[:26]:<26}" + "".join(f"{c[k]:>11}" for k in cols) + f"{note:>7}")

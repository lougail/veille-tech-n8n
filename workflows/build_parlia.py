#!/usr/bin/env python3
"""Génère workflows/veille-parlia.json depuis workflows/src-parlia/*.js.

La veille ParlIA a son propre workflow, à côté de la veille personnelle (v2 et v3) : sa mémoire, ses erreurs et sa
mise en service restent séparées (docs/veille-parlia.md). Chaque nœud Code qui en a besoin reçoit en tête les
outils communs (src-parlia/outils.js) : n8n ne permet pas d'importer un module.

Usage :
  python3 build_parlia.py            # production : workflows/veille-parlia.json
  python3 build_parlia.py --test     # essai : Discord désactivé, tout est dû, déclencheur manuel,
                                     # fichier « essai-… » : workflows/veille-parlia.test.json (ignoré par Git)
"""
import argparse
import json
import re
import unicodedata
from pathlib import Path

HERE = Path(__file__).parent
SRC = HERE / "src-parlia"

WORKFLOW_ID_PROD = "VeilleParlIAprod"
WORKFLOW_ID_TEST = "VeilleParlIAtest"
CREDENTIALS = {"openRouterApi": {"id": "w6TWAQpgn7TIxlYq", "name": "OpenRouter account"}}
ERROR_WORKFLOW = "yrUX1IcjTyIwpWqG"
MODEL_TRI = "mistralai/mistral-small-3.2-24b-instruct"

# Décalé de 15 minutes par rapport à la v3 (« 0 */30 7-22 * * * ») : les deux veilles ne tournent pas ensemble.
CRON = "0 15,45 7-22 * * *"

# Les réglages, lus dans les variables d'environnement du conteneur (le nœud Code n'a pas accès à $env),
# avec des valeurs par défaut prudentes : Discord n'est utilisé que si son webhook est réglé.
REGLAGES = [
    ("prepJour", "={{ $env.PARLIA_PREPARATION_JOUR || '1' }}"),
    ("prepHeure", "={{ $env.PARLIA_PREPARATION_HEURE || '06:00' }}"),
    ("rappelJour", "={{ $env.PARLIA_RAPPEL_JOUR || '4' }}"),
    ("rappelHeure", "={{ $env.PARLIA_RAPPEL_HEURE || '16:30' }}"),
    ("collecteHeures", "={{ $env.PARLIA_COLLECTE_HEURES || '4' }}"),
    ("candidatsMin", "={{ $env.PARLIA_CANDIDATS_MIN || '10' }}"),
    ("candidatsMax", "={{ $env.PARLIA_CANDIDATS_MAX || '15' }}"),
    ("forum", "={{ $env.DISCORD_PARLIA_FORUM || '0' }}"),
    ("discord", "={{ $env.DISCORD_WEBHOOK_PARLIA ? '1' : '0' }}"),
    ("statut", "={{ $env.DISCORD_WEBHOOK_STATUS ? '1' : '0' }}"),
    ("mention", "={{ $env.PARLIA_DISCORD_MENTION || '' }}"),
    ("essai", "0"),
]

DISCORD_PARLIA_URL = (
    "={{ $env.DISCORD_WEBHOOK_PARLIA + '?wait=true'"
    " + ($json.cv2 ? '&with_components=true' : '')"
    " + ($json.threadId ? '&thread_id=' + $json.threadId : '') }}"
)
DISCORD_STATUS_URL = "={{ $env.DISCORD_WEBHOOK_STATUS + '?wait=true' }}"

OUTILS = (SRC / "outils.js").read_text(encoding="utf-8")
OUTILS_NOMS = (
    "PARLIA", "texteSimple", "tronquer", "hacher", "domaineDe", "cleAdresse", "cellule", "pourDiscord",
    "MOIS_FR", "dateLongue", "MOIS_EN", "dateDansTexte", "noterSante", "pousserAlerte",
)


def slug(name: str) -> str:
    sans_accents = unicodedata.normalize("NFD", name).encode("ascii", "ignore").decode("ascii")
    return "parlia-" + re.sub(r"[^a-z0-9]+", "-", sans_accents.lower()).strip("-")


def js(filename: str) -> str:
    code = (SRC / filename).read_text(encoding="utf-8")
    if any(re.search(r"\b" + nom + r"\b", code) for nom in OUTILS_NOMS):
        return OUTILS + "\n" + code
    return code


def code_node(name, filename, pos):
    return {
        "parameters": {"jsCode": js(filename)},
        "id": slug(name),
        "name": name,
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": pos,
    }


def discord_node(name, url_expr, pos, disabled=False):
    node = {
        "parameters": {
            "method": "POST",
            "url": url_expr,
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": "={{ JSON.stringify($json.payload) }}",
            "options": {
                "timeout": 15000,
                "batching": {"batch": {"batchSize": 1, "batchInterval": 2500}},
            },
        },
        "id": slug(name),
        "name": name,
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.4,
        "position": pos,
        "continueOnFail": True,
        "retryOnFail": True,
        "maxTries": 3,
        "waitBetweenTries": 5000,
    }
    if disabled:
        node["disabled"] = True
    return node


def build(mode: str):
    test_mode = mode == "test"
    reglages = [
        (k, "1" if test_mode and k in ("essai", "discord", "statut") else v) for k, v in REGLAGES
    ]
    nodes = [
        {
            "parameters": {"rule": {"interval": [{"field": "cronExpression", "expression": CRON}]}},
            "id": slug("Toutes les 30 min"),
            "name": "Toutes les 30 min",
            "type": "n8n-nodes-base.scheduleTrigger",
            "typeVersion": 1.3,
            "position": [0, 400],
        },
        {
            "parameters": {
                "assignments": {"assignments": [
                    {"id": slug("reglage " + k), "name": k, "value": v, "type": "string"} for k, v in reglages
                ]},
                "options": {},
            },
            "id": slug("Réglages"),
            "name": "Réglages",
            "type": "n8n-nodes-base.set",
            "typeVersion": 3.4,
            "position": [200, 400],
        },
        # Que faire à ce passage ? Collecte, préparation, rappel : chacun au premier passage après son heure.
        code_node("Que faire ?", "planifier-parlia.js", [400, 400]),
        # Branche 1 (la plus haute, donc la première avec l'ordre d'exécution v1) : la collecte et le tri.
        code_node("Sources ParlIA", "sources-parlia.js", [600, 0]),
        {
            "parameters": {"options": {}},
            "id": slug("Flux ParlIA"),
            "name": "Flux ParlIA",
            "type": "n8n-nodes-base.splitInBatches",
            "typeVersion": 3,
            "position": [800, 0],
        },
        {
            "parameters": {"url": "={{ $json.u }}", "options": {}},
            "id": slug("Lire le flux"),
            "name": "Lire le flux",
            "type": "n8n-nodes-base.rssFeedRead",
            "typeVersion": 1.2,
            "position": [1000, -160],
            "continueOnFail": True,
            "alwaysOutputData": True,
        },
        code_node("Étiqueter la source", "tag-source-parlia.js", [1200, -160]),
        code_node("Pages et API", "collecte-pages-api.js", [1000, 80]),
        code_node("Normaliser", "normaliser-parlia.js", [1200, 80]),
        code_node("Consigne de tri", "consigne-tri-parlia.js", [1400, 0]),
        {
            "parameters": {
                "promptType": "define",
                "text": "={{ $json.prompt }}",
                # Une pause de 3 s entre deux lots, plutôt qu'un nœud « Wait » (enregistré en base à chaque
                # pause à partir de n8n 2.16).
                "batching": {"batchSize": 1, "delayBetweenBatches": 3000},
            },
            "id": slug("Tri Mistral Small"),
            "name": "Tri Mistral Small",
            "type": "@n8n/n8n-nodes-langchain.chainLlm",
            "typeVersion": 1.9,
            "position": [1600, 0],
            "continueOnFail": True,
            "retryOnFail": True,
            "maxTries": 3,
            "waitBetweenTries": 5000,
        },
        {
            "parameters": {"model": MODEL_TRI, "options": {"temperature": 0.1}},
            "id": slug("OpenRouter Mistral Small"),
            "name": "OpenRouter Mistral Small",
            "type": "@n8n/n8n-nodes-langchain.lmChatOpenRouter",
            "typeVersion": 1,
            "position": [1600, 200],
            "credentials": CREDENTIALS,
        },
        code_node("Lire le tri", "lire-tri-parlia.js", [1800, 0]),
        code_node("Registre", "registre-parlia.js", [2000, 0]),
        code_node("Journal officiel", "jorf-parlia.js", [1400, 320]),
        code_node("Alertes", "alertes-parlia.js", [1600, 320]),
        discord_node("Discord alertes", DISCORD_PARLIA_URL, [1800, 320], disabled=test_mode),
        # Branche 2 : la préparation de la semaine. Le fichier d'abord (branche haute), puis Discord.
        code_node("Sélection", "selection-parlia.js", [600, 560]),
        code_node("Préparation", "preparation-parlia.js", [800, 560]),
        {
            "parameters": {
                "operation": "toText",
                "sourceProperty": "markdown",
                "binaryPropertyName": "data",
                "options": {"fileName": "={{ $json.nom }}"},
            },
            "id": slug("Convertir en fichier"),
            "name": "Convertir en fichier",
            "type": "n8n-nodes-base.convertToFile",
            "typeVersion": 1.1,
            "position": [1000, 480],
        },
        {
            # Écrit dans /home/node/.n8n-files/parlia, le seul dossier que n8n 2.x autorise par défaut
            # (N8N_RESTRICT_FILE_ACCESS_TO), monté depuis PARLIA_EXPORT_DIR. Dossier absent : erreur notée dans
            # #status, le reste continue.
            "parameters": {
                "operation": "write",
                "fileName": "={{ $('Préparation').first().json.chemin }}",
                "dataPropertyName": "data",
                "options": {},
            },
            "id": slug("Écrire le fichier"),
            "name": "Écrire le fichier",
            "type": "n8n-nodes-base.readWriteFile",
            "typeVersion": 1.1,
            "position": [1200, 480],
            "continueOnFail": True,
        },
        code_node("Ouverture", "ouverture-parlia.js", [1000, 640]),
        discord_node("Discord ouverture", DISCORD_PARLIA_URL, [1200, 640], disabled=test_mode),
        code_node("Fiches", "fiches-parlia.js", [1400, 640]),
        discord_node("Discord fiches", DISCORD_PARLIA_URL, [1600, 640], disabled=test_mode),
        # Branche 3 : le rappel du jeudi.
        code_node("Rappel", "rappel-parlia.js", [600, 820]),
        discord_node("Discord rappel", DISCORD_PARLIA_URL, [800, 820], disabled=test_mode),
        # Branche 4 (la plus basse, donc la dernière) : le message de #status, qui lit tout le passage.
        code_node("Statut", "statut-parlia.js", [600, 1000]),
        discord_node("Discord statut", DISCORD_STATUS_URL, [800, 1000], disabled=test_mode),
    ]
    if test_mode:
        nodes.append({
            "parameters": {},
            "id": slug("Essai manuel"),
            "name": "Essai manuel",
            "type": "n8n-nodes-base.manualTrigger",
            "typeVersion": 1,
            "position": [0, 200],
        })

    def main(*targets):
        return [{"node": t, "type": "main", "index": 0} for t in targets]

    connections = {
        "Toutes les 30 min": {"main": [main("Réglages")]},
        "Réglages": {"main": [main("Que faire ?")]},
        "Que faire ?": {"main": [main("Sources ParlIA", "Sélection", "Rappel", "Statut")]},
        "Sources ParlIA": {"main": [main("Flux ParlIA")]},
        # SplitInBatches v3 : sortie 0 « done », sortie 1 « loop ».
        "Flux ParlIA": {"main": [main("Pages et API"), main("Lire le flux")]},
        "Lire le flux": {"main": [main("Étiqueter la source")]},
        "Étiqueter la source": {"main": [main("Flux ParlIA")]},
        "Pages et API": {"main": [main("Normaliser")]},
        "Normaliser": {"main": [main("Consigne de tri", "Journal officiel")]},
        "Consigne de tri": {"main": [main("Tri Mistral Small")]},
        "OpenRouter Mistral Small": {"ai_languageModel": [[{"node": "Tri Mistral Small", "type": "ai_languageModel", "index": 0}]]},
        "Tri Mistral Small": {"main": [main("Lire le tri")]},
        "Lire le tri": {"main": [main("Registre")]},
        "Journal officiel": {"main": [main("Alertes")]},
        "Alertes": {"main": [main("Discord alertes")]},
        "Sélection": {"main": [main("Préparation")]},
        "Préparation": {"main": [main("Convertir en fichier", "Ouverture")]},
        "Convertir en fichier": {"main": [main("Écrire le fichier")]},
        "Ouverture": {"main": [main("Discord ouverture")]},
        "Discord ouverture": {"main": [main("Fiches")]},
        "Fiches": {"main": [main("Discord fiches")]},
        "Rappel": {"main": [main("Discord rappel")]},
        "Statut": {"main": [main("Discord statut")]},
    }
    if test_mode:
        connections["Essai manuel"] = {"main": [main("Réglages")]}

    workflow = {
        "id": WORKFLOW_ID_TEST if test_mode else WORKFLOW_ID_PROD,
        "name": "Veille ParlIA — préparation de la semaine" + (" [TEST]" if test_mode else ""),
        "active": False,
        "isArchived": False,
        "nodes": nodes,
        "connections": connections,
        "settings": {
            "executionOrder": "v1",
            "timezone": "Europe/Paris",
            "callerPolicy": "workflowsFromSameOwner",
            "errorWorkflow": ERROR_WORKFLOW,
            "executionTimeout": 1800,
        },
        "pinData": {},
        "meta": {},
        "tags": [],
    }

    # --- validations ---
    names = {n["name"] for n in nodes}
    assert len(names) == len(nodes), "noms de nœuds en double"
    ids = [n["id"] for n in nodes]
    assert len(set(ids)) == len(ids), "identifiants de nœuds en double"
    for src_name, conns in connections.items():
        assert src_name in names, f"source inconnue : {src_name}"
        for outs in conns.values():
            for out in outs:
                for c in out:
                    assert c["node"] in names, f"cible inconnue : {c['node']} (depuis {src_name})"
    # L'ordre v1 exécute les branches de haut en bas : le statut doit rester la dernière, le fichier passer
    # avant Discord, le tri avant le Journal officiel (les alertes du registre partent avec celles du JO).
    y = {n["name"]: n["position"][1] for n in nodes}
    for avant, apres in (("Sources ParlIA", "Sélection"), ("Sélection", "Rappel"), ("Rappel", "Statut"),
                         ("Consigne de tri", "Journal officiel"), ("Convertir en fichier", "Ouverture")):
        assert y[avant] < y[apres], f"ordre d'exécution : {avant} doit être au-dessus de {apres}"
    return workflow


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--test", action="store_true", help="Discord désactivé, tout est dû, déclencheur manuel")
    ap.add_argument("-o", "--output", default=None)
    args = ap.parse_args()

    mode = "test" if args.test else "prod"
    wf = build(mode)
    out = Path(args.output) if args.output else HERE / ("veille-parlia.test.json" if mode == "test" else "veille-parlia.json")
    out.write_text(json.dumps([wf], indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"OK -> {out} ({len(wf['nodes'])} nœuds, mode {mode.upper()})")

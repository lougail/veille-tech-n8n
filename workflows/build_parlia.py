#!/usr/bin/env python3
"""Génère workflows/veille-parlia.json depuis workflows/src-parlia/*.js.

La veille ParlIA a son propre workflow, à côté de la veille personnelle (v2 et v3) : sa mémoire, ses erreurs et sa
mise en service restent séparées (docs/veille-parlia.md). Chaque nœud Code qui en a besoin reçoit en tête les
modules communs dont il se sert : les outils (src-parlia/outils.js), puis la lecture des pages
(src-parlia/lecture-pages.js), qui se sert des outils. n8n ne permet pas d'importer un module.

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
# Le modèle qui résume les originaux des candidats retenus (8 demandes par semaine au plus) : le choix de Louis.
# Un autre que celui du tri reçoit Mistral Small 3.2 en secours (refus ou « too many requests » d'OpenRouter).
MODEL_RESUMES = MODEL_TRI

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
    ("candidatsMax", "={{ $env.PARLIA_CANDIDATS_MAX || '8' }}"),
    ("forum", "={{ $env.DISCORD_PARLIA_FORUM || '0' }}"),
    ("discord", "={{ $env.DISCORD_WEBHOOK_PARLIA ? '1' : '0' }}"),
    ("statut", "={{ $env.DISCORD_WEBHOOK_STATUS ? '1' : '0' }}"),
    ("mention", "={{ $env.PARLIA_DISCORD_MENTION || '' }}"),
    ("essai", "0"),
    ("modeleResumes", MODEL_RESUMES),
]

DISCORD_PARLIA_URL = (
    "={{ $env.DISCORD_WEBHOOK_PARLIA + '?wait=true'"
    " + ($json.cv2 ? '&with_components=true' : '')"
    " + ($json.threadId ? '&thread_id=' + $json.threadId : '') }}"
)
DISCORD_STATUS_URL = "={{ $env.DISCORD_WEBHOOK_STATUS + '?wait=true' }}"

# Les dossiers montés dans le conteneur (docker-compose.yml) : n8n 2.x n'écrit et ne lit que sous ~/.n8n-files.
DOSSIER_NOTES = "/home/node/.n8n-files/parlia-notes"
DOSSIER_PREPARATIONS = "/home/node/.n8n-files/parlia"

OUTILS = (SRC / "outils.js").read_text(encoding="utf-8")
OUTILS_NOMS = (
    "PARLIA", "texteSimple", "tronquer", "hacher", "domaineDe", "cleAdresse", "cellule", "pourDiscord",
    "MOIS_FR", "dateLongue", "MOIS_EN", "datesDansTexte", "dateDansTexte", "noterSante", "pousserAlerte",
    "nomsSuivisDans", "ligneHorsTexte", "lignesHorsTexte", "deRetraitsTexte", "hypotheseFautive",
)
LECTURE = (SRC / "lecture-pages.js").read_text(encoding="utf-8")
LECTURE_NOMS = ("texteDe", "estHtml", "lignesDe", "lignesDuMarkdown", "texteDuBloc", "sansMarque", "estRangee", "FORMAT_PAGES")
MODULES = ("outils.js", "lecture-pages.js")


def slug(name: str) -> str:
    sans_accents = unicodedata.normalize("NFD", name).encode("ascii", "ignore").decode("ascii")
    return "parlia-" + re.sub(r"[^a-z0-9]+", "-", sans_accents.lower()).strip("-")


def utilise(code: str, noms) -> bool:
    return any(re.search(r"\b" + nom + r"\b", code) for nom in noms)


def js(filename: str) -> str:
    code = (SRC / filename).read_text(encoding="utf-8")
    lecture = utilise(code, LECTURE_NOMS)
    outils = lecture or utilise(code, OUTILS_NOMS)
    return (OUTILS + "\n" if outils else "") + (LECTURE + "\n" if lecture else "") + code


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


def chain_node(name, pos, fallback=False):
    # Un lot après l'autre, sans appels en parallèle. n8n 2.10.3 n'applique « delayBetweenBatches » qu'aux lots de
    # plus d'un élément, et un nœud « Wait » serait enregistré en base à chaque pause à partir de n8n 2.16 : pas de
    # pause, il n'en faut pas ici.
    node = {
        "parameters": {"promptType": "define", "text": "={{ $json.prompt }}", "batching": {"batchSize": 1}},
        "id": slug(name),
        "name": name,
        "type": "@n8n/n8n-nodes-langchain.chainLlm",
        "typeVersion": 1.9,
        "position": pos,
        "continueOnFail": True,
        "retryOnFail": True,
        "maxTries": 3,
        "waitBetweenTries": 5000,
    }
    if fallback:
        # Second modèle, branché sur l'entrée « Fallback Model » (ai_languageModel, index 1), comme dans la v2.
        node["parameters"]["needsFallback"] = True
    return node


def model_node(name, model, pos):
    return {
        "parameters": {"model": model, "options": {"temperature": 0.1}},
        "id": slug(name),
        "name": name,
        "type": "@n8n/n8n-nodes-langchain.lmChatOpenRouter",
        "typeVersion": 1,
        "position": pos,
        "credentials": CREDENTIALS,
    }


def build(mode: str):
    test_mode = mode == "test"
    reglages = [
        (k, "1" if test_mode and k in ("essai", "discord", "statut") else v) for k, v in REGLAGES
    ]
    secours = MODEL_RESUMES != MODEL_TRI
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
        # Le tri : une à trois demandes par collecte, un lot de 12 articles après l'autre.
        chain_node("Tri Mistral Small", [1600, 0]),
        model_node("OpenRouter Mistral Small", MODEL_TRI, [1600, 200]),
        code_node("Lire le tri", "lire-tri-parlia.js", [1800, 0]),
        code_node("Registre", "registre-parlia.js", [2000, 0]),
        code_node("Journal officiel", "jorf-parlia.js", [1400, 320]),
        code_node("Alertes", "alertes-parlia.js", [1600, 320]),
        discord_node("Discord alertes", DISCORD_PARLIA_URL, [1800, 320], disabled=test_mode),
        # Branche 2 : les notes de séance, relues en lecture seule, avant la préparation et le rappel qui s'en
        # servent. Dossier absent ou vide : une erreur tolérée, que le nœud Notes traduit (« notes non lues »).
        code_node("Notes à lire ?", "notes-dues-parlia.js", [600, 440]),
        # Les préparations déjà écrites par le bot, relues pour le bilan des sources sur quatre semaines (nœud Notes ;
        # sources.md, 6.2, règle 10) : les seuls fichiers datés, pas les essais. Cette branche est au-dessus de celle
        # des notes : elle s'exécute avant elle, et une panne (dossier vide) ne touche pas la lecture des notes.
        {
            "parameters": {
                "operation": "read",
                "fileSelector": DOSSIER_PREPARATIONS + "/[0-9]*-preparation.md",
                "options": {},
            },
            "id": slug("Lire les préparations"),
            "name": "Lire les préparations",
            "type": "n8n-nodes-base.readWriteFile",
            "typeVersion": 1.1,
            "position": [800, 360],
            "continueOnFail": True,
            "alwaysOutputData": True,
        },
        {
            "parameters": {
                "operation": "text",
                "binaryPropertyName": "data",
                "destinationKey": "texte",
                "options": {"keepSource": "json"},
            },
            "id": slug("Texte des préparations"),
            "name": "Texte des préparations",
            "type": "n8n-nodes-base.extractFromFile",
            "typeVersion": 1.1,
            "position": [1000, 360],
            "continueOnFail": True,
            "alwaysOutputData": True,
        },
        {
            "parameters": {
                "operation": "read",
                "fileSelector": DOSSIER_NOTES + "/*-seance-*.md",
                "options": {},
            },
            "id": slug("Lire les notes"),
            "name": "Lire les notes",
            "type": "n8n-nodes-base.readWriteFile",
            "typeVersion": 1.1,
            "position": [800, 440],
            "continueOnFail": True,
            "alwaysOutputData": True,
        },
        {
            "parameters": {
                "operation": "text",
                "binaryPropertyName": "data",
                "destinationKey": "texte",
                "options": {"keepSource": "json"},
            },
            "id": slug("Texte des notes"),
            "name": "Texte des notes",
            "type": "n8n-nodes-base.extractFromFile",
            "typeVersion": 1.1,
            "position": [1000, 440],
            "continueOnFail": True,
            "alwaysOutputData": True,
        },
        code_node("Notes", "notes-parlia.js", [1200, 440]),
        # Branche 3 : la préparation de la semaine. Les originaux des candidats sont lus et résumés, puis le fichier
        # est écrit (branche haute), puis Discord.
        code_node("Sélection", "selection-parlia.js", [600, 640]),
        code_node("Originaux", "originaux-parlia.js", [800, 640]),
        chain_node("Résumé des originaux", [1000, 640], fallback=secours),
        model_node("OpenRouter résumés", MODEL_RESUMES, [1000, 800]),
        code_node("Lire les résumés", "resumes-parlia.js", [1200, 640]),
        code_node("Préparation", "preparation-parlia.js", [1400, 640]),
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
            "position": [1600, 560],
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
            "position": [1800, 560],
            "continueOnFail": True,
        },
        code_node("Ouverture", "ouverture-parlia.js", [1600, 720]),
        discord_node("Discord ouverture", DISCORD_PARLIA_URL, [1800, 720], disabled=test_mode),
        code_node("Fiches", "fiches-parlia.js", [2000, 720]),
        discord_node("Discord fiches", DISCORD_PARLIA_URL, [2200, 720], disabled=test_mode),
        # Branche 4 : le rappel du jeudi, seulement si les notes ne montrent pas de séance cette semaine.
        code_node("Rappel", "rappel-parlia.js", [600, 880]),
        discord_node("Discord rappel", DISCORD_PARLIA_URL, [800, 880], disabled=test_mode),
        # Branche 5 (la plus basse, donc la dernière) : le message de #status, qui lit tout le passage.
        code_node("Statut", "statut-parlia.js", [600, 1040]),
        discord_node("Discord statut", DISCORD_STATUS_URL, [800, 1040], disabled=test_mode),
    ]
    if secours:
        nodes.append(model_node("OpenRouter résumés secours", MODEL_TRI, [1180, 800]))
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
        "Que faire ?": {"main": [main("Sources ParlIA", "Notes à lire ?", "Sélection", "Rappel", "Statut")]},
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
        "Notes à lire ?": {"main": [main("Lire les préparations", "Lire les notes")]},
        "Lire les préparations": {"main": [main("Texte des préparations")]},
        "Lire les notes": {"main": [main("Texte des notes")]},
        "Texte des notes": {"main": [main("Notes")]},
        "Sélection": {"main": [main("Originaux")]},
        "Originaux": {"main": [main("Résumé des originaux")]},
        "OpenRouter résumés": {"ai_languageModel": [[{"node": "Résumé des originaux", "type": "ai_languageModel", "index": 0}]]},
        "Résumé des originaux": {"main": [main("Lire les résumés")]},
        "Lire les résumés": {"main": [main("Préparation")]},
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
    if secours:
        connections["OpenRouter résumés secours"] = {"ai_languageModel": [[{"node": "Résumé des originaux", "type": "ai_languageModel", "index": 1}]]}

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
    # L'ordre v1 exécute les branches de haut en bas : le statut doit rester la dernière, les notes passer avant
    # la préparation et le rappel, les préparations déjà écrites avant les notes, le fichier avant Discord, le tri
    # avant le Journal officiel (les alertes du registre partent avec celles du JO).
    y = {n["name"]: n["position"][1] for n in nodes}
    for avant, apres in (("Sources ParlIA", "Notes à lire ?"), ("Notes à lire ?", "Sélection"),
                         ("Sélection", "Rappel"), ("Rappel", "Statut"),
                         ("Lire les préparations", "Lire les notes"),
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

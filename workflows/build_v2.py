#!/usr/bin/env python3
"""Génère workflows/veille-pro-v2.json depuis workflows/src/*.js.

Usage :
  python3 build_v2.py            # build production
  python3 build_v2.py --test     # envois Discord désactivés + branche digest forcée (pour tests CLI)
"""
import argparse
import json
from pathlib import Path

HERE = Path(__file__).parent
SRC = HERE / "src"

WORKFLOW_ID_PROD = "VeilleProV2story"
WORKFLOW_ID_TEST = "VeilleProV2test01"
CREDENTIALS = {"openRouterApi": {"id": "w6TWAQpgn7TIxlYq", "name": "OpenRouter account"}}
ERROR_WORKFLOW = "yrUX1IcjTyIwpWqG"

MODEL_CLASSIF = "mistralai/mistral-small-3.2-24b-instruct"
MODEL_DIGEST = "mistralai/mistral-large-2512"
# Secours du résumé et du bilan : le 23 octobre 2026, OpenRouter refusait Mistral Large
# (« trop de requêtes ») aux trois tentatives, alors que Mistral Small répondait au tri.
MODEL_SECOURS = MODEL_CLASSIF

DISCORD_URL_EXPR = (
    "={{ ($json.channelKey === 'IA' ? $env.DISCORD_WEBHOOK_IA : "
    "$json.channelKey === 'DEV' ? $env.DISCORD_WEBHOOK_DEV : "
    "$json.channelKey === 'CLOUD' ? $env.DISCORD_WEBHOOK_CLOUD : "
    "$json.channelKey === 'SECURITE' ? $env.DISCORD_WEBHOOK_SECURITE : "
    "$json.channelKey === 'CRITIQUE' ? $env.DISCORD_WEBHOOK_CRITIQUE : "
    "$json.channelKey === 'STATUS' ? $env.DISCORD_WEBHOOK_STATUS : "
    "$env.DISCORD_WEBHOOK_TENDANCES) + '?wait=true&with_components=true' }}"
)


def js(name: str) -> str:
    return (SRC / name).read_text(encoding="utf-8")


def code_node(name, filename, pos):
    return {
        "parameters": {"jsCode": js(filename)},
        "id": name.lower().replace(" ", "-").replace("?", "q").replace("+", "p"),
        "name": name,
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": pos,
    }


def http_api_node(name, url, pos, headers=None):
    node = {
        "parameters": {"url": url, "options": {"timeout": 15000}},
        "id": name.lower().replace(" ", "-"),
        "name": name,
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.4,
        "position": pos,
        "continueOnFail": True,
        "alwaysOutputData": True,
        "retryOnFail": True,
        "maxTries": 2,
        "waitBetweenTries": 2000,
    }
    if headers:
        node["parameters"]["sendHeaders"] = True
        node["parameters"]["headerParameters"] = {
            "parameters": [{"name": k, "value": v} for k, v in headers.items()]
        }
    return node


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
        "id": name.lower().replace(" ", "-"),
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
    node = {
        "parameters": {"promptType": "define", "text": "={{ $json.prompt }}", "batching": {}},
        "id": name.lower().replace(" ", "-"),
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
        # second modèle, branché sur l'entrée « Fallback Model » (ai_languageModel, index 1)
        node["parameters"]["needsFallback"] = True
    return node


def model_node(name, model, temperature, pos):
    return {
        "parameters": {"model": model, "options": {"temperature": temperature}},
        "id": name.lower().replace(" ", "-"),
        "name": name,
        "type": "@n8n/n8n-nodes-langchain.lmChatOpenRouter",
        "typeVersion": 1,
        "position": pos,
        "credentials": CREDENTIALS,
    }


def if_node(name, left_expr, operator, right, pos):
    return {
        "parameters": {
            "conditions": {
                "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 3},
                "conditions": [{
                    "id": name.lower().replace(" ", "-") + "-cond",
                    "leftValue": left_expr,
                    "rightValue": right,
                    "operator": {"type": "number", "operation": operator},
                }],
                "combinator": "and",
            },
            "options": {},
        },
        "id": name.lower().replace(" ", "-").replace("?", "q"),
        "name": name,
        "type": "n8n-nodes-base.if",
        "typeVersion": 2.2,
        "position": pos,
    }


def merge_node(name, pos):
    return {
        "parameters": {"mode": "append"},
        "id": name.lower().replace(" ", "-"),
        "name": name,
        "type": "n8n-nodes-base.merge",
        "typeVersion": 3,
        "position": pos,
    }


def build(mode: str):
    # mode: 'prod' | 'test' (Discord off, branches forcées) | 'preprod' (Discord ON, branches forcées)
    test_mode = mode in ("test", "preprod")
    discord_off = mode == "test"
    nodes = [
        {
            "parameters": {"rule": {"interval": [
                {"field": "cronExpression", "expression": "0 0 8,13 * * *"},
                {"field": "cronExpression", "expression": "0 30 18 * * *"},
            ]}},
            "id": "schedule-v2",
            "name": "Schedule 8h-13h-18h30",
            "type": "n8n-nodes-base.scheduleTrigger",
            "typeVersion": 1.3,
            "position": [0, 300],
        },
        code_node("Sources RSS", "sources.js", [220, 0]),
        {
            "parameters": {"options": {}},
            "id": "loop-feeds",
            "name": "Loop Feeds",
            "type": "n8n-nodes-base.splitInBatches",
            "typeVersion": 3,
            "position": [440, 0],
        },
        {
            "parameters": {"url": "={{ $json.u }}", "options": {}},
            "id": "rss-read",
            "name": "RSS Read",
            "type": "n8n-nodes-base.rssFeedRead",
            "typeVersion": 1.2,
            "position": [660, -160],
            "continueOnFail": True,
            "alwaysOutputData": True,
        },
        code_node("Tag Source", "tag-source.js", [880, -160]),
        http_api_node("HF Papers API", "https://huggingface.co/api/daily_papers?limit=30", [220, 240]),
        code_node("Map HF Papers", "map-hf-papers.js", [440, 240]),
        http_api_node("HF Models API", "https://huggingface.co/api/models?sort=trendingScore&limit=20", [220, 400]),
        code_node("Map HF Models", "map-hf-models.js", [440, 400]),
        http_api_node("Lobsters API", "https://lobste.rs/hottest.json", [220, 560]),
        code_node("Map Lobsters", "map-lobsters.js", [440, 560]),
        http_api_node(
            "GitHub New Repos API",
            "=https://api.github.com/search/repositories?q=created:%3E{{ $now.minus({days: 7}).toISODate() }}&sort=stars&order=desc&per_page=20",
            [220, 720],
            headers={"User-Agent": "n8n-veille (self-hosted)", "Accept": "application/vnd.github+json"},
        ),
        code_node("Map GitHub Repos", "map-gh-repos.js", [440, 720]),
        merge_node("Fusion A", [680, 120]),
        merge_node("Fusion B", [860, 200]),
        merge_node("Fusion C", [1040, 280]),
        merge_node("Fusion D", [1220, 360]),
        code_node("Normaliser + Signaux", "normalize.js", [1400, 360]),
        code_node("Dedup 7 Jours", "dedup-cross-runs.js", [1580, 360]),
        code_node("Pre-Ranking", "prerank.js", [1760, 360]),
        code_node("Clusteriser Stories", "cluster.js", [1940, 360]),
        if_node("Stories ?", "={{ $json._none ? 1 : 0 }}", "equals", 0, [2120, 360]),
        {
            "parameters": {"batchSize": 10, "options": {}},
            "id": "batch-stories",
            "name": "Batch Stories",
            "type": "n8n-nodes-base.splitInBatches",
            "typeVersion": 3,
            "position": [2300, 240],
        },
        code_node("Prompt Classification", "prompt-classif.js", [2480, 80]),
        chain_node("Classification LLM", [2660, 80]),
        model_node("OpenRouter Classification", MODEL_CLASSIF, 0.2, [2660, 280]),
        code_node("Parse Classification", "parse-classif.js", [2840, 80]),
        {
            "parameters": {"amount": 4},
            "id": "wait-4s",
            "name": "Wait 4s",
            "type": "n8n-nodes-base.wait",
            "typeVersion": 1.1,
            "position": [3020, 80],
            "webhookId": "wait-llm-v2",
        },
        code_node("Filtre + Registre", "filtre-registre.js", [2520, 460]),
        code_node("Router Discord", "router-discord.js", [2700, 460]),
        discord_node("Discord Send", DISCORD_URL_EXPR, [2880, 460], disabled=discord_off),
        code_node("Message Status", "status.js", [3060, 300]),
        discord_node("Discord Status", "={{ $env.DISCORD_WEBHOOK_STATUS + '?wait=true' }}", [3240, 300], disabled=discord_off),
        # Résumé et bilan : envoyés quand ils sont dus, y compris en rattrapage (planifier-resumes.js).
        # En mode test, les deux conditions sont toujours vraies.
        code_node("Planifier Resumes", "planifier-resumes.js", [3060, 760]),
        if_node("Resume du ?", "={{ $json.resumeDu ? 1 : 0 }}", "gte" if test_mode else "equals", 0 if test_mode else 1, [3240, 620]),
        code_node("Prompt Digest", "prompt-digest.js", [3420, 620]),
        chain_node("LLM Digest", [3600, 620], fallback=True),
        model_node("OpenRouter Digest", MODEL_DIGEST, 0.4, [3600, 820]),
        model_node("OpenRouter Digest Secours", MODEL_SECOURS, 0.4, [3780, 820]),
        code_node("Digest CV2", "digest-cv2.js", [3960, 620]),
        discord_node("Discord Digest", "={{ $env.DISCORD_WEBHOOK_DIGEST + '?wait=true&with_components=true' }}", [4140, 620], disabled=discord_off),
        if_node("Bilan du ?", "={{ $json.bilanDu ? 1 : 0 }}", "gte" if test_mode else "equals", 0 if test_mode else 1, [3240, 1000]),
        code_node("Prompt Hebdo", "prompt-hebdo.js", [3420, 1000]),
        chain_node("LLM Hebdo", [3600, 1000], fallback=True),
        model_node("OpenRouter Hebdo", MODEL_DIGEST, 0.4, [3600, 1200]),
        model_node("OpenRouter Hebdo Secours", MODEL_SECOURS, 0.4, [3780, 1200]),
        code_node("Hebdo CV2", "hebdo-cv2.js", [3960, 1000]),
        discord_node("Discord Hebdo", "={{ $env.DISCORD_WEBHOOK_HEBDO + '?wait=true&with_components=true' }}", [4140, 1000], disabled=discord_off),
    ]

    if test_mode:
        nodes.append({
            "parameters": {},
            "id": "manual-test",
            "name": "Test Manuel",
            "type": "n8n-nodes-base.manualTrigger",
            "typeVersion": 1,
            "position": [0, 100],
        })

    def main_conn(*targets, index=0):
        return [{"node": t, "type": "main", "index": i} for t, i in [(t, index) if isinstance(t, str) else t for t in targets]]

    connections = {
        "Schedule 8h-13h-18h30": {"main": [main_conn("Sources RSS", "HF Papers API", "HF Models API", "Lobsters API", "GitHub New Repos API")]},
        "Sources RSS": {"main": [main_conn("Loop Feeds")]},
        "Loop Feeds": {"main": [main_conn("Fusion A"), main_conn("RSS Read")]},
        "RSS Read": {"main": [main_conn("Tag Source")]},
        "Tag Source": {"main": [main_conn("Loop Feeds")]},
        "HF Papers API": {"main": [main_conn(("Fusion A", 1))]},
        "Map HF Papers": {"main": []},
        "HF Models API": {"main": [main_conn("Map HF Models")]},
        "Map HF Models": {"main": [main_conn(("Fusion B", 1))]},
        "Lobsters API": {"main": [main_conn("Map Lobsters")]},
        "Map Lobsters": {"main": [main_conn(("Fusion C", 1))]},
        "GitHub New Repos API": {"main": [main_conn("Map GitHub Repos")]},
        "Map GitHub Repos": {"main": [main_conn(("Fusion D", 1))]},
        "Fusion A": {"main": [main_conn("Fusion B")]},
        "Fusion B": {"main": [main_conn("Fusion C")]},
        "Fusion C": {"main": [main_conn("Fusion D")]},
        "Fusion D": {"main": [main_conn("Normaliser + Signaux")]},
        "Normaliser + Signaux": {"main": [main_conn("Dedup 7 Jours")]},
        "Dedup 7 Jours": {"main": [main_conn("Pre-Ranking")]},
        "Pre-Ranking": {"main": [main_conn("Clusteriser Stories")]},
        "Clusteriser Stories": {"main": [main_conn("Stories ?")]},
        "Stories ?": {"main": [main_conn("Batch Stories"), main_conn("Filtre + Registre")]},
        "Batch Stories": {"main": [main_conn("Filtre + Registre"), main_conn("Prompt Classification")]},
        "Prompt Classification": {"main": [main_conn("Classification LLM")]},
        "Classification LLM": {"main": [main_conn("Parse Classification")]},
        "OpenRouter Classification": {"ai_languageModel": [[{"node": "Classification LLM", "type": "ai_languageModel", "index": 0}]]},
        "Parse Classification": {"main": [main_conn("Wait 4s")]},
        "Wait 4s": {"main": [main_conn("Batch Stories")]},
        "Filtre + Registre": {"main": [main_conn("Router Discord")]},
        "Router Discord": {"main": [main_conn("Discord Send")]},
        "Discord Send": {"main": [main_conn("Message Status", "Planifier Resumes")]},
        "Message Status": {"main": [main_conn("Discord Status")]},
        "Planifier Resumes": {"main": [main_conn("Resume du ?", "Bilan du ?")]},
        "Resume du ?": {"main": [main_conn("Prompt Digest")]},
        "Prompt Digest": {"main": [main_conn("LLM Digest")]},
        "LLM Digest": {"main": [main_conn("Digest CV2")]},
        "OpenRouter Digest": {"ai_languageModel": [[{"node": "LLM Digest", "type": "ai_languageModel", "index": 0}]]},
        "OpenRouter Digest Secours": {"ai_languageModel": [[{"node": "LLM Digest", "type": "ai_languageModel", "index": 1}]]},
        "Digest CV2": {"main": [main_conn("Discord Digest")]},
        "Discord Digest": {"main": []},
        "Bilan du ?": {"main": [main_conn("Prompt Hebdo")]},
        "Prompt Hebdo": {"main": [main_conn("LLM Hebdo")]},
        "LLM Hebdo": {"main": [main_conn("Hebdo CV2")]},
        "OpenRouter Hebdo": {"ai_languageModel": [[{"node": "LLM Hebdo", "type": "ai_languageModel", "index": 0}]]},
        "OpenRouter Hebdo Secours": {"ai_languageModel": [[{"node": "LLM Hebdo", "type": "ai_languageModel", "index": 1}]]},
        "Hebdo CV2": {"main": [main_conn("Discord Hebdo")]},
    }
    # Le mapping "HF Papers API" -> Map se fait via Map HF Papers ; corrige la chaîne :
    connections["HF Papers API"] = {"main": [main_conn("Map HF Papers")]}
    connections["Map HF Papers"] = {"main": [main_conn(("Fusion A", 1))]}

    if test_mode:
        connections["Test Manuel"] = {"main": [main_conn("Sources RSS", "HF Papers API", "HF Models API", "Lobsters API", "GitHub New Repos API")]}

    suffix = {"test": " [TEST]", "preprod": " [PREPROD]", "prod": ""}[mode]
    workflow = {
        "id": WORKFLOW_ID_TEST if test_mode else WORKFLOW_ID_PROD,
        "name": "Veille Pro v2 — Stories & Tendances" + suffix,
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
    assert len(names) == len(nodes), "noms de nodes dupliqués"
    for src_name, conns in connections.items():
        assert src_name in names, f"source inconnue: {src_name}"
        for outs in conns.values():
            for out in outs:
                for c in out:
                    assert c["node"] in names, f"cible inconnue: {c['node']} (depuis {src_name})"
    ids = [n["id"] for n in nodes]
    assert len(set(ids)) == len(ids), "ids de nodes dupliqués"

    return workflow


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--test", action="store_true", help="Discord désactivé + branches forcées + Manual Trigger")
    ap.add_argument("--preprod", action="store_true", help="Discord ACTIF + branches forcées + Manual Trigger (id de test)")
    ap.add_argument("-o", "--output", default=None)
    args = ap.parse_args()

    mode = "preprod" if args.preprod else ("test" if args.test else "prod")
    wf = build(mode)
    default_name = {"test": "veille-pro-v2.test.json", "preprod": "veille-pro-v2.preprod.json", "prod": "veille-pro-v2.json"}[mode]
    out = Path(args.output) if args.output else HERE / default_name
    out.write_text(json.dumps([wf], indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"OK -> {out} ({len(wf['nodes'])} nodes, mode {mode.upper()})")

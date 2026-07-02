#!/usr/bin/env python3
"""Génère workflows/veille-stack.json depuis workflows/src-stack/*.js.

Veille de stack (org GitHub configurable via GITHUB_STACK_ORG) : manifestes GitHub → OSV (CVE) → Discord #stack,
+ digest hebdo (libération de contraintes, EOL) le lundi.

Usage :
  python3 build_stack.py           # production (schedule 9h30, hebdo le lundi)
  python3 build_stack.py --test    # + Manual Trigger, hebdo forcé
"""
import argparse
import json
from pathlib import Path

HERE = Path(__file__).parent
SRC = HERE / "src-stack"

WORKFLOW_ID = "VeilleStackHlmr1"
ERROR_WORKFLOW = "yrUX1IcjTyIwpWqG"

GH_HEADERS = [
    {"name": "Authorization", "value": "=Bearer {{ $env.GITHUB_STACK_TOKEN }}"},
    {"name": "Accept", "value": "application/vnd.github.raw+json"},
    {"name": "User-Agent", "value": "n8n-veille-stack (self-hosted)"},
    {"name": "X-GitHub-Api-Version", "value": "2022-11-28"},
]


def js(name):
    return (SRC / name).read_text(encoding="utf-8")


def code(name, filename, pos):
    return {"parameters": {"jsCode": js(filename)}, "id": name.lower().replace(" ", "-").replace("?", "q"),
            "name": name, "type": "n8n-nodes-base.code", "typeVersion": 2, "position": pos}


def http(name, pos, url, *, method="GET", headers=None, json_body=None, batching=None,
         never_error=False, response_format=None, full_response=False, retry=True):
    params = {"url": url, "options": {"timeout": 20000}}
    if method != "GET":
        params["method"] = method
    if headers:
        params["sendHeaders"] = True
        params["headerParameters"] = {"parameters": headers}
    if json_body:
        params["sendBody"] = True
        params["specifyBody"] = "json"
        params["jsonBody"] = json_body
    if batching:
        params["options"]["batching"] = {"batch": {"batchSize": batching[0], "batchInterval": batching[1]}}
    resp = {}
    if never_error:
        resp["neverError"] = True
    if response_format:
        resp["responseFormat"] = response_format
        if response_format == "text":
            resp["outputPropertyName"] = "body"
    if full_response:
        resp["fullResponse"] = True
    if resp:
        params["options"]["response"] = {"response": resp}
    node = {"parameters": params, "id": name.lower().replace(" ", "-"), "name": name,
            "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.4, "position": pos,
            "continueOnFail": True}
    if retry:
        node.update({"retryOnFail": True, "maxTries": 2, "waitBetweenTries": 3000})
    return node


def if_node(name, left, op, right, pos):
    return {"parameters": {"conditions": {
        "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 3},
        "conditions": [{"id": name.lower().replace(" ", "-") + "-c", "leftValue": left, "rightValue": right,
                        "operator": {"type": "number", "operation": op}}],
        "combinator": "and"}, "options": {}},
        "id": name.lower().replace(" ", "-").replace("?", "q"), "name": name,
        "type": "n8n-nodes-base.if", "typeVersion": 2.2, "position": pos}


def batch(name, pos, size=1):
    return {"parameters": {"batchSize": size, "options": {}}, "id": name.lower().replace(" ", "-"),
            "name": name, "type": "n8n-nodes-base.splitInBatches", "typeVersion": 3, "position": pos}


def build(test_mode):
    nodes = [
        {"parameters": {"rule": {"interval": [{"field": "cronExpression", "expression": "0 30 9 * * *"}]}},
         "id": "schedule-stack", "name": "Schedule 9h30", "type": "n8n-nodes-base.scheduleTrigger",
         "typeVersion": 1.3, "position": [0, 0]},
        code("Config Stack", "config-stack.js", [200, 0]),
        http("Repos Page 1", [400, -100], "=https://api.github.com/orgs/{{ $env.GITHUB_STACK_ORG }}/repos?per_page=100&page=1",
             headers=GH_HEADERS),
        http("Repos Page 2", [400, 100], "=https://api.github.com/orgs/{{ $env.GITHUB_STACK_ORG }}/repos?per_page=100&page=2",
             headers=GH_HEADERS),
        {"parameters": {"mode": "append"}, "id": "fusion-repos", "name": "Fusion Repos",
         "type": "n8n-nodes-base.merge", "typeVersion": 3, "position": [600, 0]},
        code("Plan Fetch", "plan-fetch.js", [800, 0]),
        if_node("Plan ?", "={{ $json._none ? 1 : 0 }}", "equals", 0, [1000, 0]),
        http("Fetch Manifests", [1200, -120],
             "=https://api.github.com/repos/{{ $env.GITHUB_STACK_ORG }}/{{ $json.repo }}/contents/{{ $json.path }}",
             headers=GH_HEADERS, batching=(5, 400), never_error=True, response_format="text", full_response=True),
        code("Parse Manifestes", "parse-manifests.js", [1400, -120]),
        code("Build OSV Query", "build-osv-query.js", [1600, 0]),
        if_node("Deps ?", "={{ $json._none ? 1 : 0 }}", "equals", 0, [1800, 0]),
        batch("Batch OSV", [2000, -80]),
        http("OSV Query", [2200, -200], "https://api.osv.dev/v1/querybatch", method="POST",
             json_body="={{ $json.queriesJson }}"),
        code("Collect OSV", "collect-osv.js", [2400, -200]),
        code("Process OSV", "process-osv.js", [2200, 60]),
        if_node("Details ?", "={{ $json._none ? 1 : 0 }}", "equals", 0, [2400, 60]),
        batch("Batch Details", [2600, -40]),
        http("OSV Detail", [2800, -160], "=https://api.osv.dev/v1/vulns/{{ $json.vulnId }}",
             batching=(1, 300), never_error=True, full_response=True),
        code("Collect Detail", "collect-detail.js", [3000, -160]),
        code("Format Alertes", "format-alertes.js", [2800, 120]),
        if_node("Hebdo ?", "={{ $now.weekday }}", "gte" if test_mode else "equals", 1, [3000, 120]),
        code("Plan Hebdo", "plan-hebdo.js", [3200, 0]),
        http("Fetch Refs", [3400, 0], "={{ $json.url }}", batching=(2, 300), never_error=True, full_response=True),
        code("Digest Hebdo", "digest-hebdo.js", [3600, 0]),
        code("Router Stack", "router-stack.js", [3800, 120]),
        http("Discord Stack", [4000, 120], "={{ $env.DISCORD_WEBHOOK_STACK + '?wait=true' }}", method="POST",
             json_body="={{ JSON.stringify($json.payload) }}", batching=(1, 1500)),
    ]
    if test_mode:
        nodes.append({"parameters": {}, "id": "manual-stack", "name": "Test Manuel",
                      "type": "n8n-nodes-base.manualTrigger", "typeVersion": 1, "position": [0, -160]})

    def conn(*targets):
        return [{"node": t if isinstance(t, str) else t[0], "type": "main",
                 "index": 0 if isinstance(t, str) else t[1]} for t in targets]

    connections = {
        "Schedule 9h30": {"main": [conn("Config Stack")]},
        "Config Stack": {"main": [conn("Repos Page 1", "Repos Page 2")]},
        "Repos Page 1": {"main": [conn("Fusion Repos")]},
        "Repos Page 2": {"main": [conn(("Fusion Repos", 1))]},
        "Fusion Repos": {"main": [conn("Plan Fetch")]},
        "Plan Fetch": {"main": [conn("Plan ?")]},
        "Plan ?": {"main": [conn("Fetch Manifests"), conn("Build OSV Query")]},
        "Fetch Manifests": {"main": [conn("Parse Manifestes")]},
        "Parse Manifestes": {"main": [conn("Build OSV Query")]},
        "Build OSV Query": {"main": [conn("Deps ?")]},
        "Deps ?": {"main": [conn("Batch OSV"), conn("Format Alertes")]},
        "Batch OSV": {"main": [conn("Process OSV"), conn("OSV Query")]},
        "OSV Query": {"main": [conn("Collect OSV")]},
        "Collect OSV": {"main": [conn("Batch OSV")]},
        "Process OSV": {"main": [conn("Details ?")]},
        "Details ?": {"main": [conn("Batch Details"), conn("Format Alertes")]},
        "Batch Details": {"main": [conn("Format Alertes"), conn("OSV Detail")]},
        "OSV Detail": {"main": [conn("Collect Detail")]},
        "Collect Detail": {"main": [conn("Batch Details")]},
        "Format Alertes": {"main": [conn("Hebdo ?")]},
        "Hebdo ?": {"main": [conn("Plan Hebdo"), conn("Router Stack")]},
        "Plan Hebdo": {"main": [conn("Fetch Refs")]},
        "Fetch Refs": {"main": [conn("Digest Hebdo")]},
        "Digest Hebdo": {"main": [conn("Router Stack")]},
        "Router Stack": {"main": [conn("Discord Stack")]},
    }
    if test_mode:
        connections["Test Manuel"] = {"main": [conn("Config Stack")]}

    wf = {
        "id": WORKFLOW_ID,
        "name": "Veille Stack" + (" [TEST]" if test_mode else ""),
        "active": False,
        "isArchived": False,
        "nodes": nodes,
        "connections": connections,
        "settings": {"executionOrder": "v1", "timezone": "Europe/Paris",
                     "callerPolicy": "workflowsFromSameOwner", "errorWorkflow": ERROR_WORKFLOW,
                     "executionTimeout": 1800},
        "pinData": {}, "meta": {}, "tags": [],
    }
    names = {n["name"] for n in nodes}
    for src_name, c in connections.items():
        assert src_name in names, f"source inconnue: {src_name}"
        for outs in c.values():
            for out in outs:
                for t in out:
                    assert t["node"] in names, f"cible inconnue: {t['node']}"
    return wf


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--test", action="store_true")
    args = ap.parse_args()
    wf = build(args.test)
    out = HERE / ("veille-stack.test.json" if args.test else "veille-stack.json")
    out.write_text(json.dumps([wf], indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"OK -> {out} ({len(wf['nodes'])} nodes, mode {'TEST' if args.test else 'PROD'})")

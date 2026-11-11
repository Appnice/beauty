#!/usr/bin/env python3
"""Read-only watchdog over one self-evolving-harness run. Usage: harness_watchdog.py <workflow transcript dir>

Prints one status block and a last line OK / WARN / STOP. It changes nothing.
STOP rules: a forbidden command ran (git commit/push, ssh/rsync/scp to a host, a call to an SMS gateway).
WARN rules: run older than 6 h, an agent silent for 30 min, more than 3 tasks beyond the 5 planned ones.
"""
import json
import os
import re
import subprocess
import sys
import time

d = sys.argv[1]
now = time.time()
events = []
jp = os.path.join(d, "journal.jsonl")
if os.path.exists(jp):
    for line in open(jp):
        try:
            events.append(json.loads(line))
        except ValueError:
            pass

types = {}
labels = {}
for e in events:
    types[e.get("type")] = types.get(e.get("type"), 0) + 1
    if e.get("label"):
        labels.setdefault(e["label"], []).append(e.get("type"))

started = os.path.getctime(jp) if os.path.exists(jp) else now
hours = (now - started) / 3600
tasks = sorted({m.group(1) for label in labels for m in [re.search(r"#(\d+)", label)] if m})
open_labels = [label for label, ts in labels.items() if ts.count("started") > len(ts) - ts.count("started")]

FORBIDDEN = [
    (r"\bgit\s+(-C\s+\S+\s+)?(commit|push|rebase|reset\s+--hard)\b", "git history change"),
    (r"(^|[;&|]\s*)(ssh|scp)\s+(?!-V)", "ssh/scp"),
    (r"\brsync\b[^\n]*\s\S+@\S+:", "rsync to a host"),
    (r"api\.smsapi\.pl|smsapi\.com", "SMS gateway call"),
    (r"\.github/workflows", "GitHub workflow"),
]
hits = []
youngest = 0.0
for name in sorted(os.listdir(d)):
    if not (name.startswith("agent-") and name.endswith(".jsonl")):
        continue
    p = os.path.join(d, name)
    youngest = max(youngest, os.path.getmtime(p))
    for line in open(p, errors="replace"):
        if '"Bash"' not in line:
            continue
        try:
            o = json.loads(line)
        except ValueError:
            continue
        content = (o.get("message") or {}).get("content")
        if not isinstance(content, list):
            continue
        for c in content:
            if isinstance(c, dict) and c.get("type") == "tool_use" and c.get("name") == "Bash":
                cmd = (c.get("input") or {}).get("command", "")
                for rx, why in FORBIDDEN:
                    if re.search(rx, cmd, re.M) and "fake" not in cmd and "stub" not in cmd:
                        hits.append((why, name[:22], cmd[:160].replace("\n", " ")))

idle_min = (now - youngest) / 60 if youngest else 0

models = {}
for name in sorted(os.listdir(d)):
    if name.startswith("agent-") and name.endswith(".meta.json"):
        try:
            m = json.load(open(os.path.join(d, name))).get("pickedEffortModel", "?")
        except ValueError:
            m = "?"
        models[m] = models.get(m, 0) + 1
bad_models = [m for m in models if "fable" in m]
docker = subprocess.run(["docker", "ps", "--format", "{{.Names}}"], capture_output=True, text=True).stdout.split()
ours = [n for n in docker if "beauty" in n]

print(f"run {hours:.1f} h | events {types} | tasks seen {tasks} | open now {open_labels}")
print(f"last agent write {idle_min:.0f} min ago | beauty containers {ours} | models {models}")
for h in hits[:10]:
    print("FORBIDDEN?", h)

verdict = "OK"
if hours > 6 or idle_min > 30 or len(tasks) > 8:
    verdict = "WARN"
if bad_models:
    verdict = f"WARN (agents on {bad_models}: Patryk wants Opus/Sonnet only)"
if hits:
    verdict = "STOP (check the hits: a stub test of the deploy scripts is fine)"
print(verdict)

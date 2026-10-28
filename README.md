# codebase-auditor

PoC [Agent SDK](https://cursor.com/docs/agent-sdk) agent that audits one or
many local repositories against a **multi-stack JSON rules file**.

Rules are written in natural language, grouped by stack (`python`, `dart`,
`java`, …), and may target files via glob patterns.

## What it does

- Loads `rules/sample-rules.json` (schema in `docs/rules-schema.md`)
- Copies one or more local repos into the session workspace
- Lists files that match each rule’s patterns
- Reviews those files against the natural-language rules
- Records findings and writes `audits/<id>/report.json` + `report.md`
- Supports **multi-repo audits in parallel** via the `repo-auditor` subagent

## Quick start

```bash
cd codebase-auditor
npx @grok/agent-sdk login          # once — needs a Cursor credential
npx @grok/agent-sdk validate --dir .
npx @grok/agent-sdk dev            # playground at http://127.0.0.1:3000/playground
```

### Playground prompt (multi-repo PoC)

```text
Run the multi-repo PoC audit with auditId poc-multi.
Prepare fixtures/sample-repos/python-service, dart-app, and java-service.
Use rules/sample-rules.json. Audit all repos at the same time, then finalize.
```

### HTTP channel

```bash
npx @grok/agent-sdk serve --dir . --mode single --dev

curl -sS -X POST http://127.0.0.1:3000/codebase-auditor/v1/channels/audit/run \
  -H 'content-type: application/json' \
  -d '{
    "auditId": "poc-multi",
    "rulesPath": "rules/sample-rules.json",
    "repos": [
      {"id": "python-service", "sourcePath": "fixtures/sample-repos/python-service"},
      {"id": "dart-app", "sourcePath": "fixtures/sample-repos/dart-app"},
      {"id": "java-service", "sourcePath": "fixtures/sample-repos/java-service"}
    ]
  }'
```

### Deterministic tool smoke (no model key required)

```bash
npx @grok/agent-sdk tool call load_rules --dir . \
  --input '{"rulesPath":"rules/sample-rules.json"}'

npx @grok/agent-sdk tool call prepare_repos --dir . \
  --input '{"repos":[{"id":"python-service","sourcePath":"fixtures/sample-repos/python-service"}]}'
```

## Layout

| Path | Role |
| --- | --- |
| `bot/instructions.md` | Auditor system prompt |
| `bot/tools/*` | Rules load, repo prep, targeting, findings, report |
| `bot/subagents/repo-auditor/` | Per-repo specialist for parallel audits |
| `bot/channels/audit.ts` | `POST /v1/channels/audit/run` |
| `rules/sample-rules.json` | Example multi-stack rules |
| `fixtures/sample-repos/*` | Tiny repos with intentional violations |
| `evals/` | Smoke + multi-repo evals |

## Rules JSON (example)

See `rules/sample-rules.json` and `docs/rules-schema.md`. Each rule belongs to
a stack, is written in natural language, and can set `filePatterns` /
`excludePatterns`.

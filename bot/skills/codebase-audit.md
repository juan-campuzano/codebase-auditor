---
name: codebase-audit
description: >
  Run a rules-file codebase audit for one or many local repositories,
  including the multi-repo PoC fixtures under fixtures/sample-repos/.
---

# Codebase audit

Use this skill when the user asks to audit a codebase, apply stack rules,
or run the multi-repo PoC.

## Default PoC (multi-repo)

```text
prepare_repos with:
  - id: python-service, sourcePath: fixtures/sample-repos/python-service
  - id: dart-app, sourcePath: fixtures/sample-repos/dart-app
  - id: java-service, sourcePath: fixtures/sample-repos/java-service

load_rules rulesPath=rules/sample-rules.json
list_audit_targets for those repo ids
delegate each repo to repo-auditor with the shared auditId
finalize_audit_report
```

## Single repo

Prepare one repo, skip subagents, review targets yourself, then finalize.

## Rules file

The JSON supports:

- `stacks.<name>.rules[]` with natural-language `rule` text
- optional per-rule `filePatterns` / `excludePatterns`
- optional `globalRules` that apply across stacks

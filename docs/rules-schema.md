# Audit rules JSON schema

The auditor loads a single JSON document. Rules are natural-language text
grouped by **stack**. Each rule may optionally limit itself to files that
match glob patterns.

## Shape

```json
{
  "version": "1.0",
  "description": "optional",
  "stacks": {
    "python": {
      "description": "optional",
      "defaultFilePatterns": ["**/*.py"],
      "rules": [
        {
          "id": "py-no-eval",
          "title": "Do not use eval on untrusted input",
          "severity": "high",
          "rule": "Natural language guidance the model applies…",
          "filePatterns": ["**/*.py"],
          "excludePatterns": ["**/tests/**"]
        }
      ]
    }
  },
  "globalRules": [
    {
      "id": "global-todo-fixme",
      "title": "Track FIXME / SECURITY TODOs",
      "severity": "low",
      "rule": "…",
      "filePatterns": ["**/*.py", "**/*.dart", "**/*.java"]
    }
  ]
}
```

## Fields

| Field | Required | Meaning |
| --- | --- | --- |
| `version` | yes | Document version string |
| `stacks` | yes | Map of stack name → stack config |
| `stacks.*.rules` | yes | Rules that belong to that stack |
| `stacks.*.defaultFilePatterns` | no | Fallback globs when a rule omits `filePatterns` |
| `rules[].id` | yes | Stable id recorded on findings |
| `rules[].title` | yes | Short name |
| `rules[].severity` | yes | `high` \| `medium` \| `low` |
| `rules[].rule` | yes | Natural-language rule text |
| `rules[].filePatterns` | no | Include globs (relative paths) |
| `rules[].excludePatterns` | no | Exclude globs |
| `globalRules` | no | Cross-stack rules (`stack` becomes `global`) |

Globs use `*` and `**` semantics (path segments). Matching is done in
deterministic TypeScript before the model reviews a file.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function globToRegExp(pattern) {
  const normalized = pattern.replace(/\\/g, "/");
  let regex = "^";
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === "*" && normalized[i + 1] === "*") {
      if (normalized[i + 2] === "/") {
        regex += "(?:.*/)?";
        i += 2;
      } else {
        regex += ".*";
        i += 1;
      }
      continue;
    }
    if (ch === "*") {
      regex += "[^/]*";
      continue;
    }
    if (ch === "?") {
      regex += "[^/]";
      continue;
    }
    if ("+|(){}^$".includes(ch) || ch === ".") {
      regex += `\\${ch}`;
      continue;
    }
    regex += ch;
  }
  return new RegExp(regex + "$");
}

function matchesAny(filePath, patterns) {
  return patterns.some((pattern) => globToRegExp(pattern).test(filePath));
}

const doc = JSON.parse(
  await readFile(path.join(root, "rules/sample-rules.json"), "utf8"),
);

const cases = [
  {
    file: "app/main.py",
    expect: ["py-no-eval", "py-no-hardcoded-secrets", "py-sql-parameterize", "global-todo-fixme"],
  },
  {
    file: "lib/main.dart",
    expect: [
      "dart-no-print-in-prod",
      "dart-http-timeout",
      "dart-no-hardcoded-api-keys",
      "global-todo-fixme",
    ],
  },
  {
    file: "src/main/java/com/example/UserDao.java",
    expect: [
      "java-no-string-sql",
      "java-log-no-secrets",
      "java-close-resources",
      "global-todo-fixme",
    ],
  },
];

let failed = 0;
for (const testCase of cases) {
  const ids = [];
  for (const [stackName, stack] of Object.entries(doc.stacks)) {
    for (const rule of stack.rules) {
      const patterns = rule.filePatterns ?? stack.defaultFilePatterns ?? ["**/*"];
      if (!matchesAny(testCase.file, patterns)) continue;
      if (rule.excludePatterns?.length && matchesAny(testCase.file, rule.excludePatterns)) {
        continue;
      }
      ids.push(rule.id);
    }
  }
  for (const rule of doc.globalRules ?? []) {
    if (matchesAny(testCase.file, rule.filePatterns ?? ["**/*"])) ids.push(rule.id);
  }
  const missing = testCase.expect.filter((id) => !ids.includes(id));
  const extra = ids.filter((id) => !testCase.expect.includes(id));
  if (missing.length || extra.length) {
    failed += 1;
    console.error("FAIL", testCase.file, { got: ids, missing, extra });
  } else {
    console.log("ok", testCase.file, ids.join(","));
  }
}

if (failed) process.exit(1);
console.log("rules pattern checks passed");

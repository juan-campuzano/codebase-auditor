import { readFile } from "node:fs/promises";
import path from "node:path";
import * as z from "zod/v4";

export const SeveritySchema = z.enum(["high", "medium", "low"]);

export const RuleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  severity: SeveritySchema,
  rule: z.string().min(1),
  filePatterns: z.array(z.string().min(1)).min(1).optional(),
  excludePatterns: z.array(z.string().min(1)).optional(),
});

export const StackSchema = z.object({
  description: z.string().optional(),
  defaultFilePatterns: z.array(z.string().min(1)).optional(),
  rules: z.array(RuleSchema).min(1),
});

export const AuditRulesSchema = z.object({
  version: z.string().min(1),
  description: z.string().optional(),
  stacks: z.record(z.string(), StackSchema),
  globalRules: z.array(RuleSchema).optional(),
});

export type Severity = z.infer<typeof SeveritySchema>;
export type AuditRule = z.infer<typeof RuleSchema>;
export type StackConfig = z.infer<typeof StackSchema>;
export type AuditRules = z.infer<typeof AuditRulesSchema>;

export type FlatRule = AuditRule & {
  stack: string;
  effectiveFilePatterns: string[];
};

export type ApplicableRule = {
  id: string;
  stack: string;
  title: string;
  severity: Severity;
  rule: string;
};

function globToRegExp(pattern: string): RegExp {
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
    if ("+|(){}^$".includes(ch)) {
      regex += `\\${ch}`;
      continue;
    }
    if (ch === ".") {
      regex += "\\.";
      continue;
    }
    regex += ch;
  }
  regex += "$";
  return new RegExp(regex);
}

export function matchesAny(filePath: string, patterns: string[]): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return patterns.some((pattern) => globToRegExp(pattern).test(normalized));
}

export function flattenRules(
  doc: AuditRules,
  stacksFilter?: string[],
): FlatRule[] {
  const wanted =
    stacksFilter && stacksFilter.length > 0
      ? new Set(stacksFilter.map((s) => s.toLowerCase()))
      : null;

  const flat: FlatRule[] = [];

  for (const [stackName, stack] of Object.entries(doc.stacks)) {
    if (wanted && !wanted.has(stackName.toLowerCase())) continue;
    for (const rule of stack.rules) {
      flat.push({
        ...rule,
        stack: stackName,
        effectiveFilePatterns:
          rule.filePatterns ??
          stack.defaultFilePatterns ?? ["**/*"],
      });
    }
  }

  if (!wanted || wanted.has("global")) {
    for (const rule of doc.globalRules ?? []) {
      flat.push({
        ...rule,
        stack: "global",
        effectiveFilePatterns: rule.filePatterns ?? ["**/*"],
      });
    }
  }

  return flat;
}

export function rulesForFile(
  filePath: string,
  rules: FlatRule[],
): ApplicableRule[] {
  const normalized = filePath.replace(/\\/g, "/");
  return rules
    .filter((rule) => {
      if (!matchesAny(normalized, rule.effectiveFilePatterns)) return false;
      if (
        rule.excludePatterns &&
        rule.excludePatterns.length > 0 &&
        matchesAny(normalized, rule.excludePatterns)
      ) {
        return false;
      }
      return true;
    })
    .map((rule) => ({
      id: rule.id,
      stack: rule.stack,
      title: rule.title,
      severity: rule.severity,
      rule: rule.rule,
    }));
}

export async function loadRulesFile(filePath: string): Promise<AuditRules> {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  return AuditRulesSchema.parse(parsed);
}

export function resolveUnderRoot(root: string, relativePath: string): string {
  const resolved = path.resolve(root, relativePath);
  const normalizedRoot = path.resolve(root);
  if (
    resolved !== normalizedRoot &&
    !resolved.startsWith(normalizedRoot + path.sep)
  ) {
    throw new Error(`Path escapes workspace: ${relativePath}`);
  }
  return resolved;
}

import { prompt } from "@grok/agent-sdk";
import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import {
  flattenRules,
  loadRulesFile,
  resolveUnderRoot,
} from "../lib/rules.js";

export default defineTool({
  description: prompt`
    Load and validate an audit rules JSON file from the workspace.
    Returns stacks, rule counts, and a flattened rule list.
    Call this before listing audit targets.
  `,
  effect: "read",
  inputSchema: z.object({
    rulesPath: z
      .string()
      .default("rules/sample-rules.json")
      .describe("Workspace-relative path to the rules JSON file."),
    stacks: z
      .array(z.string())
      .optional()
      .describe("Optional stack filter (e.g. python, dart, java)."),
  }),
  async execute({ rulesPath, stacks }, ctx) {
    const absolute = resolveUnderRoot(ctx.workspaceDir, rulesPath);
    const doc = await loadRulesFile(absolute);
    const flat = flattenRules(doc, stacks);
    return {
      rulesPath,
      version: doc.version,
      description: doc.description ?? null,
      stackNames: Object.keys(doc.stacks),
      selectedStacks: stacks ?? Object.keys(doc.stacks),
      ruleCount: flat.length,
      rules: flat.map((rule) => ({
        id: rule.id,
        stack: rule.stack,
        title: rule.title,
        severity: rule.severity,
        filePatterns: rule.effectiveFilePatterns,
        excludePatterns: rule.excludePatterns ?? [],
        rule: rule.rule,
      })),
    };
  },
});

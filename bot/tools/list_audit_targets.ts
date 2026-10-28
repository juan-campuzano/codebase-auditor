import path from "node:path";
import { prompt } from "@grok/agent-sdk";
import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { walkFiles } from "../lib/files.js";
import {
  flattenRules,
  loadRulesFile,
  resolveUnderRoot,
  rulesForFile,
} from "../lib/rules.js";

export default defineTool({
  description: prompt`
    List files under prepared repos that match the loaded audit rules.
    Returns each file with the applicable rule ids so you can review
    only relevant targets.
  `,
  effect: "read",
  inputSchema: z.object({
    rulesPath: z.string().default("rules/sample-rules.json"),
    repoIds: z
      .array(z.string())
      .min(1)
      .describe("Repo ids previously prepared under workspace/repos/."),
    stacks: z.array(z.string()).optional(),
    maxFilesPerRepo: z.number().int().positive().max(2000).default(400),
  }),
  async execute({ rulesPath, repoIds, stacks, maxFilesPerRepo }, ctx) {
    const absoluteRules = resolveUnderRoot(ctx.workspaceDir, rulesPath);
    const doc = await loadRulesFile(absoluteRules);
    const flat = flattenRules(doc, stacks);
    const includePatterns = [
      ...new Set(flat.flatMap((rule) => rule.effectiveFilePatterns)),
    ];

    const repos = [];
    for (const repoId of repoIds) {
      const repoRoot = resolveUnderRoot(
        ctx.workspaceDir,
        path.posix.join("repos", repoId),
      );
      const files = await walkFiles(repoRoot, {
        includePatterns,
        maxFiles: maxFilesPerRepo,
      });

      const targets = [];
      for (const file of files) {
        const applicable = rulesForFile(file.path, flat);
        if (applicable.length === 0) continue;
        targets.push({
          file: file.path,
          sizeBytes: file.sizeBytes,
          ruleIds: applicable.map((rule) => rule.id),
          stacks: [...new Set(applicable.map((rule) => rule.stack))],
          rules: applicable,
        });
      }

      repos.push({
        repoId,
        targetCount: targets.length,
        targets,
      });
    }

    return {
      rulesPath,
      ruleCount: flat.length,
      repos,
      guidance:
        "Review each target with read_code_file, apply only the listed natural-language rules, and call record_finding for confirmed issues. Then finalize_audit_report.",
    };
  },
});

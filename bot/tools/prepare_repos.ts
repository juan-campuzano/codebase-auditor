import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { prompt } from "@grok/agent-sdk";
import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import {
  copyTree,
  ensureEmptyDir,
  safeRepoSlug,
  walkFiles,
} from "../lib/files.js";
import { resolveUnderRoot } from "../lib/rules.js";

const RepoInput = z.object({
  id: z
    .string()
    .min(1)
    .optional()
    .describe("Stable id for this repo in findings and reports."),
  sourcePath: z
    .string()
    .min(1)
    .describe(
      "Absolute path, or workspace-relative path, to a local checkout to copy into the audit workspace.",
    ),
});

export default defineTool({
  description: prompt`
    Prepare one or more local repositories for auditing by copying them
    into workspace/repos/<id>. Use this for multi-repo audits so each
    repo has a stable id and path. Prefer fixture paths under
    fixtures/sample-repos/ for the PoC.
  `,
  effect: "idempotent",
  inputSchema: z.object({
    repos: z.array(RepoInput).min(1).max(20),
    reset: z
      .boolean()
      .default(true)
      .describe("When true, wipe workspace/repos before copying."),
  }),
  async execute({ repos, reset }, ctx) {
    const reposRoot = path.join(ctx.workspaceDir, "repos");
    if (reset) {
      await ensureEmptyDir(reposRoot);
    } else {
      await mkdir(reposRoot, { recursive: true });
    }

    const prepared: Array<{
      repoId: string;
      sourcePath: string;
      workspacePath: string;
      fileCount: number;
    }> = [];

    const usedIds = new Set<string>();

    for (const repo of repos) {
      const sourcePath = path.isAbsolute(repo.sourcePath)
        ? repo.sourcePath
        : resolveUnderRoot(ctx.workspaceDir, repo.sourcePath);

      await access(sourcePath);

      let repoId = repo.id ?? safeRepoSlug(sourcePath);
      if (usedIds.has(repoId)) {
        let i = 2;
        while (usedIds.has(`${repoId}-${i}`)) i += 1;
        repoId = `${repoId}-${i}`;
      }
      usedIds.add(repoId);

      const destination = path.join(reposRoot, repoId);
      await ensureEmptyDir(destination);
      await copyTree(sourcePath, destination);
      const files = await walkFiles(destination, { maxFiles: 5000 });

      prepared.push({
        repoId,
        sourcePath,
        workspacePath: path.posix.join("repos", repoId),
        fileCount: files.length,
      });
    }

    return {
      reposRoot: "repos",
      count: prepared.length,
      repos: prepared,
      nextStep:
        "Call load_rules, then list_audit_targets for each repo (or in one call with multiple repoIds). For multiple repos, delegate each repo to the repo-auditor subagent in parallel.",
    };
  },
});

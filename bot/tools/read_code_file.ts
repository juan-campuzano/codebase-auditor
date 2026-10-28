import path from "node:path";
import { prompt } from "@grok/agent-sdk";
import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { readTextFile } from "../lib/files.js";
import { resolveUnderRoot } from "../lib/rules.js";

export default defineTool({
  description: prompt`
    Read a source file from a prepared repo with line numbers.
    Use this when judging whether a natural-language rule is violated.
  `,
  effect: "read",
  inputSchema: z.object({
    repoId: z.string().min(1),
    file: z
      .string()
      .min(1)
      .describe("Path relative to the prepared repo root."),
    maxLines: z.number().int().positive().max(2000).default(800),
  }),
  async execute({ repoId, file, maxLines }, ctx) {
    const absolute = resolveUnderRoot(
      ctx.workspaceDir,
      path.posix.join("repos", repoId, file),
    );
    const { content, truncated, lineCount } = await readTextFile(absolute, {
      maxLines,
    });
    return {
      repoId,
      file,
      lineCount,
      truncated,
      content,
    };
  },
});

import { prompt } from "@grok/agent-sdk";
import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { appendFinding } from "../lib/report.js";
import { SeveritySchema } from "../lib/rules.js";

export default defineTool({
  description: prompt`
    Record one confirmed audit finding for the current audit id.
    Only call this for real violations of a loaded rule, not style nits
    outside the rules file.
  `,
  effect: "idempotent",
  inputSchema: z.object({
    auditId: z.string().min(1),
    ruleId: z.string().min(1),
    stack: z.string().min(1),
    severity: SeveritySchema,
    repoId: z.string().min(1),
    file: z.string().min(1),
    line: z.number().int().positive().optional(),
    title: z.string().min(1).max(160),
    detail: z.string().min(1).max(2000),
    evidence: z.string().max(2000).optional(),
  }),
  async execute(input, ctx) {
    const finding = {
      ruleId: input.ruleId,
      stack: input.stack,
      severity: input.severity,
      repoId: input.repoId,
      file: input.file,
      line: input.line,
      title: input.title,
      detail: input.detail,
      evidence: input.evidence,
    };
    await appendFinding(ctx.workspaceDir, input.auditId, finding);
    return {
      recorded: true,
      auditId: input.auditId,
      finding,
    };
  },
});

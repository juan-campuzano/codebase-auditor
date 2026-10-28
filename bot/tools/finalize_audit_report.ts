import path from "node:path";
import { prompt } from "@grok/agent-sdk";
import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import {
  readFindings,
  summarize,
  writeFinalReport,
  type AuditReport,
} from "../lib/report.js";

export default defineTool({
  description: prompt`
    Finalize the audit by writing report.json and report.md under
    audits/<auditId>/. Call once after all findings are recorded.
  `,
  effect: "idempotent",
  inputSchema: z.object({
    auditId: z.string().min(1),
    rulesPath: z.string().min(1),
    repoIds: z.array(z.string()).min(1),
    stacks: z.array(z.string()).default([]),
  }),
  async execute({ auditId, rulesPath, repoIds, stacks }, ctx) {
    const findings = await readFindings(ctx.workspaceDir, auditId);
    const report: AuditReport = {
      auditId,
      createdAt: new Date().toISOString(),
      rulesPath,
      repos: repoIds,
      stacks,
      findings,
      summary: summarize(findings),
    };
    const { jsonPath, markdownPath } = await writeFinalReport(
      ctx.workspaceDir,
      report,
    );
    return {
      auditId,
      summary: report.summary,
      reportJson: path.relative(ctx.workspaceDir, jsonPath),
      reportMarkdown: path.relative(ctx.workspaceDir, markdownPath),
      findings,
    };
  },
});

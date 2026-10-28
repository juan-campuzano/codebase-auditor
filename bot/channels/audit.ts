import { defineChannel, POST } from "@grok/agent-sdk/channels";
import * as z from "zod/v4";

const AuditBody = z.object({
  auditId: z.string().min(1).default("poc-audit"),
  rulesPath: z.string().default("rules/sample-rules.json"),
  stacks: z.array(z.string()).optional(),
  repos: z
    .array(
      z.object({
        id: z.string().optional(),
        sourcePath: z.string().min(1),
      }),
    )
    .min(1)
    .max(20),
});

export default defineChannel({
  routes: [
    POST("/run", {
      description:
        "Start a codebase audit for one or more local repository paths.",
      bodySchema: AuditBody,
      handler: async (_request, { callTool, send, waitUntil, body }) => {
        const prepared = await callTool("prepare_repos", {
          repos: body.repos,
          reset: true,
        });

        if (prepared.isError) {
          return Response.json(
            { ok: false, error: prepared.result },
            { status: 500 },
          );
        }

        const repoIds =
          (
            prepared.result as {
              repos?: Array<{ repoId: string }>;
            }
          ).repos?.map((repo) => repo.repoId) ?? [];

        const stacksLine =
          body.stacks && body.stacks.length > 0
            ? `Restrict stacks to: ${body.stacks.join(", ")}.`
            : "Use every stack in the rules file.";

        const message = [
          `Run a codebase audit.`,
          `auditId: ${body.auditId}`,
          `rulesPath: ${body.rulesPath}`,
          `repoIds: ${repoIds.join(", ")}`,
          stacksLine,
          repoIds.length > 1
            ? "Audit every repo at the same time via the repo-auditor subagent, then finalize_audit_report."
            : "Audit the repo, record findings, then finalize_audit_report.",
        ].join("\n");

        waitUntil(
          send(message, {
            continuationToken: `audit:${body.auditId}`,
            title: `Audit ${body.auditId}`,
            state: {
              auditId: body.auditId,
              rulesPath: body.rulesPath,
              repoIds,
            },
          }),
        );

        return new Response(null, { status: 202 });
      },
    }),
  ],
});

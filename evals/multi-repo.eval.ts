import { defineEval } from "@grok/agent-sdk/evals";

export default defineEval({
  tags: ["multi-repo", "poc"],
  description:
    "Prepares python + dart fixtures and starts a multi-repo audit flow.",
  async test(t) {
    await t.send(
      [
        "Run the multi-repo PoC audit with auditId poc-multi.",
        "Prepare fixtures/sample-repos/python-service as python-service and",
        "fixtures/sample-repos/dart-app as dart-app.",
        "Use rules/sample-rules.json.",
        "Audit both repos at the same time via the repo-auditor subagent,",
        "record findings, and finalize the report.",
      ].join(" "),
    );
    t.succeeded();
    t.calledTool("prepare_repos");
    t.calledTool("load_rules");
    t.calledTool("finalize_audit_report");
  },
});

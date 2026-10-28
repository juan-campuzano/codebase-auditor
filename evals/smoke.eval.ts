import { defineEval } from "@grok/agent-sdk/evals";

export default defineEval({
  tags: ["smoke"],
  description: "Loads sample rules and prepares the python fixture repo.",
  async test(t) {
    await t.send(
      [
        "Load rules/sample-rules.json.",
        "Prepare only fixtures/sample-repos/python-service as repo id python-service.",
        "List audit targets for python-service.",
        "Do not finalize yet; just confirm how many targets and which rule ids apply to app/main.py.",
      ].join(" "),
    );
    t.succeeded();
    t.calledTool("load_rules");
    t.calledTool("prepare_repos");
    t.calledTool("list_audit_targets");
  },
});

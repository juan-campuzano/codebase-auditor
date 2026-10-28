import { defineAgent } from "@grok/agent-sdk";

export default defineAgent({
  description:
    "Audit a single prepared repository against the loaded JSON rules. Use one task per repo during multi-repo audits.",
});

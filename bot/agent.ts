import { defineAgent } from "@grok/agent-sdk";

export default defineAgent({
  model: {
    id: "grok-4.7",
    params: [
      { id: "reasoning_effort", value: "high" },
      { id: "fast", value: "true" },
    ],
  },
  tools: ["read", "grep", "task"],
  local: {
    // Keep cwd outside any nested checkout; session workspace gets sandbox seeds.
    sandbox: true,
  },
});

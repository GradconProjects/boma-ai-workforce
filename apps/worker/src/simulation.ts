import { MockProvider, PriceTable, type LlmRequest } from "@boma/llm";

/**
 * Simulation mode (BOMA_SIMULATION=1): scripted providers so the whole flow (Chief, dual review,
 * approvals, studio) can be used before API keys exist. Every simulated output is labelled as
 * such wherever it is shown; nothing is presented as real AI work. Costs are recorded as A$0.
 */

export const SIM_MODELS = {
  ANTHROPIC_MODEL_MAKER: "sim-claude-maker",
  ANTHROPIC_MODEL_CHEAP: "sim-claude-cheap",
  OPENAI_MODEL_CHECKER: "sim-openai-checker",
};

export const simulationPrices = () =>
  new PriceTable({
    anthropic: {
      "sim-claude-maker": { input: 0, output: 0 },
      "sim-claude-cheap": { input: 0, output: 0 },
    },
    openai: { "sim-openai-checker": { input: 0, output: 0 } },
  });

const pick = (input: string, label: string) =>
  new RegExp(`${label}:\\s*([^.\\n]+)`, "i").exec(input)?.[1]?.trim() ?? "";

function simulatedCopy(input: string) {
  const brand = /for a .+? for (.+?)\. Campaign/.exec(input)?.[1] ?? "your business";
  const objective = pick(input, "Campaign objective") || "Something worth knowing about";
  const cta = pick(input, "Call to action").replace(/^your choice$/i, "") || "Find out more";
  const headline = objective.length > 56 ? `${objective.slice(0, 53).trimEnd()}…` : objective;
  return [
    `EYEBROW: ${brand}`.slice(0, 40),
    `HEADLINE: ${headline}`,
    "SUBHEAD: [Simulated copy] Connect API keys for real, reviewed copy.",
    "BODY: This text was produced in simulation mode and has not been written or checked by any AI model.",
    `CTA: ${cta.slice(0, 24)}`,
  ].join("\n");
}

export function simulationProviders() {
  const anthropic = new MockProvider("anthropic", (req: LlmRequest) => {
    switch (req.schemaName) {
      case "classification":
        return {
          json: {
            intent: "new_job",
            clarifying_question: null,
            control: null,
            summary: "simulated",
          },
        };
      case "plan":
        return {
          json: {
            reply: "🧪 Simulation: here's a sample plan (no real AI was used).",
            tasks: [
              {
                kind: "draft_post",
                workspace: "ongroundpm",
                brief: req.input.slice(0, 200),
                scheduled_for: null,
              },
            ],
            unsupported: [],
            permission_changes_requested: [],
          },
        };
      case "answer":
        return { json: { answer: "🧪 Simulation mode: connect API keys for real answers." } };
      case "maker_output": {
        const isCopy = /labelled lines/i.test(req.system);
        return {
          json: {
            text: isCopy
              ? simulatedCopy(req.input)
              : "🧪 [Simulated post] This draft was produced in simulation mode. Connect API keys for real, reviewed copy.",
            claims: [],
          },
        };
      }
      default:
        return { json: {} };
    }
  });
  const openai = new MockProvider("openai", () => ({
    json: {
      verdict: "pass",
      score: 0,
      issues: [],
      claims_checked: [],
      injection_detected: false,
      summary: "Simulated review: not a real check.",
    },
  }));
  return { anthropic, openai };
}

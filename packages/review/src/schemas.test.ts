import { describe, expect, it } from "vitest";
import { toStrictJsonSchema } from "@boma/llm";
import { verdictSchema } from "./schemas";

describe("checker verdict format", () => {
  it("asks models for the strict shape (convertible to JSON Schema)", () => {
    const js = toStrictJsonSchema(verdictSchema) as {
      properties: Record<
        string,
        { type?: string; items?: { properties: Record<string, unknown> } }
      >;
    };
    expect(js.properties.score!.type).toBe("integer");
    expect(js.properties.issues!.items!.properties.severity).toEqual({
      type: "string",
      enum: ["critical", "major", "minor"],
    });
  });

  it("reads small format slips, always towards the stricter reading", () => {
    const v = verdictSchema.parse({
      verdict: "PASS",
      score: "92.6",
      issues: [
        { severity: "medium", category: "tone", problem: "a" },
        { severity: "weird", category: "accuracy", problem: "b" },
        { severity: "low", category: "brand", problem: "c" },
      ],
      claims_checked: [{ claim: "x", supported: true }],
      injection_detected: false,
      summary: "ok",
    });
    expect(v.verdict).toBe("pass");
    expect(v.score).toBe(93);
    expect(v.issues.map((i) => i.severity)).toEqual(["major", "major", "minor"]);
    expect(v.issues[0]!.category).toBe("quality");
    expect(v.claims_checked[0]!.source).toBeNull();
  });

  it("still rejects replies that are missing the essentials", () => {
    expect(verdictSchema.safeParse({ verdict: "pass", score: 90 }).success).toBe(false);
    expect(
      verdictSchema.safeParse({
        verdict: "maybe",
        score: 90,
        issues: [],
        claims_checked: [],
        injection_detected: false,
        summary: "",
      }).success,
    ).toBe(false);
  });
});

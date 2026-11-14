import { z } from "zod";
import { MalformedOutputError } from "./types";

/**
 * JSON Schema for provider structured outputs. Both providers' strict modes need every object
 * closed (additionalProperties: false) with all properties required, and they support only a
 * subset of keywords, so numeric/length constraints are stripped here and enforced afterwards
 * by validating the parsed result with the original zod schema.
 */
const UNSUPPORTED = new Set([
  "$schema",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "pattern",
  "format",
  "default",
]);

function strictify(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictify);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (!UNSUPPORTED.has(k)) out[k] = strictify(v);
  }
  if (out.type === "object" && out.properties && typeof out.properties === "object") {
    out.additionalProperties = false;
    out.required = Object.keys(out.properties as object);
  }
  return out;
}

const WIRE = Symbol.for("boma.wireSchema");

/**
 * Pair a tolerant parsing schema (with preprocessing that JSON Schema can't express) with the
 * strict schema the model is asked to follow. Providers send the strict one; replies are
 * validated with the tolerant one.
 */
export function withWireSchema<T extends z.ZodType>(lenient: T, wire: z.ZodType): T {
  (lenient as unknown as Record<symbol, z.ZodType>)[WIRE] = wire;
  return lenient;
}

export function toStrictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const wire = (schema as unknown as Record<symbol, z.ZodType | undefined>)[WIRE] ?? schema;
  return strictify(z.toJSONSchema(wire, { target: "draft-7" })) as Record<string, unknown>;
}

export function parseStructured<T>(text: string, schema: z.ZodType<T>): T {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new MalformedOutputError("model output was not valid JSON");
  }
  const result = schema.safeParse(data);
  if (!result.success) {
    const where = result.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new MalformedOutputError(`model output did not match the schema (${where.join("; ")})`);
  }
  return result.data;
}

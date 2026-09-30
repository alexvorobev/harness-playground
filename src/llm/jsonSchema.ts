import { z } from "zod";

// Keywords the structured-outputs API rejects. Zod still enforces them when we parse the reply.
const UNSUPPORTED_KEYWORDS = new Set([
  "$schema",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
]);

// Keys directly inside `properties` are field names, not keywords, so they are never stripped.
const strip = (node: unknown, isPropertiesMap = false): unknown => {
  if (Array.isArray(node)) return node.map((item) => strip(item));
  if (typeof node !== "object" || node === null) return node;

  return Object.fromEntries(
    Object.entries(node)
      .filter(([key]) => isPropertiesMap || !UNSUPPORTED_KEYWORDS.has(key))
      .map(([key, value]) => [key, strip(value, !isPropertiesMap && key === "properties")]),
  );
};

export const toApiSchema = (schema: z.ZodType): Record<string, unknown> =>
  strip(z.toJSONSchema(schema)) as Record<string, unknown>;

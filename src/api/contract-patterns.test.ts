import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { CreateProductBody } from "./generated/products/products.zod";
import { AdjustStockBody } from "./generated/stock-movements/stock-movements.zod";
import { CreateUserBody } from "./generated/users/users.zod";

function collectPatterns(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(collectPatterns);
  if (!node || typeof node !== "object") return [];
  return Object.entries(node).flatMap(([key, value]) =>
    key === "pattern" && typeof value === "string" ? [value] : collectPatterns(value),
  );
}

const patterns = collectPatterns(parse(readFileSync("openapi/openapi.yaml", "utf8")));

// The text fields whose pattern refuses a value that is blank in any script (products R2, R4).
const blankRefusing = {
  "Product name": CreateProductBody.shape.name,
  "Product unit": CreateProductBody.shape.unit,
  "User name": CreateUserBody.shape.name,
  "Adjustment note": AdjustStockBody.shape.note,
};

describe("the contract's patterns, read the way the generated client reads them", () => {
  it("finds the contract's patterns", () => {
    expect(patterns.length).toBeGreaterThan(0);
  });

  it.each(patterns)("%s compiles", (pattern) => {
    expect(() => new RegExp(pattern)).not.toThrow();
  });

  describe.each(Object.entries(blankRefusing))("%s", (_field, schema) => {
    it.each(["p", "Z", "{", "}", "x{85}", "pZ{}"])("accepts %j", (value) => {
      expect(schema.safeParse(value).success).toBe(true);
    });

    it.each([
      ["U+00A0", " "],
      ["U+3000", "　"],
      ["U+0085", "\u0085"],
      ["U+2028", " "],
      ["a space", " "],
    ])("refuses only %s", (_label, value) => {
      expect(schema.safeParse(value).success).toBe(false);
    });
  });
});

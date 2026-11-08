import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import { CreateProductBody } from "./generated/products/products.zod";

// products R2, R4: a Product's name is refused when it is blank in any script.
const patterns: string[] = [];
(function collect(node: unknown) {
  if (Array.isArray(node)) {
    node.forEach(collect);
  } else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "pattern" && typeof value === "string") patterns.push(value);
      else collect(value);
    }
  }
})(parse(readFileSync("openapi/openapi.yaml", "utf8")));

const nameAccepts = (name: string) => CreateProductBody.shape.name.safeParse(name).success;

describe("the contract's patterns, read the way the generated client reads them", () => {
  it("finds the contract's patterns", () => {
    expect(patterns.length).toBeGreaterThan(0);
  });

  it.each(patterns)("%s compiles", (pattern) => {
    expect(() => new RegExp(pattern)).not.toThrow();
  });

  it.each(["p", "Z", "{", "}", "x{85}", "pZ{}"])("accepts a name containing %j", (name) => {
    expect(nameAccepts(name)).toBe(true);
  });

  it.each([
    ["U+00A0", " "],
    ["U+3000", "　"],
    ["U+0085", "\u0085"],
    ["U+2028", " "],
    ["a space", " "],
  ])("refuses a name of only %s", (_label, name) => {
    expect(nameAccepts(name)).toBe(false);
  });
});

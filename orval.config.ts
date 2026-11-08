import { defineConfig } from "orval";

// The contract types an optional array as `["array", "null"]`. Orval only repeats a key per value
// (`stock=low&stock=out-of-stock`, as the contract says) for a plain `array`, and otherwise joins
// the values with commas, which the API would not read as two states. A query array that may be
// left out is the same array for the client, so the null is dropped here, not in the contract.
function arraysOnly(spec: any) {
  for (const path of Object.values<any>(spec.paths ?? {})) {
    for (const operation of Object.values<any>(path)) {
      for (const parameter of operation?.parameters ?? []) {
        const { schema } = parameter;
        if (
          parameter.in === "query" &&
          Array.isArray(schema?.type) &&
          schema.type.includes("array")
        ) {
          schema.type = "array";
        }
      }
    }
  }
  return spec;
}

// The contract's patterns are Go regexes (`\x{85}`); JavaScript's `u` flag spells that `\u{85}`.
function jsPatterns(node: any) {
  if (Array.isArray(node)) {
    node.forEach(jsPatterns);
  } else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries<any>(node)) {
      if (key === "pattern" && typeof value === "string") {
        node[key] = value.replace(/\\x\{([0-9a-fA-F]+)\}/g, "\\u{$1}");
      } else {
        jsPatterns(value);
      }
    }
  }
}

function toClientSpec(spec: any) {
  jsPatterns(spec);
  return arraysOnly(spec);
}

const input = { target: "./openapi/openapi.yaml", override: { transformer: toClientSpec } };

export default defineConfig({
  client: {
    input,
    output: {
      target: "./src/api/generated/client.ts",
      schemas: "./src/api/generated/model",
      mode: "tags-split",
      client: "react-query",
      httpClient: "fetch",
      baseUrl: "/api",
      mock: { generators: [{ type: "msw", baseUrl: "*/api", generateEachHttpStatus: true }] },
      clean: true,
      override: {
        // Orval's own fetch resolves on a 503, so Query would call it a success (ADR 0004).
        mutator: { path: "./src/api/fetcher.ts", name: "apiFetch" },
        fetch: { includeHttpResponseReturnType: false },
        operations: {
          // A POST only to keep the token out of request logs: it reads, so it is a query.
          "read-setup-link": { query: { useQuery: true, useMutation: false } },
        },
      },
    },
  },
  zod: {
    input,
    output: {
      target: "./src/api/generated/zod.ts",
      mode: "tags-split",
      client: "zod",
      fileExtension: ".zod.ts",
    },
  },
});

import { defineConfig } from "orval";

const input = { target: "./openapi/openapi.yaml" };

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
      mock: { generators: [{ type: "msw", generateEachHttpStatus: true }] },
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

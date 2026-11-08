import { beforeEach, describe, expect, it } from "vitest";

import { apiFetch } from "@/api/fetcher";

import { mockApi } from "./handlers";

beforeEach(() => {
  mockApi.session = "live";
  mockApi.role = "owner";
});

// The mocks answer what the contract's API answers (testing.md, "Keep the fakes honest"): a
// request the contract refuses is refused here too, or a test passes against a fake.
describe("the mock API", () => {
  describe("a list's limit, an integer from 1 to 100", () => {
    const lists = ["/api/products", "/api/stock-movements", "/api/orders", "/api/login-log"];

    it.each(lists)("answers %s with 100 and refuses 101", async (path) => {
      await expect(apiFetch(`${path}?limit=100`)).resolves.toBeDefined();
      await expect(apiFetch(`${path}?limit=101`)).rejects.toMatchObject({
        status: 422,
        problem: { errors: [{ location: "query.limit" }] },
      });
    });

    it.each(["0", "-1", "2.5", "many"])("refuses a limit of %s", async (limit) => {
      await expect(apiFetch(`/api/orders?limit=${limit}`)).rejects.toMatchObject({ status: 422 });
    });
  });

  describe("the Sales report's from and to, dates as YYYY-MM-DD", () => {
    it.each([
      ["from", "2026-11-1"],
      ["from", "yesterday"],
      ["from", "2026-13-01"],
      ["from", "2026-02-30"],
      ["to", "07/11/2026"],
      ["to", "2026-11-07T00:00:00Z"],
    ])("refuses a malformed %s of %s", async (name, value) => {
      await expect(apiFetch(`/api/reports/sales?${name}=${value}`)).rejects.toMatchObject({
        status: 422,
        problem: { errors: [{ location: `query.${name}` }] },
      });
    });

    it("answers a real range", async () => {
      await expect(
        apiFetch("/api/reports/sales?from=2026-02-01&to=2026-02-28"),
      ).resolves.toMatchObject({ from: "2026-02-01", to: "2026-02-28" });
    });
  });
});

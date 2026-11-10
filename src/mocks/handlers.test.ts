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

// context ADR 0009: numbered and legacy modes remain distinct at the API boundary.
describe.each(["/api/stock-movements", "/api/login-log"])("history modes at %s", (path) => {
  it("returns exact zero only in numbered mode, including an out-of-range offset", async () => {
    await expect(apiFetch(`${path}?offset=0&limit=10`)).resolves.toMatchObject({
      total: 0,
      nextBefore: null,
    });
    await expect(apiFetch(`${path}?offset=100&limit=10`)).resolves.toMatchObject({ total: 0 });
    const legacy = await apiFetch(`${path}?before=99&limit=10`);
    expect(legacy).not.toHaveProperty("total");
  });
  it.each(["-1", "1.5", "bad", "9007199254740992", "2147483648", "0&before=1"])(
    "refuses invalid offset %s",
    async (offset) => {
      await expect(apiFetch(`${path}?offset=${offset}`)).rejects.toMatchObject({ status: 422 });
    },
  );
  it("protects numbered records and counts with existing authorization", async () => {
    mockApi.session = "none";
    await expect(apiFetch(`${path}?offset=0`)).rejects.toMatchObject({ status: 401 });
    mockApi.session = "live";
    mockApi.role = "staff";
    if (path.endsWith("login-log")) {
      await expect(apiFetch(`${path}?offset=0`)).rejects.toMatchObject({ status: 403 });
    } else {
      await expect(apiFetch(`${path}?offset=0`)).resolves.toMatchObject({ total: 0 });
    }
  });
});

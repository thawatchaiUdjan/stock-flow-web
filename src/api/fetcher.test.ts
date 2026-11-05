import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { server } from "@/test/server";

import { ApiError, apiFetch } from "./fetcher";

const problem = {
  status: 422,
  title: "Unprocessable Entity",
  detail: "validation failed",
  errors: [{ location: "body.quantity", message: "expected number >= 1", value: 0 }],
};

describe("apiFetch", () => {
  it("returns the parsed body of a successful response", async () => {
    server.use(http.get("*/api/things", () => HttpResponse.json({ name: "a" })));

    await expect(apiFetch("/api/things")).resolves.toEqual({ name: "a" });
  });

  it("returns undefined for a response with no body", async () => {
    server.use(http.delete("*/api/things/1", () => new HttpResponse(null, { status: 204 })));

    await expect(apiFetch("/api/things/1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("passes the request through as given", async () => {
    let sent: { method: string; body: unknown } | undefined;
    server.use(
      http.post("*/api/things", async ({ request }) => {
        sent = { method: request.method, body: await request.json() };
        return HttpResponse.json({});
      }),
    );

    await apiFetch("/api/things", { method: "POST", body: JSON.stringify({ quantity: 2 }) });

    expect(sent).toEqual({ method: "POST", body: { quantity: 2 } });
  });

  it("rejects with the Problem Details the API sent, field locations included", async () => {
    server.use(
      http.post("*/api/things", () =>
        HttpResponse.json(problem, {
          status: 422,
          headers: { "Content-Type": "application/problem+json" },
        }),
      ),
    );

    const error = await apiFetch("/api/things", { method: "POST" }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, problem });
  });

  // A failure from Vercel's edge, before the api answers, is HTML and not Problem Details.
  it("still rejects with the status when an error body is not JSON", async () => {
    server.use(
      http.get(
        "*/api/things",
        () =>
          new HttpResponse("<html>Bad Gateway</html>", { status: 502, statusText: "Bad Gateway" }),
      ),
    );

    const error = await apiFetch("/api/things").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, problem: { status: 502, title: "Bad Gateway" } });
  });
});

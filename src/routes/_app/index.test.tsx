import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { mockApi } from "@/mocks/handlers";
import { renderApp } from "@/test/render-app";

describe("the root address", () => {
  it("opens the landing page", async () => {
    mockApi.session = "live";
    const { router } = renderApp("/");

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard");
  });
});

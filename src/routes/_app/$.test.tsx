import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { mockApi } from "@/mocks/handlers";
import { renderApp } from "@/test/render-app";

describe("an address that is no page", () => {
  it("says so inside the shell and links to the landing page", async () => {
    mockApi.session = "live";
    const { user } = renderApp("/no-such-page");

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Go to Dashboard" }));

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });
});

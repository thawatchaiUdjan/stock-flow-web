import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { mockApi } from "@/mocks/handlers";
import { renderApp } from "@/test/render-app";

describe("the Dashboard", () => {
  // users-and-access R40
  it("shows its title and Coming soon", async () => {
    mockApi.session = "live";
    renderApp("/dashboard");

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });
});

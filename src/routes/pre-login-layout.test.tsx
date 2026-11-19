import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderApp } from "@/test/render-app";

// docs/design.md, Layout: every pre-login screen shares one brand panel beside its form (#79).
const screens = [
  ["Login", "/login"],
  ["Forgot password", "/forgot-password"],
  ["Reset password", "/reset-password"],
  ["Set password", "/set-password"],
  ["Password setup", "/password-setup"],
] as const;

describe("Pre-login screens", () => {
  it.each(screens)("%s shows the StockFlow brand panel beside its form", async (_name, path) => {
    renderApp(path);

    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByText("StockFlow")).toBeInTheDocument();
    expect(screen.getByText("See what is in stock")).toBeInTheDocument();
    expect(screen.getByText("Spot what is running low")).toBeInTheDocument();
    expect(screen.getByText("Create orders and see stock update")).toBeInTheDocument();
  });
});

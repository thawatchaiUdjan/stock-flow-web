import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getGetHealthMockHandler503 } from "@/api/generated/health/health.msw";
import { createAppRouter } from "@/router";
import { server } from "@/test/server";

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createAppRouter(createMemoryHistory({ initialEntries: ["/"] }));

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("the index route", () => {
  it("shows the status the API reports", async () => {
    renderApp();

    expect(await screen.findByText("API status: ok")).toBeInTheDocument();
  });

  it("says the API is unavailable when it answers 503", async () => {
    server.use(
      getGetHealthMockHandler503({
        status: 503,
        title: "Service Unavailable",
        detail: "database unreachable",
      }),
    );

    renderApp();

    expect(await screen.findByText("API unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/database unreachable/)).not.toBeInTheDocument();
  });
});

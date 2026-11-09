import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getListOrdersMockHandler500 } from "@/api/generated/orders/orders.msw";
import { mockApi, orderOf, productOf, serverFailure } from "@/mocks/handlers";
import { renderApp } from "@/test/render-app";
import { server } from "@/test/server";

const helmet = productOf({
  id: 1,
  name: "Safety helmet",
  sku: "HLM-001",
  unit: "pcs",
  price: 48_210_00,
  stock: 18,
});
const gloves = productOf({
  id: 2,
  name: "Work gloves",
  sku: "GLV-010",
  unit: "box",
  price: 1_250_50,
  stock: 233,
});
const anan = { id: 2, name: "Anan Chaiyo" };

function signedIn(role: "owner" | "admin" | "staff") {
  mockApi.session = "live";
  mockApi.role = role;
}

function order(number: number, changes: Partial<Parameters<typeof orderOf>[0]> = {}) {
  return orderOf({
    number,
    createdAt: "2026-11-05T14:12:00Z",
    createdBy: anan,
    customer: "Somchai Jaidee",
    lines: [
      {
        product: { id: helmet.id, name: helmet.name, sku: helmet.sku },
        quantity: 1,
        price: 100_00,
      },
    ],
    ...changes,
  });
}

// The address of every request the app made to `path`.
function requestsTo(path: string) {
  const sent: URL[] = [];
  server.events.on("request:start", ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname === path) sent.push(url);
  });
  return sent;
}

describe("the Orders List", () => {
  // orders R15
  it("shows each Order's number, created date and time, customer, number of lines, total and status in words, newest first", async () => {
    signedIn("owner");
    mockApi.orders = [
      order(1, { createdAt: "2026-11-04T09:05:00Z", status: "completed", customer: "Mali Chai" }),
      order(3, {
        createdAt: "2026-11-06T10:00:00Z",
        customer: "Somchai Jaidee",
        lines: [
          {
            product: { id: helmet.id, name: helmet.name, sku: helmet.sku },
            quantity: 2,
            price: 48_210_00,
          },
          {
            product: { id: gloves.id, name: gloves.name, sku: gloves.sku },
            quantity: 3,
            price: 1_250_50,
          },
        ],
      }),
      order(2, { createdAt: "2026-11-05T14:12:00Z", status: "cancelled", customer: "" }),
    ];
    renderApp("/orders");

    await screen.findByRole("link", { name: "#3" });
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      "#36 Nov, 10:00Somchai Jaidee2฿100,171.50Pending",
      "#25 Nov, 14:12No customer1฿100.00Cancelled",
      "#14 Nov, 09:05Mali Chai1฿100.00Completed",
    ]);
  });

  // orders R18
  it("shows every Order to Staff", async () => {
    signedIn("staff");
    mockApi.orders = [order(7, { createdBy: { id: 1, name: "Nok Srisuk" } })];
    renderApp("/orders");

    expect(await screen.findByRole("link", { name: "#7" })).toBeInTheDocument();
  });

  it("opens the Order's detail from its row", async () => {
    signedIn("owner");
    mockApi.orders = [order(12)];
    const { user, router } = renderApp("/orders");

    await user.click(await screen.findByRole("link", { name: "#12" }));

    expect(await screen.findByRole("heading", { name: "Order #12" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/orders/12");
  });

  // orders R14, ADR 0007: a mistake is cancelled and created again.
  it("offers no way to edit an Order", async () => {
    signedIn("owner");
    mockApi.orders = [order(12)];
    renderApp("/orders");

    await screen.findByRole("link", { name: "#12" });
    expect(screen.queryByRole("link", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
  });

  it("leads from New order to Create Order", async () => {
    signedIn("staff");
    mockApi.orders = [order(12)];
    renderApp("/orders");

    await screen.findByRole("link", { name: "#12" });
    expect(
      within(screen.getByRole("main")).getByRole("link", { name: "New order" }),
    ).toHaveAttribute("href", "/orders/new");
  });

  it("says there are no Orders yet, and offers New order", async () => {
    signedIn("staff");
    renderApp("/orders");

    expect(
      await screen.findByText("No orders yet. Create the first order to record a sale."),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("main")).getByRole("link", { name: "New order" }),
    ).toBeInTheDocument();
  });

  it("says when the API fails, and tries again", async () => {
    signedIn("owner");
    server.use(getListOrdersMockHandler500(serverFailure));
    const { user } = renderApp("/orders");

    expect(await screen.findByText("Something went wrong. Try again.")).toBeInTheDocument();
    server.resetHandlers();
    mockApi.orders = [order(12)];
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("link", { name: "#12" })).toBeInTheDocument();
  });

  describe("search and status", () => {
    // orders R16, ADR 0008
    it("searches by number or customer, and the search lives in the address", async () => {
      signedIn("owner");
      mockApi.orders = [
        order(11, { customer: "Mali Chai" }),
        order(12, { customer: "Somchai Jaidee" }),
        order(13, { customer: "Napa Somboon" }),
      ];
      const sent = requestsTo("/api/orders");
      const { user, router } = renderApp("/orders");
      await screen.findByRole("link", { name: "#13" });

      await user.type(screen.getByLabelText("Search"), "SOM");

      await waitFor(() => {
        expect(screen.getAllByRole("link", { name: /^#/ }).map((one) => one.textContent)).toEqual([
          "#13",
          "#12",
        ]);
      });
      expect(router.state.location.search).toEqual({ search: "SOM" });
      expect(sent.at(-1)?.searchParams.get("search")).toBe("SOM");

      await user.clear(screen.getByLabelText("Search"));
      await user.type(screen.getByLabelText("Search"), "11");
      await waitFor(() => {
        expect(screen.getAllByRole("link", { name: /^#/ }).map((one) => one.textContent)).toEqual([
          "#11",
        ]);
      });
    });

    it("filters by status, and the status lives in the address", async () => {
      signedIn("owner");
      mockApi.orders = [
        order(11, { status: "completed" }),
        order(12),
        order(13, { status: "cancelled" }),
      ];
      const sent = requestsTo("/api/orders");
      const { user, router } = renderApp("/orders");
      await screen.findByRole("link", { name: "#13" });

      await user.selectOptions(screen.getByLabelText("Status"), "Pending");

      await waitFor(() => {
        expect(screen.getAllByRole("link", { name: /^#/ }).map((one) => one.textContent)).toEqual([
          "#12",
        ]);
      });
      expect(router.state.location.search).toEqual({ status: "pending" });
      expect(sent.at(-1)?.searchParams.get("status")).toBe("pending");
    });

    it("opens with the search and status of the address", async () => {
      signedIn("owner");
      mockApi.orders = [
        order(11, { customer: "Somchai Jaidee", status: "completed" }),
        order(12, { customer: "Somchai Jaidee" }),
        order(13, { customer: "Mali Chai" }),
      ];
      const sent = requestsTo("/api/orders");
      renderApp("/orders?search=somchai&status=completed");

      expect(await screen.findByRole("link", { name: "#11" })).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "#12" })).not.toBeInTheDocument();
      expect(screen.getByLabelText("Search")).toHaveValue("somchai");
      expect(screen.getByLabelText("Status")).toHaveDisplayValue("Completed");
      expect(sent.at(-1)?.searchParams.get("search")).toBe("somchai");
      expect(sent.at(-1)?.searchParams.get("status")).toBe("completed");
    });

    // ADR 0008: the box keeps what was typed; the router's JSON reading would make 1e3 the number 1000.
    it.each(["1e3", "1.50", "12345678901234567890"])(
      "keeps a search of %s exactly as it is written in the address",
      async (text) => {
        signedIn("owner");
        mockApi.orders = [order(12)];
        const sent = requestsTo("/api/orders");
        renderApp(`/orders?search=${text}`);

        await screen.findByText("No orders match these filters.");
        expect(screen.getByLabelText("Search")).toHaveValue(text);
        expect(sent.at(-1)?.searchParams.get("search")).toBe(text);
      },
    );

    it("keeps a search of 1e3 that the person types", async () => {
      signedIn("owner");
      mockApi.orders = [order(12)];
      const sent = requestsTo("/api/orders");
      const { user, router } = renderApp("/orders");
      await screen.findByRole("link", { name: "#12" });

      await user.type(screen.getByLabelText("Search"), "1e3");

      await waitFor(() => expect(sent.at(-1)?.searchParams.get("search")).toBe("1e3"));
      expect(router.state.location.search).toEqual({ search: "1e3" });
      expect(screen.getByLabelText("Search")).toHaveValue("1e3");
    });

    it("drops a status the API wouldn't accept instead of sending it", async () => {
      signedIn("owner");
      mockApi.orders = [order(12)];
      const sent = requestsTo("/api/orders");
      renderApp("/orders?status=shipped");

      await screen.findByRole("link", { name: "#12" });
      expect(sent.at(-1)?.searchParams.has("status")).toBe(false);
    });

    it("says nothing matches, and clears the filters", async () => {
      signedIn("owner");
      mockApi.orders = [order(12, { customer: "Mali Chai" })];
      const { user, router } = renderApp("/orders?search=nobody");

      expect(await screen.findByText("No orders match these filters.")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Clear filters" }));

      expect(await screen.findByRole("link", { name: "#12" })).toBeInTheDocument();
      expect(router.state.location.search).toEqual({});
      expect(screen.getByLabelText("Search")).toHaveValue("");
    });
  });

  describe("paging", () => {
    function manyOrders(count: number) {
      return Array.from({ length: count }, (_, i) => order(i + 1));
    }

    it("shows 50 Orders a page, newest first, and moves between pages", async () => {
      signedIn("owner");
      mockApi.orders = manyOrders(60);
      const sent = requestsTo("/api/orders");
      const { user, router } = renderApp("/orders?size=50");

      expect(await screen.findByText("Page 1 of 2 ? 60 matching")).toBeInTheDocument();
      expect(screen.getAllByRole("link", { name: /^#/ })).toHaveLength(50);
      expect(screen.getByRole("link", { name: "#60" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();

      await user.click(screen.getByRole("button", { name: "Next page" }));

      expect(await screen.findByText("Page 2 of 2 ? 60 matching")).toBeInTheDocument();
      expect(screen.getAllByRole("link", { name: /^#/ }).map((one) => one.textContent)).toEqual(
        Array.from({ length: 10 }, (_, i) => `#${10 - i}`),
      );
      expect(router.state.location.search).toEqual({ page: 2, size: 50 });
      expect(sent.at(-1)?.searchParams.get("offset")).toBe("50");
      expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();

      await user.click(screen.getByRole("button", { name: "Previous page" }));

      expect(await screen.findByText("Page 1 of 2 ? 60 matching")).toBeInTheDocument();
    });

    it("keeps disabled paging when one page holds every Order", async () => {
      signedIn("owner");
      mockApi.orders = manyOrders(3);
      renderApp("/orders");

      await screen.findByRole("link", { name: "#3" });
      expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    });
  });
});

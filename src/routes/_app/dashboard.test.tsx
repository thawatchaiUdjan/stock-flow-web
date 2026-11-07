import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  getGetDashboardMockHandler200,
  getGetDashboardMockHandler500,
} from "@/api/generated/dashboard-and-reports/dashboard-and-reports.msw";
import type { DashboardOutputBody } from "@/api/generated/model";
import { mockApi, orderOf, productOf, serverFailure } from "@/mocks/handlers";
import { renderApp } from "@/test/render-app";
import { server } from "@/test/server";

const day = 24 * 60 * 60 * 1000;
const anan = { id: 2, name: "Anan Chaiyo" };

const helmet = productOf({
  id: 1,
  name: "Safety helmet",
  sku: "HLM-001",
  unit: "pcs",
  price: 100_00,
  minimumStock: 60,
  stock: 18,
});
const gloves = productOf({
  id: 2,
  name: "Work gloves",
  sku: "GLV-010",
  unit: "box",
  price: 50_00,
  minimumStock: 20,
  stock: 0,
});
const boots = productOf({
  id: 3,
  name: "Steel boots",
  sku: "BTS-300",
  unit: "pair",
  price: 900_00,
  minimumStock: 5,
  stock: 40,
});

function signedIn(role: "owner" | "admin" | "staff") {
  mockApi.session = "live";
  mockApi.role = role;
}

// An Order for `quantity` helmets, completed `daysAgo` days ago when it is (and Pending when not).
function order(number: number, quantity: number, daysAgo?: number, status?: "cancelled") {
  const at = new Date(Date.now() - (daysAgo ?? 0) * day).toISOString();
  return orderOf({
    number,
    createdAt: at,
    createdBy: anan,
    customer: `Customer ${number}`,
    lines: [
      {
        product: { id: helmet.id, name: helmet.name, sku: helmet.sku },
        quantity,
        price: helmet.price,
      },
    ],
    ...(daysAgo !== undefined && {
      status: "completed" as const,
      completed: { at, by: anan },
    }),
    ...(status === "cancelled" && { status, completed: null, cancelled: { at, by: anan } }),
  });
}

// The requests the app made to `path`.
function requestsTo(path: string) {
  const sent: URL[] = [];
  server.events.on("request:start", ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname === path) sent.push(url);
  });
  return sent;
}

// A response the API could give, for a test that pins every figure.
function response(changes: Partial<DashboardOutputBody> = {}): DashboardOutputBody {
  return {
    today: "2026-11-07",
    sales: 0,
    ordersCompleted: 0,
    pendingOrders: 0,
    lowProducts: 0,
    outOfStockProducts: 0,
    // 25 Oct to 7 Nov, oldest first.
    salesByDay: Array.from({ length: 14 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 9, 25 + i)).toISOString().slice(0, 10),
      sales: 0,
      ordersCompleted: 0,
    })),
    restock: [],
    newestOrders: [],
    ...changes,
  };
}

const figure = (label: string) => {
  const group = screen.getByText(label, { selector: "dt" }).closest("div");
  if (!group) throw new Error(`No figure named ${label}`);
  return group;
};

describe("the Dashboard", () => {
  // dashboard-and-reports R3, users-and-access R12
  it("shows today's Sales, the Orders completed today, the Pending Orders and the Low and Out of stock counts", async () => {
    signedIn("owner");
    mockApi.products = [
      helmet,
      gloves,
      boots,
      productOf({
        id: 4,
        name: "Rain coat",
        sku: "RC-1",
        unit: "pcs",
        price: 1,
        stock: 1,
        minimumStock: 5,
      }),
    ];
    mockApi.orders = [
      order(1, 2, 0),
      order(2, 1, 0),
      order(3, 4, 2),
      order(4, 5),
      order(5, 6),
      order(6, 7, undefined, "cancelled"),
    ];
    const sent = requestsTo("/api/dashboard");
    renderApp("/dashboard");

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    // Today's two Completed Orders only: 2 + 1 helmets at ฿100.00, not the one two days ago.
    await screen.findByText("Today's sales");
    expect(within(figure("Today's sales")).getByText("฿300.00")).toBeInTheDocument();
    expect(within(figure("Orders completed today")).getByText("2")).toBeInTheDocument();
    expect(within(figure("Pending orders")).getByText("2")).toBeInTheDocument();
    expect(within(figure("Low stock")).getByText("2")).toBeInTheDocument();
    expect(within(figure("Out of stock")).getByText("1")).toBeInTheDocument();
    // Asked once, with nothing to narrow it: the api works the figures out.
    expect(sent.map((url) => url.search)).toEqual([""]);
  });

  // dashboard-and-reports R2, R9: the figure the API returns is shown, never worked out again.
  it("shows the figures as the API gives them, not as its own lists add up", async () => {
    signedIn("owner");
    server.use(
      getGetDashboardMockHandler200(
        response({
          sales: 123_456,
          ordersCompleted: 7,
          pendingOrders: 3,
          lowProducts: 4,
          outOfStockProducts: 5,
          // A Completed Order listed below, which the figures above do not add up from.
          newestOrders: [
            {
              id: 1012,
              number: 12,
              createdAt: "2026-11-07T01:00:00Z",
              customer: "",
              lineCount: 1,
              total: 999_900,
              status: "completed",
            },
          ],
        }),
      ),
    );
    renderApp("/dashboard");

    expect(await screen.findByText("฿1,234.56")).toBeInTheDocument();
    expect(within(figure("Orders completed today")).getByText("7")).toBeInTheDocument();
    expect(within(figure("Pending orders")).getByText("3")).toBeInTheDocument();
    expect(within(figure("Low stock")).getByText("4")).toBeInTheDocument();
    expect(within(figure("Out of stock")).getByText("5")).toBeInTheDocument();
  });

  // dashboard-and-reports R4
  it("charts the Sales of each of the last 14 days, and gives the figures as text", async () => {
    signedIn("owner");
    const salesByDay = response().salesByDay.map((one, i) =>
      i === 13
        ? { ...one, sales: 30_000, ordersCompleted: 2 }
        : i === 0
          ? { ...one, sales: 1_250_050, ordersCompleted: 1 }
          : one,
    );
    server.use(getGetDashboardMockHandler200(response({ sales: 30_000, salesByDay })));
    const { user } = renderApp("/dashboard");

    const chart = await screen.findByRole("figure", { name: /Sales for each of the last 14 days/ });
    expect(chart).toBeInTheDocument();
    await user.click(screen.getByText("Show the figures"));
    const rows = within(screen.getByRole("table", { name: "Sales for each of the last 14 days" }))
      .getAllByRole("row")
      .slice(1);
    expect(rows).toHaveLength(14);
    expect(rows[0]).toHaveTextContent("25 Oct");
    expect(rows[0]).toHaveTextContent("฿12,500.50");
    expect(rows[13]).toHaveTextContent("7 Nov");
    expect(rows[13]).toHaveTextContent("฿300.00");
    // A day with no Sales is a row with 0, so the chart has no gap.
    expect(rows[5]).toHaveTextContent("฿0.00");
  });

  it("says there are no Sales yet, when none of the 14 days has any", async () => {
    signedIn("owner");
    mockApi.orders = [order(1, 1)];
    renderApp("/dashboard");

    expect(
      await screen.findByText("No sales in the last 14 days. Complete an order to record one."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("figure", { name: /Sales for each/ })).not.toBeInTheDocument();
    expect(within(figure("Today's sales")).getByText("฿0.00")).toBeInTheDocument();
  });

  // dashboard-and-reports R5, products R9
  it("lists the Products to restock, Out of stock first, with stock against the Minimum and the state in words", async () => {
    signedIn("owner");
    mockApi.products = [helmet, boots, gloves];
    renderApp("/dashboard");

    const list = await screen.findByRole("region", { name: "Restock" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Work gloves" + "GLV-010" + "0 of 20" + "Out of stock",
      "Safety helmet" + "HLM-001" + "18 of 60" + "Low",
    ]);
  });

  // dashboard-and-reports R5
  it("links each Product to Stock movements for it", async () => {
    signedIn("owner");
    mockApi.products = [helmet];
    mockApi.stockMovements = [
      {
        id: 1,
        at: "2026-11-05T10:00:00Z",
        kind: "receive",
        product: { id: helmet.id, name: helmet.name, sku: helmet.sku },
        change: 18,
        stockAfter: 18,
        user: anan,
        note: "",
        order: null,
      },
    ];
    const { user, router } = renderApp("/dashboard");

    await user.click(await screen.findByRole("link", { name: "Safety helmet" }));

    expect(await screen.findByRole("heading", { name: "Stock movements" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/stock-movements");
    expect(router.state.location.search).toEqual({ productId: helmet.id });
  });

  // dashboard-and-reports R5
  it("leads to the Product List filtered to Low and Out of stock", async () => {
    signedIn("admin");
    mockApi.products = [helmet, gloves, boots];
    const { user, router } = renderApp("/dashboard");
    const sent = requestsTo("/api/products");

    await user.click(await screen.findByRole("link", { name: "View all" }));

    expect(await screen.findByRole("heading", { name: "Products" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/products");
    expect(router.state.location.search).toEqual({ stock: ["low", "out-of-stock"] });
    await screen.findByRole("link", { name: "Work gloves" });
    expect(screen.queryByRole("link", { name: "Steel boots" })).not.toBeInTheDocument();
    expect(sent.at(-1)?.searchParams.getAll("stock")).toEqual(["low", "out-of-stock"]);
  });

  it("says when nothing needs restocking, and offers no View all", async () => {
    signedIn("owner");
    mockApi.products = [boots];
    renderApp("/dashboard");

    expect(
      await screen.findByText("Nothing to restock. Every product is above its minimum stock."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View all" })).not.toBeInTheDocument();
  });

  // dashboard-and-reports R6
  it("lists the 5 newest Orders, each linking to its detail", async () => {
    signedIn("owner");
    mockApi.orders = [1, 2, 3, 4, 5, 6, 7].map((number) => order(number, 1));
    const { user, router } = renderApp("/dashboard");

    const list = await screen.findByRole("region", { name: "Newest orders" });
    const rows = within(list).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getByRole("link").textContent)).toEqual([
      "#7",
      "#6",
      "#5",
      "#4",
      "#3",
    ]);

    await user.click(within(list).getByRole("link", { name: "#6" }));
    expect(await screen.findByRole("heading", { name: "Order #6" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/orders/6");
  });

  it("says there are no Orders yet, and offers New order", async () => {
    signedIn("owner");
    renderApp("/dashboard");

    const list = await screen.findByRole("region", { name: "Newest orders" });
    expect(
      within(list).getByText("No orders yet. Create the first order to record a sale."),
    ).toBeInTheDocument();
    expect(within(list).getByRole("link", { name: "New order" })).toHaveAttribute(
      "href",
      "/orders/new",
    );
  });

  // users-and-access R11, R12
  it("is shown to an Admin", async () => {
    signedIn("admin");
    renderApp("/dashboard");

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(await screen.findByText("Today's sales")).toBeInTheDocument();
  });

  // users-and-access R11, R22: Staff are told, and the figures are never asked for.
  it("sends Staff to the no-access page without asking for the figures", async () => {
    signedIn("staff");
    const sent = requestsTo("/api/dashboard");
    renderApp("/dashboard");

    expect(await screen.findByRole("heading", { name: "No access" })).toBeInTheDocument();
    expect(screen.queryByText("Today's sales")).not.toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it("says when the API fails, and tries again", async () => {
    signedIn("owner");
    server.use(getGetDashboardMockHandler500(serverFailure));
    const { user } = renderApp("/dashboard");

    expect(await screen.findByText("Something went wrong. Try again.")).toBeInTheDocument();
    server.resetHandlers();
    mockApi.orders = [order(1, 3, 0)];
    await user.click(screen.getByRole("button", { name: "Try again" }));

    await screen.findByText("Today's sales");
    expect(within(figure("Today's sales")).getByText("฿300.00")).toBeInTheDocument();
  });
});

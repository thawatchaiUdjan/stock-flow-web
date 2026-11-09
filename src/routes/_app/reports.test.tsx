import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getGetSalesReportMockHandler200,
  getGetSalesReportMockHandler422,
  getGetSalesReportMockHandler500,
} from "@/api/generated/dashboard-and-reports/dashboard-and-reports.msw";
import type { SalesReportOutputBody } from "@/api/generated/model";
import { mockApi, orderOf, productOf, serverFailure } from "@/mocks/handlers";
import { chooseDate } from "@/test/date-picker";
import { renderApp } from "@/test/render-app";
import { server } from "@/test/server";

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

function signedIn(role: "owner" | "admin" | "staff") {
  mockApi.session = "live";
  mockApi.role = role;
}

// An Order of `quantity` units of `product`, completed at `at` (and Pending when that is left out).
function order(number: number, product: typeof helmet, quantity: number, at?: string) {
  return orderOf({
    number,
    createdAt: at ?? "2026-11-01T01:00:00Z",
    createdBy: anan,
    lines: [
      {
        product: { id: product.id, name: product.name, sku: product.sku },
        quantity,
        price: product.price,
      },
    ],
    ...(at && { status: "completed" as const, completed: { at, by: anan } }),
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

// A response the API could give, for a test that pins every figure: 1 to 3 Nov, no Sales.
function response(changes: Partial<SalesReportOutputBody> = {}): SalesReportOutputBody {
  return {
    from: "2026-11-01",
    to: "2026-11-03",
    sales: 0,
    ordersCompleted: 0,
    averageSales: 0,
    salesByDay: [
      { date: "2026-11-01", sales: 0, ordersCompleted: 0 },
      { date: "2026-11-02", sales: 0, ordersCompleted: 0 },
      { date: "2026-11-03", sales: 0, ordersCompleted: 0 },
    ],
    topProducts: [],
    ...changes,
  };
}

const figure = (label: string) => {
  const group = screen.getByText(label, { selector: "dt" }).closest("div");
  if (!group) throw new Error(`No figure named ${label}`);
  return group;
};

// A Saturday afternoon in Bangkok: today is 7 Nov, so this month so far is 1 to 7 Nov.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-07T08:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Reports", () => {
  // navigation-and-lists R4, R7: no-sales ranges still have paging.
  it("keeps daily paging visible when the range has no sales", async () => {
    signedIn("owner");
    renderApp("/reports");
    await screen.findByText(/No sales from/);
    expect(screen.getByRole("navigation", { name: "Pages" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(screen.getByRole("table", { name: "Sales for each day of the range" })).toBeVisible();
  });

  // #41 coordinator clarification: tolerate missing daily entries defensively.
  // The contract normally includes every day, even when sales are zero.
  it("explains an unexpectedly empty daily response and disables paging", async () => {
    signedIn("owner");
    server.use(getGetSalesReportMockHandler200(response({ salesByDay: [] })));
    renderApp("/reports");
    expect(await screen.findByText("No daily sales entries in this range.")).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Pages" })).toHaveTextContent("0 matching");
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("keeps unavailable paging visible while daily sales load", async () => {
    signedIn("owner");
    let release = () => {};
    const pending = new Promise<SalesReportOutputBody>((resolve) => {
      release = () => resolve(response());
    });
    server.use(getGetSalesReportMockHandler200(() => pending));
    renderApp("/reports");
    expect(await screen.findByText("Loading report")).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Pages" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    release();
    await screen.findByText("Total sales");
  });

  it("pages zero-sale days and recovers from an out-of-range daily page", async () => {
    signedIn("owner");
    const days = Array.from({ length: 31 }, (_, i) => ({
      date: `2026-10-${String(i + 1).padStart(2, "0")}`,
      sales: 0,
      ordersCompleted: 0,
    }));
    server.use(
      getGetSalesReportMockHandler200(
        response({ from: "2026-10-01", to: "2026-10-31", salesByDay: days }),
      ),
    );
    const { user, router } = renderApp("/reports?from=2026-10-01&to=2026-10-31&page=99");
    await screen.findByText("This page is no longer available.");
    await user.click(screen.getByRole("button", { name: "First page" }));
    const table = screen.getByRole("table", { name: "Sales for each day of the range" });
    expect(within(table).getAllByRole("row")).toHaveLength(26);
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(within(table).getAllByRole("row")).toHaveLength(7);
    expect(router.state.location.search).toEqual({ from: "2026-10-01", to: "2026-10-31", page: 2 });
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();
  });

  // dashboard-and-reports R7: this month so far by default, and the API is left to work it out.
  it("opens on this month so far, and shows the range", async () => {
    signedIn("owner");
    const sent = requestsTo("/api/reports/sales");
    renderApp("/reports");

    expect(await screen.findByRole("heading", { name: "Reports" })).toBeInTheDocument();
    await screen.findByText("Total sales");
    // Nothing chosen: the fields stay empty and the line says which days are shown.
    expect(screen.getByLabelText("From")).toHaveTextContent("Start date");
    expect(screen.getByLabelText("To")).toHaveTextContent("End date");
    expect(screen.getByText("Reported range: 1 Nov 2026 to 7 Nov 2026")).toBeInTheDocument();
    expect(sent.map((url) => url.search)).toEqual([""]);
  });

  // dashboard-and-reports R2, R7: Sales, Orders completed and the average of the Completed Orders.
  it("shows total Sales, Orders completed and the average Sales per Order", async () => {
    signedIn("owner");
    mockApi.products = [helmet, gloves];
    mockApi.orders = [
      order(1, helmet, 1, "2026-11-02T03:00:00Z"),
      order(2, gloves, 2, "2026-11-07T04:00:00Z"),
      order(3, helmet, 3, "2026-11-07T05:00:00Z"),
      // Pending, and completed last month: neither is in this range.
      order(4, helmet, 9),
      order(5, helmet, 9, "2026-10-20T03:00:00Z"),
    ];
    renderApp("/reports");

    await screen.findByText("Total sales");
    // 100.00 + 100.00 + 300.00 over 3 Orders, 166.666… rounded half up to the satang.
    expect(within(figure("Total sales")).getByText("฿500.00")).toBeInTheDocument();
    expect(within(figure("Orders completed")).getByText("3")).toBeInTheDocument();
    expect(within(figure("Average sales per order")).getByText("฿166.67")).toBeInTheDocument();
  });

  // dashboard-and-reports R9: the figures are the API's; they are never worked out again here.
  it("shows the figures as the API gives them, not as its own lists add up", async () => {
    signedIn("owner");
    server.use(
      getGetSalesReportMockHandler200(
        response({
          sales: 123_456,
          ordersCompleted: 7,
          averageSales: 17_637,
          salesByDay: [{ date: "2026-11-01", sales: 5_000, ordersCompleted: 1 }],
        }),
      ),
    );
    renderApp("/reports");

    await screen.findByText("Total sales");
    expect(within(figure("Total sales")).getByText("฿1,234.56")).toBeInTheDocument();
    expect(within(figure("Orders completed")).getByText("7")).toBeInTheDocument();
    expect(within(figure("Average sales per order")).getByText("฿176.37")).toBeInTheDocument();
  });

  // dashboard-and-reports R7
  it("charts Sales for each day of the range, and gives the figures as a table", async () => {
    signedIn("admin");
    server.use(
      getGetSalesReportMockHandler200(
        response({
          sales: 1_300_050,
          ordersCompleted: 3,
          averageSales: 433_350,
          salesByDay: [
            { date: "2026-11-01", sales: 1_250_050, ordersCompleted: 2 },
            { date: "2026-11-02", sales: 0, ordersCompleted: 0 },
            { date: "2026-11-03", sales: 50_000, ordersCompleted: 1 },
          ],
        }),
      ),
    );
    renderApp("/reports");

    const section = await screen.findByRole("region", { name: "Sales by day" });
    expect(
      within(section).getByRole("figure", { name: /Sales for each day of the range/ }),
    ).toBeInTheDocument();
    const rows = within(
      within(section).getByRole("table", { name: "Sales for each day of the range" }),
    )
      .getAllByRole("row")
      .slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      "1 Nov" + "2" + "฿12,500.50",
      // A day with no Sales is a row with 0, so the chart has no gap.
      "2 Nov" + "0" + "฿0.00",
      "3 Nov" + "1" + "฿500.00",
    ]);
  });

  // dashboard-and-reports R8
  it("lists the top Products with their SKU, quantity sold and Sales", async () => {
    signedIn("owner");
    mockApi.products = [helmet, gloves];
    mockApi.orders = [
      order(1, gloves, 2, "2026-11-02T03:00:00Z"),
      order(2, helmet, 3, "2026-11-03T03:00:00Z"),
      order(3, helmet, 1, "2026-11-04T03:00:00Z"),
    ];
    renderApp("/reports");

    const section = await screen.findByRole("region", { name: "Top products" });
    const rows = within(await within(section).findByRole("table"))
      .getAllByRole("row")
      .slice(1);
    // Highest Sales first: 4 helmets at ฿100.00, then 2 gloves at ฿50.00.
    expect(rows.map((row) => row.textContent)).toEqual([
      "Safety helmet" + "HLM-001" + "4" + "฿400.00",
      "Work gloves" + "GLV-010" + "2" + "฿100.00",
    ]);
  });

  // dashboard-and-reports R7: the range is part of the address, and what was sent is what was asked.
  it("asks for the range in the address, and shows it", async () => {
    signedIn("owner");
    const sent = requestsTo("/api/reports/sales");
    renderApp("/reports?from=2026-10-01&to=2026-10-31");

    await screen.findByText("Total sales");
    expect(screen.getByLabelText("From")).toHaveTextContent("1 Oct 2026");
    expect(screen.getByLabelText("To")).toHaveTextContent("31 Oct 2026");
    expect(sent.map((url) => url.search)).toEqual(["?from=2026-10-01&to=2026-10-31"]);
  });

  it("keeps a range the person chooses in the address, and asks for it", async () => {
    signedIn("owner");
    const sent = requestsTo("/api/reports/sales");
    const { user, router } = renderApp("/reports");
    await screen.findByText("Total sales");

    await chooseDate(user, "From", "2026-10-01");
    await chooseDate(user, "To", "2026-10-31");

    await vi.waitFor(() => expect(sent.at(-1)?.search).toBe("?from=2026-10-01&to=2026-10-31"));
    expect(router.state.location.search).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(await screen.findByText("Total sales")).toBeInTheDocument();
  });

  it("goes back to this month so far", async () => {
    signedIn("owner");
    const sent = requestsTo("/api/reports/sales");
    const { user, router } = renderApp("/reports?from=2026-10-01&to=2026-10-31");
    await screen.findByText("Total sales");

    await user.click(screen.getByRole("link", { name: "This month so far" }));

    await vi.waitFor(() => expect(sent.at(-1)?.search).toBe(""));
    expect(router.state.location.search).toEqual({});
    expect(screen.queryByRole("link", { name: "This month so far" })).not.toBeInTheDocument();
  });

  // dashboard-and-reports R7: caught before sending, never stricter than the API.
  it("says when From is after To, and asks nothing", async () => {
    signedIn("owner");
    const sent = requestsTo("/api/reports/sales");
    renderApp("/reports?from=2026-11-05&to=2026-11-01");

    expect(
      await screen.findByText("From is after To. Choose a From day on or before To."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Total sales")).not.toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it("says when the range is over 366 days, and asks nothing", async () => {
    signedIn("owner");
    const sent = requestsTo("/api/reports/sales");
    // 367 days, both ends included.
    renderApp("/reports?from=2025-11-06&to=2026-11-07");

    expect(
      await screen.findByText("This range is over 366 days. Choose 366 days or fewer."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Total sales")).not.toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it("asks for a range of exactly 366 days", async () => {
    signedIn("owner");
    const sent = requestsTo("/api/reports/sales");
    renderApp("/reports?from=2025-11-07&to=2026-11-07");

    await screen.findByText("Total sales");
    expect(sent.map((url) => url.search)).toEqual(["?from=2025-11-07&to=2026-11-07"]);
  });

  // dashboard-and-reports R7: an end left out is the day the API would use, so the range is
  // checked before sending all the same. Today is 7 Nov.
  it("says when a From alone makes the range over 366 days, and asks nothing", async () => {
    signedIn("owner");
    const sent = requestsTo("/api/reports/sales");
    renderApp("/reports?from=2020-01-01");

    expect(
      await screen.findByText("This range is over 366 days. Choose 366 days or fewer."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Total sales")).not.toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it("says when a From alone is after today, and asks nothing", async () => {
    signedIn("owner");
    const sent = requestsTo("/api/reports/sales");
    renderApp("/reports?from=2026-11-08");

    expect(
      await screen.findByText("From is after To. Choose a From day on or before To."),
    ).toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it("asks for a From alone that the API would accept, and a To alone", async () => {
    signedIn("owner");
    const sent = requestsTo("/api/reports/sales");
    const { router } = renderApp("/reports?from=2025-11-07");
    await screen.findByText("Total sales");

    await router.navigate({ to: "/reports", search: { to: "2026-10-15" } });
    await screen.findByText("Reported range: 1 Oct 2026 to 15 Oct 2026");

    expect(sent.map((url) => url.search)).toEqual(["?from=2025-11-07", "?to=2026-10-15"]);
  });

  // The API's 422 is still shown, should it refuse what the page let through.
  it("shows the refusal when the API says the range is too long", async () => {
    signedIn("owner");
    server.use(
      getGetSalesReportMockHandler422({
        status: 422,
        title: "Unprocessable Entity",
        detail: "The range is too long.",
        errors: [{ location: "query.from", message: "range must not be over 366 days" }],
      }),
    );
    renderApp("/reports?from=2026-11-01");

    expect(
      await screen.findByText(
        "This range isn't valid. Choose a From day on or before To, and 366 days or fewer.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Total sales")).not.toBeInTheDocument();
  });

  it("shows the refusal when the API says the range ends first", async () => {
    signedIn("owner");
    server.use(
      getGetSalesReportMockHandler422({
        status: 422,
        title: "Unprocessable Entity",
        detail: "The range ends before it starts.",
        errors: [{ location: "query.to", message: "must not be before from" }],
      }),
    );
    renderApp("/reports?from=2026-11-01&to=2026-11-01");

    expect(
      await screen.findByText(
        "This range isn't valid. Choose a From day on or before To, and 366 days or fewer.",
      ),
    ).toBeInTheDocument();
  });

  it("says there are no Sales in a range without any, and still gives the figures", async () => {
    signedIn("owner");
    mockApi.products = [helmet];
    mockApi.orders = [order(1, helmet, 1), order(2, helmet, 1, "2026-10-20T03:00:00Z")];
    renderApp("/reports");

    expect(
      await screen.findByText(
        "No sales from 1 Nov to 7 Nov. Complete an order, or choose another range.",
      ),
    ).toBeInTheDocument();
    expect(within(figure("Total sales")).getByText("฿0.00")).toBeInTheDocument();
    expect(within(figure("Orders completed")).getByText("0")).toBeInTheDocument();
    expect(within(figure("Average sales per order")).getByText("฿0.00")).toBeInTheDocument();
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();
    // #41 clarification: zero-sale days remain readable and pageable.
    expect(screen.getByRole("table", { name: "Sales for each day of the range" })).toBeVisible();
  });

  // users-and-access R11
  it("is shown to an Admin", async () => {
    signedIn("admin");
    renderApp("/reports");

    expect(await screen.findByRole("heading", { name: "Reports" })).toBeInTheDocument();
    expect(await screen.findByText("Total sales")).toBeInTheDocument();
  });

  // users-and-access R11, R22: Staff are told, and the figures are never asked for.
  it("sends Staff to the no-access page without asking for the figures", async () => {
    signedIn("staff");
    const sent = requestsTo("/api/reports/sales");
    renderApp("/reports");

    expect(await screen.findByRole("heading", { name: "No access" })).toBeInTheDocument();
    expect(screen.queryByText("Total sales")).not.toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it("says when the API fails, and tries again", async () => {
    signedIn("owner");
    server.use(getGetSalesReportMockHandler500(serverFailure));
    const { user } = renderApp("/reports");

    expect(await screen.findByText("Something went wrong. Try again.")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Pages" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    server.resetHandlers();
    mockApi.products = [helmet];
    mockApi.orders = [order(1, helmet, 3, "2026-11-02T03:00:00Z")];
    await user.click(screen.getByRole("button", { name: "Try again" }));

    await screen.findByText("Total sales");
    expect(within(figure("Total sales")).getByText("฿300.00")).toBeInTheDocument();
  });
});

// navigation-and-lists R7: table paging must not change full-range aggregates or chart.
it("pages daily rows without shrinking the chart or total and resets on date changes", async () => {
  signedIn("owner");
  const days = Array.from({ length: 31 }, (_, i) => ({
    date: `2026-10-${String(i + 1).padStart(2, "0")}`,
    sales: 100,
    ordersCompleted: 1,
  }));
  server.use(
    getGetSalesReportMockHandler200({
      from: "2026-10-01",
      to: "2026-10-31",
      sales: 3100,
      ordersCompleted: 31,
      averageSales: 100,
      salesByDay: days,
      topProducts: [],
    }),
  );
  const sent = requestsTo("/api/reports/sales");
  const { user, router } = renderApp("/reports?from=2026-10-01&to=2026-10-31");
  const table = await screen.findByRole("table", { name: "Sales for each day of the range" });
  expect(within(table).getAllByRole("row")).toHaveLength(26);
  expect(screen.getByText("฿31.00")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Next page" }));
  expect(within(table).getAllByRole("row")).toHaveLength(7);
  expect(screen.getByText("฿31.00")).toBeInTheDocument();
  expect(screen.getByRole("figure")).toHaveAccessibleName(/31 Oct/);
  expect(sent.every((url) => !url.searchParams.has("page"))).toBe(true);
  await chooseDate(user, "From", "2026-10-01");
  expect(router.state.location.search.page).toBeUndefined();
});

// date-controls R2, R7-R8: effective defaults explain empty controls without selecting them.
it("explains effective defaults while the report is loading and when it fails", async () => {
  signedIn("owner");
  let release = () => {};
  const pending = new Promise<typeof serverFailure>((resolve) => {
    release = () => resolve(serverFailure);
  });
  server.use(getGetSalesReportMockHandler500(() => pending));
  const { user, router } = renderApp("/reports?to=2024-02-29&page=2");
  await screen.findByRole("heading", { name: "Reports" });
  expect(screen.getByLabelText("From")).toHaveTextContent("Start date");
  expect(screen.getByLabelText("To")).toHaveTextContent("29 Feb 2024");
  expect(screen.getByText("Effective range: 1 Feb 2024 to 29 Feb 2024")).toBeInTheDocument();
  expect(screen.getByText(/An empty To uses today in Bangkok/)).toBeInTheDocument();
  expect(screen.getByText("Loading report")).toBeVisible();
  release();
  await screen.findByRole("button", { name: "Try again" });
  expect(screen.getByText("Effective range: 1 Feb 2024 to 29 Feb 2024")).toBeInTheDocument();
  await user.click(screen.getByLabelText("From"));
  await user.keyboard("{Escape}");
  expect(router.state.location.search).toEqual({ to: "2024-02-29", page: 2 });
});

// date-controls R7-R9: every combination keeps defaults out of explicit URL state.
it.each([
  ["", "Start date", "End date", "1 Nov 2026 to 7 Nov 2026", {}],
  [
    "?from=2026-11-03",
    "3 Nov 2026",
    "End date",
    "3 Nov 2026 to 7 Nov 2026",
    { from: "2026-11-03" },
  ],
  [
    "?to=2024-02-29",
    "Start date",
    "29 Feb 2024",
    "1 Feb 2024 to 29 Feb 2024",
    { to: "2024-02-29" },
  ],
  [
    "?from=2025-12-31&to=2026-01-01",
    "31 Dec 2025",
    "1 Jan 2026",
    "31 Dec 2025 to 1 Jan 2026",
    { from: "2025-12-31", to: "2026-01-01" },
  ],
])("shows effective defaults for /reports%s", async (query, from, to, range, explicit) => {
  signedIn("owner");
  const sent = requestsTo("/api/reports/sales");
  const { user, router } = renderApp(`/reports${query}`);
  await screen.findByText("Total sales");
  expect(screen.getByLabelText("From")).toHaveTextContent(from);
  expect(screen.getByLabelText("To")).toHaveTextContent(to);
  expect(screen.getByText(`Effective range: ${range}`)).toBeInTheDocument();
  expect(Object.fromEntries(sent.at(-1)!.searchParams)).toEqual(explicit);
  await user.click(screen.getByLabelText("To"));
  await user.keyboard("{Escape}");
  expect(router.state.location.search).toEqual(explicit);
  expect(screen.getByLabelText("To")).toHaveFocus();
});

it.each(["From", "To"])("removes only Reports' %s selection and resets paging", async (label) => {
  signedIn("owner");
  const sent = requestsTo("/api/reports/sales");
  const { user, router } = renderApp("/reports?from=2026-11-01&to=2026-11-03&page=2");
  await screen.findByText("Total sales");
  await chooseDate(user, label, label === "From" ? "2026-11-01" : "2026-11-03");
  const remaining = label === "From" ? { to: "2026-11-03" } : { from: "2026-11-01" };
  await vi.waitFor(() => expect(Object.fromEntries(sent.at(-1)!.searchParams)).toEqual(remaining));
  expect(router.state.location.search).toEqual(remaining);
});

it("keeps returned figures paired with their returned range", async () => {
  signedIn("owner");
  server.use(getGetSalesReportMockHandler200(response()));
  renderApp("/reports");
  await screen.findByText("Total sales");
  expect(screen.getByText("Effective range: 1 Nov 2026 to 7 Nov 2026")).toBeInTheDocument();
  expect(screen.getByText("Reported range: 1 Nov 2026 to 3 Nov 2026")).toBeInTheDocument();
});

// date-controls R7, R9: a tab resumed across Bangkok midnight must explain the new defaults.
it("refreshes effective default days when the tab resumes after Bangkok New Year", async () => {
  signedIn("owner");
  vi.setSystemTime(new Date("2026-12-31T16:59:00Z"));
  const { router } = renderApp("/reports");
  await screen.findByText("Total sales");
  expect(screen.getByText("Effective range: 1 Dec 2026 to 31 Dec 2026")).toBeInTheDocument();
  vi.setSystemTime(new Date("2026-12-31T17:01:00Z"));
  fireEvent.focus(window);
  expect(screen.getByText("Effective range: 1 Jan 2027 to 1 Jan 2027")).toBeInTheDocument();
  expect(router.state.location.search).toEqual({});
});

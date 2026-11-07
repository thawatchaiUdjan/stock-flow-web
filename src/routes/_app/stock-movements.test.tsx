import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { StockMovement } from "@/api/generated/model";
import { getListStockMovementsMockHandler500 } from "@/api/generated/stock-movements/stock-movements.msw";
import { mockApi, productOf, serverFailure } from "@/mocks/handlers";
import { renderApp } from "@/test/render-app";
import { server } from "@/test/server";

const helmet = productOf({
  id: 1,
  name: "Safety helmet",
  sku: "HLM-001",
  unit: "pcs",
  price: 48_210_00,
  minimumStock: 60,
  stock: 18,
});
const gloves = productOf({
  id: 2,
  name: "Work gloves",
  sku: "GLV-010",
  unit: "box",
  price: 1_250_50,
  minimumStock: 20,
  stock: 233,
});
const goggles = productOf({
  id: 4,
  name: "Old goggles",
  sku: "GGL-002",
  unit: "pcs",
  price: 80_00,
  stock: 3,
  status: "archived",
});

function signedIn(role: "owner" | "admin" | "staff") {
  mockApi.session = "live";
  mockApi.role = role;
}

function movement(id: number, changes: Partial<StockMovement> = {}): StockMovement {
  return {
    id,
    at: "2026-11-05T14:12:00Z",
    kind: "receive",
    product: { id: helmet.id, name: helmet.name, sku: helmet.sku },
    change: 12,
    stockAfter: 30,
    user: { id: 2, name: "Anan Chaiyo" },
    note: "",
    order: null,
    ...changes,
  };
}

// The address of every request the app made to `path`, and the body each one carried.
function requestsTo(path: string) {
  const sent: { url: URL; body: unknown }[] = [];
  server.events.on("request:start", ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname !== path) return;
    const entry = { url, body: undefined as unknown };
    sent.push(entry);
    void request
      .clone()
      .json()
      .then((body) => (entry.body = body))
      .catch(() => undefined);
  });
  return sent;
}

function rowOf(text: string | RegExp) {
  return screen.getByRole("row", { name: text });
}

describe("the Stock Movements list", () => {
  // stock-movements R10, R11
  it("shows each entry's time, Product with SKU, kind, change, stock after, User and note, newest first", async () => {
    signedIn("owner");
    mockApi.products = [helmet, gloves];
    mockApi.stockMovements = [
      movement(1, {
        at: "2026-11-04T09:05:00Z",
        change: 30,
        stockAfter: 30,
        note: "Delivery 4012",
      }),
      movement(2, {
        at: "2026-11-05T14:12:00Z",
        kind: "adjustment",
        change: -3,
        stockAfter: 27,
        note: "Three cracked",
        user: { id: 1, name: "Nok Srisuk" },
      }),
      movement(3, {
        at: "2026-11-06T10:00:00Z",
        product: { id: gloves.id, name: gloves.name, sku: gloves.sku },
        change: 12,
        stockAfter: 245,
      }),
    ];
    renderApp("/stock-movements");

    await screen.findByText("Three cracked");
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      "6 Nov, 10:00Work glovesGLV-010Receive+12245Anan Chaiyo",
      "5 Nov, 14:12Safety helmetHLM-001Adjustment−327Nok SrisukThree cracked",
      "4 Nov, 09:05Safety helmetHLM-001Receive+3030Anan ChaiyoDelivery 4012",
    ]);
  });

  // stock-movements R12
  it("shows every entry to Staff, and offers no way to edit or delete one", async () => {
    signedIn("staff");
    mockApi.products = [helmet];
    mockApi.stockMovements = [movement(1, { note: "Delivery 4012" })];
    renderApp("/stock-movements");

    await screen.findByText("Delivery 4012");
    expect(screen.queryByRole("button", { name: /edit|delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /edit|delete/i })).not.toBeInTheDocument();
  });

  // stock-movements R3, R11: Orders make these; orders R17, the number leads to the Order's detail.
  it("renders Order and Cancellation entries with their Order's number, linking to its detail", async () => {
    signedIn("owner");
    mockApi.products = [helmet];
    mockApi.stockMovements = [
      movement(1, { kind: "order", change: -4, stockAfter: 14, order: { id: 7, number: 1007 } }),
      movement(2, {
        kind: "cancellation",
        change: 4,
        stockAfter: 18,
        order: { id: 7, number: 1007 },
      }),
    ];
    renderApp("/stock-movements");

    await screen.findAllByText("#1007");
    expect(rowOf(/Order/)).toHaveTextContent("Order#1007−414");
    expect(rowOf(/Cancellation/)).toHaveTextContent("Cancellation#1007+418");
    for (const link of screen.getAllByRole("link", { name: "#1007" })) {
      expect(link).toHaveAttribute("href", "/orders/1007");
    }
  });

  it("opens the Order's detail from one of its entries", async () => {
    signedIn("owner");
    mockApi.products = [helmet];
    mockApi.stockMovements = [
      movement(1, { kind: "order", change: -4, stockAfter: 14, order: { id: 7, number: 1007 } }),
    ];
    const { user, router } = renderApp("/stock-movements");

    await user.click(await screen.findByRole("link", { name: "#1007" }));

    expect(await screen.findByRole("heading", { name: "Order not found" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/orders/1007");
  });

  it("says what belongs here when there are no entries", async () => {
    signedIn("owner");
    mockApi.products = [helmet];
    renderApp("/stock-movements");

    expect(
      await screen.findByText(
        "No stock movements yet. Receive stock to start the history of every change.",
      ),
    ).toBeInTheDocument();
  });

  it("says so, with a way back, when the filters match nothing", async () => {
    signedIn("owner");
    mockApi.products = [helmet];
    mockApi.stockMovements = [movement(1)];
    const { user } = renderApp("/stock-movements?kind=adjustment");

    expect(await screen.findByText("No stock movements match these filters.")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Clear filters" }));
    expect(await screen.findByText("Safety helmet")).toBeInTheDocument();
  });

  it("pages by cursor, keeping the filters", async () => {
    signedIn("owner");
    mockApi.products = [helmet];
    mockApi.stockMovements = Array.from({ length: 51 }, (_, i) =>
      movement(i + 1, { note: `n${i + 1}` }),
    );
    const sent = requestsTo("/api/stock-movements");
    const { user } = renderApp("/stock-movements?kind=receive");

    await screen.findByText("n51");
    expect(screen.queryByText("n1")).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Older entries" }));

    await screen.findByText("n1");
    expect(screen.queryByText("n51")).not.toBeInTheDocument();
    expect(sent.at(-1)!.url.searchParams.get("before")).toBe("2");
    expect(sent.at(-1)!.url.searchParams.get("kind")).toBe("receive");
    expect(screen.queryByRole("link", { name: "Older entries" })).not.toBeInTheDocument();
  });

  it("offers to try again when the list fails", async () => {
    signedIn("owner");
    server.use(getListStockMovementsMockHandler500(serverFailure));
    renderApp("/stock-movements");

    expect(await screen.findByText("Something went wrong. Try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("the Stock Movements filters", () => {
  // stock-movements R10, products R16: the Product List links here with its Product.
  it("opens filtered to the Product the Product List linked to", async () => {
    signedIn("owner");
    mockApi.products = [helmet, gloves];
    mockApi.stockMovements = [
      movement(1, { note: "for the helmet" }),
      movement(2, {
        product: { id: gloves.id, name: gloves.name, sku: gloves.sku },
        note: "for the gloves",
      }),
    ];
    const sent = requestsTo("/api/stock-movements");
    renderApp("/stock-movements?productId=1");

    await screen.findByText("for the helmet");
    expect(screen.queryByText("for the gloves")).not.toBeInTheDocument();
    expect(sent[0]!.url.searchParams.get("productId")).toBe("1");
    expect(await screen.findByLabelText("Product", { selector: "#movements-product" })).toHaveValue(
      "1",
    );
  });

  it("filters by Product, kind and range of days, and keeps them in the address", async () => {
    signedIn("owner");
    mockApi.products = [helmet, gloves];
    mockApi.stockMovements = [movement(1)];
    const sent = requestsTo("/api/stock-movements");
    const { router, user } = renderApp("/stock-movements");

    await screen.findByText("Safety helmet");
    const product = await screen.findByLabelText("Product", { selector: "#movements-product" });
    await waitFor(() => expect(product).toBeEnabled());
    await user.selectOptions(product, "2");
    await user.selectOptions(screen.getByLabelText("Kind"), "adjustment");
    await user.type(screen.getByLabelText("From"), "2026-11-01");
    await user.type(screen.getByLabelText("To"), "2026-11-07");

    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        productId: 2,
        kind: "adjustment",
        from: "2026-11-01",
        to: "2026-11-07",
      }),
    );
    await waitFor(() => {
      const last = sent.at(-1)!.url.searchParams;
      expect(Object.fromEntries(last)).toMatchObject({
        productId: "2",
        kind: "adjustment",
        from: "2026-11-01",
        to: "2026-11-07",
      });
    });
  });

  it("drops a filter the API would not accept, rather than sending it", async () => {
    signedIn("owner");
    mockApi.products = [helmet];
    const sent = requestsTo("/api/stock-movements");
    renderApp("/stock-movements?kind=nonsense&from=yesterday&productId=0");

    await screen.findByText(/No stock movements yet/);
    const params = sent[0]!.url.searchParams;
    expect(params.has("kind")).toBe(false);
    expect(params.has("from")).toBe(false);
    expect(params.has("productId")).toBe(false);
  });

  it("says when From is after To, and asks nothing", async () => {
    signedIn("owner");
    mockApi.products = [helmet];
    const sent = requestsTo("/api/stock-movements");
    renderApp("/stock-movements?from=2026-11-07&to=2026-11-01");

    expect(
      await screen.findByText("From is after To. Choose an earlier From day."),
    ).toBeInTheDocument();
    expect(sent).toHaveLength(0);
  });
});

describe("Receive stock", () => {
  // stock-movements R4, R12
  it.each(["owner", "admin", "staff"] as const)("is offered to the %s", async (role) => {
    signedIn(role);
    mockApi.products = [helmet];
    renderApp("/stock-movements");

    expect(await screen.findByRole("button", { name: "Receive stock" })).toBeInTheDocument();
  });

  // stock-movements R4: sends what was typed, shows the result, and the stock moved with it.
  it("receives a delivery: sends it, says so, and shows the entry and the new stock", async () => {
    signedIn("staff");
    mockApi.products = [helmet, gloves];
    const sent = requestsTo("/api/stock-movements/receive");
    const { user } = renderApp("/stock-movements");

    await user.click(await screen.findByRole("button", { name: "Receive stock" }));
    const product = await screen.findByLabelText("Product", { selector: "#stock-product" });
    await waitFor(() => expect(product).toBeEnabled());
    await user.selectOptions(product, "1");
    await user.type(screen.getByLabelText("Quantity"), "12");
    await user.type(screen.getByLabelText("Note (optional)"), "Delivery 4012");
    await user.click(screen.getByRole("button", { name: "Receive stock" }));

    expect(await screen.findByText("Stock received")).toBeInTheDocument();
    expect(sent).toHaveLength(1);
    expect(sent[0]!.body).toEqual({ productId: 1, quantity: 12, note: "Delivery 4012" });
    expect(await screen.findByText("Delivery 4012")).toBeInTheDocument();
    expect(rowOf(/Delivery 4012/)).toHaveTextContent("Receive+1230");
    expect(mockApi.products.find(({ id }) => id === 1)!.stock).toBe(30);
  });

  it("shows each Product's stock in the picker, and offers Active Products only", async () => {
    signedIn("owner");
    mockApi.products = [helmet, gloves, goggles];
    const { user } = renderApp("/stock-movements");

    await user.click(await screen.findByRole("button", { name: "Receive stock" }));
    const product = await screen.findByLabelText("Product", { selector: "#stock-product" });
    await waitFor(() => expect(product).toBeEnabled());
    const options = within(product)
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options).toEqual([
      "Choose a product",
      "Safety helmet (HLM-001), 18 in stock",
      "Work gloves (GLV-010), 233 in stock",
    ]);
  });

  // The API pages Products by 100: a Shop with more still finds every one.
  it("offers every Active Product, however many the API pages", async () => {
    signedIn("owner");
    mockApi.products = Array.from({ length: 101 }, (_, i) =>
      productOf({
        id: i + 1,
        name: `Product ${String(i + 1).padStart(3, "0")}`,
        sku: `P-${i + 1}`,
        unit: "pcs",
        price: 100,
        stock: i,
      }),
    );
    const { user } = renderApp("/stock-movements");

    await user.click(await screen.findByRole("button", { name: "Receive stock" }));
    const product = await screen.findByLabelText("Product", { selector: "#stock-product" });
    await waitFor(() => expect(within(product).getAllByRole("option")).toHaveLength(102));
    expect(
      within(product).getByRole("option", { name: "Product 101 (P-101), 100 in stock" }),
    ).toBeInTheDocument();
  });

  it("presets the Product when the page is filtered to one", async () => {
    signedIn("owner");
    mockApi.products = [helmet, gloves];
    const sent = requestsTo("/api/stock-movements/receive");
    const { user } = renderApp("/stock-movements?productId=2");

    await user.click(await screen.findByRole("button", { name: "Receive stock" }));
    const product = await screen.findByLabelText("Product", { selector: "#stock-product" });
    await waitFor(() => expect(product).toHaveValue("2"));
    await user.type(screen.getByLabelText("Quantity"), "5");
    await user.click(screen.getByRole("button", { name: "Receive stock" }));

    await screen.findByText("Stock received");
    expect(sent[0]!.body).toEqual({ productId: 2, quantity: 5 });
  });

  // stock-movements R4: a whole number, at least 1.
  it("refuses a quantity that is not a whole number of at least 1, sending nothing", async () => {
    signedIn("owner");
    mockApi.products = [helmet];
    const sent = requestsTo("/api/stock-movements/receive");
    const { user } = renderApp("/stock-movements?productId=1");

    await user.click(await screen.findByRole("button", { name: "Receive stock" }));
    const quantity = await screen.findByLabelText("Quantity");
    for (const text of ["0", "1.5", "-2", "", "abc"]) {
      await user.clear(quantity);
      if (text) await user.type(quantity, text);
      await user.click(screen.getByRole("button", { name: "Receive stock" }));
      expect(await screen.findByText("Enter a whole number of 1 or more.")).toBeInTheDocument();
    }
    expect(sent).toHaveLength(0);
  });

  it("asks for a Product before sending", async () => {
    signedIn("owner");
    mockApi.products = [helmet];
    const sent = requestsTo("/api/stock-movements/receive");
    const { user } = renderApp("/stock-movements");

    await user.click(await screen.findByRole("button", { name: "Receive stock" }));
    await user.type(await screen.findByLabelText("Quantity"), "3");
    await user.click(screen.getByRole("button", { name: "Receive stock" }));

    expect(await screen.findByText("Choose a product.")).toBeInTheDocument();
    expect(sent).toHaveLength(0);
  });

  // stock-movements R9, products R12
  it("says beside the Product that it is archived", async () => {
    signedIn("owner");
    mockApi.products = [helmet];
    const { user } = renderApp("/stock-movements?productId=1");

    await user.click(await screen.findByRole("button", { name: "Receive stock" }));
    const quantity = await screen.findByLabelText("Quantity");
    await waitFor(() =>
      expect(screen.getByLabelText("Product", { selector: "#stock-product" })).toHaveValue("1"),
    );
    // Archived by someone else after the page loaded.
    mockApi.products = [{ ...helmet, status: "archived" }];
    await user.type(quantity, "3");
    await user.click(screen.getByRole("button", { name: "Receive stock" }));

    const message = await screen.findByText(
      "This product is archived. Choose an active product instead.",
    );
    expect(
      screen.getByLabelText("Product", { selector: "#stock-product" }),
    ).toHaveAccessibleDescription(message.textContent!);
  });
});

describe("Adjust stock", () => {
  // stock-movements R5
  it.each(["owner", "admin"] as const)("is offered to the %s", async (role) => {
    signedIn(role);
    mockApi.products = [helmet];
    renderApp("/stock-movements");

    expect(await screen.findByRole("button", { name: "Adjust stock" })).toBeInTheDocument();
  });

  it("is not offered to Staff", async () => {
    signedIn("staff");
    mockApi.products = [helmet];
    renderApp("/stock-movements");

    await screen.findByRole("button", { name: "Receive stock" });
    expect(screen.queryByRole("button", { name: "Adjust stock" })).not.toBeInTheDocument();
  });

  // stock-movements R5: up or down, with a note.
  it("adjusts down with a note: sends a negative change, says so, and shows the entry", async () => {
    signedIn("admin");
    mockApi.products = [helmet];
    const sent = requestsTo("/api/stock-movements/adjust");
    const { user } = renderApp("/stock-movements?productId=1");

    await user.click(await screen.findByRole("button", { name: "Adjust stock" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Product", { selector: "#stock-product" })).toHaveValue("1"),
    );
    // The minus sign people read on screen is accepted as well as the hyphen.
    await user.type(screen.getByLabelText("Change"), "−3");
    await user.type(screen.getByLabelText("Note"), "Three cracked");
    await user.click(screen.getByRole("button", { name: "Adjust stock" }));

    expect(await screen.findByText("Stock adjusted")).toBeInTheDocument();
    expect(sent[0]!.body).toEqual({ productId: 1, change: -3, note: "Three cracked" });
    expect(await screen.findByText("Three cracked")).toBeInTheDocument();
    expect(rowOf(/Three cracked/)).toHaveTextContent("Adjustment−315");
  });

  it("adjusts up with a plus sign or none", async () => {
    signedIn("owner");
    mockApi.products = [helmet];
    const sent = requestsTo("/api/stock-movements/adjust");
    const { user } = renderApp("/stock-movements?productId=1");

    await user.click(await screen.findByRole("button", { name: "Adjust stock" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Product", { selector: "#stock-product" })).toHaveValue("1"),
    );
    await user.type(screen.getByLabelText("Change"), "+4");
    await user.type(screen.getByLabelText("Note"), "Found a box");
    await user.click(screen.getByRole("button", { name: "Adjust stock" }));

    await screen.findByText("Stock adjusted");
    expect(sent[0]!.body).toEqual({ productId: 1, change: 4, note: "Found a box" });
  });

  // stock-movements R5: needs a note, and a change other than 0.
  it("requires a note and a change other than 0, sending nothing until it has both", async () => {
    signedIn("owner");
    mockApi.products = [helmet];
    const sent = requestsTo("/api/stock-movements/adjust");
    const { user } = renderApp("/stock-movements?productId=1");

    await user.click(await screen.findByRole("button", { name: "Adjust stock" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Product", { selector: "#stock-product" })).toHaveValue("1"),
    );
    await user.type(screen.getByLabelText("Change"), "-3");
    await user.click(screen.getByRole("button", { name: "Adjust stock" }));
    expect(await screen.findByText("Say why the stock is wrong.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Note"), "   ");
    await user.click(screen.getByRole("button", { name: "Adjust stock" }));
    expect(await screen.findByText("Say why the stock is wrong.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Note"), "x");
    const change = screen.getByLabelText("Change");
    for (const text of ["0", "1.5", "abc"]) {
      await user.clear(change);
      await user.type(change, text);
      await user.click(screen.getByRole("button", { name: "Adjust stock" }));
      expect(
        await screen.findByText("Enter a whole number other than 0, such as 5 or −3."),
      ).toBeInTheDocument();
    }
    expect(sent).toHaveLength(0);
  });

  // stock-movements R6: refused, saying how many are in stock.
  it("says beside the change how many are in stock when it would go below 0", async () => {
    signedIn("owner");
    mockApi.products = [helmet];
    const { user } = renderApp("/stock-movements?productId=1");

    await user.click(await screen.findByRole("button", { name: "Adjust stock" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Product", { selector: "#stock-product" })).toHaveValue("1"),
    );
    await user.type(screen.getByLabelText("Change"), "-20");
    await user.type(screen.getByLabelText("Note"), "Recount");
    await user.click(screen.getByRole("button", { name: "Adjust stock" }));

    const message = await screen.findByText("Only 18 in stock.");
    expect(screen.getByLabelText("Change")).toHaveAccessibleDescription(
      expect.stringContaining(message.textContent!),
    );
    expect(mockApi.products[0]!.stock).toBe(18);
    expect(mockApi.stockMovements).toHaveLength(0);
  });

  it("clears the refusal once the value is edited", async () => {
    signedIn("owner");
    mockApi.products = [helmet];
    const { user } = renderApp("/stock-movements?productId=1");

    await user.click(await screen.findByRole("button", { name: "Adjust stock" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Product", { selector: "#stock-product" })).toHaveValue("1"),
    );
    await user.type(screen.getByLabelText("Change"), "-20");
    await user.type(screen.getByLabelText("Note"), "Recount");
    await user.click(screen.getByRole("button", { name: "Adjust stock" }));
    await screen.findByText("Only 18 in stock.");

    await user.clear(screen.getByLabelText("Change"));
    await user.type(screen.getByLabelText("Change"), "-18");
    expect(screen.queryByText("Only 18 in stock.")).not.toBeInTheDocument();
  });
});

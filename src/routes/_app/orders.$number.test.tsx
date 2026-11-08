import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  getCompleteOrderMockHandler500,
  getGetOrderMockHandler500,
} from "@/api/generated/orders/orders.msw";
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
const nok = { id: 1, name: "Nok Srisuk" };

function signedIn(role: "owner" | "admin" | "staff") {
  mockApi.session = "live";
  mockApi.role = role;
}

function order(changes: Partial<Parameters<typeof orderOf>[0]> = {}) {
  return orderOf({
    number: 12,
    createdAt: "2026-11-05T14:12:00Z",
    createdBy: anan,
    customer: "Somchai Jaidee",
    note: "Pick up on Friday",
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
    ...changes,
  });
}

// The method, address and body of every request that changed something.
function writes() {
  const sent: { method: string; path: string; body: unknown }[] = [];
  server.events.on("request:start", ({ request }) => {
    if (request.method === "GET") return;
    const entry = { method: request.method, path: new URL(request.url).pathname, body: undefined };
    sent.push(entry as (typeof sent)[number]);
    void request
      .clone()
      .text()
      .then((text) => (entry.body = text ? JSON.parse(text) : undefined))
      .catch(() => undefined);
  });
  return sent;
}

// What a `<dt>` of the detail says next to it.
function fieldOf(label: string) {
  return screen.getByText(label, { selector: "dt" }).nextElementSibling;
}

// The question of Cancel order, open on Order 12.
async function askCancel(role: "owner" | "admin" = "admin") {
  signedIn(role);
  mockApi.products = [helmet, gloves];
  mockApi.orders = [order()];
  const sent = writes();
  const view = renderApp("/orders/12");
  await view.user.click(await screen.findByRole("button", { name: "Cancel order" }));
  return { ...view, sent, dialog: await screen.findByRole("alertdialog") };
}

describe("the Order detail", () => {
  // orders R17
  it("shows the lines with quantity, price and amount, the total, the customer, the note and who created it", async () => {
    signedIn("owner");
    mockApi.orders = [order()];
    renderApp("/orders/12");

    expect(await screen.findByRole("heading", { name: "Order #12" })).toBeInTheDocument();
    const rows = screen.getAllByRole("row").map((row) => row.textContent);
    expect(rows).toEqual([
      "ProductQuantityPriceAmount",
      "Safety helmetHLM-0012฿48,210.00฿96,420.00",
      "Work glovesGLV-0103฿1,250.50฿3,751.50",
      "Total฿100,171.50",
    ]);
    expect(fieldOf("Customer")).toHaveTextContent("Somchai Jaidee");
    expect(fieldOf("Note")).toHaveTextContent("Pick up on Friday");
    expect(fieldOf("Created")).toHaveTextContent("5 Nov, 14:12 by Anan Chaiyo");
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.queryByText("Completed", { selector: "dt" })).not.toBeInTheDocument();
    expect(screen.queryByText("Cancelled", { selector: "dt" })).not.toBeInTheDocument();
  });

  it("says when an Order has no customer or note", async () => {
    signedIn("staff");
    mockApi.orders = [order({ customer: "", note: "" })];
    renderApp("/orders/12");

    await screen.findByRole("heading", { name: "Order #12" });
    expect(fieldOf("Customer")).toHaveTextContent("No customer");
    expect(fieldOf("Note")).toHaveTextContent("No note");
  });

  // orders R17: once it is no longer Pending, who completed it and when.
  it("shows who completed the Order and when, and offers nothing more", async () => {
    signedIn("owner");
    mockApi.orders = [
      order({ status: "completed", completed: { at: "2026-11-06T09:30:00Z", by: nok } }),
    ];
    renderApp("/orders/12");

    await screen.findByRole("heading", { name: "Order #12" });
    expect(screen.getByText("Completed", { selector: "span" })).toBeInTheDocument();
    expect(fieldOf("Completed")).toHaveTextContent("6 Nov, 09:30 by Nok Srisuk");
    expect(screen.queryByRole("button", { name: "Complete order" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel order" })).not.toBeInTheDocument();
  });

  it("shows who cancelled the Order and when, and offers nothing more", async () => {
    signedIn("owner");
    mockApi.orders = [
      order({ status: "cancelled", cancelled: { at: "2026-11-07T08:00:00Z", by: anan } }),
    ];
    renderApp("/orders/12");

    await screen.findByRole("heading", { name: "Order #12" });
    expect(screen.getByText("Cancelled", { selector: "span" })).toBeInTheDocument();
    expect(fieldOf("Cancelled")).toHaveTextContent("7 Nov, 08:00 by Anan Chaiyo");
    expect(screen.queryByRole("button", { name: "Complete order" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel order" })).not.toBeInTheDocument();
  });

  // orders R14, ADR 0007
  it("offers no Edit", async () => {
    signedIn("owner");
    mockApi.orders = [order()];
    renderApp("/orders/12");

    await screen.findByRole("heading", { name: "Order #12" });
    expect(screen.queryByRole("link", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
  });

  it("leads back to the Orders List", async () => {
    signedIn("owner");
    mockApi.orders = [order()];
    const { user, router } = renderApp("/orders/12");

    await user.click(await screen.findByRole("link", { name: "Back to orders" }));

    expect(await screen.findByRole("heading", { name: "Orders" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/orders");
  });

  it("says when no Order has the number", async () => {
    signedIn("owner");
    renderApp("/orders/99");

    expect(await screen.findByText("No order has this number.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to orders" })).toBeInTheDocument();
  });

  it("says no Order has an address that is not a number, without asking the API", async () => {
    signedIn("owner");
    mockApi.orders = [order()];
    renderApp("/orders/12abc");

    expect(await screen.findByText("No order has this number.")).toBeInTheDocument();
  });

  // A number past what JavaScript holds exactly would name another Order once sent.
  it("says no Order has a number too large to be exact, without asking the API", async () => {
    signedIn("owner");
    mockApi.orders = [order()];
    const asked: string[] = [];
    server.events.on("request:start", ({ request }) => {
      asked.push(new URL(request.url).pathname);
    });
    renderApp("/orders/99999999999999999999");

    expect(await screen.findByText("No order has this number.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Order not found" })).toBeInTheDocument();
    expect(asked.filter((path) => path.startsWith("/api/orders"))).toEqual([]);
  });

  it("says when the API fails, and tries again", async () => {
    signedIn("owner");
    mockApi.orders = [order()];
    server.use(getGetOrderMockHandler500(serverFailure));
    const { user } = renderApp("/orders/12");

    expect(await screen.findByText("Something went wrong. Try again.")).toBeInTheDocument();
    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { name: "Order #12" })).toBeInTheDocument();
  });

  describe("who is offered what", () => {
    // orders R11, R12
    it.each([
      ["owner", true],
      ["admin", true],
      ["staff", false],
    ] as const)("offers %s Complete order, and Cancel order only if %s", async (role, cancels) => {
      signedIn(role);
      mockApi.orders = [order()];
      renderApp("/orders/12");

      expect(await screen.findByRole("button", { name: "Complete order" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Cancel order" }) !== null).toBe(cancels);
    });
  });

  describe("Complete order", () => {
    async function ask(role: "owner" | "admin" | "staff" = "staff") {
      signedIn(role);
      mockApi.products = [helmet, gloves];
      mockApi.orders = [order()];
      const sent = writes();
      const view = renderApp("/orders/12");
      await view.user.click(await screen.findByRole("button", { name: "Complete order" }));
      return { ...view, sent, dialog: await screen.findByRole("alertdialog") };
    }

    // orders R11, R13: the consequence is the reason for the question.
    it("asks first, naming the Order and the consequence", async () => {
      const { dialog, sent } = await ask();

      expect(within(dialog).getByText("Complete order #12?")).toBeInTheDocument();
      expect(dialog).toHaveTextContent(
        "The customer has paid and has the goods. A completed order is final: it can't be changed or cancelled.",
      );
      expect(sent).toEqual([]);
    });

    it("sends nothing when the question is dismissed", async () => {
      const { user, dialog, sent } = await ask();

      await user.click(within(dialog).getByRole("button", { name: "Go back" }));

      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(sent).toEqual([]);
      expect(screen.getByRole("button", { name: "Complete order" })).toBeInTheDocument();
    });

    it("completes the Order once confirmed, to Staff too, and says so", async () => {
      const { user, dialog, sent } = await ask("staff");

      await user.click(within(dialog).getByRole("button", { name: "Complete order" }));

      expect(await screen.findByText("Order completed")).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      // The buttons are gone: focus goes to the Order, not the page.
      await waitFor(() => expect(screen.getByRole("heading", { name: "Order #12" })).toHaveFocus());
      expect(sent).toEqual([{ method: "POST", path: "/api/orders/12/complete", body: undefined }]);
      expect(screen.getByText("Completed", { selector: "span" })).toBeInTheDocument();
      expect(fieldOf("Completed")).toHaveTextContent("by Suda Prasert");
      expect(screen.queryByRole("button", { name: "Complete order" })).not.toBeInTheDocument();
      // ADR 0007: completing changes no stock.
      expect(mockApi.products.map(({ stock }) => stock)).toEqual([18, 233]);
    });

    it("keeps the question open and says so when the API fails", async () => {
      const { user, dialog } = await ask();
      server.use(getCompleteOrderMockHandler500(serverFailure));

      await user.click(within(dialog).getByRole("button", { name: "Complete order" }));

      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "Something went wrong. Try again.",
      );
      expect(screen.queryByText("Order completed")).not.toBeInTheDocument();
    });
  });

  describe("Cancel order", () => {
    const ask = askCancel;

    // orders R12: cancelling gives stock back, which is why it is asked about.
    it("asks first, naming the Order and the consequence", async () => {
      const { dialog, sent } = await ask();

      expect(within(dialog).getByText("Cancel order #12?")).toBeInTheDocument();
      expect(dialog).toHaveTextContent(
        "Cancelling puts 5 items from its 2 lines back into stock. A cancelled order is final: it can't be completed or changed.",
      );
      expect(sent).toEqual([]);
    });

    it("sends nothing when the question is dismissed", async () => {
      const { user, dialog, sent } = await ask();

      await user.click(within(dialog).getByRole("button", { name: "Go back" }));

      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(sent).toEqual([]);
      expect(screen.getByText("Pending")).toBeInTheDocument();
    });

    it.each(["owner", "admin"] as const)(
      "cancels the Order once %s confirms, and says so",
      async (role) => {
        const { user, dialog, sent } = await ask(role);

        await user.click(within(dialog).getByRole("button", { name: "Cancel order" }));

        expect(await screen.findByText("Order cancelled")).toBeInTheDocument();
        await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
        await waitFor(() =>
          expect(screen.getByRole("heading", { name: "Order #12" })).toHaveFocus(),
        );
        expect(sent).toEqual([{ method: "POST", path: "/api/orders/12/cancel", body: undefined }]);
        expect(screen.getByText("Cancelled", { selector: "span" })).toBeInTheDocument();
        expect(fieldOf("Cancelled")).toHaveTextContent(
          `by ${role === "owner" ? "Nok Srisuk" : "Anan Chaiyo"}`,
        );
        expect(screen.queryByRole("button", { name: "Cancel order" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Complete order" })).not.toBeInTheDocument();
        // orders R12: the stock came back, one cancellation movement per line.
        expect(mockApi.products.map(({ stock }) => stock)).toEqual([20, 236]);
        expect(mockApi.stockMovements.map(({ kind }) => kind)).toEqual([
          "cancellation",
          "cancellation",
        ]);
      },
    );
  });

  // orders R12: the Role can change during the session, past what the screen offered.
  describe("a Cancel the Role may not make", () => {
    it("says the person may not cancel Orders, and keeps the question open", async () => {
      const { user, dialog, sent } = await askCancel();
      // The Owner made this Admin a Staff while the question was open.
      mockApi.role = "staff";

      await user.click(within(dialog).getByRole("button", { name: "Cancel order" }));

      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "Your role can't cancel orders. Only the Owner and Admins can.",
      );
      expect(sent).toEqual([{ method: "POST", path: "/api/orders/12/cancel", body: undefined }]);
      expect(screen.queryByText("Order cancelled")).not.toBeInTheDocument();
      expect(screen.getByText("Pending")).toBeInTheDocument();
    });
  });

  // orders R13: someone else got there first.
  describe("an Order that is no longer Pending", () => {
    it.each(["Complete order", "Cancel order"] as const)(
      "says so on %s and shows the Order as it now is",
      async (action) => {
        signedIn("owner");
        mockApi.orders = [order()];
        const { user } = renderApp("/orders/12");
        await user.click(await screen.findByRole("button", { name: action }));
        const dialog = await screen.findByRole("alertdialog");
        // Another User completes it while the question is open.
        mockApi.orders = [
          order({ status: "completed", completed: { at: "2026-11-06T09:30:00Z", by: anan } }),
        ];

        await user.click(within(dialog).getByRole("button", { name: action }));

        expect(
          await screen.findByText(
            "This order was completed or cancelled already, so it can't change.",
          ),
        ).toBeInTheDocument();
        await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
        expect(await screen.findByText("Completed", { selector: "span" })).toBeInTheDocument();
        expect(fieldOf("Completed")).toHaveTextContent("6 Nov, 09:30 by Anan Chaiyo");
        expect(screen.queryByRole("button", { name: "Complete order" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Cancel order" })).not.toBeInTheDocument();
        expect(screen.queryByText("Order completed")).not.toBeInTheDocument();
        expect(screen.queryByText("Order cancelled")).not.toBeInTheDocument();
      },
    );
  });
});

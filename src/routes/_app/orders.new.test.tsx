import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getCreateOrderMockHandler500 } from "@/api/generated/orders/orders.msw";
import { mockApi, productOf, serverFailure } from "@/mocks/handlers";
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
const goggles = productOf({
  id: 3,
  name: "Safety goggles",
  sku: "GOG-002",
  unit: "pcs",
  price: 350_00,
  stock: 40,
  status: "archived",
});

function signedIn(role: "owner" | "admin" | "staff") {
  mockApi.session = "live";
  mockApi.role = role;
}

// The body of every Create Order the screen sent.
function createOrderBodies() {
  const sent: unknown[] = [];
  server.events.on("request:start", ({ request }) => {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/api/orders") return;
    void request
      .clone()
      .json()
      .then((body: unknown) => sent.push(body));
  });
  return sent;
}

async function openCreateOrder(role: "owner" | "admin" | "staff" = "staff") {
  signedIn(role);
  mockApi.products = [helmet, gloves, goggles];
  const app = renderApp("/orders/new");
  await screen.findByRole("heading", { name: "New order" });
  return app;
}

// What the search offers for this text, one entry per Product.
async function offered(user: Awaited<ReturnType<typeof openCreateOrder>>["user"], text: string) {
  const search = screen.getByLabelText("Find a product");
  await user.clear(search);
  await user.type(search, text);
  // The list for the whole text, not one for the letters typed so far.
  await waitFor(() =>
    expect(screen.getByRole("list", { name: "Products found" })).toHaveAttribute(
      "aria-busy",
      "false",
    ),
  );
  return within(screen.getByRole("list", { name: "Products found" })).getAllByRole("listitem");
}

async function add(
  user: Awaited<ReturnType<typeof openCreateOrder>>["user"],
  text: string,
  name: string,
) {
  const entries = await offered(user, text);
  const entry = entries.find((one) => one.textContent?.includes(name));
  if (!entry) throw new Error(`${name} is not offered`);
  await user.click(within(entry).getByRole("button", { name: `Add ${name}` }));
}

function lineOf(name: string) {
  return screen.getByRole("group", { name });
}

describe("Create Order", () => {
  // orders R6, R19: Active Products only, each with its stock and price.
  it("offers Active Products only, each with its stock and price", async () => {
    const { user } = await openCreateOrder();

    const entries = await offered(user, "safety");
    expect(entries.map((entry) => entry.textContent)).toEqual([
      expect.stringContaining("Safety helmet"),
    ]);
    expect(entries[0]).toHaveTextContent("HLM-001");
    expect(entries[0]).toHaveTextContent("18 in stock");
    expect(entries[0]).toHaveTextContent("฿48,210.00");
  });

  // orders R4, R19: each line's amount, and the total as lines change.
  it("shows each line's amount and updates the total as lines change", async () => {
    const { user } = await openCreateOrder();
    const total = () => screen.getByRole("status", { name: "Total" });
    expect(total()).toHaveTextContent("฿0.00");

    await add(user, "helmet", "Safety helmet");
    expect(lineOf("Safety helmet")).toHaveTextContent("฿48,210.00");
    expect(total()).toHaveTextContent("฿48,210.00");

    const quantity = within(lineOf("Safety helmet")).getByLabelText("Quantity");
    await user.clear(quantity);
    await user.type(quantity, "2");
    expect(lineOf("Safety helmet")).toHaveTextContent("Amount฿96,420.00");

    await add(user, "GLV", "Work gloves");
    const gloves = within(lineOf("Work gloves")).getByLabelText("Quantity");
    await user.clear(gloves);
    await user.type(gloves, "3");
    expect(lineOf("Work gloves")).toHaveTextContent("Amount฿3,751.50");
    expect(total()).toHaveTextContent("฿100,171.50");

    await user.click(screen.getByRole("button", { name: "Remove Safety helmet" }));
    expect(screen.queryByRole("group", { name: "Safety helmet" })).not.toBeInTheDocument();
    expect(total()).toHaveTextContent("฿3,751.50");
  });

  it("starts a line at a quantity of 1, ready to change", async () => {
    const { user } = await openCreateOrder();

    await add(user, "helmet", "Safety helmet");

    const quantity = within(lineOf("Safety helmet")).getByLabelText("Quantity");
    expect(quantity).toHaveValue("1");
    expect(quantity).toHaveFocus();
  });

  // orders R3: a Product is on one line of an Order at most.
  it("doesn't offer a Product that is on a line already", async () => {
    const { user } = await openCreateOrder();
    await add(user, "helmet", "Safety helmet");

    const [entry] = await offered(user, "helmet");
    expect(
      within(entry!).queryByRole("button", { name: "Add Safety helmet" }),
    ).not.toBeInTheDocument();
    expect(within(entry!).getByRole("button", { name: "Added" })).toBeDisabled();
  });

  // orders R1, R3, R7: the lines, customer and note go to the API, which takes the stock.
  it("creates the Order and opens its detail with Order created", async () => {
    const sent = createOrderBodies();
    const { user, router } = await openCreateOrder();
    await add(user, "helmet", "Safety helmet");
    const quantity = within(lineOf("Safety helmet")).getByLabelText("Quantity");
    await user.clear(quantity);
    await user.type(quantity, "2");
    await add(user, "gloves", "Work gloves");
    await user.type(screen.getByLabelText("Customer (optional)"), "  Somchai Jaidee ");
    await user.type(screen.getByLabelText("Note (optional)"), "Pick up on Friday");
    await user.click(screen.getByRole("button", { name: "Create order" }));

    expect(await screen.findByRole("heading", { name: "Order #1" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/orders/1");
    expect(screen.getByText("Order #1 created")).toBeInTheDocument();
    expect(sent).toEqual([
      {
        customer: "Somchai Jaidee",
        note: "Pick up on Friday",
        lines: [
          { productId: 1, quantity: 2 },
          { productId: 2, quantity: 1 },
        ],
      },
    ]);
    expect(mockApi.products.find(({ id }) => id === 1)?.stock).toBe(16);
  });

  it("leaves out a customer and note that are empty", async () => {
    const sent = createOrderBodies();
    const { user } = await openCreateOrder();
    await add(user, "helmet", "Safety helmet");
    await user.type(screen.getByLabelText("Customer (optional)"), "   ");
    await user.click(screen.getByRole("button", { name: "Create order" }));

    await screen.findByRole("heading", { name: "Order #1" });
    expect(sent).toEqual([{ lines: [{ productId: 1, quantity: 1 }] }]);
  });

  // orders R1: one or more lines.
  it("asks for a product before it creates an Order with none", async () => {
    const sent = createOrderBodies();
    const { user } = await openCreateOrder();

    await user.click(screen.getByRole("button", { name: "Create order" }));

    expect(await screen.findByText("Add at least one product.")).toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  // orders R3: a whole quantity of at least 1.
  it.each(["0", "1.5", "two", ""])("refuses a quantity of %j", async (text) => {
    const sent = createOrderBodies();
    const { user } = await openCreateOrder();
    await add(user, "helmet", "Safety helmet");
    const quantity = within(lineOf("Safety helmet")).getByLabelText("Quantity");
    await user.clear(quantity);
    if (text) await user.type(quantity, text);

    await user.click(screen.getByRole("button", { name: "Create order" }));

    expect(
      await within(lineOf("Safety helmet")).findByText("Enter a whole number of 1 or more."),
    ).toBeInTheDocument();
    expect(quantity).toHaveAttribute("aria-invalid", "true");
    expect(sent).toEqual([]);
  });

  // orders R1: a customer name of up to 120 characters and a note of up to 200, counted as
  // characters (an emoji is one), never stricter than the API.
  it("takes a customer of 120 characters and a note of 200, and refuses one more", async () => {
    const sent = createOrderBodies();
    const { user } = await openCreateOrder();
    await add(user, "helmet", "Safety helmet");
    const customer = screen.getByLabelText("Customer (optional)");
    const note = screen.getByLabelText("Note (optional)");
    await user.click(customer);
    await user.paste(`${"😀".repeat(119)}a`.concat("b"));
    await user.click(note);
    await user.paste("n".repeat(201));

    await user.click(screen.getByRole("button", { name: "Create order" }));

    expect(
      await screen.findByText("Keep the customer's name to 120 characters."),
    ).toBeInTheDocument();
    expect(screen.getByText("Keep the note to 200 characters.")).toBeInTheDocument();
    expect(sent).toEqual([]);

    await user.type(customer, "{Backspace}");
    await user.type(note, "{Backspace}");
    await user.click(screen.getByRole("button", { name: "Create order" }));

    await screen.findByRole("heading", { name: "Order #1" });
    expect(sent).toEqual([
      {
        customer: `${"😀".repeat(119)}a`,
        note: "n".repeat(200),
        lines: [{ productId: 1, quantity: 1 }],
      },
    ]);
  });

  async function setQuantity(
    user: Awaited<ReturnType<typeof openCreateOrder>>["user"],
    name: string,
    text: string,
  ) {
    const quantity = within(lineOf(name)).getByLabelText("Quantity");
    await user.clear(quantity);
    await user.type(quantity, text);
  }

  // orders R8: refused whole, and every short line says how many are in stock, not only the first.
  it("shows beside every short line how many are in stock, and takes nothing", async () => {
    const sent = createOrderBodies();
    const { user } = await openCreateOrder();
    await add(user, "helmet", "Safety helmet");
    await setQuantity(user, "Safety helmet", "20");
    await add(user, "gloves", "Work gloves");
    await setQuantity(user, "Work gloves", "240");
    // Someone sold some gloves since they were offered.
    mockApi.products = mockApi.products.map((one) =>
      one.id === gloves.id ? productOf({ ...gloves, stock: 230 }) : one,
    );

    await user.click(screen.getByRole("button", { name: "Create order" }));

    expect(
      await within(lineOf("Safety helmet")).findByText(
        "Only 18 in stock. Lower the quantity to continue.",
      ),
    ).toBeInTheDocument();
    expect(
      within(lineOf("Work gloves")).getByText("Only 230 in stock. Lower the quantity to continue."),
    ).toBeInTheDocument();
    expect(lineOf("Work gloves")).toHaveTextContent("230 in stock");
    expect(screen.queryByText("There isn't enough stock for this change.")).not.toBeInTheDocument();
    expect(sent).toHaveLength(1);
    expect(mockApi.orders).toEqual([]);
    expect(mockApi.products.find(({ id }) => id === helmet.id)?.stock).toBe(18);
  });

  it("clears a short line's message once its quantity is within the stock", async () => {
    const { user } = await openCreateOrder();
    await add(user, "helmet", "Safety helmet");
    await setQuantity(user, "Safety helmet", "20");
    await add(user, "gloves", "Work gloves");
    await setQuantity(user, "Work gloves", "240");
    await user.click(screen.getByRole("button", { name: "Create order" }));
    await within(lineOf("Safety helmet")).findByText(/Only 18 in stock/);

    await setQuantity(user, "Safety helmet", "18");

    expect(within(lineOf("Safety helmet")).queryByText(/Only 18 in stock/)).not.toBeInTheDocument();
    expect(within(lineOf("Work gloves")).getByText(/Only 233 in stock/)).toBeInTheDocument();

    await setQuantity(user, "Work gloves", "233");
    await user.click(screen.getByRole("button", { name: "Create order" }));
    expect(await screen.findByRole("heading", { name: "Order #1" })).toBeInTheDocument();
  });

  // orders R6: a Product Archived since it was offered is refused, beside its line.
  it("says beside its line that a Product was archived since it was added", async () => {
    const { user } = await openCreateOrder();
    await add(user, "helmet", "Safety helmet");
    await add(user, "gloves", "Work gloves");
    mockApi.products = mockApi.products.map((one) =>
      one.id === gloves.id ? productOf({ ...gloves, status: "archived" }) : one,
    );

    await user.click(screen.getByRole("button", { name: "Create order" }));

    expect(
      await within(lineOf("Work gloves")).findByText(
        "This product is archived, so its stock can't change. Choose another.",
      ),
    ).toBeInTheDocument();
    // Beside its line only, not again above the form.
    expect(screen.getAllByText(/This product is archived/)).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Remove Work gloves" }));
    await user.click(screen.getByRole("button", { name: "Create order" }));
    expect(await screen.findByRole("heading", { name: "Order #1" })).toBeInTheDocument();
  });

  it("says what went wrong when the API fails, and keeps what was entered", async () => {
    server.use(getCreateOrderMockHandler500(serverFailure));
    const { user } = await openCreateOrder();
    await add(user, "helmet", "Safety helmet");
    await setQuantity(user, "Safety helmet", "2");

    await user.click(screen.getByRole("button", { name: "Create order" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Try again.");
    expect(within(lineOf("Safety helmet")).getByLabelText("Quantity")).toHaveValue("2");
  });
});

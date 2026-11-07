import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CreateProductBody } from "@/api/generated/model";
import { getCreateProductMockHandler201 } from "@/api/generated/products/products.msw";
import { mockApi, productOf } from "@/mocks/handlers";
import { renderApp } from "@/test/render-app";
import { server } from "@/test/server";

type User = ReturnType<typeof renderApp>["user"];

async function fillIn(
  user: User,
  fields: { name?: string; sku?: string; unit?: string; price?: string; minimumStock?: string },
) {
  await screen.findByLabelText("Name");
  const labels = {
    name: "Name",
    sku: "SKU",
    unit: "Unit",
    price: "Price (baht)",
    minimumStock: "Minimum stock",
  } as const;
  for (const [key, label] of Object.entries(labels) as [keyof typeof labels, string][]) {
    const text = fields[key];
    if (text === undefined) continue;
    await user.clear(screen.getByLabelText(label));
    await user.type(screen.getByLabelText(label), text);
  }
}

// What the API received, as the screen sent it.
function recordCreateRequests() {
  const sent: CreateProductBody[] = [];
  server.use(
    getCreateProductMockHandler201(async ({ request }) => {
      sent.push(await request.clone().json());
      return productOf({ id: 9, name: "x", sku: "X-1", unit: "pcs", price: 100 });
    }),
  );
  return sent;
}

const signedIn = (role: "owner" | "admin" = "owner") => {
  mockApi.session = "live";
  mockApi.role = role;
};

describe("the Product Form, adding", () => {
  it("takes a name, SKU, unit, price and Minimum stock, and no stock", async () => {
    signedIn();
    renderApp("/products/new");

    expect(await screen.findByLabelText("Name")).toBeInTheDocument();
    for (const label of ["SKU", "Unit", "Price (baht)", "Minimum stock"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    // products R6, context ADR 0006: stock changes only through Stock movements.
    expect(screen.queryByLabelText(/^stock$/i)).not.toBeInTheDocument();
    expect(screen.getByRole("main").querySelectorAll("input")).toHaveLength(5);
    // products R8: 0 by default.
    expect(screen.getByLabelText("Minimum stock")).toHaveValue("0");
  });

  it.each(["owner", "admin"] as const)(
    "sends what %s entered, the price in satang",
    async (role) => {
      signedIn(role);
      const sent = recordCreateRequests();
      const { user } = renderApp("/products/new");

      await fillIn(user, {
        name: "Safety helmet",
        sku: "HLM-001",
        unit: "pcs",
        price: "48.5",
        minimumStock: "60",
      });
      await user.click(screen.getByRole("button", { name: "Add product" }));

      await screen.findByRole("heading", { name: "Product added" });
      expect(sent).toEqual([
        { name: "Safety helmet", sku: "HLM-001", unit: "pcs", price: 4850, minimumStock: 60 },
      ]);
    },
  );

  it("sends the values without the spaces around them", async () => {
    signedIn();
    const sent = recordCreateRequests();
    const { user } = renderApp("/products/new");

    await fillIn(user, { name: "  สายไฟ ", sku: " WIRE-1 ", unit: " m ", price: " 12 " });
    await user.click(screen.getByRole("button", { name: "Add product" }));

    await screen.findByRole("heading", { name: "Product added" });
    expect(sent).toEqual([
      { name: "สายไฟ", sku: "WIRE-1", unit: "m", price: 1200, minimumStock: 0 },
    ]);
  });

  it("lets the Owner add another, or go back to the list", async () => {
    signedIn();
    const { user } = renderApp("/products/new");

    await fillIn(user, { name: "Safety helmet", sku: "HLM-001", unit: "pcs", price: "10" });
    await user.click(screen.getByRole("button", { name: "Add product" }));
    await screen.findByRole("heading", { name: "Product added" });
    expect(screen.getByText(/Safety helmet \(HLM-001\)/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add another product" }));
    expect(await screen.findByLabelText("Name")).toHaveValue("");
  });

  // products R2 to R5, R8
  it("asks for what is missing beside each field, and sends nothing", async () => {
    signedIn();
    const sent = recordCreateRequests();
    const { user } = renderApp("/products/new");

    await screen.findByLabelText("Name");
    await user.click(screen.getByRole("button", { name: "Add product" }));

    expect(await screen.findByText("Enter a name of up to 120 characters.")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInvalid();
    expect(screen.getByText(/^Enter a SKU/)).toBeInTheDocument();
    expect(screen.getByLabelText("SKU")).toBeInvalid();
    expect(screen.getByText(/^Enter the unit/)).toBeInTheDocument();
    expect(screen.getByText(/^Enter a price/)).toBeInTheDocument();
    expect(screen.getByLabelText("Price (baht)")).toBeInvalid();
    expect(screen.getByLabelText("Minimum stock")).toBeValid();
    expect(sent).toEqual([]);
  });

  it.each([
    ["a SKU with a space", { sku: "HLM 001" }],
    ["a SKU over 40 characters", { sku: "A".repeat(41) }],
    ["a unit over 20 characters", { unit: "u".repeat(21) }],
    ["a name over 120 characters", { name: "n".repeat(121) }],
    ["a price with letters", { price: "abc" }],
    ["a price with fractions of a satang", { price: "1.234" }],
    ["a price above ฿9,999,999.99", { price: "10000000" }],
    ["a Minimum stock with a fraction", { minimumStock: "2.5" }],
    ["a negative Minimum stock", { minimumStock: "-1" }],
  ])("refuses %s, and sends nothing", async (_case, wrong) => {
    signedIn();
    const sent = recordCreateRequests();
    const { user } = renderApp("/products/new");

    await fillIn(user, { name: "Helmet", sku: "H-1", unit: "pcs", price: "1" });
    const label = {
      sku: "SKU",
      unit: "Unit",
      name: "Name",
      price: "Price (baht)",
      minimumStock: "Minimum stock",
    }[Object.keys(wrong)[0] as "sku"];
    const field = screen.getByLabelText(label);
    await user.clear(field);
    await user.type(field, Object.values(wrong)[0]!);
    await user.click(screen.getByRole("button", { name: "Add product" }));

    expect(await screen.findByLabelText(label)).toBeInvalid();
    expect(sent).toEqual([]);
  });

  it("takes the edges of the allowed ranges", async () => {
    signedIn();
    const sent = recordCreateRequests();
    const { user } = renderApp("/products/new");

    await fillIn(user, {
      name: "n".repeat(120),
      sku: "A".repeat(40),
      unit: "u".repeat(20),
      price: "9999999.99",
    });
    await user.click(screen.getByRole("button", { name: "Add product" }));

    await screen.findByRole("heading", { name: "Product added" });
    expect(sent[0]).toMatchObject({ price: 999_999_999, minimumStock: 0 });
  });

  // products R3
  it("shows a SKU already in use beside the SKU, in any letter case, and keeps the form", async () => {
    signedIn();
    mockApi.products = [
      productOf({ id: 1, name: "Safety helmet", sku: "HLM-001", unit: "pcs", price: 100 }),
    ];
    const { user } = renderApp("/products/new");

    await fillIn(user, { name: "Another helmet", sku: "hlm-001", unit: "pcs", price: "5" });
    await user.click(screen.getByRole("button", { name: "Add product" }));

    const message = await screen.findByText(
      "Another product already uses this SKU. Use a different one.",
    );
    expect(message).toBeInTheDocument();
    expect(screen.getByLabelText("SKU")).toBeInvalid();
    expect(screen.getByLabelText("SKU")).toHaveAccessibleDescription(
      /Another product already uses/,
    );
    expect(screen.getByLabelText("Name")).toHaveValue("Another helmet");
    expect(screen.queryByRole("heading", { name: "Product added" })).not.toBeInTheDocument();

    // The message was about the old SKU.
    await user.type(screen.getByLabelText("SKU"), "2");
    expect(screen.queryByText(/already uses this SKU/)).not.toBeInTheDocument();
  });

  it("says what went wrong when the API fails in some other way", async () => {
    signedIn();
    const { user } = renderApp("/products/new");
    server.use(
      getCreateProductMockHandler201(() => {
        throw new Response(null, { status: 500 });
      }),
    );

    await fillIn(user, { name: "Helmet", sku: "H-1", unit: "pcs", price: "1" });
    await user.click(screen.getByRole("button", { name: "Add product" }));

    expect(await screen.findByText("Something went wrong. Try again.")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Helmet");
  });

  it("leads back to the list, where the new Product shows", async () => {
    signedIn();
    const { user } = renderApp("/products/new");

    await fillIn(user, { name: "Safety helmet", sku: "HLM-001", unit: "pcs", price: "10" });
    await user.click(screen.getByRole("button", { name: "Add product" }));
    await screen.findByRole("heading", { name: "Product added" });
    await user.click(screen.getByRole("link", { name: "Back to products" }));

    const row = await screen.findByRole("row", { name: /Safety helmet/ });
    // products R7: a new Product starts with no stock.
    expect(within(row).getByText("Out of stock")).toBeInTheDocument();
    expect(row).toHaveTextContent("HLM-001");
    expect(row).toHaveTextContent("฿10.00");
  });
});

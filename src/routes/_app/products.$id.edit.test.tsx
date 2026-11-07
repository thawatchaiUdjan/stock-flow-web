import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { UpdateProductBody } from "@/api/generated/model";
import { getUpdateProductMockHandler200 } from "@/api/generated/products/products.msw";
import { mockApi, productOf } from "@/mocks/handlers";
import { renderApp } from "@/test/render-app";
import { server } from "@/test/server";

const helmet = productOf({
  id: 1,
  name: "Safety helmet",
  sku: "HLM-001",
  unit: "pcs",
  price: 1_250_50,
  minimumStock: 60,
  stock: 18,
});
const gloves = productOf({
  id: 2,
  name: "Work gloves",
  sku: "GLV-010",
  unit: "box",
  price: 99_00,
});
const goggles = productOf({
  id: 3,
  name: "Old goggles",
  sku: "GGL-002",
  unit: "pcs",
  price: 80_00,
  stock: 4,
  status: "archived",
});

const signedIn = (role: "owner" | "admin" | "staff" = "owner") => {
  mockApi.session = "live";
  mockApi.role = role;
};

// What the API received, as the screen sent it. The answer is the mock's own, so the list agrees.
function recordUpdateRequests() {
  const sent: UpdateProductBody[] = [];
  server.events.on("request:start", async ({ request }) => {
    if (request.method === "PATCH") sent.push(await request.clone().json());
  });
  return sent;
}

async function opened(name: string) {
  await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue(name));
}

describe("the Product Form, editing", () => {
  it("opens with the Product's values, the price in baht", async () => {
    signedIn();
    mockApi.products = [helmet];
    renderApp("/products/1/edit");

    expect(await screen.findByRole("heading", { name: "Edit product" })).toBeInTheDocument();
    await opened("Safety helmet");
    expect(screen.getByLabelText("SKU")).toHaveValue("HLM-001");
    expect(screen.getByLabelText("Unit")).toHaveValue("pcs");
    expect(screen.getByLabelText("Price (baht)")).toHaveValue("1250.50");
    expect(screen.getByLabelText("Minimum stock")).toHaveValue("60");
    // products R6, context ADR 0006
    expect(screen.queryByLabelText(/^stock$/i)).not.toBeInTheDocument();
  });

  it("sends only what changed, the price in satang", async () => {
    signedIn("admin");
    mockApi.products = [helmet];
    const sent = recordUpdateRequests();
    const { user } = renderApp("/products/1/edit");

    await opened("Safety helmet");
    await user.clear(screen.getByLabelText("Price (baht)"));
    await user.type(screen.getByLabelText("Price (baht)"), "1300");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await screen.findByRole("heading", { name: "Products" });
    expect(sent).toEqual([{ price: 130_000 }]);
  });

  it("changes the Product, which the list then shows with its stock as it was", async () => {
    signedIn();
    mockApi.products = [helmet];
    const { user } = renderApp("/products/1/edit");

    await opened("Safety helmet");
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Hard hat");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const row = await screen.findByRole("row", { name: /Hard hat/ });
    expect(row).toHaveTextContent("18 of 60");
    expect(screen.queryByText("Safety helmet")).not.toBeInTheDocument();
  });

  it("sends nothing when nothing changed", async () => {
    signedIn();
    mockApi.products = [helmet];
    const sent = recordUpdateRequests();
    const { user } = renderApp("/products/1/edit");

    await opened("Safety helmet");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await screen.findByRole("heading", { name: "Products" });
    expect(sent).toEqual([]);
  });

  // products R3
  it("shows a SKU another Product uses beside the SKU, in any letter case", async () => {
    signedIn();
    mockApi.products = [helmet, gloves];
    const { user } = renderApp("/products/2/edit");

    await opened("Work gloves");
    await user.clear(screen.getByLabelText("SKU"));
    await user.type(screen.getByLabelText("SKU"), "hlm-001");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText("Another product already uses this SKU. Use a different one."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("SKU")).toBeInvalid();
    expect(screen.getByLabelText("Name")).toHaveValue("Work gloves");
  });

  it("lets a Product keep its own SKU, even in other letters", async () => {
    signedIn();
    mockApi.products = [helmet, gloves];
    const { user } = renderApp("/products/2/edit");

    await opened("Work gloves");
    await user.clear(screen.getByLabelText("SKU"));
    await user.type(screen.getByLabelText("SKU"), "glv-010");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await screen.findByRole("heading", { name: "Products" });
    expect(await screen.findByText("glv-010")).toBeInTheDocument();
  });

  it("says so when no Product has the address", async () => {
    signedIn();
    renderApp("/products/99/edit");

    expect(await screen.findByText("No product has this address.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to products" })).toHaveAttribute(
      "href",
      "/products",
    );
  });
});

describe("archiving and restoring", () => {
  // products R11
  it("asks first, naming the Product and the consequence, and archives on confirm", async () => {
    signedIn();
    mockApi.products = [helmet];
    const sent = recordUpdateRequests();
    const { user } = renderApp("/products/1/edit");

    await opened("Safety helmet");
    await user.click(screen.getByRole("button", { name: "Archive" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Archive Safety helmet?")).toBeInTheDocument();
    // products R12
    expect(dialog).toHaveTextContent("can't receive stock or be added to an order");
    expect(dialog).toHaveTextContent("Its stock of 18 stays as it is");
    expect(dialog).toHaveTextContent("you can restore it later");
    expect(sent).toEqual([]);

    await user.click(within(dialog).getByRole("button", { name: "Archive" }));

    await screen.findByRole("heading", { name: "Products" });
    expect(sent).toEqual([{ status: "archived" }]);
  });

  it("takes the Product out of the Active list and into the Archived one", async () => {
    signedIn();
    mockApi.products = [helmet, gloves];
    const { user } = renderApp("/products/1/edit");

    await opened("Safety helmet");
    await user.click(screen.getByRole("button", { name: "Archive" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Archive" }),
    );

    await screen.findByText("Work gloves");
    expect(screen.queryByText("Safety helmet")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Archived" }));
    expect(await screen.findByText("Safety helmet")).toBeInTheDocument();
  });

  it("sends nothing when the question is cancelled", async () => {
    signedIn();
    mockApi.products = [helmet];
    const sent = recordUpdateRequests();
    const { user } = renderApp("/products/1/edit");

    await opened("Safety helmet");
    await user.click(screen.getByRole("button", { name: "Archive" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }),
    );

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(sent).toEqual([]);
    expect(screen.getByRole("heading", { name: "Edit product" })).toBeInTheDocument();
  });

  it("offers Restore for an Archived Product, with its own question", async () => {
    signedIn("admin");
    mockApi.products = [goggles];
    const sent = recordUpdateRequests();
    const { user } = renderApp("/products/3/edit");

    await opened("Old goggles");
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Restore" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Restore Old goggles?")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("is back on the product list");
    await user.click(within(dialog).getByRole("button", { name: "Restore" }));

    await screen.findByRole("heading", { name: "Products" });
    expect(sent).toEqual([{ status: "active" }]);
  });

  it("says why when the API refuses, and keeps the question open", async () => {
    signedIn();
    mockApi.products = [helmet];
    const { user } = renderApp("/products/1/edit");
    await opened("Safety helmet");
    server.use(
      getUpdateProductMockHandler200(() => {
        throw new Response(null, { status: 500 });
      }),
    );

    await user.click(screen.getByRole("button", { name: "Archive" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Archive" }),
    );

    expect(await screen.findByText("Something went wrong. Try again.")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});

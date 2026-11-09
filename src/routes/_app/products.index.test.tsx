import { screen, waitFor, within } from "@testing-library/react";
import { delay } from "msw";
import { describe, expect, it } from "vitest";

import {
  getListProductsMockHandler200,
  getListProductsMockHandler500,
} from "@/api/generated/products/products.msw";
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
const boots = productOf({
  id: 3,
  name: "Steel boots",
  sku: "BTS-777",
  unit: "pcs",
  price: 990_00,
  minimumStock: 5,
  stock: 0,
});
const goggles = productOf({
  id: 4,
  name: "Old goggles",
  sku: "GGL-002",
  unit: "pcs",
  price: 80_00,
  minimumStock: 5,
  stock: 3,
  status: "archived",
});

function signedIn(role: "owner" | "admin" | "staff") {
  mockApi.session = "live";
  mockApi.role = role;
}

function rowOf(name: string) {
  return screen.getByRole("row", { name: new RegExp(name) });
}

// The address of every list request the app made, to assert what was sent.
function recordListRequests() {
  const sent: URL[] = [];
  server.events.on("request:start", ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname === "/api/products") sent.push(url);
  });
  return sent;
}

describe("the Product List", () => {
  // products R13, R9
  it("shows each Product's name, SKU, unit, price, stock and state, sorted by name", async () => {
    signedIn("owner");
    mockApi.products = [helmet, gloves, boots];
    renderApp("/products");

    await screen.findByText("Safety helmet");
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((row) => row.querySelector("a, p")?.textContent)).toEqual([
      "Safety helmet",
      "Steel boots",
      "Work gloves",
    ]);

    const low = rowOf("Safety helmet");
    expect(low).toHaveTextContent("HLM-001");
    expect(low).toHaveTextContent("pcs");
    expect(low).toHaveTextContent("฿48,210.00");
    expect(low).toHaveTextContent("18 of 60");
    expect(within(low).getByText("Low")).toBeInTheDocument();

    const healthy = rowOf("Work gloves");
    expect(healthy).toHaveTextContent("box");
    expect(healthy).toHaveTextContent("฿1,250.50");
    expect(healthy).toHaveTextContent("233");
    expect(within(healthy).getByText("In stock")).toBeInTheDocument();

    const out = rowOf("Steel boots");
    expect(out).toHaveTextContent("0 of 5");
    expect(within(out).getByText("Out of stock")).toBeInTheDocument();
  });

  it("draws the level bar of stock against the Minimum stock", async () => {
    signedIn("owner");
    mockApi.products = [helmet];
    renderApp("/products");

    await screen.findByText("Safety helmet");
    expect(
      within(rowOf("Safety helmet")).getByRole("meter", { name: "18 in stock, minimum 60" }),
    ).toBeInTheDocument();
  });

  // products R14
  it("shows the Active Products unless asked for the Archived ones", async () => {
    signedIn("owner");
    mockApi.products = [helmet, goggles];
    const { user } = renderApp("/products");

    await screen.findByText("Safety helmet");
    expect(screen.queryByText("Old goggles")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Archived" }));

    expect(await screen.findByText("Old goggles")).toBeInTheDocument();
    expect(screen.queryByText("Safety helmet")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archived" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  // products R14, and the Dashboard will link here
  it("opens filtered by what the address says", async () => {
    signedIn("staff");
    mockApi.products = [helmet, gloves, boots];
    const sent = recordListRequests();
    renderApp(`/products?stock=${encodeURIComponent('["low","out-of-stock"]')}&search=%22s%22`);

    await screen.findByText("Safety helmet");
    expect(screen.getByText("Steel boots")).toBeInTheDocument();
    expect(screen.queryByText("Work gloves")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toHaveValue("s");
    expect(screen.getByRole("button", { name: "Low" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "In stock" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(sent.at(-1)?.searchParams.getAll("stock")).toEqual(["low", "out-of-stock"]);
    expect(sent.at(-1)?.searchParams.get("search")).toBe("s");
  });

  it("keeps the search in the address and sends it", async () => {
    signedIn("owner");
    mockApi.products = [helmet, gloves];
    const sent = recordListRequests();
    const { user, router } = renderApp("/products");

    await screen.findByText("Work gloves");
    await user.type(screen.getByLabelText("Search"), "glv-0");

    await waitFor(() => expect(screen.queryByText("Safety helmet")).not.toBeInTheDocument());
    expect(screen.getByText("Work gloves")).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ search: "glv-0" });
    expect(sent.at(-1)?.searchParams.get("search")).toBe("glv-0");
  });

  it("filters by one or more stock states, kept in the address", async () => {
    signedIn("owner");
    mockApi.products = [helmet, gloves, boots];
    const sent = recordListRequests();
    const { user, router } = renderApp("/products");

    await screen.findByText("Work gloves");
    await user.click(screen.getByRole("button", { name: "Low" }));
    await waitFor(() => expect(screen.queryByText("Work gloves")).not.toBeInTheDocument());
    expect(screen.queryByText("Steel boots")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Out of stock" }));
    expect(await screen.findByText("Steel boots")).toBeInTheDocument();
    expect(screen.getByText("Safety helmet")).toBeInTheDocument();
    expect(screen.queryByText("Work gloves")).not.toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ stock: ["low", "out-of-stock"] });
    expect(sent.at(-1)?.searchParams.getAll("stock")).toEqual(["low", "out-of-stock"]);

    await user.click(screen.getByRole("button", { name: "Low" }));
    await waitFor(() => expect(screen.queryByText("Safety helmet")).not.toBeInTheDocument());
    expect(sent.at(-1)?.searchParams.getAll("stock")).toEqual(["out-of-stock"]);
  });

  it("says when nothing matches, and clears the filters", async () => {
    signedIn("owner");
    mockApi.products = [helmet];
    const { user } = renderApp("/products?search=%22zzz%22");

    expect(await screen.findByText("No products match these filters.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(await screen.findByText("Safety helmet")).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toHaveValue("");
  });

  // products R10, R15
  it.each(["owner", "admin"] as const)("offers %s Add product and Edit", async (role) => {
    signedIn(role);
    mockApi.products = [helmet];
    renderApp("/products");

    await screen.findByText("Safety helmet");
    expect(screen.getByRole("link", { name: "Add product" })).toHaveAttribute(
      "href",
      "/products/new",
    );
    expect(
      within(rowOf("Safety helmet")).getByRole("link", { name: "Edit Safety helmet" }),
    ).toHaveAttribute("href", "/products/1/edit");
  });

  it("offers Staff neither Add product nor Edit", async () => {
    signedIn("staff");
    mockApi.products = [helmet];
    renderApp("/products");

    await screen.findByText("Safety helmet");
    expect(screen.queryByRole("link", { name: "Add product" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Edit/ })).not.toBeInTheDocument();
    // They still see everything else, price included (R15).
    expect(rowOf("Safety helmet")).toHaveTextContent("฿48,210.00");
  });

  // products R16
  it("links each Product to its Stock movements", async () => {
    signedIn("staff");
    mockApi.products = [helmet, gloves];
    renderApp("/products");

    await screen.findByText("Safety helmet");
    expect(within(rowOf("Work gloves")).getByRole("link", { name: "Work gloves" })).toHaveAttribute(
      "href",
      "/stock-movements?productId=2",
    );
  });

  it("offers the Owner and Admins to add the first Product when there is none", async () => {
    signedIn("admin");
    renderApp("/products");

    expect(
      await screen.findByText("No products yet. Add your first product to start tracking stock."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add product" })).toHaveAttribute(
      "href",
      "/products/new",
    );
  });

  it("tells Staff there is nothing yet, without an action they can't use", async () => {
    signedIn("staff");
    renderApp("/products");

    expect(await screen.findByText(/No products yet\./)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add product" })).not.toBeInTheDocument();
  });

  it("pages through a long list", async () => {
    signedIn("owner");
    mockApi.products = Array.from({ length: 55 }, (_, index) =>
      productOf({
        id: index + 1,
        name: `Item ${String(index + 1).padStart(2, "0")}`,
        sku: `SKU-${index + 1}`,
        unit: "pcs",
        price: 100,
        minimumStock: 1,
        stock: 10,
      }),
    );
    const sent = recordListRequests();
    const { user } = renderApp("/products?size=50");

    await screen.findByText("Item 01");
    expect(screen.getByText("Item 50")).toBeInTheDocument();
    expect(screen.queryByText("Item 51")).not.toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2 \u00b7 55 matching")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(await screen.findByText("Item 51")).toBeInTheDocument();
    expect(screen.queryByText("Item 01")).not.toBeInTheDocument();
    expect(screen.getByText("Page 2 of 2 \u00b7 55 matching")).toBeInTheDocument();
    expect(sent.at(-1)?.searchParams.get("offset")).toBe("50");
  });

  it("says what went wrong and tries again", async () => {
    signedIn("owner");
    mockApi.products = [helmet];
    server.use(getListProductsMockHandler500(serverFailure));
    const { user } = renderApp("/products");

    expect(await screen.findByText("Something went wrong. Try again.")).toBeInTheDocument();
    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Safety helmet")).toBeInTheDocument();
  });
});

// navigation-and-lists R4-R5
it("keeps paging visible on a single page with the default size", async () => {
  signedIn("owner");
  mockApi.products = [helmet];
  const sent = recordListRequests();
  renderApp("/products");
  await screen.findByText("Safety helmet");
  expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  expect(screen.getByLabelText("Rows per page")).toHaveValue("25");
  expect(screen.getByText("Page 1 of 1 \u00b7 1 matching")).toBeInTheDocument();
  expect(sent.at(-1)?.searchParams.get("limit")).toBe("25");
});

// navigation-and-lists R5
it("reloads a chosen size and filter, resets size and search to page one, and recovers an absent page", async () => {
  signedIn("owner");
  mockApi.products = Array.from({ length: 31 }, (_, i) =>
    productOf({ id: i + 1, name: `Item ${i + 1}`, sku: `SKU-${i + 1}`, price: 100, unit: "pcs" }),
  );
  const sent = recordListRequests();
  const { user, router } = renderApp("/products?size=10&page=2&search=Item");
  await screen.findByText("Page 2 of 4 \u00b7 31 matching");
  expect(sent.at(-1)?.searchParams.get("limit")).toBe("10");
  expect(sent.at(-1)?.searchParams.get("offset")).toBe("10");
  expect(sent.at(-1)?.searchParams.get("search")).toBe("Item");
  await user.selectOptions(screen.getByLabelText("Rows per page"), "25");
  await screen.findByText("Page 1 of 2 \u00b7 31 matching");
  expect(router.state.location.search).toMatchObject({ size: 25, search: "Item" });
  await user.click(screen.getByRole("button", { name: "Next page" }));
  await screen.findByText("Page 2 of 2 \u00b7 31 matching");
  await user.type(screen.getByLabelText("Search"), " 1");
  await waitFor(() => expect(sent.at(-1)?.searchParams.get("offset")).toBe("0"));
  await router.navigate({ to: "/products", search: { page: 999, size: 10, search: "Item" } });
  await screen.findByText("This page is no longer available.");
  await user.click(screen.getByRole("button", { name: "First page" }));
  await screen.findByText("Page 1 of 4 \u00b7 31 matching");
});

// navigation-and-lists R4-R5: a pending page must never use the preceding total.
it("disables forward paging while the chosen server page loads and on errors", async () => {
  signedIn("owner");
  mockApi.products = [helmet];
  const { user, router } = renderApp("/products");
  await screen.findByText("Safety helmet");
  server.use(
    getListProductsMockHandler200(async () => {
      await delay(150);
      return { products: [], total: 0 };
    }),
  );
  await router.navigate({ to: "/products", search: { page: 2 } });
  expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  expect(screen.queryByText("Safety helmet")).not.toBeInTheDocument();
  await screen.findByText("This page is no longer available.");
  server.use(getListProductsMockHandler500(serverFailure));
  await router.navigate({ to: "/products", search: { page: 3 } });
  await screen.findByRole("button", { name: "Try again" });
  expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "First page" })).toBeEnabled();
  await user.click(screen.getByRole("button", { name: "First page" }));
  expect(router.state.location.search.page).toBeUndefined();
});

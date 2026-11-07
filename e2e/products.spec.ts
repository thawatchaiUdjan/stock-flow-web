import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// The people and state key of src/mocks, the install every test starts from.
const stateKey = "stock-flow-mock-api";
const people = { owner: "nok@example.com", staff: "suda@example.com" };

// An install where everyone already has this password, and where the Shop already sells `products`.
async function install(page: Page, password: string, products: object[] = []) {
  await page.addInitScript(
    ({ key, state }) => {
      if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, state);
    },
    { key: stateKey, state: JSON.stringify({ password, products }) },
  );
}

async function logIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

function product(id: number, fields: object) {
  return {
    id,
    unit: "pcs",
    price: 12_345,
    minimumStock: 60,
    stock: 18,
    stockState: "low",
    status: "active",
    ...fields,
  };
}

test("the Owner adds a Product and finds it by SKU", async ({ page }) => {
  const password = `correct-horse-${test.info().testId}`;
  // Unique, so that no other test's data can match.
  const sku = `E2E-${test.info().testId.slice(0, 12)}`.toUpperCase();
  const name = `Safety helmet ${test.info().testId}`;
  await install(page, password);

  await logIn(page, people.owner, password);
  await expect(page).toHaveURL("/dashboard");
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Products" })
    .click();
  await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
  await expect(
    page.getByText("No products yet. Add your first product to start tracking stock."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Add product" }).click();

  const create = page.waitForRequest((request) => request.url().endsWith("/api/products"));
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("SKU").fill(sku);
  await page.getByLabel("Unit").fill("pcs");
  await page.getByLabel("Price (baht)").fill("48.50");
  await page.getByLabel("Minimum stock").fill("60");
  await page.getByRole("button", { name: "Add product" }).click();

  expect((await create).postDataJSON()).toEqual({
    name,
    sku,
    unit: "pcs",
    price: 4850,
    minimumStock: 60,
  });
  await expect(page.getByRole("heading", { name: "Product added" })).toBeVisible();
  await page.getByRole("link", { name: "Back to products" }).click();

  // Found by SKU, in any letter case, and the search sits in the address.
  await page.getByLabel("Search").fill(sku.toLowerCase());
  await expect(page).toHaveURL(/search=/);
  const row = page.getByRole("row", { name: new RegExp(name) });
  await expect(row).toContainText(sku);
  await expect(row).toContainText("฿48.50");
  await expect(row).toContainText("Out of stock");

  // A link to the filtered list opens it filtered, after a reload too.
  await page.reload();
  await expect(page.getByLabel("Search")).toHaveValue(sku.toLowerCase());
  await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible();
});

// docs/design.md, *Layout* and *Tables*: it is checked at 375, 768, 1024 and 1440 px; controls are
// 44 px tall on a phone and 38 px on a desktop; no page scrolls sideways; on a phone the name, SKU,
// stock and state stay.
for (const { width, phone } of [
  { width: 375, phone: true },
  { width: 768, phone: true },
  { width: 1024, phone: false },
  { width: 1440, phone: false },
]) {
  test(`the Product List fits a ${phone ? "phone" : "desktop"} at ${width} px`, async ({
    page,
  }) => {
    const password = `correct-horse-${test.info().testId}`;
    await install(page, password, [
      product(1, {
        name: "Safety helmet with a very long name that goes on and on past the edge",
        sku: "HLM-001-WITH-A-LONG-SKU-THAT-KEEPS-GOING",
        price: 4_821_000,
      }),
      product(2, {
        name: "Work gloves",
        sku: "GLV-010",
        stock: 233,
        minimumStock: 20,
        stockState: "in-stock",
      }),
    ]);
    await page.setViewportSize({ width, height: 900 });
    await logIn(page, people.owner, password);
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Products" })
      .click();
    const row = page.getByRole("row", { name: /Work gloves/ });
    await expect(row).toBeVisible();

    const sidewaysScroll = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(sidewaysScroll).toBe(0);

    const search = page.getByLabel("Search");
    expect((await search.boundingBox())!.height).toBe(phone ? 44 : 38);
    await expect(search).toHaveCSS("font-size", phone ? "16px" : "15px");
    const edit = row.getByRole("link", { name: "Edit Work gloves" });
    expect((await edit.boundingBox())!.height).toBe(phone ? 44 : 38);

    const surface = (await page.getByRole("table").boundingBox())!;
    expect(surface.x + surface.width).toBeLessThanOrEqual(width);

    await expect(row).toContainText("GLV-010");
    await expect(row).toContainText("233");
    await expect(row).toContainText("In stock");
    if (phone) {
      await expect(row.getByText("pcs")).toBeHidden();
      await expect(row.getByText(/^฿/)).toBeHidden();
      await expect(page.getByRole("columnheader")).toHaveCount(0);
    } else {
      await expect(row.getByText("pcs")).toBeVisible();
      await expect(row.getByText(/^฿/)).toBeVisible();
      await expect(page.getByRole("columnheader")).toHaveText([
        "Product",
        "Unit",
        "Price",
        "Stock",
        "State",
        "Actions",
      ]);
    }
  });
}

test("Staff see the Product List without actions, and the Product Form says No access", async ({
  page,
}) => {
  const password = `correct-horse-${test.info().testId}`;
  await install(page, password, [product(1, { name: "Safety helmet", sku: "HLM-001" })]);

  await logIn(page, people.staff, password);
  await expect(page).toHaveURL("/orders");
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Products" })
    .click();
  await expect(page.getByRole("row", { name: /Safety helmet/ })).toContainText("฿123.45");
  await expect(page.getByRole("link", { name: "Add product" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Edit/ })).toHaveCount(0);

  await page.goto("/products/new");
  await expect(page.getByRole("heading", { name: "No access" })).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveCount(0);
});

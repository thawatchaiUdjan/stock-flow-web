import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// The happy path through the real stack; every other case is the mocked suite's (e2e/).
// It starts from a freshly migrated database whose Owner has an unused Setup link.
const email = requiredEnv("SMOKE_OWNER_EMAIL");
const token = requiredEnv("SMOKE_SETUP_LINK_TOKEN");

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value)
    throw new Error(`${name} is not set. docs/agents/testing.md says where it comes from.`);
  return value;
}

// Unique, so a second run finds its own Product.
const run = Date.now().toString(36);
const password = `correct-horse-${run}`;
const product = { name: `Smoke helmet ${run}`, sku: `SMK-${run}`.toUpperCase() };

test.describe.configure({ mode: "serial" });

// One browser session for the whole journey: the Owner logs in once, in the first test.
let page: Page;
test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
});
test.afterAll(async () => {
  await page.context().close();
});

function openFromMenu(name: string) {
  return page.getByRole("navigation", { name: "Main" }).getByRole("link", { name }).click();
}

// users-and-access R2, R27, R34: the Owner's first password comes from a Setup link.
test("the Owner sets a password from the Setup link and logs in", async () => {
  await page.goto(`/set-password#${token}`);
  await expect(page.getByText(email)).toBeVisible();
  await page.getByLabel("New password").fill(password);
  await page.getByRole("button", { name: "Set password" }).click();
  await expect(page).toHaveURL("/login");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});

// products R2, R4
test("the Owner adds a Product", async () => {
  await openFromMenu("Products");
  await page.getByRole("link", { name: "Add product" }).click();
  await page.getByLabel("Name").fill(product.name);
  await page.getByLabel("SKU").fill(product.sku);
  await page.getByLabel("Unit").fill("pcs");
  await page.getByLabel("Price (baht)").fill("48.50");
  await page.getByLabel("Minimum stock").fill("5");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByRole("heading", { name: "Product added" })).toBeVisible();
});

test("the Owner receives stock for the Product", async () => {
  await openFromMenu("Products");
  const row = page.getByRole("row", { name: new RegExp(product.name) });
  await expect(row).toContainText("0 of 5");
  await row.getByRole("link", { name: product.name, exact: true }).click();
  await expect(page).toHaveURL(/\/stock-movements\?productId=\d+/);
  await page.getByRole("button", { name: "Receive stock" }).click();
  await page.getByLabel("Quantity").fill("12");
  await page.getByRole("button", { name: "Receive stock" }).click();
  await expect(page.getByText("Stock received", { exact: true })).toBeVisible();
  await expect(page.getByRole("row", { name: /Receive/ })).toContainText("+12");
});

// dashboard-and-reports R2, R3: an Order is a Sale once it is completed.
test("the Owner creates an Order, completes it and sees the Sale on the Dashboard", async () => {
  await page.goto("/orders/new");
  await page.getByLabel("Find a product").fill(product.sku);
  await page.getByRole("button", { name: `Add ${product.name}` }).click();
  await page.getByRole("group", { name: product.name }).getByLabel("Quantity").fill("2");
  await page.getByRole("button", { name: "Create order" }).click();
  await expect(page.getByText(/^Order #\d+ created$/)).toBeVisible();

  await openFromMenu("Dashboard");
  await page
    .getByRole("region", { name: "Newest orders" })
    .getByRole("link", { name: /^#\d+$/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Complete order" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Complete order" }).click();
  await expect(page.getByText("Order completed", { exact: true })).toBeVisible();

  await openFromMenu("Dashboard");
  // 2 pcs at ฿48.50. A freshly migrated database holds no other Sale.
  await expect(page.getByText("Today's sales", { exact: true }).locator("..")).toContainText(
    "฿97.00",
  );
});

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// The people and state key of src/mocks, the install every test starts from.
const stateKey = "stock-flow-mock-api";
const people = { owner: "nok@example.com", admin: "anan@example.com", staff: "suda@example.com" };
const anan = { id: 2, name: "Anan Chaiyo" };

// An install where everyone already has this password, and where the Shop already has these.
async function install(page: Page, password: string, state: object) {
  await page.addInitScript(
    ({ key, saved }) => {
      if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, saved);
    },
    { key: stateKey, saved: JSON.stringify({ password, ...state }) },
  );
}

async function logIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

function helmet(name: string) {
  return {
    id: 1,
    name,
    sku: "HLM-001",
    unit: "pcs",
    price: 12_345,
    minimumStock: 60,
    stock: 18,
    stockState: "low",
    status: "active",
  };
}

// A Pending Order for two helmets, as the API would hold it.
function pendingOrder(name: string, customer: string) {
  return {
    id: 1012,
    number: 12,
    status: "pending",
    customer,
    note: "",
    createdAt: "2026-11-05T14:12:00Z",
    createdBy: anan,
    completed: null,
    cancelled: null,
    total: 24_690,
    lines: [
      { product: { id: 1, name, sku: "HLM-001" }, quantity: 2, price: 12_345, amount: 24_690 },
    ],
  };
}

test("Staff find an Order by its customer and complete it", async ({ page }) => {
  const password = `correct-horse-${test.info().testId}`;
  // Unique, so that no other test's data can match.
  const name = `Safety helmet ${test.info().testId}`;
  const customer = `Somchai ${test.info().testId}`;
  await install(page, password, {
    products: [helmet(name)],
    orders: [pendingOrder(name, customer)],
  });

  await logIn(page, people.staff, password);
  await expect(page).toHaveURL("/orders");
  await page.getByLabel("Search").fill(customer.toLowerCase());
  await expect(page).toHaveURL(/search=/);
  const row = page.getByRole("row", { name: new RegExp(customer) });
  await expect(row).toContainText("Pending");
  await row.getByRole("link", { name: "#12" }).click();

  await expect(page.getByRole("heading", { name: "Order #12" })).toBeVisible();
  // orders R12: Staff are not shown what they can't do.
  await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
  const complete = page.waitForRequest((request) =>
    request.url().endsWith("/api/orders/12/complete"),
  );
  await page.getByRole("button", { name: "Complete order" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Complete order" }).click();

  expect((await complete).method()).toBe("POST");
  await expect(page.getByText("Order completed", { exact: true })).toBeVisible();
  await expect(page.getByText("by Suda Prasert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Complete order" })).toHaveCount(0);
});

test("an Admin cancels a Pending Order and traces its stock from Stock movements", async ({
  page,
}) => {
  const password = `correct-horse-${test.info().testId}`;
  const name = `Safety helmet ${test.info().testId}`;
  await install(page, password, {
    products: [helmet(name)],
    orders: [pendingOrder(name, `Somchai ${test.info().testId}`)],
  });

  await logIn(page, people.admin, password);
  await page.goto("/orders/12");
  const cancel = page.waitForRequest((request) => request.url().endsWith("/api/orders/12/cancel"));
  await page.getByRole("button", { name: "Cancel order" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Cancel order #12?");
  await dialog.getByRole("button", { name: "Cancel order" }).click();

  expect((await cancel).method()).toBe("POST");
  await expect(page.getByText("Order cancelled", { exact: true })).toBeVisible();

  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Stock movements" })
    .click();
  const entry = page.getByRole("row", { name: /Cancellation/ });
  await expect(entry).toContainText("+2");
  await entry.getByRole("link", { name: "#12" }).click();
  await expect(page.getByRole("heading", { name: "Order #12" })).toBeVisible();
  await expect(page.getByText("Cancelled", { exact: true }).first()).toBeVisible();
});

// Finds a Product by the text and adds it to the Order, at this quantity.
async function addLine(page: Page, text: string, name: string, quantity: string) {
  await page.getByLabel("Find a product").fill(text);
  await page.getByRole("button", { name: `Add ${name}` }).click();
  await page.getByRole("group", { name }).getByLabel("Quantity").fill(quantity);
}

test("Staff create an Order and complete it", async ({ page }) => {
  const password = `correct-horse-${test.info().testId}`;
  const name = `Safety helmet ${test.info().testId}`;
  const customer = `Somchai ${test.info().testId}`;
  await install(page, password, { products: [helmet(name)] });

  await logIn(page, people.staff, password);
  await expect(page).toHaveURL("/orders");
  await page.getByRole("main").getByRole("link", { name: "New order" }).click();
  await expect(page.getByRole("heading", { name: "New order" })).toBeVisible();

  await page.getByLabel("Find a product").fill("HLM-001");
  await expect(page.getByRole("listitem").filter({ hasText: name })).toContainText("18 in stock");
  await addLine(page, "HLM-001", name, "2");
  await expect(page.getByRole("status", { name: "Total" })).toHaveText("฿246.90");
  await page.getByLabel("Customer (optional)").fill(customer);

  const create = page.waitForRequest(
    (request) => request.url().endsWith("/api/orders") && request.method() === "POST",
  );
  await page.getByRole("button", { name: "Create order" }).click();
  expect((await create).postDataJSON()).toEqual({
    customer,
    lines: [{ productId: 1, quantity: 2 }],
  });

  await expect(page.getByRole("heading", { name: "Order #1" })).toBeVisible();
  await expect(page.getByText("Order #1 created", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Complete order" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Complete order" }).click();
  await expect(page.getByText("Order completed", { exact: true })).toBeVisible();
  await expect(page.getByText("by Suda Prasert").last()).toBeVisible();
});

test("the Owner cancels an Order and sees its stock come back on the Product List", async ({
  page,
}) => {
  const password = `correct-horse-${test.info().testId}`;
  const name = `Safety helmet ${test.info().testId}`;
  await install(page, password, { products: [helmet(name)] });

  await logIn(page, people.owner, password);
  await page.goto("/orders/new");
  await addLine(page, "helmet", name, "5");
  await page.getByRole("button", { name: "Create order" }).click();
  await expect(page.getByText("Order #1 created", { exact: true })).toBeVisible();

  const products = page.getByRole("navigation", { name: "Main" }).getByRole("link", {
    name: "Products",
  });
  await products.click();
  await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText("13 of 60");

  await page.goto("/orders/1");
  await page.getByRole("button", { name: "Cancel order" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Cancel order" }).click();
  await expect(page.getByText("Order cancelled", { exact: true })).toBeVisible();

  await products.click();
  await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText("18 of 60");
});

// docs/design.md, *Breakpoints*: no page scrolls sideways at any of these widths.
for (const width of [375, 768, 1024, 1440]) {
  test(`the Orders List and an Order detail fit ${width} px`, async ({ page }) => {
    const password = `correct-horse-${test.info().testId}`;
    const name = "Safety helmet with a very long name that goes on and on past the edge";
    await install(page, password, {
      products: [helmet(name)],
      orders: [pendingOrder(name, "Somchai with a very long customer name that goes on and on")],
    });
    await page.setViewportSize({ width, height: 900 });
    await logIn(page, people.staff, password);
    await expect(page.getByRole("link", { name: "#12" })).toBeVisible();

    const sideways = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
    expect(await sideways()).toBe(0);

    await page.getByRole("link", { name: "#12" }).click();
    await expect(page.getByRole("heading", { name: "Order #12" })).toBeVisible();
    expect(await sideways()).toBe(0);
  });
}

// docs/design.md, *Breakpoints*: Create Order, with a line and its refusal, fits a phone too.
for (const width of [375, 768, 1024, 1440]) {
  test(`Create Order fits ${width} px`, async ({ page }) => {
    const password = `correct-horse-${test.info().testId}`;
    const name = "Safety helmet with a very long name that goes on and on past the edge";
    await install(page, password, { products: [helmet(name)] });
    await page.setViewportSize({ width, height: 900 });
    await logIn(page, people.staff, password);
    await page.getByRole("main").getByRole("link", { name: "New order" }).click();
    await addLine(page, "helmet", name, "20");
    await page.getByRole("button", { name: "Create order" }).click();
    await expect(page.getByText("Only 18 in stock. Lower the quantity to continue.")).toBeVisible();

    const sideways = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(sideways).toBe(0);
  });
}

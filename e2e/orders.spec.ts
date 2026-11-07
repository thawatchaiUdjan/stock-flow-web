import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// The people and state key of src/mocks, the install every test starts from.
const stateKey = "stock-flow-mock-api";
const people = { admin: "anan@example.com", staff: "suda@example.com" };
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

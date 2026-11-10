import { expect, test } from "@playwright/test";

import { install, logIn } from "./support";

// The people of src/mocks.
const people = { staff: "suda@example.com" };

test("Staff receive stock for a Product and see its new stock on the Product List", async ({
  page,
}) => {
  const password = `correct-horse-${test.info().testId}`;
  // Unique, so that no other test's data can match.
  const name = `Safety helmet ${test.info().testId}`;
  await install(page, password, {
    products: [
      {
        id: 1,
        name,
        sku: "HLM-001",
        unit: "pcs",
        price: 12_345,
        minimumStock: 60,
        stock: 18,
        stockState: "low",
        status: "active",
      },
    ],
  });

  await logIn(page, people.staff, password);
  await expect(page).toHaveURL("/orders");
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Products" })
    .click();
  const before = page.getByRole("row", { name: new RegExp(name) });
  await expect(before).toContainText("18 of 60");

  // The Product List links to the Product's history, and the form opens on that Product.
  await before.getByRole("link", { name }).click();
  await expect(page).toHaveURL(/\/stock-movements\?productId=1/);
  await expect(page.getByText("No stock movements match these filters.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Adjust stock" })).toHaveCount(0);
  await page.getByRole("link", { name: "Receive stock" }).click();
  await expect(page.getByLabel("Product", { exact: true }).last()).toHaveValue("1");

  const receive = page.waitForRequest((request) =>
    request.url().endsWith("/api/stock-movements/receive"),
  );
  await page.getByLabel("Quantity").fill("12");
  await page.getByLabel("Note (optional)").fill("Delivery 4012");
  await page.getByRole("button", { name: "Receive stock" }).click();

  expect((await receive).postDataJSON()).toEqual({
    productId: 1,
    quantity: 12,
    note: "Delivery 4012",
  });
  await expect(page.getByText("Stock received", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to stock movements" }).click();
  const entry = page.getByRole("row", { name: /Delivery 4012/ });
  await expect(entry).toContainText("Receive");
  await expect(entry).toContainText("+12");

  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Products" })
    .click();
  await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText("30");
});

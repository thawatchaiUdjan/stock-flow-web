import { expect, test } from "@playwright/test";

import { install, logIn } from "./support";

// The people of src/mocks.
const people = { owner: "nok@example.com", admin: "anan@example.com" };

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

// dashboard-and-reports R2, R3: an Order counts in today's Sales once it is completed.
test("the Owner completes an Order and sees it in today's Sales", async ({ page }) => {
  const password = `correct-horse-${test.info().testId}`;
  const name = `Safety helmet ${test.info().testId}`;
  await install(page, password, { products: [helmet(name)] });

  await logIn(page, people.owner, password);
  await expect(page).toHaveURL("/dashboard");
  const sales = page.getByText("Today's sales", { exact: true }).locator("..");
  await expect(sales).toContainText("฿0.00");
  await expect(page.getByRole("region", { name: "Restock" })).toContainText("18 of 60");

  await page.goto("/orders/new");
  await page.getByLabel("Find a product").fill("HLM-001");
  await page.getByRole("button", { name: `Add ${name}` }).click();
  await page.getByRole("group", { name }).getByLabel("Quantity").fill("2");
  await page.getByRole("button", { name: "Create order" }).click();
  await expect(page.getByText("Order #1 created", { exact: true })).toBeVisible();

  // A Pending Order is no Sale yet.
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Dashboard" })
    .click();
  await expect(page.getByText("Pending orders", { exact: true }).locator("..")).toContainText("1");
  await expect(sales).toContainText("฿0.00");

  await page
    .getByRole("region", { name: "Newest orders" })
    .getByRole("link", { name: "#1" })
    .click();
  await page.getByRole("button", { name: "Complete order" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Complete order" }).click();
  await expect(page.getByText("Order completed", { exact: true })).toBeVisible();

  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Dashboard" })
    .click();
  await expect(sales).toContainText("฿246.90");
  await expect(
    page.getByText("Orders completed today", { exact: true }).locator(".."),
  ).toContainText("1");
  await expect(page.getByText("Pending orders", { exact: true }).locator("..")).toContainText("0");
  await expect(page.getByRole("region", { name: "Restock" })).toContainText("16 of 60");
  await expect(
    page.getByRole("figure", { name: /Sales for each of the last 14 days/ }),
  ).toBeVisible();
});

// docs/design.md, *Breakpoints*: no page scrolls sideways at any of these widths.
for (const width of [375, 768, 1024, 1440]) {
  test(`the Dashboard fits ${width} px`, async ({ page }) => {
    const password = `correct-horse-${test.info().testId}`;
    const name = "Safety helmet with a very long name that goes on and on past the edge";
    await install(page, password, { products: [helmet(name)] });
    await page.setViewportSize({ width, height: 900 });
    await logIn(page, people.admin, password);
    await expect(page.getByRole("region", { name: "Restock" })).toContainText("18 of 60");

    const sideways = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(sideways).toBe(0);
  });
}

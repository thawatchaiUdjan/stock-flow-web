import { expect, test } from "@playwright/test";

import { install, logIn } from "./support";

// The people of src/mocks.
const people = { owner: "nok@example.com", staff: "suda@example.com" };

test("the Owner logs in and lands on the Dashboard", async ({ page }) => {
  const password = `correct-horse-${test.info().testId}`;
  await install(page, password);

  await logIn(page, people.owner, password);

  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  const navigation = page.getByRole("navigation", { name: "Main" });
  for (const name of ["Reports", "Users", "Login log"]) {
    await expect(navigation.getByRole("link", { name })).toBeVisible();
  }
});

test("Staff log in, land on the Orders List and cannot reach Reports", async ({ page }) => {
  const password = `correct-horse-${test.info().testId}`;
  await install(page, password);

  await logIn(page, people.staff, password);

  await expect(page).toHaveURL("/orders");
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
  const navigation = page.getByRole("navigation", { name: "Main" });
  await expect(navigation.getByRole("link", { name: "Reports" })).toHaveCount(0);

  // The session survives the reload, as the API's cookie would.
  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "No access" })).toBeVisible();
  await expect(page).toHaveURL("/reports");
  await expect(page.getByRole("heading", { name: "Reports" })).toHaveCount(0);

  await page.getByRole("link", { name: "Go to Orders" }).click();
  await expect(page).toHaveURL("/orders");
});

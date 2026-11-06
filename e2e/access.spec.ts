import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// The people and state key of src/mocks, the install every test starts from.
const stateKey = "stock-flow-mock-api";
const people = { owner: "nok@example.com", staff: "suda@example.com" };

// An install where everyone already has this password, as if their Setup links were used.
async function installWithPassword(page: Page, password: string) {
  await page.addInitScript(
    ({ key, state }) => {
      if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, state);
    },
    { key: stateKey, state: JSON.stringify({ password }) },
  );
}

async function logIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

test("the Owner logs in and lands on the Dashboard", async ({ page }) => {
  const password = `correct-horse-${test.info().testId}`;
  await installWithPassword(page, password);

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
  await installWithPassword(page, password);

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

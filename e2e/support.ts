import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

// The state key of src/mocks, the install every test starts from.
const stateKey = "stock-flow-mock-api";

// An install where everyone already has this password, as if their Setup links were used, and
// where the Shop already holds `state` (Products, Orders, the Login log, ...).
export async function install(page: Page, password: string, state: object = {}) {
  await page.addInitScript(
    ({ key, saved }) => {
      if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, saved);
    },
    { key: stateKey, saved: JSON.stringify({ password, ...state }) },
  );
}

// Submits the Log in form and returns at once, for a test that expects to stay on Log in.
export async function attemptLogIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

// Logs in and waits for the session. It is live only once the app has left Log in; a `goto`
// before that reloads the app before the mock API has saved the session, and it comes up logged out.
export async function logIn(page: Page, email: string, password: string) {
  await attemptLogIn(page, email, password);
  await expect(page).not.toHaveURL(/\/login/);
}

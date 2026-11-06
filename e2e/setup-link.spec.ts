import { expect, test } from "@playwright/test";

// The Owner and token of src/mocks/handlers.ts, the state every page load starts from.
const email = "nok@example.com";
const token = "mock-setup-link-token";

test("a person sets a password through a Setup link and logs in", async ({ page }) => {
  const password = `correct-horse-${test.info().testId}`;

  await page.goto(`/set-password#${token}`);
  await expect(page.getByText("Nok Srisuk")).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  const setPassword = page.waitForRequest("**/api/setup-link/password");
  await page.getByLabel("New password").fill(password);
  await page.getByRole("button", { name: "Set password" }).click();

  expect((await setPassword).postDataJSON()).toEqual({ token, password });
  await expect(page).toHaveURL("/login");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("main").getByText("Coming soon")).toBeVisible();
  await expect(page.getByText("Owner", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();

  await page.setViewportSize({ width: 375, height: 667 });
  await expect(page.getByText("Nok Srisuk")).toBeInViewport();
  await expect(page.getByText("Owner", { exact: true })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Log out" })).toBeInViewport();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeInViewport();
});

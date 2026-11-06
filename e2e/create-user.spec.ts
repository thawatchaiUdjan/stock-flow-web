import { expect, test } from "@playwright/test";

// The Owner and token of src/mocks/handlers.ts, the state every page load starts from.
const email = "nok@example.com";
const token = "mock-setup-link-token";

test("the Owner creates a User and gets their Setup link once", async ({ page }) => {
  const password = `correct-horse-${test.info().testId}`;
  const person = `Mali ${test.info().testId}`;

  // The mocks live in the page, so the Owner's password is set in this page load first.
  await page.goto(`/set-password#${token}`);
  await page.getByLabel("New password").fill(password);
  await page.getByRole("button", { name: "Set password" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/dashboard");

  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Users" }).click();
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  await page.getByRole("link", { name: "Create User" }).click();

  const create = page.waitForRequest((request) => request.url().endsWith("/api/users"));
  await page.getByLabel("Name").fill(person);
  await page.getByLabel("Email").fill("mali@example.com");
  await page.getByRole("radio", { name: "Admin" }).click();
  await page.getByRole("button", { name: "Create User" }).click();

  expect((await create).postDataJSON()).toEqual({
    name: person,
    email: "mali@example.com",
    role: "admin",
  });
  await expect(page.getByRole("heading", { name: "User created" })).toBeVisible();
  await expect(page.getByLabel("Setup link")).toHaveValue(/\/set-password#mock-token-for-user-2$/);
  await expect(page.getByText("won't be shown again")).toBeVisible();

  await page.getByRole("link", { name: "Back to Users" }).click();
  await expect(page.getByRole("row", { name: new RegExp(person) })).toContainText(
    "Password not set",
  );

  await page.goBack();
  await expect(page.getByLabel("Name")).toHaveValue("");
  await expect(page.getByLabel("Setup link")).toHaveCount(0);
});

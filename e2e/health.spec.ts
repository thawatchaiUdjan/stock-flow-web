import { expect, test } from "@playwright/test";

test("the app reads the API's status through the generated client", async ({ page }) => {
  const request = page.waitForRequest("**/api/health");

  await page.goto("/");

  expect((await request).method()).toBe("GET");
  await expect(page.getByText("API status: ok")).toBeVisible();
});

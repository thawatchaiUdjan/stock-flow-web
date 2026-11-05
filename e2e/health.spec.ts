import { expect, test } from "@playwright/test";

test("the app shows the status the API reports", async ({ page }) => {
  const request = page.waitForRequest("**/api/health");

  await page.goto("/");

  expect((await request).method()).toBe("GET");
  await expect(page.getByText("API status: ok")).toBeVisible();
});

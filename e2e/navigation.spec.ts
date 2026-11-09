import { expect, test } from "@playwright/test";

import { install, logIn } from "./support";

// navigation-and-lists R1-R3: the same destinations remain usable at each shell breakpoint.
for (const width of [375, 768, 1024, 1440]) {
  test(`contextual navigation at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const password = `correct-horse-${testInfo.testId}`;
    await install(page, password);
    await logIn(page, "nok@example.com", password);
    const main = page.getByRole("navigation", { name: "Main", exact: true });
    await expect(main.getByRole("link", { name: "New product" })).toHaveCount(0);
    await expect(main.getByRole("link", { name: "New order" })).toHaveCount(0);
    await main.getByRole("link", { name: "Products", exact: true }).click();
    await page.getByRole("main").getByRole("link", { name: "Add product" }).first().click();
    await expect(page.getByRole("heading", { name: "New product" })).toBeVisible();
    await expect(main.getByRole("link", { name: "Products", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const context = page.getByRole("navigation", { name: "Current page" });
    await expect(context.getByText("New product")).toHaveAttribute("aria-current", "page");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const brandImage = page.getByRole("link", { name: "StockFlow home" }).locator("img");
    await expect(brandImage).not.toHaveJSProperty("naturalWidth", 0);
    const favicon = await page.locator('link[rel="icon"]').getAttribute("href");
    expect(favicon).toBeTruthy();
    expect((await page.request.get(favicon!)).ok()).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`navigation-${width}.png`), fullPage: true });
    await testInfo.attach(`navigation-${width}`, {
      path: testInfo.outputPath(`navigation-${width}.png`),
      contentType: "image/png",
    });
    const parent = context.getByRole("link", { name: "Products" });
    await parent.focus();
    await expect(parent).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Products", exact: true })).toBeVisible();
    const home = page.getByRole("link", { name: "StockFlow home" });
    await home.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/dashboard");
  });
}

test("Staff use the phone home link and create Orders from the list", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const password = `correct-horse-${testInfo.testId}`;
  await install(page, password);
  await logIn(page, "suda@example.com", password);
  await page.getByRole("main").getByRole("link", { name: "New order" }).click();
  await expect(page.getByRole("heading", { name: "New order" })).toBeVisible();
  await page.getByRole("link", { name: "StockFlow home" }).click();
  await expect(page).toHaveURL("/orders");
  await page.goto("/products/new");
  await expect(page.getByRole("heading", { name: "No access" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Current page" })).toHaveText("No access");
});

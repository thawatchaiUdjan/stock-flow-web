import { expect, test } from "@playwright/test";

import { presentationInstall } from "./presentation.fixture";
import { install, logIn } from "./support";

test.use({ timezoneId: "America/Los_Angeles", hasTouch: true });

// #41; navigation-and-lists R3-R7: rendered width, cursor interaction and readable dates.
for (const width of [375, 768, 1024, 1440]) {
  test(`Long histories, navigation and dates remain usable at ${width}px`, async ({
    page,
  }, info) => {
    // Keep native Date subclassing intact for the calendar's TZDate (date-controls R9).
    await page.addInitScript(() => {
      Date.now = () => 1794249000000; // 9 Nov 2026 18:30 UTC, 10 Nov in Bangkok.
    });
    await page.setViewportSize({ width, height: 900 });
    const password = `presentation-${info.testId}`;
    await install(page, password, presentationInstall());
    await logIn(page, "nok@example.com", password);
    await page.goto("/stock-movements?kind=receive");
    const table = page.getByRole("table");
    const size = page.getByRole("combobox", { name: "Rows per page" });
    // navigation-and-lists R8: default to 25; explicitly choose 50 for this long-history check.
    await expect(size).toHaveValue("25");
    await expect(table.getByRole("row")).toHaveCount(width < 800 ? 25 : 26);
    await size.selectOption("50");
    await expect(table.getByRole("row")).toHaveCount(width < 800 ? 50 : 51);
    if (width >= 800) {
      const product = table.getByRole("row").nth(1).getByRole("cell").nth(1);
      expect((await product.boundingBox())!.width).toBeGreaterThanOrEqual(192);
    }
    const main = page.getByRole("navigation", { name: "Main", exact: true });
    expect(await main.evaluate((nav) => nav.scrollWidth <= nav.clientWidth)).toBe(true);
    await expect(main.getByRole("link")).toHaveCount(7);
    await page.getByRole("button", { name: "Next page", exact: true }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText(/Page 2 of \d+ \u00b7 \d+ matching/)).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Kind")).toHaveValue("receive");
    await expect(size).toHaveValue("50");
    const from = page.getByLabel("From", { exact: true });
    await expect(from).toHaveText("Start date");
    await from.focus();
    await page.keyboard.press("Enter");
    const day = page.getByRole("button", { name: /Tuesday, November 10th, 2026/ });
    await expect(day).toBeFocused();
    await expect(page).toHaveURL(/page=2/);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: info.outputPath(`stock-calendar-open-${width}.png`) });
    await page.keyboard.press("Enter");
    await expect(from).toHaveText("10 Nov 2026");
    await expect(page).not.toHaveURL(/page=2/);
    await page.reload();
    await expect(from).toHaveText("10 Nov 2026");
    await from.tap();
    await expect(day).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Select the selected day again to remove it")).toBeVisible();
    await day.tap();
    await expect(from).toHaveText("Start date");
    await expect(page.getByLabel("Kind")).toHaveValue("receive");
    await expect(from).toBeFocused();
    await page.getByRole("button", { name: "Next page", exact: true }).scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBe(0);
    await page.screenshot({ path: info.outputPath(`stock-bottom-${width}.png`) });
  });
}

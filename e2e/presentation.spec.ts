import { expect, test } from "@playwright/test";

import { presentationInstall } from "./presentation.fixture";
import { install, logIn } from "./support";

// #41; navigation-and-lists R3-R7: rendered width, cursor interaction and readable dates.
for (const width of [375, 768, 1024, 1440]) {
  test(`Long histories, navigation and dates remain usable at ${width}px`, async ({
    page,
  }, info) => {
    await page.clock.setFixedTime(new Date("2026-11-09T18:30:00Z"));
    await page.setViewportSize({ width, height: 900 });
    const password = `presentation-${info.testId}`;
    await install(page, password, presentationInstall());
    await logIn(page, "nok@example.com", password);
    await page.goto("/stock-movements?kind=receive");
    const table = page.getByRole("table");
    await expect(table.getByRole("row")).toHaveCount(width < 800 ? 50 : 51);
    if (width >= 800) {
      const product = table.getByRole("row").nth(1).getByRole("cell").nth(1);
      expect((await product.boundingBox())!.width).toBeGreaterThanOrEqual(192);
    }
    const main = page.getByRole("navigation", { name: "Main", exact: true });
    expect(await main.evaluate((nav) => nav.scrollWidth <= nav.clientWidth)).toBe(true);
    await expect(main.getByRole("link")).toHaveCount(7);
    await page.getByRole("button", { name: "Older entries", exact: true }).click();
    await expect(page).toHaveURL(/before=/);
    await expect(page.getByText("Viewing older entries")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Kind")).toHaveValue("receive");
    await page.getByRole("button", { name: "Use today for From" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("From", { exact: true })).toHaveValue("2026-11-10");
    await expect(page).not.toHaveURL(/before=/);
    await page.getByRole("button", { name: "Clear From" }).click();
    await expect(page.getByLabel("From", { exact: true })).toHaveValue("");
    await page.getByRole("button", { name: "Older entries", exact: true }).scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBe(0);
    await page.screenshot({ path: info.outputPath(`stock-bottom-${width}.png`) });
  });
}

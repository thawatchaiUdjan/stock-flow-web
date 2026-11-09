import { expect, test } from "@playwright/test";

import { install, logIn } from "./support";

// navigation-and-lists R4-R7, docs/design.md: all paging patterns fit every target width.
for (const width of [375, 768, 1024, 1440]) {
  test(`List paging fits ${width} px`, async ({ page }, info) => {
    const password = `paging-${info.testId}`;
    await install(page, password);
    await page.setViewportSize({ width, height: 900 });
    await logIn(page, "nok@example.com", password);
    for (const route of ["products", "orders", "users", "stock-movements", "login-log"]) {
      await page.goto(`/${route}`);
      const paging = page.getByRole("navigation", { name: "Pages" });
      await expect(paging).toBeVisible();
      await expect(paging).not.toHaveAttribute("aria-busy", "true");
      await paging.scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      ).toBe(0);
      await page.screenshot({ path: info.outputPath(`${route}-${width}.png`) });
    }
  });
}

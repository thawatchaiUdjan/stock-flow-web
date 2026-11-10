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
      const size = paging.getByRole("combobox", { name: "Rows per page" });
      await expect(size).toHaveValue("25");
      await size.selectOption("10");
      await expect(page).toHaveURL(new RegExp(`${route}\\?size=10$`));
      await page.reload();
      await expect(size).toHaveValue("10");
      await expect(paging).not.toHaveAttribute("aria-busy", "true");
      const controls = paging.getByRole("button");
      await expect(controls).toHaveCount(4);
      for (const control of await controls.all()) {
        await expect(control).toHaveAttribute(
          "title",
          (await control.getAttribute("aria-label")) ?? "",
        );
        const box = (await control.boundingBox())!;
        expect(box.width).toBe(width < 800 ? 44 : 38);
        expect(box.height).toBe(width < 800 ? 44 : 38);
      }
      await paging.scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      ).toBe(0);
      await page.screenshot({ path: info.outputPath(`${route}-${width}.png`) });
      if (width === 375 && (route === "stock-movements" || route === "login-log")) {
        await page.evaluate(() => {
          document.documentElement.style.fontSize = "200%";
        });
        await size.selectOption("25");
        // Text resizing must leave the complete selected number visible.
        expect(
          await size.evaluate((select: HTMLSelectElement) => {
            const style = getComputedStyle(select);
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d")!;
            context.font = style.font;
            const available =
              select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
            return available >= context.measureText(select.selectedOptions[0]!.text).width;
          }),
        ).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(
          0,
        );
      }
    }
  });
}

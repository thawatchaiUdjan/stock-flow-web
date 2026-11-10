import { expect, test } from "@playwright/test";

import { install, logIn } from "./support";

test.use({ timezoneId: "America/Los_Angeles" });

// #45, date-controls R1-R5, R10: presentation is verified at the rendered screen seam.
for (const width of [375, 768, 1024, 1440]) {
  for (const route of ["stock-movements", "reports"]) {
    test(`${route} date presentation at ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(() => {
        Date.now = () => 1794249000000;
      });
      const password = `dates-${info.testId}`;
      await install(page, password);
      await logIn(page, "nok@example.com", password);
      await page.goto(`/${route}`);
      const typography = (element: HTMLElement | SVGElement) => {
        const style = getComputedStyle(element);
        return { family: style.fontFamily, size: style.fontSize, weight: style.fontWeight };
      };
      const expectedType = { size: width < 800 ? "16px" : "15px", weight: "400" };
      const kind = route === "stock-movements" ? page.getByLabel("Kind") : undefined;
      for (const label of ["From", "To"]) {
        const trigger = page.getByLabel(label, { exact: true });
        await expect(trigger).toHaveText(label === "From" ? "Start date" : "End date");
        const emptyType = await trigger.evaluate(typography);
        expect(emptyType).toMatchObject(expectedType);
        if (kind) expect(emptyType).toEqual(await kind.evaluate(typography));
        await trigger.focus();
        await page.keyboard.press("Enter");
        const dialog = page.getByRole("dialog", { name: `${label} calendar` });
        await expect(dialog.getByText("November 2026", { exact: true })).toHaveCSS(
          "font-size",
          "15px",
        );
        const today = dialog.getByRole("button", { name: /Tuesday, November 10th, 2026/ });
        await expect(today).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(trigger).toHaveText("10 Nov 2026");
        await expect(trigger).toBeFocused();
        expect(await trigger.evaluate(typography)).toEqual(emptyType);
        await trigger.click();
        await expect(today).toHaveAttribute("aria-pressed", "true");
        const adjacent = dialog.getByRole("button", { name: /Wednesday, November 11th, 2026/ });
        await adjacent.hover();
        const selectedBox = (await today.boundingBox())!;
        const adjacentBox = (await adjacent.boundingBox())!;
        expect(adjacentBox.x - selectedBox.x - selectedBox.width).toBeGreaterThanOrEqual(4);
        expect(selectedBox.width).toBeGreaterThanOrEqual(width < 800 ? 44 : 40);
        expect(selectedBox.height).toBeGreaterThanOrEqual(width < 800 ? 44 : 40);
        await expect(adjacent).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
        for (const action of ["Previous year", "Next year"]) {
          const button = dialog.getByRole("button", { name: action, exact: true });
          await expect(button).toHaveCSS("border-top-style", "solid");
          await expect(button).toHaveCSS("border-top-color", "rgb(137, 145, 131)");
          await page.keyboard.press("Tab");
          await button.focus();
          await expect(button).toHaveCSS("outline-style", "solid");
          await expect(button).toHaveCSS("outline-width", "2px");
          await page.keyboard.press("Enter");
          await expect(
            dialog.getByText(action === "Previous year" ? "November 2025" : "November 2026", {
              exact: true,
            }),
          ).toBeVisible();
          await expect(trigger).toHaveText("10 Nov 2026");
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({ path: info.outputPath(`${route}-${label}-${width}.png`) });
        await page.keyboard.press("Escape");
        await expect(trigger).toBeFocused();
        await trigger.click();
        await today.click();
        await expect(trigger).toHaveText(label === "From" ? "Start date" : "End date");
      }
    });
  }
}

for (const route of ["stock-movements", "reports"]) {
  test(`${route} calendars remain reachable in phone landscape`, async ({ page }, info) => {
    await page.setViewportSize({ width: 667, height: 375 });
    const password = `landscape-${info.testId}`;
    await install(page, password);
    await logIn(page, "nok@example.com", password);
    await page.goto(`/${route}`);
    for (const label of ["From", "To"]) {
      const trigger = page.getByLabel(label, { exact: true });
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: `${label} calendar` });
      const bounds = (await dialog.boundingBox())!;
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(375);
      const previous = dialog.getByRole("button", { name: "Previous year", exact: true });
      await previous.scrollIntoViewIfNeeded();
      await previous.click();
      await expect(previous).toBeInViewport();
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
    }
  });
}

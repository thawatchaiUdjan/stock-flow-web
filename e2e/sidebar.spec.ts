import { expect, test } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";

import { install, logIn } from "./support";

// #82, docs/design.md "Sidebar colors" and "Key figures": colours and layout are computed styles,
// so only a real browser can check them. Values are the design's tokens as rgb().
const forest = "rgb(58, 107, 79)";
const fern = "rgb(230, 240, 232)";
const ink = "rgb(32, 38, 31)";
const white = "rgb(255, 255, 255)";

async function openDashboard(page: Page, testInfo: TestInfo, width: number) {
  const password = `correct-horse-${testInfo.testId}`;
  await install(page, password);
  await page.setViewportSize({ width, height: 800 });
  await logIn(page, "nok@example.com", password);
}

test("the sidebar is Forest with white text, a Fern selected link and a readable Log out", async ({
  page,
}, testInfo) => {
  await openDashboard(page, testInfo, 1280);

  await expect(page.locator("aside")).toHaveCSS("background-color", forest);
  const nav = page.getByRole("navigation", { name: "Main" });
  const selected = nav.getByRole("link", { name: "Dashboard", exact: true });
  await expect(selected).toHaveCSS("background-color", fern);
  await expect(selected).toHaveCSS("color", ink);
  await expect(nav.getByRole("link", { name: "Products", exact: true })).toHaveCSS("color", white);

  // Never dark text on Forest: the outline button's own hover colour must not win.
  const logOut = page.getByRole("button", { name: "Log out" });
  await expect(logOut).toHaveCSS("color", white);
  await logOut.hover();
  // The colours transition for 150 ms; a retrying assertion would pass on the first frame.
  await page.waitForTimeout(400);
  await expect(logOut).toHaveCSS("color", white);

  // The page-title bar keeps the White `sidebar` token.
  await expect(page.getByRole("navigation", { name: "Current page" })).toHaveCSS(
    "background-color",
    white,
  );
});

test("Log out takes a white focus outline on the Forest sidebar", async ({ page }, testInfo) => {
  await openDashboard(page, testInfo, 1280);

  // Tab order reaches it by keyboard, so the ring is :focus-visible, not just :focus.
  await page.getByRole("button", { name: "Log out" }).focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Log out" })).toHaveCSS("outline-color", white);
});

for (const width of [375, 768, 1024, 1440]) {
  test(`the shell keeps its Forest strips and fits ${width} px`, async ({ page }, testInfo) => {
    await openDashboard(page, testInfo, width);

    const home = page.getByRole("link", { name: "StockFlow home" });
    await expect(home).toBeVisible();
    if (width < 800) {
      // Below 800 px the three strips are each Forest; desktop is the aside, checked above.
      await expect(home).toHaveCSS("background-color", forest);
      await expect(page.getByRole("navigation", { name: "Main" })).toHaveCSS(
        "background-color",
        forest,
      );
      await expect(page.getByRole("button", { name: "Log out" }).locator("..")).toHaveCSS(
        "background-color",
        forest,
      );
    }
    await expect(page.getByRole("navigation", { name: "Current page" })).toHaveCSS(
      "background-color",
      white,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}

// Cells of one row share a parent top; within a row every number ends at the same height.
async function figuresShareBaselines(page: Page) {
  return page.locator("dl").evaluateAll((lists) =>
    lists.every((list) => {
      const rows = new Map<number, Set<number>>();
      for (const cell of list.children) {
        const top = Math.round(cell.getBoundingClientRect().top);
        const bottom = Math.round(cell.querySelector("dd")!.getBoundingClientRect().bottom);
        rows.set(top, (rows.get(top) ?? new Set()).add(bottom));
      }
      return [...rows.values()].every((bottoms) => bottoms.size === 1);
    }),
  );
}

test("Dashboard figures share one bottom edge when a label wraps", async ({ page }, testInfo) => {
  await openDashboard(page, testInfo, 900);

  await expect(page.locator("dl dd")).toHaveCount(5);
  // "Orders completed today" wraps at this width, so the labels differ in height.
  const labelHeights = await page
    .locator("dl dt")
    .evaluateAll((els) => els.map((e) => e.clientHeight));
  expect(new Set(labelHeights).size).toBeGreaterThan(1);
  expect(await figuresShareBaselines(page)).toBe(true);
});

test("Reports figures share one bottom edge too", async ({ page }, testInfo) => {
  await openDashboard(page, testInfo, 900);
  await page.goto("/reports");

  await expect(page.locator("dl dd").first()).toBeVisible();
  expect(await figuresShareBaselines(page)).toBe(true);
});

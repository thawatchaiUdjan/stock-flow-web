import { expect, test } from "@playwright/test";

import { install, logIn } from "./support";

// #82, docs/design.md "Sidebar colors" and "Key figures": colours and layout are computed styles,
// so only a real browser can check them. Values are the design's tokens as rgb().
const forest = "rgb(58, 107, 79)";
const fern = "rgb(230, 240, 232)";
const ink = "rgb(32, 38, 31)";
const white = "rgb(255, 255, 255)";

test("the sidebar is Forest with white text, a Fern selected link and a readable Log out", async ({
  page,
}, testInfo) => {
  const password = `correct-horse-${testInfo.testId}`;
  await install(page, password);
  await page.setViewportSize({ width: 1280, height: 800 });
  await logIn(page, "nok@example.com", password);

  const sidebar = page.locator("aside");
  await expect(sidebar).toHaveCSS("background-color", forest);
  const nav = page.getByRole("navigation", { name: "Main" });
  const selected = nav.getByRole("link", { name: "Dashboard", exact: true });
  await expect(selected).toHaveCSS("background-color", fern);
  await expect(selected).toHaveCSS("color", ink);
  await expect(nav.getByRole("link", { name: "Products", exact: true })).toHaveCSS("color", white);

  // Never dark text on Forest: the outline button's own hover colour must not win.
  const logOut = page.getByRole("button", { name: "Log out" });
  await expect(logOut).toHaveCSS("color", white);
  await logOut.hover();
  // The colours transition for 150 ms; assert after it, not on its first frame.
  await page.waitForTimeout(400);
  await expect(logOut).toHaveCSS("color", white);

  // The page-title bar keeps the White `sidebar` token.
  await expect(page.getByRole("navigation", { name: "Current page" })).toHaveCSS(
    "background-color",
    white,
  );
});

test("Log out takes a white focus outline on the Forest sidebar", async ({ page }, testInfo) => {
  const password = `correct-horse-${testInfo.testId}`;
  await install(page, password);
  await page.setViewportSize({ width: 1280, height: 800 });
  await logIn(page, "nok@example.com", password);

  await page.getByRole("button", { name: "Log out" }).focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Log out" })).toHaveCSS("outline-color", white);
});

test("Dashboard figures share one bottom edge when a label wraps", async ({ page }, testInfo) => {
  const password = `correct-horse-${testInfo.testId}`;
  await install(page, password);
  await page.setViewportSize({ width: 900, height: 800 });
  await logIn(page, "nok@example.com", password);

  const figures = page.locator("dl dd");
  await expect(figures).toHaveCount(5);
  // "Orders completed today" wraps at this width, so the labels differ in height.
  const labelHeights = await page
    .locator("dl dt")
    .evaluateAll((els) => els.map((e) => e.clientHeight));
  expect(new Set(labelHeights).size).toBeGreaterThan(1);
  const bottoms = await figures.evaluateAll((els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().bottom)),
  );
  expect(new Set(bottoms).size).toBe(1);
});

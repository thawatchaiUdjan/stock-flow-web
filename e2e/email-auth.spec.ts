import { expect, test } from "@playwright/test";

// Successful mail journeys run against the real API in e2e-smoke. No mailbox exists in mock mode.
test("a person requests first-time instructions and can retry an invalid code", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Set up your password" }).click();
  await page.getByLabel("Email").fill("staff@example.com");
  const request = page.waitForRequest("**/api/v2/password-setup/request");
  await page.getByRole("button", { name: "Send instructions" }).click();
  expect((await request).postDataJSON()).toEqual({ email: "staff@example.com" });
  await expect(page.getByRole("status")).toHaveText(
    "If this email is eligible, we've sent instructions.",
  );
  await expect(page.getByRole("button", { name: "Send instructions" })).toBeDisabled();
  await page.getByLabel("First-time code").fill("001234");
  const verify = page.waitForRequest("**/api/v2/password-setup/verify");
  await page.getByRole("button", { name: "Verify code" }).click();
  expect((await verify).postDataJSON()).toEqual({ email: "staff@example.com", code: "001234" });
  await expect(page.getByRole("alert")).toContainText("This code can't be used.");
  await expect(page.getByLabel("Email")).toHaveValue("staff@example.com");
});

test("reset fragments are removed from history and storage before any password submission", async ({
  page,
}) => {
  await page.goto("/forgot-password");
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v2/password-reset/password")) writes.push(request.method());
    expect(new URL(request.url()).search).not.toContain("browser-reset-token");
  });
  await page.goto("/reset-password#token=browser-reset-token");
  await expect(page).toHaveURL("/reset-password");
  await expect(page.getByLabel("New password")).toBeVisible();
  expect(writes).toEqual([]);
  expect(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))).not.toContain(
    "browser-reset-token",
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "This Reset link has expired or can't be used.",
  );
  await expect(page.getByLabel("New password")).toHaveCount(0);
  expect(writes).toEqual([]);
});

for (const width of [375, 768, 1024, 1440]) {
  test(`public email screens fit ${width}px with keyboard and reduced motion`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const path of ["/password-setup", "/forgot-password", "/reset-password#token=fixture"]) {
      await page.goto(path);
      await expect(page.getByRole("heading")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.getByLabel(path.includes("reset-password") ? "New password" : "Email").focus();
      await expect(page.locator(":focus")).toBeVisible();
    }
  });
}

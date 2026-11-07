import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// The people and state key of src/mocks, the install every test starts from.
const stateKey = "stock-flow-mock-api";
const people = { owner: "nok@example.com" };

// An install where everyone already has this password, and where the Shop already has these.
async function install(page: Page, password: string, state: object) {
  await page.addInitScript(
    ({ key, saved }) => {
      if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, saved);
    },
    { key: stateKey, saved: JSON.stringify({ password, ...state }) },
  );
}

async function logIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  // The session is live only once the app has left Log in; a `goto` before that reloads logged out.
  await expect(page).not.toHaveURL(/\/login/);
}

// An Order of 3 helmets completed on 1 Jun 2026, so a year-long range holds it.
function completedOrder(name: string) {
  const at = "2026-06-01T03:00:00Z";
  const by = { id: 1, name: "Nok Srisuk" };
  return {
    id: 1001,
    number: 1,
    status: "completed",
    createdAt: at,
    createdBy: by,
    completed: { at, by },
    cancelled: null,
    customer: "",
    note: "",
    lines: [
      { product: { id: 1, name, sku: "HLM-001" }, quantity: 3, price: 12_345, amount: 37_035 },
    ],
    total: 37_035,
  };
}

// dashboard-and-reports R7, R8, docs/design.md, *Breakpoints*: the longest range fits every width.
for (const width of [375, 768, 1024, 1440]) {
  test(`Reports for 366 days fit ${width} px`, async ({ page }) => {
    const password = `correct-horse-${test.info().testId}`;
    const name = "Safety helmet with a very long name that goes on and on past the edge";
    await install(page, password, { orders: [completedOrder(name)] });
    await page.setViewportSize({ width, height: 900 });
    await logIn(page, people.owner, password);

    await page.goto("/reports?from=2025-11-07&to=2026-11-07");
    await expect(page.getByText("Total sales", { exact: true }).locator("..")).toContainText(
      "฿370.35",
    );
    await expect(page.getByRole("region", { name: "Top products" })).toContainText("HLM-001");
    await expect(
      page.getByRole("table", { name: "Sales for each day of the range" }),
    ).toBeVisible();

    const sideways = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(sideways).toBe(0);
  });
}

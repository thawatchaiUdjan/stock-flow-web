import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// The people and state key of src/mocks, the install every test starts from.
const stateKey = "stock-flow-mock-api";
const people = {
  owner: "nok@example.com",
  admin: "anan@example.com",
  staff: "suda@example.com",
};

// Times are shown in the visitor's zone; the tests read them in this one.
test.use({ timezoneId: "UTC" });

const mali = { id: 2, name: "Mali Chai", email: "mali@example.com" };
const somchai = { id: 3, name: "Somchai Dee", email: "somchai@example.com" };

type Entry = {
  id: number;
  at: string;
  email: string;
  user: { id: number; name: string } | null;
  result: "login" | "failed-login" | "logout";
  ip: string;
  userAgent: string;
};

const chromeOnWindows =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0";
const results = ["login", "failed-login", "logout"] as const;
const total = 120;
// The API sends 50 entries a page unless asked for fewer (users-and-access R38).
const pageSize = 50;

// Entry n happened n minutes after midnight, so its time tells it apart from every other, and the
// newest is entry 120 at 02:00. Mali has most of them, so that her entries alone fill two pages;
// every tenth is nobody's, an email that matches no User (R36).
function entry(id: number): Entry {
  const user = id % 10 === 0 ? null : id % 10 === 5 ? somchai : mali;
  return {
    id,
    at: new Date(Date.UTC(2026, 10, 5, 0, id)).toISOString(),
    email: user?.email ?? `nobody${id}@example.com`,
    user: user && { id: user.id, name: user.name },
    result: results[id % 3]!,
    ip: "203.0.113.7",
    // Browsers call themselves a long string, and that string is what the API keeps.
    userAgent: id % 2 ? chromeOnWindows : "Firefox on Windows",
  };
}

const loginLog = Array.from({ length: total }, (_, index) => entry(index + 1));

function time(id: number) {
  return `${String(Math.floor(id / 60)).padStart(2, "0")}:${String(id % 60).padStart(2, "0")}`;
}

// An install where everyone already has this password, as if their Setup links were used, and
// where the Login log already holds entries.
async function installWithLog(page: Page, password: string) {
  const users = [
    { id: 1, name: "Nok Srisuk", email: people.owner, role: "owner" },
    { id: mali.id, name: mali.name, email: mali.email, role: "admin" },
    { id: somchai.id, name: somchai.name, email: somchai.email, role: "staff" },
  ].map((user) => ({ ...user, status: "active", passwordSet: true }));

  await page.addInitScript(
    ({ key, state }) => {
      if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, state);
    },
    { key: stateKey, state: JSON.stringify({ password, users, loginLog }) },
  );
}

async function logIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

// Every request the page makes to the Login log, as the API would see it.
function requestsToTheLog(page: Page) {
  const urls: URL[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/login-log") urls.push(url);
  });
  return urls;
}

test("the Owner opens the Login log, filters it by User and by result, and pages through it", async ({
  page,
}) => {
  const password = `correct-horse-${test.info().testId}`;
  await installWithLog(page, password);
  const requests = requestsToTheLog(page);
  await logIn(page, people.owner, password);
  await expect(page).toHaveURL("/dashboard");

  // The Login log is in the navigation (R11), and opens on the newest entries first (R38).
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Login log" })
    .click();
  await expect(page).toHaveURL("/login-log");
  await expect(page.getByRole("heading", { name: "Login log" })).toBeVisible();
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(pageSize);
  await expect(rows.first()).toContainText(time(total));
  await expect(rows.first()).toContainText("nobody120@example.com");
  await expect(rows.first()).toContainText("No User");
  await expect(rows.first()).toContainText("203.0.113.7");
  await expect(rows.first()).toContainText("Firefox on Windows");
  await expect(rows.nth(1)).toContainText(time(total - 1));
  await expect(rows.last()).toContainText(time(total - pageSize + 1));
  expect(requests.at(-1)!.search).toBe("");

  // Filter by User: only her entries, and the address says so.
  await page.getByLabel("User").selectOption({ label: `${mali.name} (${mali.email})` });
  await expect(page).toHaveURL(`/login-log?userId=${mali.id}`);
  await expect(rows.first()).toContainText(time(119));
  await expect(rows.filter({ hasNotText: mali.name })).toHaveCount(0);
  await expect(rows).toHaveCount(pageSize);
  expect(requests.at(-1)!.searchParams.get("userId")).toBe(String(mali.id));

  // The result narrows it further, and the User stays.
  await page.getByLabel("Result").selectOption({ label: "Failed login" });
  await expect(page).toHaveURL(`/login-log?userId=${mali.id}&result=failed-login`);
  await expect(rows.filter({ hasNotText: "Failed login" })).toHaveCount(0);
  await expect(rows.filter({ hasNotText: mali.name })).toHaveCount(0);
  const narrowed = requests.at(-1)!.searchParams;
  expect([narrowed.get("userId"), narrowed.get("result")]).toEqual([
    String(mali.id),
    "failed-login",
  ]);

  // Drop the User: every failed login, hers and not hers.
  await page.getByLabel("User").selectOption({ label: "All Users" });
  await expect(page).toHaveURL("/login-log?result=failed-login");
  await expect(rows.filter({ hasNotText: "Failed login" })).toHaveCount(0);
  await expect(rows.filter({ hasText: "No User" }).first()).toBeVisible();
  await page.getByLabel("Result").selectOption({ label: "All results" });
  await expect(page).toHaveURL("/login-log");

  // Page through all of it: 120 entries are three pages, and the oldest page is the short one.
  await page.getByRole("link", { name: "Older entries" }).click();
  await expect(page).toHaveURL(`/login-log?before=${total - pageSize + 1}`);
  await expect(rows).toHaveCount(pageSize);
  await expect(rows.first()).toContainText(time(total - pageSize));
  await expect(rows.last()).toContainText(time(total - 2 * pageSize + 1));
  expect(requests.at(-1)!.searchParams.get("before")).toBe(String(total - pageSize + 1));
  await page.getByRole("link", { name: "Older entries" }).click();
  await expect(rows).toHaveCount(total - 2 * pageSize);
  await expect(rows.last()).toContainText(time(1));
  await expect(page.getByRole("link", { name: "Older entries" })).toHaveCount(0);

  await page.getByRole("link", { name: "Newest entries" }).click();
  await expect(page).toHaveURL("/login-log");
  await expect(rows.first()).toContainText(time(total));

  // The filters ride along while paging, and are kept in the address: a reload shows the same.
  await page.getByLabel("User").selectOption({ label: `${mali.name} (${mali.email})` });
  await expect(page).toHaveURL(`/login-log?userId=${mali.id}`);
  await page.getByRole("link", { name: "Older entries" }).click();
  await expect(page).toHaveURL(new RegExp(String.raw`/login-log\?userId=${mali.id}&before=\d+$`));
  const older = requests.at(-1)!.searchParams;
  expect([older.get("userId"), older.has("before")]).toEqual([String(mali.id), true]);
  const url = page.url();
  await expect(rows).toHaveCount(46);
  await expect(rows.filter({ hasNotText: mali.name })).toHaveCount(0);

  await page.reload();
  await expect(page).toHaveURL(url);
  await expect(page.getByLabel("User")).toHaveValue(String(mali.id));
  await expect(rows).toHaveCount(46);
  await expect(rows.filter({ hasNotText: mali.name })).toHaveCount(0);

  // A filter changes what the pages hold, so it sends the Owner back to the newest.
  await page.getByLabel("Result").selectOption({ label: "Logout" });
  await expect(page).toHaveURL(`/login-log?userId=${mali.id}&result=logout`);
  await expect(rows.filter({ hasNotText: "Logout" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Newest entries" })).toHaveCount(0);
});

for (const role of ["admin", "staff"] as const) {
  test(`${role === "admin" ? "An Admin" : "Staff"} cannot reach the Login log`, async ({
    page,
  }) => {
    const password = `correct-horse-${test.info().testId}`;
    await installWithLog(page, password);
    const requests = requestsToTheLog(page);
    await logIn(page, people[role], password);
    await expect(page).toHaveURL(role === "admin" ? "/dashboard" : "/orders");

    // R11: the navigation does not offer it...
    const navigation = page.getByRole("navigation", { name: "Main" });
    await expect(navigation.getByRole("link", { name: "Orders" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Login log" })).toHaveCount(0);

    // ...and typing the address says so, with no entry on the page and none asked of the API.
    await page.goto("/login-log");
    await expect(page.getByRole("heading", { name: "No access" })).toBeVisible();
    await expect(page).toHaveURL("/login-log");
    await expect(page.getByRole("heading", { name: "Login log" })).toHaveCount(0);
    await expect(page.locator("table")).toHaveCount(0);
    expect(requests).toEqual([]);
  });
}

// docs/design.md, *Layout* and *Tables*: it is checked at 375, 768, 1024 and 1440 px; the sidebar
// becomes a bottom bar below 800 px; controls are 44 px tall on a phone and 38 px on a desktop;
// inputs are 16 px on a phone; rows of one line are 42 px at most; no page scrolls sideways.
for (const { width, phone } of [
  { width: 375, phone: true },
  { width: 768, phone: true },
  { width: 1024, phone: false },
  { width: 1440, phone: false },
]) {
  test(`the Login log fits a ${phone ? "phone" : "desktop"} at ${width} px`, async ({ page }) => {
    const password = `correct-horse-${test.info().testId}`;
    await installWithLog(page, password);
    await page.setViewportSize({ width, height: 900 });
    await logIn(page, people.owner, password);
    await expect(page).toHaveURL("/dashboard");
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Login log" })
      .click();
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(pageSize);

    const sidewaysScroll = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(sidewaysScroll).toBe(0);

    // The filters.
    for (const label of ["User", "Result"]) {
      const select = page.getByLabel(label);
      expect((await select.boundingBox())!.height).toBe(phone ? 44 : 38);
      await expect(select).toHaveCSS("font-size", phone ? "16px" : "15px");
    }
    const paging = page.getByRole("link", { name: "Older entries" });
    expect((await paging.boundingBox())!.height).toBe(phone ? 44 : 38);

    // The sidebar is a bottom bar on a phone, still with words.
    const navigation = page.getByRole("navigation", { name: "Main" });
    const bar = (await navigation.boundingBox())!;
    if (phone) expect(bar.y + bar.height).toBeGreaterThan(900 - 1);
    else expect(bar.x + bar.width).toBeLessThanOrEqual(216);

    // Entry 119 is Mali's, with a short email and a long browser string.
    const row = rows.filter({ hasText: time(119) });
    const table = page.getByRole("table");
    const surface = (await table.boundingBox())!;
    expect(surface.x + surface.width).toBeLessThanOrEqual(width);
    if (phone) {
      // The time, the email and the result stay; the rest drops.
      await expect(table.getByRole("columnheader")).toHaveCount(0);
      await expect(row).toContainText("mali@example.com");
      await expect(row).toContainText("Logout");
      await expect(row.locator("td:visible")).toHaveCount(3);
    } else {
      await expect(table.getByRole("columnheader")).toHaveText([
        "Time",
        "Email entered",
        "User",
        "Result",
        "IP address",
        "Browser or device",
      ]);
      await expect(row).toContainText(mali.name);
      await expect(row).toContainText("203.0.113.7");
      await expect(row).toContainText("Mozilla/5.0");
      expect((await row.boundingBox())!.height).toBeLessThanOrEqual(42);
    }
  });
}

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// The happy path through the real stack; every other case is the mocked suite's (e2e/).
// It starts from a freshly migrated database whose Owner has an unused Setup link.
const email = requiredEnv("SMOKE_OWNER_EMAIL");
const token = requiredEnv("SMOKE_SETUP_LINK_TOKEN");

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value)
    throw new Error(`${name} is not set. docs/agents/testing.md says where it comes from.`);
  return value;
}

// Unique, so a second run finds its own Product.
const run = Date.now().toString(36);
const password = `correct-horse-${run}`;
const product = { name: `Smoke helmet ${run}`, sku: `SMK-${run}`.toUpperCase() };

test.describe.configure({ mode: "serial" });

// One browser session for the whole journey: the Owner logs in once, in the first test.
let page: Page;
test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
});
test.afterAll(async () => {
  await page.context().close();
});

function openFromMenu(name: string) {
  return page.getByRole("navigation", { name: "Main" }).getByRole("link", { name }).click();
}

// users-and-access R2, R27, R34: the Owner's first password comes from a Setup link.
test("the Owner sets a password from the Setup link and logs in", async () => {
  // users-and-access R34: public recovery before installation sends nothing.
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send instructions" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "If this email is eligible, we've sent instructions.",
  );
  expect(await mailbox(page)).toHaveLength(0);
  await page.goto(`/set-password#${token}`);
  await expect(page.getByText(email)).toBeVisible();
  await page.getByLabel("New password").fill(password);
  await page.getByRole("button", { name: "Set password" }).click();
  await expect(page).toHaveURL("/login");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  expect(await mailbox(page)).toHaveLength(0);
});

// products R2, R4
test("the Owner adds a Product", async () => {
  await openFromMenu("Products");
  await page.getByRole("link", { name: "Add product" }).click();
  await page.getByLabel("Name").fill(product.name);
  await page.getByLabel("SKU").fill(product.sku);
  await page.getByLabel("Unit").fill("pcs");
  await page.getByLabel("Price (baht)").fill("48.50");
  await page.getByLabel("Minimum stock").fill("5");
  await page.getByRole("button", { name: "Add product" }).click();
  await expect(page.getByRole("heading", { name: "Product added" })).toBeVisible();
});

test("the Owner receives stock for the Product", async () => {
  await openFromMenu("Products");
  const row = page.getByRole("row", { name: new RegExp(product.name) });
  await expect(row).toContainText("0 of 5");
  await row.getByRole("link", { name: product.name, exact: true }).click();
  await expect(page).toHaveURL(/\/stock-movements\?productId=\d+/);
  await page.getByRole("link", { name: "Receive stock" }).click();
  await page.getByLabel("Quantity").fill("12");
  await page.getByRole("button", { name: "Receive stock" }).click();
  await expect(page.getByText("Stock received", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to stock movements" }).click();
  await expect(page.getByRole("row", { name: /Receive/ })).toContainText("+12");
});

// dashboard-and-reports R2, R3: an Order is a Sale once it is completed.
test("the Owner creates an Order, completes it and sees the Sale on the Dashboard", async () => {
  await page.goto("/orders/new");
  await page.getByLabel("Find a product").fill(product.sku);
  await page.getByRole("button", { name: `Add ${product.name}` }).click();
  await page.getByRole("group", { name: product.name }).getByLabel("Quantity").fill("2");
  await page.getByRole("button", { name: "Create order" }).click();
  await expect(page.getByText(/^Order #\d+ created$/)).toBeVisible();

  await openFromMenu("Dashboard");
  await page
    .getByRole("region", { name: "Newest orders" })
    .getByRole("link", { name: /^#\d+$/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Complete order" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Complete order" }).click();
  await expect(page.getByText("Order completed", { exact: true })).toBeVisible();

  await openFromMenu("Dashboard");
  // 2 pcs at ฿48.50. A freshly migrated database holds no other Sale.
  await expect(page.getByText("Today's sales", { exact: true }).locator("..")).toContainText(
    "฿97.00",
  );
});

interface Mail {
  to: { email: string }[];
  textContent: string;
}

async function mailbox(from: Page): Promise<Mail[]> {
  const response = await from.request.get(`${requiredEnv("SMOKE_MAIL_URL")}/messages`);
  expect(response.ok()).toBe(true);
  return response.json();
}

async function mailFor(from: Page, address: string, content: RegExp) {
  const messages = (await mailbox(from)).filter(
    (message) =>
      message.to.some((recipient) => recipient.email === address) &&
      content.test(message.textContent),
  );
  expect(messages.length).toBeGreaterThan(0);
  return messages.at(-1)!.textContent;
}

async function signIn(from: Page, address: string, secret: string, landing: string) {
  await from.goto("/login");
  await from.getByLabel("Email").fill(address);
  await from.getByLabel("Password").fill(secret);
  await from.getByRole("button", { name: "Log in" }).click();
  await expect(from).toHaveURL(landing);
}

// Real API/database and API-rendered email, with only Brevo replaced by the local provider fixture.
test("email setup and self-service recovery preserve installation, delivery outcomes and session rules", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const staffEmail = `staff-${run}@smoke.example`;
  await page.goto("/users/new");
  await page.getByLabel("Name").fill("Email Smoke Staff");
  await page.getByLabel("Email").fill(staffEmail);
  await page.getByRole("radio", { name: "Staff" }).click();
  await page.getByRole("button", { name: "Create User" }).click();
  await expect(
    page.getByText(
      "The email provider accepted the instructions. Check the inbox and spam folder.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Setup link")).toHaveCount(0);
  const firstEmail = await mailFor(page, staffEmail, /Your code: /);
  expect(firstEmail).toContain("https://stock-flow.test/password-setup");
  const code = firstEmail.match(/Your code: ([0-9]{6})/)?.[1];
  expect(code).toBeDefined();

  // users-and-access R46: failed sending still commits exactly one User.
  await page.request.post(`${requiredEnv("SMOKE_MAIL_URL")}/fail`);
  await page.getByRole("button", { name: "Create another User" }).click();
  await page.getByLabel("Name").fill("Failed Email Staff");
  await page.getByLabel("Email").fill(`failed-${run}@smoke.example`);
  await page.getByRole("radio", { name: "Staff" }).click();
  await page.getByRole("button", { name: "Create User" }).click();
  await expect(
    page.getByText("The User was created, but the email could not be sent."),
  ).toBeVisible();
  await page.request.post(`${requiredEnv("SMOKE_MAIL_URL")}/resume`);
  await page.getByRole("link", { name: "Back to Users" }).click();
  await expect(page.getByRole("row", { name: /Failed Email Staff/ })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /reset|reissue|copy link/i })).toHaveCount(0);
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL("/login");

  await page.getByRole("link", { name: "Set up your password" }).click();
  await page.getByLabel("Email").fill(staffEmail);
  await page.getByLabel("First-time code").fill(code!);
  const verification = page.waitForResponse("**/api/v2/password-setup/verify");
  await page.getByRole("button", { name: "Verify code" }).click();
  const verified = await verification;
  const verifiedBody = await verified.json();
  // Status/type/field names diagnose integration without printing a code or grant.
  expect({
    status: verified.status(),
    type: verifiedBody.type,
    fields: verifiedBody.errors?.map((error: { location?: string }) => error.location),
  }).toEqual({ status: 200, type: undefined, fields: undefined });
  await page.getByLabel("New password").fill(password);
  await page.getByRole("button", { name: "Set password" }).click();
  await expect(page).toHaveURL("/login");
  await signIn(page, staffEmail, password, "/orders");
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signIn(otherPage, staffEmail, password, "/orders");

  // Shared automatic-send/request cooldown is real; never bypass it through the database.
  await new Promise((resolve) => setTimeout(resolve, 61_000));
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(staffEmail);
  await page.getByRole("button", { name: "Send instructions" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "If this email is eligible, we've sent instructions.",
  );
  await otherPage.reload();
  await expect(otherPage).toHaveURL("/orders");
  const resetEmail = await mailFor(page, staffEmail, /reset-password#token=/);
  const link = new URL(
    resetEmail.match(/https:\/\/stock-flow\.test\/reset-password#token=[^\s]+/)![0],
  );
  const resetPath = link.pathname + link.hash;
  await page.goto(resetPath);
  await expect(page).toHaveURL("/reset-password");
  // Opening did not consume the link or end the other device's session.
  await otherPage.reload();
  await expect(otherPage).toHaveURL("/orders");
  await page.getByLabel("New password").fill(`${password}-reset`);
  await page.getByRole("button", { name: "Set password" }).click();
  await expect(page).toHaveURL("/login");
  await otherPage.reload();
  await expect(otherPage.getByRole("heading", { name: "Log in" })).toBeVisible();
  await expect(otherPage.getByRole("alert")).toContainText("Your session has ended.");
  await mailFor(page, staffEmail, /Your StockFlow password has changed/);
  await page.goto(resetPath);
  await page.getByLabel("New password").fill(`${password}-again`);
  await page.getByRole("button", { name: "Set password" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "This Reset link has expired or can't be used.",
  );
  await signIn(page, staffEmail, `${password}-reset`, "/orders");
  await other.close();

  // users-and-access R31, R34: installed Owner uses the same self-service flow.
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await signIn(ownerPage, email, password, "/dashboard");
  await ownerPage.goto("/forgot-password");
  await ownerPage.getByLabel("Email").fill(email);
  await ownerPage.getByRole("button", { name: "Send instructions" }).click();
  await expect(ownerPage.getByRole("status")).toHaveText(
    "If this email is eligible, we've sent instructions.",
  );
  const ownerMail = await mailFor(ownerPage, email, /reset-password#token=/);
  const ownerLink = new URL(
    ownerMail.match(/https:\/\/stock-flow\.test\/reset-password#token=[^\s]+/)![0],
  );
  await ownerPage.goto(ownerLink.pathname + ownerLink.hash);
  await expect(ownerPage).toHaveURL("/reset-password");
  await ownerPage.getByLabel("New password").fill(`${password}-owner-reset`);
  await ownerPage.getByRole("button", { name: "Set password" }).click();
  await expect(ownerPage).toHaveURL("/login");
  await signIn(ownerPage, email, `${password}-owner-reset`, "/dashboard");
  await ownerContext.close();
});

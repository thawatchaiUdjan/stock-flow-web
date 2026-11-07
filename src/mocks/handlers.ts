import { HttpResponse } from "msw";

import { getListLoginLogMockHandler200 } from "@/api/generated/login-log/login-log.msw";
import type {
  ErrorModel,
  LoginLogEntryBody,
  Product,
  ProductStockState,
  User,
  UserRole,
} from "@/api/generated/model";
import {
  getCreateProductMockHandler201,
  getGetProductMockHandler200,
  getListProductsMockHandler200,
  getUpdateProductMockHandler200,
} from "@/api/generated/products/products.msw";
import {
  getCreateSessionMockHandler200,
  getEndSessionMockHandler204,
  getGetCurrentUserMockHandler200,
} from "@/api/generated/sessions/sessions.msw";
import {
  getReadSetupLinkMockHandler200,
  getSetPasswordMockHandler204,
} from "@/api/generated/setup-links/setup-links.msw";
import {
  getCreateUserMockHandler201,
  getListUsersMockHandler200,
  getResetPasswordMockHandler200,
  getUpdateUserMockHandler200,
} from "@/api/generated/users/users.msw";

export const owner = { name: "Nok Srisuk", email: "nok@example.com", role: "owner" } as const;
// Who can log in to the mock install: one person per Role, all with the one `mockApi.password`.
export const people = {
  owner,
  admin: { name: "Anan Chaiyo", email: "anan@example.com", role: "admin" },
  staff: { name: "Suda Prasert", email: "suda@example.com", role: "staff" },
} as const;
export const setupToken = "mock-setup-link-token";

const ownerUser: User = { id: 1, ...owner, status: "active", passwordSet: true };

function freshInstall() {
  return {
    session: "none" as "none" | "live" | "ended",
    // Whose session it is, once it is live.
    role: "owner" as UserRole,
    password: undefined as string | undefined,
    setupLinkUsed: false,
    // A real install lists its Owner, so the list is never empty (users-and-access R9).
    users: [ownerUser] as User[],
    // Any order: the handler sorts, as the API does. Entries have the ids the API gives them.
    loginLog: [] as LoginLogEntryBody[],
    // Any order: the handler sorts, as the API does. A real install starts with none.
    products: [] as Product[],
  };
}

// "ended" is a cookie matching no live session: the API keeps it, so each request hears so again.
export const mockApi = freshInstall();

export function resetMockApi() {
  Object.assign(mockApi, freshInstall());
}

export const serverFailure = {
  status: 500,
  title: "Internal Server Error",
  detail: "something went wrong on our side",
};

// Thrown from a resolver: the generated handlers answer one status, and MSW sends a thrown Response.
function problem(body: ErrorModel & { status: number }) {
  return HttpResponse.json(body, {
    status: body.status,
    headers: { "Content-Type": "application/problem+json" },
  });
}

function requireSession() {
  if (mockApi.session === "none") {
    throw problem({ status: 401, title: "Unauthorized", detail: "Log in to continue." });
  }
  if (mockApi.session === "ended") {
    throw problem({
      type: "session-ended",
      status: 401,
      title: "Unauthorized",
      detail: "Your session has ended. Log in again.",
    });
  }
}

// A new object, so a User a test put in the list is never changed behind its back.
function updateMockUser(user: User, changes: Partial<User>) {
  const changed = { ...user, ...changes };
  mockApi.users = mockApi.users.map((one) => (one === user ? changed : one));
  return changed;
}

function targetIsOwner() {
  return problem({
    type: "target-is-owner",
    status: 403,
    title: "Forbidden",
    detail: "The Owner can't be changed.",
  });
}

function requireSetupLink(token: string) {
  if (token !== setupToken || mockApi.setupLinkUsed) {
    throw problem({
      type: "setup-link-invalid",
      status: 410,
      title: "Gone",
      detail: "This Setup link no longer works. Ask the Owner for a new one.",
    });
  }
}

// users-and-access R11: Admin and Staff are refused the Owner's operations.
function requireOwner() {
  if (mockApi.role !== "owner") {
    throw problem({ status: 403, title: "Forbidden", detail: "Only the Owner can do this." });
  }
}

// products R10: the Owner and Admins change Products, Staff only read them.
function requireAdminOrOwner() {
  if (mockApi.role === "staff") {
    throw problem({ status: 403, title: "Forbidden", detail: "Staff can't change Products." });
  }
}

// products R9
export function stockStateOf(stock: number, minimumStock: number): ProductStockState {
  if (stock === 0) return "out-of-stock";
  return stock <= minimumStock ? "low" : "in-stock";
}

// A Product as the API holds it: the state follows from the stock and the Minimum stock.
export function productOf(
  fields: Pick<Product, "id" | "name" | "sku" | "unit" | "price"> &
    Partial<Pick<Product, "minimumStock" | "stock" | "status">>,
): Product {
  const { minimumStock = 0, stock = 0, status = "active" } = fields;
  return { ...fields, minimumStock, stock, status, stockState: stockStateOf(stock, minimumStock) };
}

// products R2 to R5, R8: what the API refuses with 422, one entry per field.
type ProductFields = Partial<Record<"name" | "sku" | "unit" | "price" | "minimumStock", unknown>>;

function productFieldErrors(body: ProductFields) {
  const { name, sku, unit, price, minimumStock } = body;
  const bad = (location: string, value: unknown) => ({
    location: `body.${location}`,
    message: "validation failed",
    value,
  });
  return [
    ...(name !== undefined && !(typeof name === "string" && /\S/.test(name) && name.length <= 120)
      ? [bad("name", name)]
      : []),
    ...(sku !== undefined && !(typeof sku === "string" && /^[A-Za-z0-9-]{1,40}$/.test(sku))
      ? [bad("sku", sku)]
      : []),
    ...(unit !== undefined && !(typeof unit === "string" && /\S/.test(unit) && unit.length <= 20)
      ? [bad("unit", unit)]
      : []),
    ...(price !== undefined &&
    !(Number.isInteger(price) && (price as number) >= 0 && (price as number) <= 999_999_999)
      ? [bad("price", price)]
      : []),
    ...(minimumStock !== undefined &&
    !(Number.isInteger(minimumStock) && (minimumStock as number) >= 0)
      ? [bad("minimumStock", minimumStock)]
      : []),
  ];
}

function requireValidProduct(body: ProductFields) {
  const errors = productFieldErrors(body);
  if (errors.length > 0) {
    throw problem({
      status: 422,
      title: "Unprocessable Entity",
      detail: "validation failed",
      errors,
    });
  }
}

// products R3: compared without regard to letter case, and not against the Product itself.
function requireFreeSku(sku: string, except?: number) {
  if (
    mockApi.products.some((one) => one.id !== except && one.sku.toLowerCase() === sku.toLowerCase())
  ) {
    throw problem({
      type: "sku-taken",
      status: 409,
      title: "Conflict",
      detail: "Another Product has this SKU.",
    });
  }
}

const productsDefaultLimit = 50;

const loginLogDefaultLimit = 50;

const day = 24 * 60 * 60 * 1000;

// Orval's default mocks return random strings; each handler here pins what the real API sends.
export const handlers = [
  getListUsersMockHandler200(() => {
    requireSession();
    return { users: mockApi.users };
  }),
  getCreateUserMockHandler201(async ({ request }) => {
    requireSession();
    const { name, email, role } = await request.json();
    // users-and-access R14: the name is required; the API refuses a blank one.
    const nameOk = /\S/.test(name);
    const emailOk = email.includes("@");
    if (!nameOk || !emailOk) {
      throw problem({
        status: 422,
        title: "Unprocessable Entity",
        detail: "validation failed",
        errors: [
          ...(nameOk
            ? []
            : [
                { location: "body.name", message: "expected string to match pattern", value: name },
              ]),
          ...(emailOk
            ? []
            : [
                {
                  location: "body.email",
                  message: "expected string to be RFC 5322 email",
                  value: email,
                },
              ]),
        ],
      });
    }
    // users-and-access R3: compared without regard to letter case.
    if (mockApi.users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
      throw problem({
        type: "email-taken",
        status: 409,
        title: "Conflict",
        detail: "A User has this email already.",
      });
    }
    const user: User = {
      id: Math.max(...mockApi.users.map(({ id }) => id)) + 1,
      name,
      email,
      role,
      status: "active",
      passwordSet: false,
    };
    mockApi.users.push(user);
    // users-and-access R27: 24 hours.
    return {
      user,
      setupLink: {
        token: `mock-token-for-user-${user.id}`,
        expiresAt: new Date(Date.now() + day).toISOString(),
      },
    };
  }),
  getUpdateUserMockHandler200(async ({ request, params }) => {
    requireSession();
    const user = mockApi.users.find(({ id }) => id === Number(params.id));
    if (!user) throw problem({ status: 404, title: "Not Found" });
    // users-and-access R18, ADR 0004: every change to the Owner is refused alike.
    if (user.role === "owner") throw targetIsOwner();
    const { name, role, status } = await request.json();
    // users-and-access R14: the name is required; the API refuses a blank one.
    if (name !== undefined && !/\S/.test(name)) {
      throw problem({
        status: 422,
        title: "Unprocessable Entity",
        detail: "validation failed",
        errors: [
          { location: "body.name", message: "expected string to match pattern", value: name },
        ],
      });
    }
    return updateMockUser(user, {
      ...(name !== undefined && { name }),
      ...(role !== undefined && { role }),
      ...(status !== undefined && { status }),
    });
  }),
  getResetPasswordMockHandler200(({ params }) => {
    requireSession();
    const user = mockApi.users.find(({ id }) => id === Number(params.id));
    if (!user) throw problem({ status: 404, title: "Not Found" });
    if (user.role === "owner") throw targetIsOwner();
    // users-and-access R32
    if (user.status === "inactive") {
      throw problem({
        type: "user-inactive",
        status: 409,
        title: "Conflict",
        detail: "This User is Inactive.",
      });
    }
    // users-and-access R31: the old password stops working, and the new link is the only way in.
    updateMockUser(user, { passwordSet: false });
    return {
      token: `mock-reset-token-for-user-${user.id}`,
      expiresAt: new Date(Date.now() + day).toISOString(),
    };
  }),
  getListProductsMockHandler200(({ request }) => {
    requireSession();
    const query = new URL(request.url).searchParams;
    const search = (query.get("search") ?? "").trim().toLowerCase();
    const states = query.getAll("stock");
    const status = query.get("status") ?? "active";
    const limit = Number(query.get("limit") ?? productsDefaultLimit);
    const offset = Number(query.get("offset") ?? 0);
    // products R13, R14: sorted by name, the filters narrow together, Active unless asked.
    const matching = mockApi.products
      .filter((one) => one.status === status)
      .filter((one) => states.length === 0 || states.includes(one.stockState))
      .filter(
        (one) =>
          search === "" ||
          one.name.toLowerCase().includes(search) ||
          one.sku.toLowerCase().includes(search),
      )
      .toSorted((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
    return { products: matching.slice(offset, offset + limit), total: matching.length };
  }),
  getGetProductMockHandler200(({ params }) => {
    requireSession();
    const product = mockApi.products.find(({ id }) => id === Number(params.id));
    if (!product) throw problem({ status: 404, title: "Not Found" });
    return product;
  }),
  getCreateProductMockHandler201(async ({ request }) => {
    requireSession();
    requireAdminOrOwner();
    const body = await request.json();
    requireValidProduct(body);
    requireFreeSku(body.sku);
    // products R7, R8, R11: stock 0, Minimum stock 0 when left out, Active.
    const product = productOf({
      id: Math.max(0, ...mockApi.products.map(({ id }) => id)) + 1,
      name: body.name,
      sku: body.sku,
      unit: body.unit,
      price: body.price,
      minimumStock: body.minimumStock,
    });
    mockApi.products.push(product);
    return product;
  }),
  getUpdateProductMockHandler200(async ({ request, params }) => {
    requireSession();
    requireAdminOrOwner();
    const product = mockApi.products.find(({ id }) => id === Number(params.id));
    if (!product) throw problem({ status: 404, title: "Not Found" });
    const body = await request.json();
    requireValidProduct(body);
    if (body.sku !== undefined) requireFreeSku(body.sku, product.id);
    // The body names what changes; a new object, so a Product a test put in the list is not altered.
    const { name, sku, unit, price, minimumStock, status } = body;
    const changed = productOf({
      ...product,
      ...(name !== undefined && { name }),
      ...(sku !== undefined && { sku }),
      ...(unit !== undefined && { unit }),
      ...(price !== undefined && { price }),
      ...(minimumStock !== undefined && { minimumStock }),
      ...(status !== undefined && { status }),
    });
    mockApi.products = mockApi.products.map((one) => (one === product ? changed : one));
    return changed;
  }),
  getListLoginLogMockHandler200(({ request }) => {
    requireSession();
    requireOwner();
    const query = new URL(request.url).searchParams;
    const userId = query.get("userId");
    const result = query.get("result");
    const before = query.get("before");
    const limit = Number(query.get("limit") ?? loginLogDefaultLimit);
    // users-and-access R38: newest first, and the filters narrow together.
    const matching = mockApi.loginLog
      .filter((entry) => userId === null || entry.user?.id === Number(userId))
      .filter((entry) => result === null || entry.result === result)
      .filter((entry) => before === null || entry.id < Number(before))
      .toSorted((a, b) => b.id - a.id);
    const entries = matching.slice(0, limit);
    // Entries older than the last one on the page, or null when there are none.
    return {
      entries,
      nextBefore: matching.length > entries.length ? entries[entries.length - 1]!.id : null,
    };
  }),
  getGetCurrentUserMockHandler200(() => {
    requireSession();
    return people[mockApi.role];
  }),
  getCreateSessionMockHandler200(async ({ request }) => {
    const { email, password } = await request.json();
    const person = Object.values(people).find((one) => one.email === email.toLowerCase());
    if (!person || password !== mockApi.password) {
      throw problem({
        type: "login-failed",
        status: 401,
        title: "Unauthorized",
        detail: "Email or password is incorrect.",
      });
    }
    mockApi.session = "live";
    mockApi.role = person.role;
    return person;
  }),
  getEndSessionMockHandler204(() => {
    requireSession();
    mockApi.session = "none";
  }),
  getReadSetupLinkMockHandler200(async ({ request }) => {
    const { token } = await request.json();
    requireSetupLink(token);
    return { name: owner.name, email: owner.email };
  }),
  getSetPasswordMockHandler204(async ({ request }) => {
    const { token, password } = await request.json();
    // Characters, as the API counts them, not UTF-16 units.
    if (Array.from(password).length < 6) {
      throw problem({
        status: 422,
        title: "Unprocessable Entity",
        detail: "validation failed",
        errors: [{ location: "body.password", message: "expected length >= 6", value: password }],
      });
    }
    requireSetupLink(token);
    mockApi.password = password;
    mockApi.setupLinkUsed = true;
  }),
];

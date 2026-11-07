import { HttpResponse } from "msw";

import { getGetDashboardMockHandler200 } from "@/api/generated/dashboard-and-reports/dashboard-and-reports.msw";
import { getListLoginLogMockHandler200 } from "@/api/generated/login-log/login-log.msw";
import type {
  DashboardOutputBody,
  ErrorModel,
  LoginLogEntryBody,
  Order,
  OrderSummary,
  Product,
  ProductStockState,
  RestockProduct,
  SalesDay,
  StockMovement,
  User,
  UserRole,
} from "@/api/generated/model";
import {
  getCancelOrderMockHandler200,
  getCompleteOrderMockHandler200,
  getCreateOrderMockHandler201,
  getGetOrderMockHandler200,
  getListOrdersMockHandler200,
} from "@/api/generated/orders/orders.msw";
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
  getAdjustStockMockHandler201,
  getListStockMovementsMockHandler200,
  getReceiveStockMockHandler201,
} from "@/api/generated/stock-movements/stock-movements.msw";
import {
  getCreateUserMockHandler201,
  getListUsersMockHandler200,
  getResetPasswordMockHandler200,
  getUpdateUserMockHandler200,
} from "@/api/generated/users/users.msw";
import { characters, int32Max } from "@/lib/format";

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
    // Any order: the handler sorts, as the API does. A real install starts with none. Entries have
    // the ids the API gives them, and a test that adds one keeps its Product's stock to match.
    stockMovements: [] as StockMovement[],
    // Any order: the handler sorts, as the API does. A real install starts with none. Build them
    // with `orderOf`; cancelling one gives its stock back and adds its movements.
    orders: [] as Order[],
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

// products R10, stock-movements R5: the Owner and Admins change Products and adjust stock.
function requireAdminOrOwner() {
  if (mockApi.role === "staff") {
    throw problem({
      status: 403,
      title: "Forbidden",
      detail: "Only the Owner and Admins can do this.",
    });
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

// stock-movements R4 to R6, R9: what the API refuses with 422, 404 and 409 before it moves any stock.
type StockFields = Partial<Record<"productId" | "quantity" | "change" | "note", unknown>>;

function requireValidStockChange(
  body: StockFields,
  rules: { field: "quantity" | "change"; ok: (value: number) => boolean; noteRequired: boolean },
) {
  const value = body[rules.field];
  const note = body.note;
  const bad = (location: string, value: unknown) => ({
    location: `body.${location}`,
    message: "validation failed",
    value,
  });
  const errors = [
    ...(!Number.isInteger(value) || !rules.ok(value as number) ? [bad(rules.field, value)] : []),
    ...(note !== undefined && !(typeof note === "string" && Array.from(note).length <= 200)
      ? [bad("note", note)]
      : []),
    ...(rules.noteRequired && !(typeof note === "string" && /\S/.test(note))
      ? [bad("note", note)]
      : []),
  ];
  if (errors.length > 0) {
    throw problem({
      status: 422,
      title: "Unprocessable Entity",
      detail: "validation failed",
      errors,
    });
  }
}

// Receives and Adjustments are the movements a User makes: the Product's stock moves with them (ADR 0006).
function makeStockMovement(
  kind: "receive" | "adjustment",
  productId: number,
  change: number,
  note: string | undefined,
) {
  const product = mockApi.products.find(({ id }) => id === productId);
  if (!product) throw problem({ status: 404, title: "Not Found" });
  // stock-movements R9, products R12
  if (product.status === "archived") {
    throw problem({
      type: "product-archived",
      status: 409,
      title: "Conflict",
      detail: "The Product is Archived.",
    });
  }
  // stock-movements R6: refused, saying how many are in stock.
  if (product.stock + change < 0) {
    throw problem({
      type: "insufficient-stock",
      status: 409,
      title: "Conflict",
      detail: "Not enough stock.",
      products: [{ id: product.id, stock: product.stock }],
    });
  }
  return recordMovement(product, kind, change, note, null);
}

// The signed-in person as the API names a User on a record.
function actor() {
  const person = people[mockApi.role];
  return { id: Object.values(people).indexOf(person) + 1, name: person.name };
}

// ADR 0006: the stock moves with its movement; the Product is replaced, not altered.
function recordMovement(
  product: Product,
  kind: StockMovement["kind"],
  change: number,
  note: string | undefined,
  order: StockMovement["order"],
) {
  const movement: StockMovement = {
    id: Math.max(0, ...mockApi.stockMovements.map(({ id }) => id)) + 1,
    at: new Date().toISOString(),
    kind,
    product: { id: product.id, name: product.name, sku: product.sku },
    change,
    stockAfter: product.stock + change,
    user: actor(),
    note: note ?? "",
    order,
  };
  mockApi.stockMovements.push(movement);
  mockApi.products = mockApi.products.map((one) =>
    one === product ? productOf({ ...product, stock: movement.stockAfter }) : one,
  );
  return movement;
}

// orders R3, R4: an Order as the API holds it. A line's amount and the Order's total follow from
// the quantities and prices; the Order starts Pending (R10) unless a test says otherwise.
export function orderOf(
  fields: Pick<Order, "number" | "createdAt" | "createdBy"> &
    Partial<Pick<Order, "customer" | "note" | "status" | "completed" | "cancelled">> & {
      lines: Pick<Order["lines"][number], "product" | "quantity" | "price">[];
    },
): Order {
  const lines = fields.lines.map((line) => ({ ...line, amount: line.quantity * line.price }));
  return {
    id: fields.number + 1000,
    customer: "",
    note: "",
    status: "pending",
    completed: null,
    cancelled: null,
    ...fields,
    lines,
    total: lines.reduce((sum, line) => sum + line.amount, 0),
  };
}

function summaryOf(order: Order): OrderSummary {
  return {
    id: order.id,
    number: order.number,
    createdAt: order.createdAt,
    customer: order.customer,
    lineCount: order.lines.length,
    total: order.total,
    status: order.status,
  };
}

// orders R10, R13: only a Pending Order can be completed or cancelled.
function pendingOrder(number: number) {
  const order = mockApi.orders.find((one) => one.number === number);
  if (!order) throw problem({ status: 404, title: "Not Found" });
  if (order.status !== "pending") {
    throw problem({
      type: "order-not-pending",
      status: 409,
      title: "Conflict",
      detail: "The Order is completed or cancelled already.",
    });
  }
  return order;
}

function changeOrder(order: Order, changes: Partial<Order>) {
  const changed = { ...order, ...changes };
  mockApi.orders = mockApi.orders.map((one) => (one === order ? changed : one));
  return changed;
}

// orders R1, R3: what the API refuses with 422 before it looks at any Product.
type OrderFields = { customer?: unknown; note?: unknown; lines?: unknown };

function requireValidOrder(body: OrderFields) {
  const bad = (location: string, value: unknown) => ({
    location: `body.${location}`,
    message: "validation failed",
    value,
  });
  const lines = Array.isArray(body.lines) ? (body.lines as Record<string, unknown>[]) : [];
  const tooLong = (value: unknown, max: number) =>
    value !== undefined && !(typeof value === "string" && characters(value) <= max);
  const seen = new Set<unknown>();
  const errors = [
    ...(tooLong(body.customer, 120) ? [bad("customer", body.customer)] : []),
    ...(tooLong(body.note, 200) ? [bad("note", body.note)] : []),
    ...(lines.length === 0 ? [bad("lines", body.lines)] : []),
    ...lines.flatMap((line, i) => {
      const { quantity } = line;
      const quantityOk =
        Number.isInteger(quantity) && (quantity as number) >= 1 && (quantity as number) <= int32Max;
      return quantityOk ? [] : [bad(`lines[${i}].quantity`, quantity)];
    }),
    // orders R3: a Product is on one line at most.
    ...lines.flatMap((line, i) => {
      const duplicate = seen.has(line.productId);
      seen.add(line.productId);
      return duplicate ? [bad(`lines[${i}].productId`, line.productId)] : [];
    }),
  ];
  if (errors.length > 0) {
    throw problem({
      status: 422,
      title: "Unprocessable Entity",
      detail: "validation failed",
      errors,
    });
  }
}

// orders R6 to R8, context ADR 0007, checked in the API's order; nothing is taken unless all is.
function makeOrder(body: Required<Pick<OrderFields, "lines">> & OrderFields) {
  const lines = body.lines as { productId: number; quantity: number }[];
  // The total is an int64 in the contract: past it, a 422 on the lines.
  let total = 0n;
  const products = lines.map((line) => {
    const product = mockApi.products.find(({ id }) => id === line.productId);
    if (!product)
      throw problem({ status: 404, title: "Not Found", detail: "There is no such Product." });
    total += BigInt(line.quantity) * BigInt(product.price);
    if (total > 9_223_372_036_854_775_807n) {
      throw problem({
        status: 422,
        title: "Unprocessable Entity",
        detail: "The total would be too large.",
        errors: [{ location: "body.lines", message: "would make a total past the limit" }],
      });
    }
    return product;
  });
  if (products.some(({ status }) => status === "archived")) {
    throw problem({
      type: "product-archived",
      status: 409,
      title: "Conflict",
      detail: "A Product on this Order is Archived.",
    });
  }
  const short = lines
    .map((line, i) => ({ product: products[i]!, quantity: line.quantity }))
    .filter(({ product, quantity }) => quantity > product.stock)
    .map(({ product }) => ({ id: product.id, stock: product.stock }))
    .toSorted((a, b) => a.id - b.id);
  if (short.length > 0) {
    throw problem({
      type: "insufficient-stock",
      status: 409,
      title: "Conflict",
      detail: "Not enough stock.",
      products: short,
    });
  }
  // orders R2: numbers count up and are never reused.
  const number = Math.max(0, ...mockApi.orders.map((one) => one.number)) + 1;
  const order = orderOf({
    number,
    createdAt: new Date().toISOString(),
    createdBy: actor(),
    customer: typeof body.customer === "string" ? body.customer : "",
    note: typeof body.note === "string" ? body.note : "",
    // orders R3: the price is the Product's now.
    lines: lines.map((line, i) => ({
      product: { id: products[i]!.id, name: products[i]!.name, sku: products[i]!.sku },
      quantity: line.quantity,
      price: products[i]!.price,
    })),
  });
  // orders R7: one Order movement per line.
  for (const line of lines) {
    const product = mockApi.products.find(({ id }) => id === line.productId)!;
    recordMovement(product, "order", -line.quantity, undefined, { id: order.id, number });
  }
  mockApi.orders.push(order);
  return order;
}

const productsDefaultLimit = 50;

const stockMovementsDefaultLimit = 50;

const loginLogDefaultLimit = 50;

const ordersDefaultLimit = 50;

const day = 24 * 60 * 60 * 1000;

// dashboard-and-reports R1: the Shop's days are Bangkok days, UTC+7 all year.
const bangkokOffset = 7 * 60 * 60 * 1000;

function bangkokDay(at: number | string) {
  return new Date(new Date(at).getTime() + bangkokOffset).toISOString().slice(0, 10);
}

// dashboard-and-reports R2 to R6, as the API works them out when asked.
function dashboardOf(): DashboardOutputBody {
  const today = bangkokDay(Date.now());
  // R2: Sales are the Orders completed, counted on the day each was completed.
  const completed = mockApi.orders.filter((one) => one.status === "completed" && one.completed);
  const salesOn = (date: string) => {
    const that = completed.filter((one) => bangkokDay(one.completed!.at) === date);
    return {
      date,
      sales: that.reduce((sum, one) => sum + one.total, 0),
      ordersCompleted: that.length,
    };
  };
  // R4: the last 14 days, today included, oldest first; a day with no Sales is 0.
  const salesByDay: SalesDay[] = Array.from({ length: 14 }, (_, i) =>
    salesOn(bangkokDay(Date.now() - (13 - i) * day)),
  );
  const active = mockApi.products.filter((one) => one.status === "active");
  // R5: Out of stock first, then the lowest stock; up to 10.
  const restock: RestockProduct[] = active
    .filter((one) => one.stockState !== "in-stock")
    .toSorted(
      (a, b) => Number(b.stock === 0) - Number(a.stock === 0) || a.stock - b.stock || a.id - b.id,
    )
    .slice(0, 10)
    .map(({ id, name, sku, unit, stock, minimumStock, stockState }) => ({
      id,
      name,
      sku,
      unit,
      stock,
      minimumStock,
      stockState: stockState === "low" ? "low" : "out-of-stock",
    }));
  return {
    today,
    sales: salesByDay[13]!.sales,
    ordersCompleted: salesByDay[13]!.ordersCompleted,
    pendingOrders: mockApi.orders.filter((one) => one.status === "pending").length,
    lowProducts: active.filter((one) => one.stockState === "low").length,
    outOfStockProducts: active.filter((one) => one.stockState === "out-of-stock").length,
    salesByDay,
    restock,
    // R6
    newestOrders: mockApi.orders
      .toSorted((a, b) => b.number - a.number)
      .slice(0, 5)
      .map(summaryOf),
  };
}

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
  getListStockMovementsMockHandler200(({ request }) => {
    requireSession();
    const query = new URL(request.url).searchParams;
    const productId = query.get("productId");
    const kind = query.get("kind");
    const from = query.get("from");
    const to = query.get("to");
    const before = query.get("before");
    const limit = Number(query.get("limit") ?? stockMovementsDefaultLimit);
    // stock-movements R10: newest first; the filters narrow together; the days are the Shop's,
    // Bangkok time (dashboard-and-reports R1), so a day ends at Bangkok midnight.
    const matching = mockApi.stockMovements
      .filter((one) => productId === null || one.product.id === Number(productId))
      .filter((one) => kind === null || one.kind === kind)
      .filter((one) => from === null || Date.parse(one.at) >= Date.parse(`${from}T00:00:00+07:00`))
      .filter((one) => to === null || Date.parse(one.at) < Date.parse(`${to}T00:00:00+07:00`) + day)
      .filter((one) => before === null || one.id < Number(before))
      .toSorted((a, b) => b.id - a.id);
    const movements = matching.slice(0, limit);
    return {
      movements,
      nextBefore: matching.length > movements.length ? movements[movements.length - 1]!.id : null,
    };
  }),
  getReceiveStockMockHandler201(async ({ request }) => {
    requireSession();
    const body = await request.json();
    // stock-movements R4
    requireValidStockChange(body, { field: "quantity", ok: (n) => n >= 1, noteRequired: false });
    return makeStockMovement("receive", body.productId, body.quantity, body.note);
  }),
  getAdjustStockMockHandler201(async ({ request }) => {
    requireSession();
    // stock-movements R5: only the Owner and Admins adjust.
    requireAdminOrOwner();
    const body = await request.json();
    requireValidStockChange(body, { field: "change", ok: (n) => n !== 0, noteRequired: true });
    return makeStockMovement("adjustment", body.productId, body.change, body.note);
  }),
  getListOrdersMockHandler200(({ request }) => {
    requireSession();
    const query = new URL(request.url).searchParams;
    const search = (query.get("search") ?? "").trim().toLowerCase();
    const status = query.get("status");
    const limit = Number(query.get("limit") ?? ordersDefaultLimit);
    const offset = Number(query.get("offset") ?? 0);
    // orders R15, R16: newest first; the Order with that number and the customers containing the
    // text, in any letter case; the status narrows both.
    const matching = mockApi.orders
      .filter((one) => status === null || one.status === status)
      .filter(
        (one) =>
          search === "" ||
          String(one.number) === search ||
          one.customer.toLowerCase().includes(search),
      )
      .toSorted((a, b) => b.number - a.number);
    return {
      orders: matching.slice(offset, offset + limit).map(summaryOf),
      total: matching.length,
    };
  }),
  getGetOrderMockHandler200(({ params }) => {
    requireSession();
    // orders R18: every Role sees every Order.
    const order = mockApi.orders.find((one) => one.number === Number(params.number));
    if (!order) throw problem({ status: 404, title: "Not Found" });
    return order;
  }),
  getCreateOrderMockHandler201(async ({ request }) => {
    requireSession();
    // orders R5: every Role creates Orders.
    const body = await request.json();
    requireValidOrder(body);
    return makeOrder(body);
  }),
  getCompleteOrderMockHandler200(({ params }) => {
    requireSession();
    // orders R11: every Role completes, and no stock changes (ADR 0007).
    const order = pendingOrder(Number(params.number));
    return changeOrder(order, {
      status: "completed",
      completed: { at: new Date().toISOString(), by: actor() },
    });
  }),
  getCancelOrderMockHandler200(({ params }) => {
    requireSession();
    // orders R12: only the Owner and Admins cancel.
    requireAdminOrOwner();
    const order = pendingOrder(Number(params.number));
    // One cancellation movement per line, even for a Product Archived since.
    for (const line of order.lines) {
      const product = mockApi.products.find(({ id }) => id === line.product.id);
      if (product) {
        recordMovement(product, "cancellation", line.quantity, undefined, {
          id: order.id,
          number: order.number,
        });
      }
    }
    return changeOrder(order, {
      status: "cancelled",
      cancelled: { at: new Date().toISOString(), by: actor() },
    });
  }),
  getGetDashboardMockHandler200(() => {
    requireSession();
    // users-and-access R11: the figures are for the Owner and Admins.
    requireAdminOrOwner();
    return dashboardOf();
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

import type {
  LoginLogEntryBody,
  Order,
  Product,
  StockMovement,
  User,
} from "../src/api/generated/model";

// Valid contract snapshots with enough records to exercise every full list.
export function presentationInstall() {
  const by = { id: 1, name: "Nok Srisuk" };
  const products: Product[] = Array.from({ length: 60 }, (_, i) => ({
    id: i + 1,
    name:
      i === 0
        ? "product-test-1"
        : `Safety helmet ${i + 1} with a long name for warehouse deliveries`,
    sku: `HLM-${i + 1}`,
    unit: "pcs",
    price: 10000,
    minimumStock: 10,
    stock: 110,
    stockState: "in-stock",
    status: "active",
  }));
  const users: User[] = Array.from({ length: 60 }, (_, i) => ({
    id: i + 1,
    name: i === 0 ? by.name : `Warehouse administrator ${i + 1}`,
    email: i === 0 ? "nok@example.com" : `admin-${i + 1}@example.com`,
    role: i === 0 ? "owner" : "admin",
    status: "active",
    passwordSet: true,
  }));
  const orders: Order[] = Array.from({ length: 60 }, (_, i) => {
    const at = i === 0 ? "2026-11-09T03:00:00Z" : "2026-11-08T03:00:00Z";
    return {
      id: i + 1,
      number: i + 1,
      status: i < 2 ? "completed" : "pending",
      createdAt: at,
      createdBy: by,
      completed: i < 2 ? { at, by } : null,
      cancelled: null,
      customer: `Warehouse customer ${i + 1} collecting a large delivery`,
      note: "",
      lines: [
        {
          product: { id: 1, name: products[0]!.name, sku: "HLM-1" },
          quantity: 1,
          price: 10000,
          amount: 10000,
        },
      ],
      total: 10000,
    };
  });
  const stockMovements: StockMovement[] = Array.from({ length: 110 }, (_, i) => ({
    id: i + 1,
    at: "2026-11-09T05:40:00Z",
    product:
      i === 108
        ? { id: 2, name: products[1]!.name, sku: "HLM-2" }
        : { id: 1, name: products[0]!.name, sku: "HLM-1" },
    kind: "receive",
    change: 1,
    stockAfter: i + 1,
    user: by,
    note:
      i === 109
        ? ""
        : "Delivery with a long note, checked against the warehouse packing list. ".repeat(4),
    order: null,
  }));
  const loginLog: LoginLogEntryBody[] = Array.from({ length: 110 }, (_, i) => ({
    id: i + 1,
    at: "2026-11-09T05:40:00Z",
    result: "failed-login",
    email: `long-warehouse-email-entry-${i + 1}@example.com`,
    user: null,
    ip: "192.0.2.1",
    userAgent: "Warehouse browser",
  }));
  return { products, users, orders, stockMovements, loginLog };
}

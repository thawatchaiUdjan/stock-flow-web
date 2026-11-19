// PROTOTYPE, throwaway: demo Shop so the Dashboard has something to look at. Branch prototype/app-design only.
import { mockApi, orderOf, productOf } from "./handlers";

const day = 24 * 60 * 60 * 1000;
const anan = { id: 2, name: "Anan Chaiyo" };

export function seedPrototypeShop() {
  const products = [
    productOf({
      id: 1,
      name: "Safety helmet",
      sku: "HLM-001",
      unit: "pcs",
      price: 120_00,
      minimumStock: 60,
      stock: 18,
    }),
    productOf({
      id: 2,
      name: "Work gloves",
      sku: "GLV-010",
      unit: "box",
      price: 50_00,
      minimumStock: 20,
      stock: 0,
    }),
    productOf({
      id: 3,
      name: "Steel boots",
      sku: "BTS-300",
      unit: "pair",
      price: 900_00,
      minimumStock: 5,
      stock: 40,
    }),
    productOf({
      id: 4,
      name: "Hi-vis vest",
      sku: "VST-120",
      unit: "pcs",
      price: 85_00,
      minimumStock: 30,
      stock: 22,
    }),
    productOf({
      id: 5,
      name: "Ear plugs",
      sku: "EAR-050",
      unit: "box",
      price: 35_00,
      minimumStock: 25,
      stock: 140,
    }),
  ];
  const line = (productId: number, quantity: number) => {
    const p = products.find((one) => one.id === productId)!;
    return { product: { id: p.id, name: p.name, sku: p.sku }, quantity, price: p.price };
  };
  // Completed Orders over the last 12 days, plus today's, and two Pending ones.
  const plan: [number, number, number, number][] = [
    [0, 4, 3, 1],
    [0, 3, 1, 5],
    [1, 2, 8, 2],
    [2, 1, 4, 3],
    [3, 5, 6, 4],
    [5, 2, 2, 1],
    [6, 3, 5, 3],
    [8, 1, 3, 4],
    [9, 4, 2, 1],
    [11, 2, 7, 5],
  ];
  const orders = plan.map(([daysAgo, productId, quantity], i) => {
    const at = new Date(Date.now() - daysAgo * day - i * 3_600_000).toISOString();
    return orderOf({
      number: i + 1,
      createdAt: at,
      createdBy: anan,
      customer: ["Somchai K.", "Mali P.", "Wirat S.", ""][i % 4]!,
      lines: [line(productId, quantity)],
      status: "completed",
      completed: { at, by: anan },
    });
  });
  const pending = [11, 12].map((number, i) =>
    orderOf({
      number,
      createdAt: new Date(Date.now() - (i + 1) * 3_600_000).toISOString(),
      createdBy: anan,
      customer: i ? "" : "Napat T.",
      lines: [line(4, 2 + i)],
    }),
  );
  // Logged in as the Owner already, so /dashboard opens straight away.
  Object.assign(mockApi, {
    session: "live",
    role: "owner",
    password: "prototype",
    products,
    orders: [...orders, ...pending],
  });
}

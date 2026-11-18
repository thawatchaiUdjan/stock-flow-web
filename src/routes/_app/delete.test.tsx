import { screen, waitFor, within } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";

import type { User } from "@/api/generated/model";
import { mockApi, orderOf, problem, productOf } from "@/mocks/handlers";
import { renderApp } from "@/test/render-app";
import { menuButtonOf, openRowMenu } from "@/test/row-menu";
import { server } from "@/test/server";

// products R17, users-and-access R55, orders R20, domain ADR 0013: each list deletes one kind of
// record, permanently, from the row's actions menu. The same rules, so the same tests.

const archived = productOf({
  id: 4,
  name: "Old goggles",
  sku: "GGL-002",
  unit: "pcs",
  price: 80_00,
  minimumStock: 5,
  stock: 3,
  status: "archived",
});
const active = productOf({
  id: 1,
  name: "Safety helmet",
  sku: "HLM-001",
  unit: "pcs",
  price: 48_210_00,
  minimumStock: 5,
  stock: 18,
});
const mali: User = {
  id: 2,
  name: "Mali Chai",
  email: "mali@example.com",
  role: "admin",
  status: "active",
  passwordSet: true,
};
const somchai: User = {
  id: 3,
  name: "Somchai Jaidee",
  email: "somchai@example.com",
  role: "staff",
  status: "inactive",
  passwordSet: true,
};
const line = {
  product: { id: 1, name: "Safety helmet", sku: "HLM-001" },
  quantity: 1,
  price: 100_00,
};
const orderFor = (number: number, status: "pending" | "completed" | "cancelled") =>
  orderOf({
    number,
    status,
    createdAt: "2026-11-05T14:12:00Z",
    createdBy: { id: 2, name: "Anan Chaiyo" },
    customer: `Customer ${number}`,
    lines: [line],
  });

type Role = "owner" | "admin" | "staff";

const kinds = [
  {
    kind: "Product",
    address: "/products?status=archived",
    // The row that may be deleted, the row that may not, and who may delete.
    target: "Old goggles",
    notDeletable: { address: "/products", row: "Safety helmet" },
    deletePath: "/api/products/4",
    route: "/api/products/:id",
    allowed: ["owner", "admin"] as Role[],
    denied: ["staff"] as Role[],
    seed: () => {
      mockApi.products = [active, archived];
    },
    gone: () => {
      mockApi.products = [active];
    },
    title: "Delete Old goggles?",
    conflict: { type: "product-not-archived" as const },
    conflictMessage: "This product is active again. Archive it before deleting it.",
    forbiddenMessage: "Your role can't delete products. Only the Owner and Admins can.",
  },
  {
    kind: "User",
    address: "/users",
    target: "Somchai Jaidee",
    notDeletable: { address: "/users", row: "Mali Chai" },
    deletePath: "/api/users/3",
    route: "/api/users/:id",
    // The Users list is the Owner's page (users-and-access R10, R22).
    allowed: ["owner"] as Role[],
    denied: [] as Role[],
    seed: () => {
      mockApi.users.push(mali, somchai);
    },
    gone: () => {
      mockApi.users = mockApi.users.filter(({ id }) => id !== 3);
    },
    title: "Delete Somchai Jaidee?",
    conflict: { type: "user-not-inactive" as const },
    conflictMessage: "This User is active again. Set them Inactive before deleting them.",
    forbiddenMessage: "Your role can't delete Users. Only the Owner can.",
  },
  {
    kind: "Order",
    address: "/orders",
    target: "#1",
    notDeletable: { address: "/orders", row: "#2" },
    deletePath: "/api/orders/1",
    route: "/api/orders/:number",
    allowed: ["owner", "admin"] as Role[],
    denied: ["staff"] as Role[],
    seed: () => {
      mockApi.products = [active];
      mockApi.orders = [orderFor(1, "completed"), orderFor(2, "pending")];
    },
    gone: () => {
      mockApi.orders = [orderFor(2, "pending")];
    },
    title: "Delete order #1?",
    conflict: { type: "order-pending" as const },
    conflictMessage: "This order is still pending. Cancel it before deleting it.",
    forbiddenMessage: "Your role can't delete orders. Only the Owner and Admins can.",
  },
];

function signedIn(role: Role) {
  mockApi.session = "live";
  mockApi.role = role;
}

async function rowOf(text: string) {
  const row = (await screen.findAllByRole("row")).find((one) => one.textContent?.includes(text));
  if (!row) throw new Error(`No row for ${text}`);
  return row;
}

function recordWrites() {
  const writes: { method: string; path: string }[] = [];
  server.events.on("request:start", ({ request }) => {
    if (request.method !== "GET") {
      writes.push({ method: request.method, path: new URL(request.url).pathname });
    }
  });
  return writes;
}

describe.each(kinds)("deleting a $kind from its list", (k) => {
  async function askToDelete(role: Role = "owner") {
    signedIn(role);
    k.seed();
    const writes = recordWrites();
    const view = renderApp(k.address);
    const menu = await openRowMenu(view.user, await rowOf(k.target));
    await view.user.click(within(menu).getByRole("menuitem", { name: "Delete" }));
    return { ...view, writes, dialog: await screen.findByRole("alertdialog") };
  }

  it.each(k.allowed)("offers Delete to %s for a record the rule allows", async (role) => {
    signedIn(role);
    k.seed();
    const { user } = renderApp(k.address);

    const menu = await openRowMenu(user, await rowOf(k.target));

    expect(within(menu).getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
  });

  it.each(k.denied)("offers %s no actions menu", async (role) => {
    signedIn(role);
    k.seed();
    renderApp(k.address);

    await rowOf(k.target);

    expect(screen.queryByRole("button", { name: /^Actions for / })).not.toBeInTheDocument();
  });

  it("does not offer Delete for a record the rule does not allow", async () => {
    signedIn("owner");
    k.seed();
    const { user } = renderApp(k.notDeletable.address);
    const row = await rowOf(k.notDeletable.row);

    // A Pending Order has no menu at all; the others still have their other actions.
    if (k.kind === "Order") {
      expect(within(row).queryByRole("button", { name: /^Actions for / })).not.toBeInTheDocument();
      return;
    }
    const menu = await openRowMenu(user, row);
    expect(within(menu).getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("asks first, says it is permanent, and sends nothing until confirmed", async () => {
    const { dialog, writes } = await askToDelete();

    expect(within(dialog).getByText(k.title)).toBeInTheDocument();
    expect(dialog).toHaveTextContent("This can't be undone: there is no way to restore it.");
    expect(writes).toEqual([]);
  });

  it("changes nothing when cancelled, and focus returns to the row's menu button", async () => {
    const { user, dialog, writes } = await askToDelete();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(writes).toEqual([]);
    await waitFor(async () => expect(menuButtonOf(await rowOf(k.target))).toHaveFocus());
  });

  it("deletes it, and the list stops showing it", async () => {
    const { user, dialog, writes } = await askToDelete();

    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(screen.queryAllByRole("row").some((r) => r.textContent?.includes(k.target))).toBe(
        false,
      ),
    );
    expect(writes).toEqual([{ method: "DELETE", path: k.deletePath }]);
  });

  // State changes between the page load and the click.
  it("says so, and keeps asking, when the state changed (409)", async () => {
    const { user, dialog } = await askToDelete();
    server.use(
      http.delete(k.route, () => problem({ ...k.conflict, status: 409, title: "Conflict" })),
    );

    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(k.conflictMessage);
  });

  it("says the Role may not delete when the API answers 403", async () => {
    const { user, dialog } = await askToDelete();
    server.use(http.delete(k.route, () => problem({ status: 403, title: "Forbidden" })));

    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(k.forbiddenMessage);
  });

  it("treats 404 as already gone: closes the question and refreshes the list", async () => {
    const { user, dialog } = await askToDelete();
    server.use(http.delete(k.route, () => problem({ status: 404, title: "Not Found" })));
    k.gone();

    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(screen.queryAllByRole("row").some((r) => r.textContent?.includes(k.target))).toBe(
        false,
      ),
    );
  });

  it("tells the person to log in again when the session ended (401)", async () => {
    const { user, dialog } = await askToDelete();
    server.use(
      http.delete(k.route, () =>
        problem({ type: "session-ended", status: 401, title: "Unauthorized" }),
      ),
    );

    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Your session has ended. Log in again.",
    );
  });
});

describe("the row actions menu", () => {
  it("opens with the keyboard, moves with the arrows, and Escape returns focus to its button", async () => {
    signedIn("owner");
    mockApi.products = [archived];
    const { user } = renderApp("/products?status=archived");
    const button = menuButtonOf(await rowOf("Old goggles"));

    button.focus();
    await user.keyboard("{Enter}");
    const menu = await screen.findByRole("menu");
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(within(menu).getByRole("menuitem", { name: "Edit" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(within(menu).getByRole("menuitem", { name: "Delete" })).toHaveFocus();
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(button).toHaveFocus();
  });

  it("names the row it belongs to, so a screen reader can tell the buttons apart", async () => {
    signedIn("owner");
    mockApi.products = [active, archived];
    renderApp("/products");

    expect(
      await screen.findByRole("button", { name: "Actions for Safety helmet" }),
    ).toBeInTheDocument();
  });

  it("keeps Set Inactive reachable on the Users list, with Edit", async () => {
    signedIn("owner");
    mockApi.users.push(mali);
    const { user } = renderApp("/users");

    const menu = await openRowMenu(user, await rowOf("Mali Chai"));

    expect(within(menu).getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Set Inactive" })).toBeInTheDocument();
  });
});

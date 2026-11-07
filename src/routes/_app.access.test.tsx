import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { UserRole } from "@/api/generated/model";
import { mockApi, people } from "@/mocks/handlers";
import { renderApp } from "@/test/render-app";

// users-and-access R11, copied from the record as its table reads, not from the app's own table.
// `heading` is what the page shows when the Role reaches it; `label` is its link in the navigation.
const r11 = [
  {
    page: "Dashboard",
    path: "/dashboard",
    label: "Dashboard",
    heading: "Dashboard",
    owner: true,
    admin: true,
    staff: false,
  },
  {
    page: "Product List",
    path: "/products",
    label: "Products",
    heading: "Products",
    owner: true,
    admin: true,
    staff: true,
  },
  {
    page: "Product Form",
    path: "/products/new",
    label: "New product",
    heading: "New product",
    owner: true,
    admin: true,
    staff: false,
  },
  {
    page: "Product Form, editing",
    path: "/products/2/edit",
    route: "/products/$id/edit",
    label: undefined,
    heading: "Edit product",
    owner: true,
    admin: true,
    staff: false,
  },
  {
    page: "Stock Movements",
    path: "/stock-movements",
    label: "Stock movements",
    heading: "Stock movements",
    owner: true,
    admin: true,
    staff: true,
  },
  {
    page: "Orders List",
    path: "/orders",
    label: "Orders",
    heading: "Orders",
    owner: true,
    admin: true,
    staff: true,
  },
  {
    // R17: an Order's detail follows the Orders List's access.
    page: "Order detail",
    path: "/orders/12",
    route: "/orders/$number",
    label: undefined,
    heading: "Order not found",
    owner: true,
    admin: true,
    staff: true,
  },
  {
    page: "Create Order",
    path: "/orders/new",
    label: "New order",
    heading: "New order",
    owner: true,
    admin: true,
    staff: true,
  },
  {
    page: "Reports",
    path: "/reports",
    label: "Reports",
    heading: "Reports",
    owner: true,
    admin: true,
    staff: false,
  },
  {
    page: "Users list",
    path: "/users",
    label: "Users",
    heading: "Users",
    owner: true,
    admin: false,
    staff: false,
  },
  {
    page: "Users form",
    path: "/users/new",
    label: undefined,
    heading: "Create User",
    owner: true,
    admin: false,
    staff: false,
  },
  {
    page: "Users form, editing",
    path: "/users/2/edit",
    route: "/users/$id/edit",
    label: undefined,
    heading: "Edit User",
    owner: true,
    admin: false,
    staff: false,
  },
  {
    page: "Login log",
    path: "/login-log",
    label: "Login log",
    heading: "Login log",
    owner: true,
    admin: false,
    staff: false,
  },
] as const;

const roles = ["owner", "admin", "staff"] as const;
const landing = { owner: "/dashboard", admin: "/dashboard", staff: "/orders" } as const;
const landingName = { owner: "Dashboard", admin: "Dashboard", staff: "Orders" } as const;
const password = "correct-horse";

function signedIn(role: UserRole) {
  mockApi.session = "live";
  mockApi.role = role;
}

function navigationLinks() {
  return within(screen.getByRole("navigation", { name: "Main" }))
    .getAllByRole("link")
    .map((link) => link.textContent);
}

describe("what each Role reaches", () => {
  describe.each(roles)("as %s", (role) => {
    // users-and-access R11, R22: exactly the pages of the Role, nothing else.
    it("sees the pages of its row of R11 in the navigation, and no others", async () => {
      signedIn(role);
      renderApp(landing[role]);

      await screen.findByText(people[role].name);
      expect(navigationLinks()).toEqual(
        r11.filter((row) => row[role] && row.label).map((row) => row.label),
      );
    });

    it.each(r11)("opens $page by its address only if R11 says $page is reachable", async (row) => {
      signedIn(role);
      renderApp(row.path);

      if (row[role]) {
        expect(await screen.findByRole("heading", { name: row.heading })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "No access" })).not.toBeInTheDocument();
      } else {
        expect(await screen.findByRole("heading", { name: "No access" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: row.heading })).not.toBeInTheDocument();
        // The page says so instead of redirecting (R22): the address stays.
        expect(screen.getByRole("link", { name: `Go to ${landingName[role]}` })).toHaveAttribute(
          "href",
          landing[role],
        );
      }
    });

    // users-and-access R40
    it.each(
      r11.filter(
        (row) =>
          row[role] &&
          !row.path.startsWith("/users") &&
          !row.path.startsWith("/products") &&
          row.path !== "/stock-movements" &&
          row.path !== "/orders" &&
          !("route" in row && row.route === "/orders/$number") &&
          row.path !== "/login-log",
      ),
    )("shows $page with its title and Coming soon", async (row) => {
      signedIn(role);
      renderApp(row.path);

      expect(await screen.findByRole("heading", { name: row.heading })).toBeInTheDocument();
      expect(screen.getByRole("main")).toHaveTextContent("Coming soon");
    });

    it.each(r11.filter((row) => row.label && row[role]))(
      "opens $page from the navigation",
      async (row) => {
        signedIn(role);
        const { user } = renderApp(landing[role]);

        await user.click(
          within(await screen.findByRole("navigation", { name: "Main" })).getByRole("link", {
            name: row.label,
          }),
        );

        expect(await screen.findByRole("heading", { name: row.heading })).toBeInTheDocument();
      },
    );
  });

  it("leads from No access to the landing page of the Role", async () => {
    signedIn("staff");
    const { user, router } = renderApp("/reports");

    await user.click(await screen.findByRole("link", { name: "Go to Orders" }));

    expect(await screen.findByRole("heading", { name: "Orders" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/orders");
  });

  // users-and-access R35: the Role is read again, so a change shows without a new login.
  it("shows No access when the Role changes under a page", async () => {
    signedIn("admin");
    renderApp("/reports");
    await screen.findByRole("heading", { name: "Reports" });

    mockApi.role = "staff";
    window.dispatchEvent(new Event("visibilitychange"));

    expect(await screen.findByRole("heading", { name: "No access" })).toBeInTheDocument();
    expect(navigationLinks()).not.toContain("Reports");
  });
});

describe("where a User lands", () => {
  async function logInAs(role: UserRole, address: string) {
    mockApi.password = password;
    const { user, router } = renderApp(address);
    await user.type(await screen.findByLabelText("Email"), people[role].email);
    await user.type(screen.getByLabelText("Password"), password);
    await user.click(screen.getByRole("button", { name: "Log in" }));
    return router;
  }

  // users-and-access R12
  it.each(roles)("sends %s to its landing page after logging in", async (role) => {
    const router = await logInAs(role, "/login");

    await waitFor(() => expect(router.state.location.pathname).toBe(landing[role]));
    expect(await screen.findByRole("heading", { name: landingName[role] })).toBeInTheDocument();
  });

  // users-and-access R12
  it.each(roles)("opens the root address on the landing page of %s", async (role) => {
    signedIn(role);
    const { router } = renderApp("/");

    await waitFor(() => expect(router.state.location.pathname).toBe(landing[role]));
  });

  // users-and-access R25
  it.each(roles)("sends %s from Login to its landing page when already logged in", async (role) => {
    signedIn(role);
    const { router } = renderApp("/login");

    await waitFor(() => expect(router.state.location.pathname).toBe(landing[role]));
  });

  // users-and-access R24
  it("returns an Admin to the page that sent them to Login", async () => {
    const router = await logInAs("admin", "/reports");

    await waitFor(() => expect(router.state.location.pathname).toBe("/reports"));
    expect(await screen.findByRole("heading", { name: "Reports" })).toBeInTheDocument();
  });

  it.each([
    ["staff", "/reports", "/orders"],
    ["staff", "/dashboard", "/orders"],
    ["staff", "/users/new", "/orders"],
    ["staff", "/users/2/edit", "/orders"],
    ["admin", "/users", "/dashboard"],
    ["admin", "/users/2/edit", "/dashboard"],
    ["admin", "/login-log", "/dashboard"],
  ] as const)(
    "sends %s to the landing page when the page they were sent from (%s) is not theirs",
    async (role, address, expected) => {
      const router = await logInAs(role, address);

      await waitFor(() => expect(router.state.location.pathname).toBe(expected));
      expect(screen.queryByRole("heading", { name: "No access" })).not.toBeInTheDocument();
    },
  );
});

describe("the routes of the app", () => {
  // A route nobody put in R11's table would open for every Role, so this fails until it is.
  it("have a row in R11 for every page under the shell", () => {
    signedIn("owner");
    const { router } = renderApp("/dashboard");
    const notPages = ["/", "/$", "/login", "/set-password"];
    const addresses = Object.keys(router.routesByPath)
      .map((path) => (path.length > 1 ? path.replace(/\/$/, "") : path))
      .filter((path) => !notPages.includes(path));

    expect(addresses.toSorted()).toEqual(
      r11.map((row) => ("route" in row ? row.route : row.path)).toSorted(),
    );
  });
});

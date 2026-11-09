import {
  ArrowLeftRight,
  ChartColumn,
  ClipboardList,
  ClipboardPlus,
  LayoutDashboard,
  Package,
  PackagePlus,
  ScrollText,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { UserRole } from "@/api/generated/model";

// users-and-access R11, the one place it lives: navigation and page access both read this table.
// A route under `_app` that is not here has no rule, so `_app.access.test.tsx` fails until it is added.
// `parent` groups forms and details beneath their list (navigation-and-lists R2, R3).
// `path` identifies an address,
// where `$name` stands for any one segment.
export const pages = [
  {
    title: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    roles: ["owner", "admin"],
  },
  {
    title: "Products",
    path: "/products",
    icon: Package,
    roles: ["owner", "admin", "staff"],
  },
  {
    title: "New product",
    path: "/products/new",
    parent: "/products",
    icon: PackagePlus,
    roles: ["owner", "admin"],
  },
  {
    title: "Edit product",
    path: "/products/$id/edit",
    parent: "/products",
    icon: PackagePlus,
    roles: ["owner", "admin"],
  },
  {
    title: "Stock movements",
    path: "/stock-movements",
    icon: ArrowLeftRight,
    roles: ["owner", "admin", "staff"],
  },
  {
    title: "Orders",
    path: "/orders",
    icon: ClipboardList,
    roles: ["owner", "admin", "staff"],
  },
  {
    title: "New order",
    path: "/orders/new",
    parent: "/orders",
    icon: ClipboardPlus,
    roles: ["owner", "admin", "staff"],
  },
  {
    title: "Order details",
    path: "/orders/$number",
    parent: "/orders",
    icon: ClipboardList,
    roles: ["owner", "admin", "staff"],
  },
  {
    title: "Reports",
    path: "/reports",
    icon: ChartColumn,
    roles: ["owner", "admin"],
  },
  {
    title: "Users",
    path: "/users",
    icon: Users,
    roles: ["owner"],
  },
  {
    title: "Create User",
    path: "/users/new",
    parent: "/users",
    icon: Users,
    roles: ["owner"],
  },
  {
    title: "Edit User",
    path: "/users/$id/edit",
    parent: "/users",
    icon: Users,
    roles: ["owner"],
  },
  {
    title: "Login log",
    path: "/login-log",
    icon: ScrollText,
    roles: ["owner"],
  },
] as const satisfies readonly Page[];

interface Page {
  title: string;
  path: string;
  parent?: string;
  icon: LucideIcon;
  roles: readonly UserRole[];
}

export type AppPage = (typeof pages)[number];

// The tuples are literal types for `Link`; widened here to ask them about any Role.
function allows(page: Page, role: UserRole) {
  return page.roles.includes(role);
}

export function pagesOf(role: UserRole): AppPage[] {
  // navigation-and-lists R2: hidden shortcuts keep their route permissions.
  return pages.filter((page) => allows(page, role) && !("parent" in page));
}

function withoutTrailingSlash(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

// The R11 row an address belongs to; none for an address that is no page (or a redirect).
export function pageAt(pathname: string): AppPage | undefined {
  const path = withoutTrailingSlash(pathname);
  // An exact address wins over a pattern: `/orders/new` is New order, not an Order numbered "new".
  return (
    pages.find((page) => page.path === path) ??
    pages.find((page) => matchesPattern(page.path, path))
  );
}

function matchesPattern(pattern: string, path: string) {
  const parts = path.split("/");
  const expected = pattern.split("/");
  return (
    parts.length === expected.length &&
    expected.every((part, i) => part.startsWith("$") || part === parts[i])
  );
}

export function canReach(role: UserRole, pathname: string) {
  const page = pageAt(pathname);
  // Not a page, so there is nothing to protect: it says "Page not found" itself.
  return !page || allows(page, role);
}

// users-and-access R12
const landing = {
  owner: "/dashboard",
  admin: "/dashboard",
  staff: "/orders",
} as const satisfies Record<UserRole, AppPage["path"]>;

export function landingPageOf(role: UserRole): AppPage {
  const page = pages.find(({ path }) => path === landing[role]);
  if (!page) throw new Error(`The landing page of ${role} is not in R11's table`);
  return page;
}

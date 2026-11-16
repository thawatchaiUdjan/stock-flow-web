import { screen, waitFor, within } from "@testing-library/react";
import { delay } from "msw";
import { describe, expect, it } from "vitest";

import type { User } from "@/api/generated/model";
import { getGetCurrentUserMockHandler200 } from "@/api/generated/sessions/sessions.msw";
import {
  getListUsersMockHandler200,
  getListUsersMockHandler403,
  getListUsersMockHandler500,
  getUpdateUserMockHandler500,
} from "@/api/generated/users/users.msw";
import { mockApi, serverFailure } from "@/mocks/handlers";
import { renderApp } from "@/test/render-app";
import { server } from "@/test/server";

describe("the Users list", () => {
  // users-and-access R10: the Owner's pages.
  it("is in the Owner's navigation and opens", async () => {
    mockApi.session = "live";
    const { user } = renderApp("/dashboard");

    await user.click(
      within(await screen.findByRole("navigation", { name: "Main" })).getByRole("link", {
        name: "Users",
      }),
    );

    expect(await screen.findByRole("heading", { name: "Users" })).toBeInTheDocument();
  });

  // users-and-access R22
  it("is not in an Admin's navigation", async () => {
    server.use(
      getGetCurrentUserMockHandler200({ name: "Mali", email: "mali@example.com", role: "admin" }),
    );
    renderApp("/dashboard");

    const navigation = await screen.findByRole("navigation", { name: "Main" });
    expect(within(navigation).getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(within(navigation).queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
  });

  // users-and-access R14
  it("shows each User's name, email, Role and status", async () => {
    mockApi.session = "live";
    mockApi.users.push(
      {
        id: 2,
        name: "Mali Chai",
        email: "mali@example.com",
        role: "admin",
        status: "active",
        passwordSet: true,
      },
      {
        id: 3,
        name: "สมชาย ใจดี",
        email: "somchai@example.com",
        role: "staff",
        status: "inactive",
        passwordSet: true,
      },
    );
    renderApp("/users");

    const rows = within(await screen.findByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent("Nok Srisuk");
    expect(rows[1]).toHaveTextContent("nok@example.com");
    expect(within(rows[1]!).getByRole("cell", { name: "Owner" })).toBeInTheDocument();
    expect(rows[2]).toHaveTextContent("Mali Chai");
    expect(rows[2]).toHaveTextContent("mali@example.com");
    expect(within(rows[2]!).getByRole("cell", { name: "Admin" })).toBeInTheDocument();
    expect(within(rows[2]!).getByText("Active")).toBeInTheDocument();
    expect(rows[3]).toHaveTextContent("สมชาย ใจดี");
    expect(within(rows[3]!).getByRole("cell", { name: "Staff" })).toBeInTheDocument();
    expect(within(rows[3]!).getByText("Inactive")).toBeInTheDocument();
  });

  // users-and-access R33
  it("marks the Users who have not set a password yet, and only them", async () => {
    mockApi.session = "live";
    mockApi.users.push(
      {
        id: 2,
        name: "Mali Chai",
        email: "mali@example.com",
        role: "admin",
        status: "active",
        passwordSet: false,
      },
      {
        id: 3,
        name: "Anan Dee",
        email: "anan@example.com",
        role: "staff",
        status: "active",
        passwordSet: true,
      },
    );
    renderApp("/users");

    const rows = within(await screen.findByRole("table")).getAllByRole("row");
    expect(within(rows[2]!).getByText("Password not set")).toBeInTheDocument();
    expect(within(rows[1]!).queryByText("Password not set")).not.toBeInTheDocument();
    expect(within(rows[3]!).queryByText("Password not set")).not.toBeInTheDocument();
  });

  it("says it is loading until the API answers", async () => {
    mockApi.session = "live";
    server.use(
      getListUsersMockHandler200(async () => {
        await delay(100);
        return { users: mockApi.users };
      }),
    );
    renderApp("/users");

    expect(await screen.findByText("Loading Users")).toBeInTheDocument();
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.queryByText("Loading Users")).not.toBeInTheDocument();
  });

  // users-and-access R9: the Owner is a User, so a real list is never empty; this is its first state.
  it("invites the Owner to create the first User when there is no one else", async () => {
    mockApi.session = "live";
    renderApp("/users");

    expect(await screen.findByText(/No other Users yet/)).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
  });

  it("does not show the empty state once there are other Users", async () => {
    mockApi.session = "live";
    mockApi.users.push({
      id: 2,
      name: "Mali Chai",
      email: "mali@example.com",
      role: "admin",
      status: "active",
      passwordSet: true,
    });
    renderApp("/users");

    await screen.findByRole("table");
    expect(screen.queryByText(/No other Users yet/)).not.toBeInTheDocument();
  });

  it("offers Create User", async () => {
    mockApi.session = "live";
    const { user, router } = renderApp("/users");

    await user.click(await screen.findByRole("link", { name: "Create User" }));

    expect(await screen.findByRole("heading", { name: "Create User" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/users/new");
  });

  it("offers another try when the list fails", async () => {
    mockApi.session = "live";
    server.use(getListUsersMockHandler500(serverFailure));
    const { user } = renderApp("/users");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^Something went wrong\. Try again\.$/,
    );

    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  // users-and-access R23: the API refuses, and the page says so rather than showing an empty list.
  // The app still thinks this User is the Owner, as it does for a moment after a Role change (R35).
  it("does not show an empty list to someone the API refuses", async () => {
    server.use(
      getGetCurrentUserMockHandler200({ name: "Mali", email: "mali@example.com", role: "owner" }),
      getListUsersMockHandler403({ status: 403, title: "Forbidden" }),
    );
    renderApp("/users");

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(/No other Users yet/)).not.toBeInTheDocument();
  });
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
  name: "สมชาย ใจดี",
  email: "somchai@example.com",
  role: "staff",
  status: "inactive",
  passwordSet: true,
};

// What the API received from the screen: a method, an address and a body, in order.
function recordWrites() {
  const sent: Promise<{ method: string; path: string; body: unknown }>[] = [];
  server.events.on("request:start", ({ request }) => {
    if (request.method === "GET") return;
    const { method, url } = request;
    sent.push(
      request
        .clone()
        .text()
        .then((body) => ({ method, path: new URL(url).pathname, body: body && JSON.parse(body) })),
    );
  });
  return () => Promise.all(sent);
}

async function rowOf(name: string) {
  const row = (await screen.findAllByRole("row")).find((one) => one.textContent?.includes(name));
  if (!row) throw new Error(`No row for ${name}`);
  return row;
}

describe("the actions on the Users list", () => {
  // users-and-access R18, context ADR 0004: nothing on the Owner's row.
  it("offers no action on the Owner's row, and editing and status actions on another User's", async () => {
    mockApi.session = "live";
    mockApi.users.push(mali);
    renderApp("/users");

    const ownerRow = await rowOf("Nok Srisuk");
    expect(within(ownerRow).queryByRole("link")).not.toBeInTheDocument();
    expect(within(ownerRow).queryByRole("button")).not.toBeInTheDocument();
    const maliRow = await rowOf("Mali Chai");
    expect(within(maliRow).getByRole("link", { name: "Edit" })).toBeInTheDocument();
    expect(within(maliRow).getByRole("button", { name: "Set Inactive" })).toBeInTheDocument();
    expect(
      within(maliRow).queryByRole("button", { name: "Reset password" }),
    ).not.toBeInTheDocument();
  });

  it("opens the User form for the User whose Edit was chosen", async () => {
    mockApi.session = "live";
    mockApi.users.push(mali);
    const { user, router } = renderApp("/users");

    await user.click(within(await rowOf("Mali Chai")).getByRole("link", { name: "Edit" }));

    expect(await screen.findByRole("heading", { name: "Edit User" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/users/2/edit");
  });

  // users-and-access R32: an Inactive User gets no Setup link, so there is nothing to reset.
  it("offers Set Active, and no Reset password, for an Inactive User", async () => {
    mockApi.session = "live";
    mockApi.users.push(mali, somchai);
    renderApp("/users");

    const row = await rowOf("สมชาย ใจดี");
    expect(within(row).getByRole("button", { name: "Set Active" })).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Set Inactive" })).not.toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Reset password" })).not.toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "Edit" })).toBeInTheDocument();
    const activeRow = await rowOf("Mali Chai");
    expect(within(activeRow).queryByRole("button", { name: "Set Active" })).not.toBeInTheDocument();
  });

  describe("Set Inactive", () => {
    async function ask() {
      mockApi.session = "live";
      mockApi.users.push(mali);
      const written = recordWrites();
      const view = renderApp("/users");
      await view.user.click(
        within(await rowOf("Mali Chai")).getByRole("button", { name: "Set Inactive" }),
      );
      return { ...view, written, dialog: await screen.findByRole("alertdialog") };
    }

    // users-and-access R16: the consequence is the reason for the question.
    it("asks first, naming the User and the consequence", async () => {
      const { dialog, written } = await ask();

      expect(within(dialog).getByText("Set Mali Chai Inactive?")).toBeInTheDocument();
      expect(dialog).toHaveTextContent(
        "Mali Chai won't be able to log in, and any session they have ends at once. Their codes and password links stop working too.",
      );
      expect(await written()).toEqual([]);
    });

    it("changes nothing when the Owner cancels", async () => {
      const { user, dialog, written } = await ask();

      await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(await written()).toEqual([]);
      expect(within(await rowOf("Mali Chai")).getByText("Active")).toBeInTheDocument();
    });

    it("sets the User Inactive once the Owner confirms", async () => {
      const { user, dialog, written } = await ask();

      await user.click(within(dialog).getByRole("button", { name: "Set Inactive" }));

      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(await written()).toEqual([
        { method: "PATCH", path: "/api/users/2", body: { status: "inactive" } },
      ]);
      const row = await rowOf("Mali Chai");
      await waitFor(() => expect(within(row).getByText("Inactive")).toBeInTheDocument());
      // The row now offers the reverse, and no password reset.
      expect(within(row).getByRole("button", { name: "Set Active" })).toBeInTheDocument();
      expect(within(row).queryByRole("button", { name: "Reset password" })).not.toBeInTheDocument();
    });

    it("keeps the question open and says so when the API fails", async () => {
      const { user, dialog } = await ask();
      server.use(getUpdateUserMockHandler500(serverFailure));

      await user.click(within(dialog).getByRole("button", { name: "Set Inactive" }));

      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "Something went wrong. Try again.",
      );
      // Still asking: the User is Active until the API says otherwise.
      await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
      expect(within(await rowOf("Mali Chai")).getByText("Active")).toBeInTheDocument();
    });
  });

  describe("Set Active", () => {
    async function ask() {
      mockApi.session = "live";
      mockApi.users.push(somchai);
      const written = recordWrites();
      const view = renderApp("/users");
      await view.user.click(
        within(await rowOf("สมชาย ใจดี")).getByRole("button", { name: "Set Active" }),
      );
      return { ...view, written, dialog: await screen.findByRole("alertdialog") };
    }

    it("asks first, naming the User and the consequence", async () => {
      const { dialog, written } = await ask();

      expect(within(dialog).getByText("Set สมชาย ใจดี Active?")).toBeInTheDocument();
      expect(dialog).toHaveTextContent(
        "สมชาย ใจดี will be able to log in again. Sessions, codes and password links that ended do not come back. Ask them to request fresh instructions.",
      );
      expect(await written()).toEqual([]);
    });

    it("sets the User Active once the Owner confirms", async () => {
      const { user, dialog, written } = await ask();

      await user.click(within(dialog).getByRole("button", { name: "Set Active" }));

      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(await written()).toEqual([
        { method: "PATCH", path: "/api/users/3", body: { status: "active" } },
      ]);
      const row = await rowOf("สมชาย ใจดี");
      await waitFor(() => expect(within(row).getByText("Active")).toBeInTheDocument());
      expect(within(row).getByRole("button", { name: "Set Inactive" })).toBeInTheDocument();
    });
  });

  // users-and-access R29, R31: self-service recovery replaces Owner resets.
  it("offers no Owner reset, reissue, resend or copy-link control", async () => {
    mockApi.session = "live";
    mockApi.users.push(mali);
    renderApp("/users");
    await screen.findByRole("table");
    expect(
      screen.queryByRole("button", { name: /reset|reissue|resend|copy link/i }),
    ).not.toBeInTheDocument();
  });
});

// navigation-and-lists R4-R5: whole-list meaning survives a page containing only the Owner.
it("pages the complete Users response, keeping actions and whole-list empty meaning", async () => {
  mockApi.session = "live";
  const others: User[] = Array.from({ length: 25 }, (_, i) => ({
    id: i + 2,
    name: `Staff ${i}`,
    email: `staff${i}@example.com`,
    role: "staff",
    status: "active",
    passwordSet: true,
  }));
  server.use(
    getListUsersMockHandler200({
      users: [
        ...others,
        {
          id: 1,
          name: "Owner",
          email: "owner@example.com",
          role: "owner",
          status: "active",
          passwordSet: true,
        },
      ],
    }),
  );
  const { user } = renderApp("/users?size=25&page=2");
  await screen.findByText("Page 2 of 2 \u00b7 26 matching");
  expect(screen.queryByText(/No other Users yet/)).not.toBeInTheDocument();
  expect(screen.queryByText("Staff 0")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "First page" }));
  await screen.findByText("Staff 0");
  expect(screen.queryAllByRole("button", { name: "Reset password" })).toHaveLength(0);
});

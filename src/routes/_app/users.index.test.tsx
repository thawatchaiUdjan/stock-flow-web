import { screen, within } from "@testing-library/react";
import { delay } from "msw";
import { describe, expect, it } from "vitest";

import { getGetCurrentUserMockHandler200 } from "@/api/generated/sessions/sessions.msw";
import {
  getListUsersMockHandler200,
  getListUsersMockHandler403,
  getListUsersMockHandler500,
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
  it("does not show an empty list to someone the API refuses", async () => {
    server.use(
      getGetCurrentUserMockHandler200({ name: "Mali", email: "mali@example.com", role: "admin" }),
      getListUsersMockHandler403({ status: 403, title: "Forbidden" }),
    );
    renderApp("/users");

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(/No other Users yet/)).not.toBeInTheDocument();
  });
});

import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  getEndSessionMockHandler500,
  getGetCurrentUserMockHandler200,
  getGetCurrentUserMockHandler500,
} from "@/api/generated/sessions/sessions.msw";
import { mockApi, serverFailure } from "@/mocks/handlers";
import { renderApp } from "@/test/render-app";
import { server } from "@/test/server";

describe("the app shell", () => {
  // navigation-and-lists R1; users-and-access R12
  it.each([
    ["owner", "/dashboard", "Dashboard"],
    ["admin", "/dashboard", "Dashboard"],
    ["staff", "/orders", "Orders"],
  ] as const)("takes %s home through the StockFlow brand", async (role, path, title) => {
    mockApi.session = "live";
    mockApi.role = role;
    const { user, router } = renderApp("/products");
    const home = await screen.findByRole("link", { name: "StockFlow home" });
    expect(home).toHaveAttribute("href", path);
    await user.click(home);
    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(path);
  });

  // navigation-and-lists R2, R3
  it.each([
    ["/products/new", "New product", "Products", "/products"],
    ["/products/2/edit", "Edit product", "Products", "/products"],
    ["/orders/new", "New order", "Orders", "/orders"],
    ["/orders/12", "Order details", "Orders", "/orders"],
    ["/users/new", "Create User", "Users", "/users"],
    ["/users/2/edit", "Edit User", "Users", "/users"],
  ])("identifies %s and links back to its selected parent", async (path, title, parent, list) => {
    mockApi.session = "live";
    const { user, router } = renderApp(path);
    const context = within(await screen.findByRole("navigation", { name: "Current page" }));
    expect(context.getByText(title)).toHaveAttribute("aria-current", "page");
    const main = within(screen.getByRole("navigation", { name: "Main" }));
    expect(main.getByRole("link", { name: parent })).toHaveAttribute("aria-current", "page");
    expect(main.queryByRole("link", { name: "New product" })).not.toBeInTheDocument();
    expect(main.queryByRole("link", { name: "New order" })).not.toBeInTheDocument();
    await user.click(context.getByRole("link", { name: parent }));
    expect(await screen.findByRole("heading", { name: parent })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(list);
  });

  it("shows the User's name and Role and a Log out action", async () => {
    mockApi.session = "live";
    renderApp("/dashboard");

    expect(await screen.findByText("Nok Srisuk")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", {
        name: "Dashboard",
      }),
    ).toHaveAttribute("href", "/dashboard");
  });

  it.each([
    ["admin", "Admin"],
    ["staff", "Staff"],
  ] as const)("names the Role %s as %s", async (role, label) => {
    server.use(
      getGetCurrentUserMockHandler200({ name: "สมชาย ใจดี", email: "s@example.com", role }),
    );
    renderApp("/dashboard");

    expect(await screen.findByText("สมชาย ใจดี")).toBeInTheDocument();
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  // users-and-access R24
  it.each(["/", "/dashboard", "/no-such-page"])(
    "sends a visitor who opens %s to Login, with the page as the return address",
    async (address) => {
      const { router } = renderApp(address);

      expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/login");
      expect(router.state.location.search).toEqual({ redirect: address });
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    },
  );

  // A failure of the API says nothing about the session: Login would be the wrong answer.
  it("offers another try when the check for a session fails", async () => {
    server.use(getGetCurrentUserMockHandler500(serverFailure));
    const { user, router } = renderApp("/dashboard");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^Something went wrong\. Try again\.$/,
    );
    expect(router.state.location.pathname).toBe("/dashboard");

    server.resetHandlers();
    mockApi.session = "live";
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  describe("logging out", () => {
    // users-and-access R7
    it("ends the session and goes to Login with no message", async () => {
      mockApi.session = "live";
      const { user, router } = renderApp("/dashboard");

      await user.click(await screen.findByRole("button", { name: "Log out" }));

      expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
      expect(mockApi.session).toBe("none");
      expect(router.state.location.search).toEqual({});
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("leaves nothing for the next person: the app asks the API again", async () => {
      mockApi.session = "live";
      const { user, router } = renderApp("/dashboard");

      await user.click(await screen.findByRole("button", { name: "Log out" }));
      await screen.findByRole("heading", { name: "Log in" });
      await router.navigate({ to: "/dashboard" });

      await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
      expect(screen.queryByText("Nok Srisuk")).not.toBeInTheDocument();
    });

    it("stays and says so when the API fails", async () => {
      mockApi.session = "live";
      server.use(getEndSessionMockHandler500(serverFailure));
      const { user } = renderApp("/dashboard");

      await user.click(await screen.findByRole("button", { name: "Log out" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        /^Something went wrong\. Try again\.$/,
      );
      expect(screen.getByText("Nok Srisuk")).toBeInTheDocument();
    });

    // users-and-access R26: the session ended before the click.
    it("goes to Login with the message when the session had already ended", async () => {
      mockApi.session = "live";
      const { user } = renderApp("/dashboard");

      const logOut = await screen.findByRole("button", { name: "Log out" });
      mockApi.session = "ended";
      await user.click(logOut);

      expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
      expect(await screen.findByRole("alert")).toHaveTextContent(
        /^Your session has ended\. Log in again\.$/,
      );
    });
  });

  describe("when the session ends while the app is open", () => {
    // users-and-access R26
    it("sends the User to Login with the message, and back after logging in", async () => {
      mockApi.session = "live";
      mockApi.password = "correct-horse";
      const { user, router } = renderApp("/no-such-page");

      await screen.findByRole("heading", { name: "Page not found" });
      mockApi.session = "ended";
      window.dispatchEvent(new Event("visibilitychange"));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        /^Your session has ended\. Log in again\.$/,
      );

      await user.type(screen.getByLabelText("Email"), "nok@example.com");
      await user.type(screen.getByLabelText("Password"), "correct-horse");
      await user.click(screen.getByRole("button", { name: "Log in" }));

      await waitFor(() => expect(router.state.location.pathname).toBe("/no-such-page"));
    });

    it("notices on the next page the User opens", async () => {
      mockApi.session = "live";
      const { user } = renderApp("/no-such-page");

      await screen.findByRole("heading", { name: "Page not found" });
      mockApi.session = "ended";
      await user.click(screen.getByRole("link", { name: "Go to Dashboard" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        /^Your session has ended\. Log in again\.$/,
      );
    });

    it("shows no message when the cookie is simply gone", async () => {
      mockApi.session = "live";
      const { user } = renderApp("/no-such-page");

      await screen.findByRole("heading", { name: "Page not found" });
      mockApi.session = "none";
      await user.click(screen.getByRole("link", { name: "Go to Dashboard" }));

      expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});

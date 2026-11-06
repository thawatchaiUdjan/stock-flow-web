import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  getCreateSessionMockHandler500,
  getGetCurrentUserMockHandler500,
} from "@/api/generated/sessions/sessions.msw";
import { mockApi, owner } from "@/mocks/handlers";
import { renderApp } from "@/test/render-app";
import { server } from "@/test/server";

const password = "correct-horse";

async function logIn(user: ReturnType<typeof renderApp>["user"], email: string, typed: string) {
  await user.type(await screen.findByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), typed);
  await user.click(screen.getByRole("button", { name: "Log in" }));
}

describe("Login", () => {
  // users-and-access R2
  it("takes a User with the right email and password to the Dashboard", async () => {
    mockApi.password = password;
    const { user, router } = renderApp("/login");

    await logIn(user, owner.email, password);

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard");
    expect(mockApi.session).toBe("live");
  });

  // users-and-access R3: the API compares, so the email goes as typed.
  it("sends the email as it was typed", async () => {
    mockApi.password = password;
    const { user } = renderApp("/login");

    await logIn(user, "NOK@Example.com", password);

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  // users-and-access R5
  it("says only that the email or password is incorrect when login fails", async () => {
    mockApi.password = password;
    const { user, router } = renderApp("/login");

    await logIn(user, owner.email, "wrong-password");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^Email or password is incorrect\.$/,
    );
    expect(router.state.location.pathname).toBe("/login");
  });

  // users-and-access R5: anything that can't be right fails the same way, from the API.
  it("leaves an empty form for the API to refuse", async () => {
    const { user } = renderApp("/login");

    await user.click(await screen.findByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^Email or password is incorrect\.$/,
    );
  });

  it("shows a general message, not the server's text, when the API fails", async () => {
    server.use(
      getCreateSessionMockHandler500({
        status: 500,
        title: "Internal Server Error",
        detail: "something went wrong on our side",
      }),
    );
    const { user } = renderApp("/login");

    await logIn(user, owner.email, password);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^Something went wrong\. Try again\.$/,
    );
  });

  // users-and-access R25
  it("sends a User who is already logged in to their landing page", async () => {
    mockApi.session = "live";
    const { router } = renderApp("/login?redirect=%2Felsewhere");

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard");
  });

  // users-and-access R26
  it("says the session has ended when the API answers session-ended", async () => {
    mockApi.session = "ended";
    const { router } = renderApp("/dashboard");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^Your session has ended\. Log in again\.$/,
    );
    expect(router.state.location.pathname).toBe("/login");
  });

  it("shows no message after a plain 401", async () => {
    renderApp("/dashboard");

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("can't be made to say the session ended by a crafted link", async () => {
    renderApp("/login?sessionEnded=true&ended=true&reason=session-ended");

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows one message at a time: a failed login replaces the session-ended one", async () => {
    mockApi.session = "ended";
    const { user } = renderApp("/login");

    await screen.findByText("Your session has ended. Log in again.");
    await logIn(user, owner.email, "wrong-password");

    expect(await screen.findByText("Email or password is incorrect.")).toBeInTheDocument();
    expect(screen.queryByText("Your session has ended. Log in again.")).not.toBeInTheDocument();
  });

  it("still works when the check for a session fails", async () => {
    server.use(
      getGetCurrentUserMockHandler500({
        status: 500,
        title: "Internal Server Error",
        detail: "something went wrong on our side",
      }),
    );
    renderApp("/login");

    expect(await screen.findByLabelText("Email")).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  describe("the return address", () => {
    // users-and-access R24. A page that isn't the landing page, or the test proves nothing.
    it("brings the visitor back to the page they opened, with its search", async () => {
      mockApi.password = password;
      const { user, router } = renderApp("/products?page=2");

      await logIn(user, owner.email, password);

      await waitFor(() => expect(router.state.location.href).toBe("/products?page=2"));
    });

    it.each([
      ["a full address", "https://evil.example/phish"],
      ["no scheme", "//evil.example/phish"],
      ["a backslash the browser reads as a slash", "/\\evil.example/phish"],
      ["two backslashes", "\\\\evil.example/phish"],
      ["a tab the browser drops", "/\t/evil.example/phish"],
      ["a dot segment that collapses to two slashes", "/.//evil.example/phish"],
      ["a script", "javascript:alert(1)"],
    ])("can't leave the app with %s", async (_, address) => {
      mockApi.password = password;
      const { user, router } = renderApp(`/login?redirect=${encodeURIComponent(address)}`);

      await logIn(user, owner.email, password);

      expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/dashboard");
    });
  });
});

import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  getIdentifyLoginEmailMockHandler200,
  getIdentifyLoginEmailMockHandler429,
  getIdentifyLoginEmailMockHandler503,
} from "@/api/generated/email-access/email-access.msw";
import {
  getCreateSessionMockHandler200,
  getCreateSessionMockHandler500,
  getGetCurrentUserMockHandler500,
} from "@/api/generated/sessions/sessions.msw";
import { mockApi, owner, serverFailure } from "@/mocks/handlers";
import { renderApp } from "@/test/render-app";
import { server } from "@/test/server";

const password = "correct-horse";

type User = ReturnType<typeof renderApp>["user"];

// users-and-access R2: Login asks for the email first, then the password.
async function continueWith(user: User, email: string) {
  await user.type(await screen.findByLabelText("Email"), email);
  await user.click(screen.getByRole("button", { name: "Continue" }));
}

async function logIn(user: User, email: string, typed: string) {
  await continueWith(user, email);
  await user.type(await screen.findByLabelText("Password"), typed);
  await user.click(screen.getByRole("button", { name: "Log in" }));
}

describe("Login", () => {
  // users-and-access R2
  it("asks for the email only, with Continue, before the password", async () => {
    renderApp("/login");

    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Set up your password" })).not.toBeInTheDocument();
  });

  // users-and-access R2, R5: the password step names the email and offers recovery.
  it("shows the email, Forgot password and a way to change the email on the password step", async () => {
    mockApi.password = password;
    const { user } = renderApp("/login");

    await continueWith(user, owner.email);

    expect(await screen.findByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByText(owner.email)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
    await user.click(screen.getByRole("button", { name: "Change email" }));
    expect(await screen.findByLabelText("Email")).toHaveValue(owner.email);
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

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
  it("sends the email to the check, then the email and password as they were typed", async () => {
    let checked: unknown;
    let sent: unknown;
    server.use(
      getIdentifyLoginEmailMockHandler200(async ({ request }) => {
        checked = await request.json();
        return { next: "password" };
      }),
      getCreateSessionMockHandler200(async ({ request }) => {
        sent = await request.json();
        // The API starts the session the Dashboard then asks its figures with.
        mockApi.session = "live";
        return owner;
      }),
    );
    const { user } = renderApp("/login");

    await logIn(user, "NOK@Example.com", password);

    await screen.findByRole("heading", { name: "Dashboard" });
    expect(checked).toEqual({ email: "NOK@Example.com" });
    expect(sent).toEqual({ email: "NOK@Example.com", password });
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

  // users-and-access R5: the API refuses an email it can't read; the screen is no stricter.
  it("leaves an empty email for the API to refuse, and says so", async () => {
    mockApi.password = password;
    const { user } = renderApp("/login");

    await user.click(await screen.findByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  // users-and-access R50: one message for an unknown email and an Inactive User.
  it.each([
    ["an unknown email", "nobody@example.com"],
    ["an Inactive User", "anan@example.com"],
  ])("says there is no account for %s, without revealing status", async (_, email) => {
    mockApi.password = password;
    mockApi.users.push({
      id: 2,
      name: "Anan Chaiyo",
      email: "anan@example.com",
      role: "admin",
      status: "inactive",
      passwordSet: true,
    });
    const { user } = renderApp("/login");

    await continueWith(user, email);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/no account/i);
    expect(alert).toHaveTextContent(/Owner/);
    expect(alert).not.toHaveTextContent(/inactive/i);
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  // users-and-access R52
  it("tells the first Owner to use the installation Setup link", async () => {
    const { user } = renderApp("/login");

    await continueWith(user, owner.email);

    expect(await screen.findByRole("alert")).toHaveTextContent(/installation Setup link/);
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  // users-and-access R51, R54: the code step opens for the email just given.
  it("opens the code step for a User without a password, without asking for the email again", async () => {
    server.use(
      getIdentifyLoginEmailMockHandler200({
        next: "first-time-code",
        codeDelivery: "sent",
      }),
    );
    const { user } = renderApp("/login");

    await continueWith(user, "suda@example.com");

    expect(
      await screen.findByRole("heading", { name: "Set up your password" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("First-time code")).toBeInTheDocument();
    expect(screen.getByText("suda@example.com")).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.queryByText(/no new code/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Change email" }));
    expect(await screen.findByLabelText("Email")).toHaveValue("suda@example.com");
  });

  // The answer is still first-time-code, so the screen goes to the code step and says so.
  it.each(["suppressed", "failed"] as const)(
    "goes to the code step and says no new code was sent when delivery was %s",
    async (codeDelivery) => {
      server.use(
        getIdentifyLoginEmailMockHandler200({
          next: "first-time-code",
          codeDelivery,
        }),
      );
      const { user } = renderApp("/login");

      await continueWith(user, "suda@example.com");

      expect(await screen.findByLabelText("First-time code")).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(/no new code was sent/i);
      expect(screen.getByRole("button", { name: "Resend code" })).toBeEnabled();
    },
  );

  it("maps a throttled email check to its message from the published error list", async () => {
    server.use(
      getIdentifyLoginEmailMockHandler429({
        type: "login-check-limited",
        status: 429,
        title: "Too Many Requests",
      }),
    );
    const { user } = renderApp("/login");

    await continueWith(user, owner.email);

    expect(await screen.findByRole("alert")).toHaveTextContent(/too many/i);
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("maps email-auth-unavailable from the email check to its message", async () => {
    server.use(
      getIdentifyLoginEmailMockHandler503({
        type: "email-auth-unavailable",
        status: 503,
        title: "Service Unavailable",
      }),
    );
    const { user } = renderApp("/login");

    await continueWith(user, "suda@example.com");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^Password setup and recovery are unavailable\. Try again later\.$/,
    );
  });

  it("shows a general message, not the server's text, when the API fails", async () => {
    mockApi.password = password;
    server.use(getCreateSessionMockHandler500(serverFailure));
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
    mockApi.password = password;
    const { user } = renderApp("/login");

    await screen.findByText("Your session has ended. Log in again.");
    await logIn(user, owner.email, "wrong-password");

    expect(await screen.findByText("Email or password is incorrect.")).toBeInTheDocument();
    expect(screen.queryByText("Your session has ended. Log in again.")).not.toBeInTheDocument();
  });

  it("still works when the check for a session fails", async () => {
    server.use(getGetCurrentUserMockHandler500(serverFailure));
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

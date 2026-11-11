import { screen, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";

import {
  getVerifyFirstTimeCodeMockHandler200,
  getSetEmailPasswordMockHandler204,
  getVerifyFirstTimeCodeMockHandler410,
  getVerifyFirstTimeCodeMockHandler503,
  getVerifyFirstTimeCodeMockHandler422,
  getSetEmailPasswordMockHandler410,
  getSetEmailPasswordMockHandler503,
  getRequestFirstTimeCodeMockHandler202,
} from "@/api/generated/email-access/email-access.msw";
import { renderApp } from "@/test/render-app";
import { server } from "@/test/server";

it("verifies a leading-zero code and sets a password without logging in", async () => {
  const sent: unknown[] = [];
  server.use(
    getVerifyFirstTimeCodeMockHandler200(async ({ request }) => {
      sent.push(await request.json());
      return { token: "private-grant", expiresAt: new Date(Date.now() + 600_000).toISOString() };
    }),
    getSetEmailPasswordMockHandler204(async ({ request }) => {
      sent.push(await request.json());
    }),
  );
  const { user, router } = renderApp("/password-setup");
  await user.type(await screen.findByLabelText("Email"), "staff@example.com");
  await user.type(screen.getByLabelText("First-time code"), "001234");
  await user.click(screen.getByRole("button", { name: "Verify code" }));
  await user.type(await screen.findByLabelText("New password"), "new-password");
  expect(router.state.location.href).not.toContain("private-grant");
  await user.click(screen.getByRole("button", { name: "Set password" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  expect(sent).toEqual([
    { email: "staff@example.com", code: "001234" },
    { token: "private-grant", password: "new-password" },
  ]);
});

async function enterCode() {
  const app = renderApp("/password-setup");
  await app.user.type(await screen.findByLabelText("Email"), "staff@example.com");
  await app.user.type(screen.getByLabelText("First-time code"), "001234");
  await app.user.click(screen.getByRole("button", { name: "Verify code" }));
  return app;
}

it("sends no instructions on load and permits explicit requests with a cooldown", async () => {
  const sent: unknown[] = [];
  server.use(
    getRequestFirstTimeCodeMockHandler202(async ({ request }) => {
      sent.push(await request.json());
      return { message: "If this email is eligible, we've sent instructions." };
    }),
  );
  const { user } = renderApp("/password-setup");
  await user.type(await screen.findByLabelText("Email"), "STAFF@example.com");
  expect(sent).toEqual([]);
  await user.click(screen.getByRole("button", { name: "Send instructions" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "If this email is eligible, we've sent instructions.",
  );
  expect(screen.getByRole("button", { name: "Send instructions" })).toBeDisabled();
  expect(sent).toEqual([{ email: "STAFF@example.com" }]);
});

it.each(["wrong", "expired", "used", "replaced", "blocked", "ineligible"])(
  "shows the same recovery action for a %s code",
  async () => {
    server.use(
      getVerifyFirstTimeCodeMockHandler410({
        status: 410,
        type: "first-time-code-invalid",
        title: "private reason",
      }),
    );
    const { user } = await enterCode();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This code can't be used. Check the code or request fresh instructions.",
    );
    expect(screen.queryByText("private reason")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("staff@example.com");
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText("First-time code"));
    server.use(
      getVerifyFirstTimeCodeMockHandler200({
        token: "fresh-grant",
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
      }),
    );
    await user.type(screen.getByLabelText("First-time code"), "000002");
    await user.click(screen.getByRole("button", { name: "Verify code" }));
    expect(await screen.findByLabelText("New password")).toBeInTheDocument();
  },
);

it("keeps email and code when email service is unavailable", async () => {
  server.use(getVerifyFirstTimeCodeMockHandler503({ status: 503, type: "email-auth-unavailable" }));
  await enterCode();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Password setup and recovery are unavailable. Try again later.",
  );
  expect(screen.getByLabelText("Email")).toHaveValue("staff@example.com");
  expect(screen.getByLabelText("First-time code")).toHaveValue("001234");
});

it("maps invalid code validation beside the code field", async () => {
  server.use(
    getVerifyFirstTimeCodeMockHandler422({ status: 422, errors: [{ location: "body.code" }] }),
  );
  await enterCode();
  expect(await screen.findByText("Enter the six-digit code from your email.")).toBeInTheDocument();
  expect(screen.getByLabelText("First-time code")).toHaveAttribute("aria-invalid", "true");
});

it("offers fresh setup when the verified grant expires and retains no grant after leaving", async () => {
  server.use(
    getVerifyFirstTimeCodeMockHandler200({
      token: "expired-grant",
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    }),
    getSetEmailPasswordMockHandler410({ status: 410, type: "password-setup-invalid" }),
  );
  const { user, router } = await enterCode();
  await user.type(await screen.findByLabelText("New password"), "new-password");
  await user.click(screen.getByRole("button", { name: "Set password" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "This password setup has expired or can't be used.",
  );
  expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Start password setup again" }));
  expect(await screen.findByLabelText("First-time code")).toHaveValue("");
  expect(router.state.location.href).toBe("/password-setup");
  await user.click(screen.getByRole("link", { name: "Back to Log in" }));
  await screen.findByRole("heading", { name: "Log in" });
  await user.click(screen.getByRole("link", { name: "Set up your password" }));
  expect(await screen.findByLabelText("First-time code")).toHaveValue("");
  expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
});

it("keeps the chosen password and grant after a service failure", async () => {
  server.use(
    getVerifyFirstTimeCodeMockHandler200({
      token: "valid-grant",
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    }),
    getSetEmailPasswordMockHandler503({ status: 503, type: "email-auth-unavailable" }),
  );
  const { user } = await enterCode();
  await user.type(await screen.findByLabelText("New password"), "new-password");
  await user.click(screen.getByRole("button", { name: "Set password" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Password setup and recovery are unavailable.",
  );
  expect(screen.getByLabelText("New password")).toHaveValue("new-password");
});

import { act, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

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

const neutral = { message: "If this email is eligible, we've sent instructions." };
const grant = (token: string) => ({
  token,
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
});

afterEach(() => vi.useRealTimers());

// users-and-access R29, R43: the code step is reached only by an explicit request.
async function requestCode(email = "staff@example.com") {
  const app = renderApp("/password-setup");
  await app.user.type(await screen.findByLabelText("Email"), email);
  await app.user.click(screen.getByRole("button", { name: "Send code" }));
  await screen.findByLabelText("First-time code");
  return app;
}

async function enterCode(code = "001234") {
  const app = await requestCode();
  await app.user.type(screen.getByLabelText("First-time code"), code);
  return app;
}

// users-and-access R27, R42, R54, R30
it("verifies a leading-zero code as soon as it is complete and sets a password without logging in", async () => {
  const sent: unknown[] = [];
  server.use(
    getRequestFirstTimeCodeMockHandler202(async ({ request }) => {
      sent.push(await request.json());
      return neutral;
    }),
    getVerifyFirstTimeCodeMockHandler200(async ({ request }) => {
      sent.push(await request.json());
      return grant("private-grant");
    }),
    getSetEmailPasswordMockHandler204(async ({ request }) => {
      sent.push(await request.json());
    }),
  );
  const { user, router } = await enterCode("001234");
  await user.type(await screen.findByLabelText("New password"), "new-password");
  expect(screen.queryByRole("button", { name: /verify/i })).not.toBeInTheDocument();
  expect(router.state.location.href).not.toContain("private-grant");
  await user.click(screen.getByRole("button", { name: "Set password" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  expect(sent).toEqual([
    { email: "staff@example.com" },
    { email: "staff@example.com", code: "001234" },
    { token: "private-grant", password: "new-password" },
  ]);
});

// users-and-access R54: nothing is verified until the sixth digit.
it("does not verify an incomplete code", async () => {
  const verified: unknown[] = [];
  server.use(
    getVerifyFirstTimeCodeMockHandler200(async ({ request }) => {
      verified.push(await request.json());
      return grant("grant");
    }),
  );
  const { user } = await enterCode("00123");
  expect(verified).toEqual([]);
  await user.type(screen.getByLabelText("First-time code"), "4");
  await screen.findByLabelText("New password");
  expect(verified).toEqual([{ email: "staff@example.com", code: "001234" }]);
});

it("sends a complete code once and locks the boxes while it is checked", async () => {
  const verified: unknown[] = [];
  let answer!: () => void;
  server.use(
    getVerifyFirstTimeCodeMockHandler200(async ({ request }) => {
      verified.push(await request.json());
      await new Promise<void>((resolve) => (answer = resolve));
      return grant("grant");
    }),
  );
  const { user } = await enterCode("001234");
  const code = screen.getByLabelText("First-time code");
  await waitFor(() => expect(code).toBeDisabled());
  expect(screen.getByRole("button", { name: "Resend code" })).toBeDisabled();
  await user.keyboard("{Backspace}4");
  expect(verified).toHaveLength(1);
  answer();
  await screen.findByLabelText("New password");
  expect(verified).toHaveLength(1);
});

it("fills every box from a pasted code", async () => {
  const verified: unknown[] = [];
  server.use(
    getVerifyFirstTimeCodeMockHandler200(async ({ request }) => {
      verified.push(await request.json());
      return grant("grant");
    }),
  );
  const { user } = await requestCode();
  await user.click(screen.getByLabelText("First-time code"));
  await user.paste("012345");
  await screen.findByLabelText("New password");
  expect(verified).toEqual([{ email: "staff@example.com", code: "012345" }]);
});

it("keeps email and code on separate steps and lets the person change the email", async () => {
  const { user } = renderApp("/password-setup");
  await screen.findByLabelText("Email");
  expect(screen.queryByLabelText("First-time code")).not.toBeInTheDocument();
  await user.type(screen.getByLabelText("Email"), "staff@example.com");
  await user.click(screen.getByRole("button", { name: "Send code" }));
  const code = await screen.findByLabelText("First-time code");
  expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  expect(code).toHaveAttribute("autocomplete", "one-time-code");
  expect(code).toHaveAttribute("inputmode", "numeric");
  expect(screen.getByRole("status")).toHaveTextContent("staff@example.com");
  await user.click(screen.getByRole("button", { name: "Change email" }));
  expect(await screen.findByLabelText("Email")).toHaveValue("staff@example.com");
  expect(screen.queryByLabelText("First-time code")).not.toBeInTheDocument();
});

// users-and-access R43, R44
it("sends no code on load and allows a resend only after 60 seconds, with a neutral message", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const sent: unknown[] = [];
  server.use(
    getRequestFirstTimeCodeMockHandler202(async ({ request }) => {
      sent.push(await request.json());
      return neutral;
    }),
  );
  const { user } = renderApp("/password-setup");
  await user.type(await screen.findByLabelText("Email"), "STAFF@example.com");
  expect(sent).toEqual([]);
  await user.click(screen.getByRole("button", { name: "Send code" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "If STAFF@example.com is eligible, we've sent it a six-digit code.",
  );
  const resend = screen.getByRole("button", { name: "Resend code" });
  expect(resend).toBeDisabled();
  await act(async () => vi.advanceTimersByTimeAsync(59_000));
  expect(resend).toBeDisabled();
  await act(async () => vi.advanceTimersByTimeAsync(1_000));
  await waitFor(() => expect(resend).toBeEnabled());
  await user.click(resend);
  await waitFor(() => expect(sent).toHaveLength(2));
  expect(sent).toEqual([{ email: "STAFF@example.com" }, { email: "STAFF@example.com" }]);
  await waitFor(() => expect(screen.getByRole("button", { name: "Resend code" })).toBeDisabled());
});

it.each(["wrong", "expired", "used", "replaced", "blocked", "ineligible"])(
  "shows the same message for a %s code, clears the boxes and refocuses them",
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
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    const code = screen.getByLabelText("First-time code");
    expect(code).toHaveValue("");
    await waitFor(() => expect(code).toHaveFocus());
    server.use(getVerifyFirstTimeCodeMockHandler200(grant("fresh-grant")));
    await user.keyboard("000002");
    expect(await screen.findByLabelText("New password")).toBeInTheDocument();
  },
);

it("explains when email service is unavailable and lets the person retry", async () => {
  server.use(getVerifyFirstTimeCodeMockHandler503({ status: 503, type: "email-auth-unavailable" }));
  await enterCode();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Password setup and recovery are unavailable. Try again later.",
  );
  expect(screen.getByRole("status")).toHaveTextContent("staff@example.com");
  await waitFor(() => expect(screen.getByLabelText("First-time code")).toHaveFocus());
});

it("maps invalid code validation beside the code", async () => {
  server.use(
    getVerifyFirstTimeCodeMockHandler422({ status: 422, errors: [{ location: "body.code" }] }),
  );
  await enterCode();
  expect(await screen.findByText("Enter the six-digit code from your email.")).toBeInTheDocument();
  expect(screen.getByLabelText("First-time code")).toHaveAttribute("aria-invalid", "true");
});

it("offers fresh setup when the verified grant expires and retains no grant after leaving", async () => {
  server.use(
    getVerifyFirstTimeCodeMockHandler200(grant("expired-grant")),
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
  expect(await screen.findByLabelText("Email")).toHaveValue("staff@example.com");
  expect(router.state.location.href).toBe("/password-setup");
  await user.click(screen.getByRole("link", { name: "Back to Log in" }));
  await screen.findByRole("heading", { name: "Log in" });
  await user.click(screen.getByRole("link", { name: "Set up your password" }));
  expect(await screen.findByLabelText("Email")).toHaveValue("");
  expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
});

it("keeps the chosen password and grant after a service failure", async () => {
  server.use(
    getVerifyFirstTimeCodeMockHandler200(grant("valid-grant")),
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

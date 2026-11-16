import { screen, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";

import {
  getResetEmailPasswordMockHandler204,
  getResetEmailPasswordMockHandler410,
  getResetEmailPasswordMockHandler503,
  getResetEmailPasswordMockHandler422,
} from "@/api/generated/email-access/email-access.msw";
import { mockApi } from "@/mocks/handlers";
import { renderApp } from "@/test/render-app";
import { server } from "@/test/server";

it("captures a reset fragment, replaces history, and saves only on explicit submission", async () => {
  const sent: unknown[] = [];
  server.use(
    getResetEmailPasswordMockHandler204(async ({ request }) => {
      sent.push(await request.json());
      mockApi.session = "none";
    }),
  );
  const { user, router } = renderApp("/reset-password#token=private-reset");
  await screen.findByLabelText("New password");
  await waitFor(() => expect(router.state.location.hash).toBe(""));
  expect(sent).toEqual([]);
  await user.type(screen.getByLabelText("New password"), "new-password");
  await user.click(screen.getByRole("button", { name: "Set password" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  expect(sent).toEqual([{ token: "private-reset", password: "new-password" }]);
});

it.each(["", "#other=bad", "#token=", "#token=a&token=b"])(
  "offers recovery without submitting a missing or malformed fragment %s",
  async (hash) => {
    const sent: unknown[] = [];
    server.use(
      getResetEmailPasswordMockHandler204(async ({ request }) => {
        sent.push(await request.json());
      }),
    );
    renderApp(`/reset-password${hash}`);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This Reset link has expired or can't be used.",
    );
    expect(screen.getByRole("link", { name: "Forgot password" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
    expect(sent).toEqual([]);
  },
);

it.each(["expired", "used", "replaced", "ineligible"])(
  "offers another request for a %s Reset link",
  async () => {
    server.use(
      getResetEmailPasswordMockHandler410({
        status: 410,
        type: "password-reset-invalid",
        detail: "private",
      }),
    );
    const { user } = renderApp("/reset-password#token=invalid");
    await user.type(await screen.findByLabelText("New password"), "new-password");
    await user.click(screen.getByRole("button", { name: "Set password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This Reset link has expired or can't be used.",
    );
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    expect(screen.queryByText("private")).not.toBeInTheDocument();
  },
);

it("clears an already cached authenticated User on reset success", async () => {
  mockApi.session = "live";
  const { user, router } = renderApp("/dashboard");
  await screen.findByRole("heading", { name: "Dashboard" });
  server.use(
    getResetEmailPasswordMockHandler204(() => {
      mockApi.session = "ended";
    }),
  );
  await router.navigate({ to: "/reset-password", hash: "token=reset" });
  await user.type(await screen.findByLabelText("New password"), "new-password");
  await user.click(screen.getByRole("button", { name: "Set password" }));
  expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
});

it.each(["12345", "😀😀😀😀😀"])("rejects fewer than six characters: %s", async (password) => {
  const sent: unknown[] = [];
  server.use(
    getResetEmailPasswordMockHandler204(async ({ request }) => {
      sent.push(await request.json());
    }),
  );
  const { user } = renderApp("/reset-password#token=valid");
  await user.type(await screen.findByLabelText("New password"), password);
  await user.click(screen.getByRole("button", { name: "Set password" }));
  expect(await screen.findByText("Use at least 6 characters.")).toBeInTheDocument();
  expect(sent).toEqual([]);
});

it("accepts six Unicode characters and keeps the form on service failure", async () => {
  let sent: unknown;
  server.use(
    getResetEmailPasswordMockHandler503(async ({ request }) => {
      sent = await request.json();
      return { status: 503, type: "email-auth-unavailable" };
    }),
  );
  const { user } = renderApp("/reset-password#token=valid");
  await user.type(await screen.findByLabelText("New password"), "😀😀😀😀😀😀");
  await user.click(screen.getByRole("button", { name: "Set password" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Password setup and recovery are unavailable.",
  );
  expect(screen.getByLabelText("New password")).toHaveValue("😀😀😀😀😀😀");
  expect(sent).toEqual({ token: "valid", password: "😀😀😀😀😀😀" });
});

it("maps API password validation beside the field", async () => {
  server.use(
    getResetEmailPasswordMockHandler422({ status: 422, errors: [{ location: "body.password" }] }),
  );
  const { user } = renderApp("/reset-password#token=valid");
  await user.type(await screen.findByLabelText("New password"), "new-password");
  await user.click(screen.getByRole("button", { name: "Set password" }));
  expect(await screen.findByText("Use at least 6 characters.")).toBeInTheDocument();
  expect(screen.getByLabelText("New password")).toHaveAttribute("aria-invalid", "true");
});

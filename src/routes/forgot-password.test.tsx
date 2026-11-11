import { screen } from "@testing-library/react";
import { expect, it } from "vitest";

import {
  getRequestPasswordResetMockHandler202,
  getRequestPasswordResetMockHandler503,
  getRequestPasswordResetMockHandler422,
  getRequestPasswordResetMockHandler500,
} from "@/api/generated/email-access/email-access.msw";
import { renderApp } from "@/test/render-app";
import { server } from "@/test/server";

it("requests recovery only on submit and shows an eligibility-neutral result", async () => {
  const sent: unknown[] = [];
  server.use(
    getRequestPasswordResetMockHandler202(async ({ request }) => {
      sent.push(await request.json());
      return { message: "If this email is eligible, we've sent instructions." };
    }),
  );
  const { user } = renderApp("/forgot-password");
  await screen.findByLabelText("Email");
  expect(sent).toEqual([]);
  await user.type(screen.getByLabelText("Email"), "NOK@example.com");
  await user.click(screen.getByRole("button", { name: "Send instructions" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "If this email is eligible, we've sent instructions.",
  );
  expect(sent).toEqual([{ email: "NOK@example.com" }]);
});

it.each([
  "unknown",
  "inactive",
  "limited",
  "delivery failed",
  "unfinished User",
  "installed Owner",
  "initial Owner",
])("shows identical public success for %s", async () => {
  server.use(
    getRequestPasswordResetMockHandler202({
      message: "If this email is eligible, we've sent instructions.",
    }),
  );
  const { user } = renderApp("/forgot-password");
  await user.type(await screen.findByLabelText("Email"), "person@example.com");
  await user.click(screen.getByRole("button", { name: "Send instructions" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "If this email is eligible, we've sent instructions.",
  );
  expect(screen.getByRole("button", { name: "Send instructions" })).toBeDisabled();
});

it.each([
  [
    getRequestPasswordResetMockHandler503({
      status: 503,
      type: "email-auth-unavailable",
      detail: "private",
    }),
    "Password setup and recovery are unavailable. Try again later.",
  ],
  [
    getRequestPasswordResetMockHandler500({ status: 500, detail: "private" }),
    "Something went wrong. Try again.",
  ],
] as const)("preserves the form on service failure %#", async (handler, message) => {
  server.use(handler);
  const { user } = renderApp("/forgot-password");
  await user.type(await screen.findByLabelText("Email"), "person@example.com");
  await user.click(screen.getByRole("button", { name: "Send instructions" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(message);
  expect(screen.getByLabelText("Email")).toHaveValue("person@example.com");
  expect(screen.queryByText("private")).not.toBeInTheDocument();
});

it("shows API email validation beside the field", async () => {
  server.use(
    getRequestPasswordResetMockHandler422({ status: 422, errors: [{ location: "body.email" }] }),
  );
  const { user } = renderApp("/forgot-password");
  await user.click(await screen.findByRole("button", { name: "Send instructions" }));
  expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
  expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
});

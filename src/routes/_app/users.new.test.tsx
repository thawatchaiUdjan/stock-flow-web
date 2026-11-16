import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  getCreateEmailUserMockHandler201,
  getCreateEmailUserMockHandler422,
  getCreateEmailUserMockHandler500,
} from "@/api/generated/email-access/email-access.msw";
import type { CreateUserBody } from "@/api/generated/model";
import { mockApi, serverFailure } from "@/mocks/handlers";
import { renderApp } from "@/test/render-app";
import { server } from "@/test/server";

async function fillIn(
  user: ReturnType<typeof renderApp>["user"],
  { name, email, role }: { name: string; email: string; role?: "Admin" | "Staff" },
) {
  await user.type(await screen.findByLabelText("Name"), name);
  await user.type(screen.getByLabelText("Email"), email);
  if (role) await user.click(screen.getByRole("radio", { name: role }));
}

// What the API received, as the screen sent it.
function recordCreateRequests() {
  const sent: CreateUserBody[] = [];
  server.use(
    getCreateEmailUserMockHandler201(async ({ request }) => {
      sent.push(await request.clone().json());
      return {
        user: {
          id: 2,
          name: "x",
          email: "x@example.com",
          role: "staff",
          status: "active",
          passwordSet: false,
        },
        emailDelivery: "sent",
      };
    }),
  );
  return sent;
}

describe("the User form", () => {
  it("takes a name, an email and a Role, and offers only Admin and Staff", async () => {
    mockApi.session = "live";
    renderApp("/users/new");

    expect(await screen.findByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    // users-and-access R9, R10: no second Owner can be created.
    expect(screen.getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual([
      "admin",
      "staff",
    ]);
    expect(screen.getByRole("radio", { name: "Admin" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Staff" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Owner" })).not.toBeInTheDocument();
  });

  it("sends the name, email and Role the Owner chose", async () => {
    mockApi.session = "live";
    const sent = recordCreateRequests();
    const { user } = renderApp("/users/new");

    await fillIn(user, { name: "สมชาย ใจดี", email: "somchai@example.com", role: "Staff" });
    await user.click(screen.getByRole("button", { name: "Create User" }));

    await screen.findByRole("heading", { name: "User created" });
    expect(sent).toEqual([{ name: "สมชาย ใจดี", email: "somchai@example.com", role: "staff" }]);
  });

  it("sends the name and email without the spaces around them", async () => {
    mockApi.session = "live";
    const sent = recordCreateRequests();
    const { user } = renderApp("/users/new");

    await fillIn(user, { name: "  Mali Chai ", email: " mali@example.com ", role: "Admin" });
    await user.click(screen.getByRole("button", { name: "Create User" }));

    await screen.findByRole("heading", { name: "User created" });
    expect(sent).toEqual([{ name: "Mali Chai", email: "mali@example.com", role: "admin" }]);
  });

  // users-and-access R14
  it("asks for what is missing beside each field, and sends nothing", async () => {
    mockApi.session = "live";
    const sent = recordCreateRequests();
    const { user } = renderApp("/users/new");

    await screen.findByLabelText("Name");
    await user.click(screen.getByRole("button", { name: "Create User" }));

    expect(await screen.findByText("Enter a name.")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInvalid();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInvalid();
    expect(screen.getByText("Choose a Role.")).toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  it("does not take a name made of spaces", async () => {
    mockApi.session = "live";
    const sent = recordCreateRequests();
    const { user } = renderApp("/users/new");

    await fillIn(user, { name: "   ", email: "mali@example.com", role: "Admin" });
    await user.click(screen.getByRole("button", { name: "Create User" }));

    expect(await screen.findByText("Enter a name.")).toBeInTheDocument();
    expect(sent).toEqual([]);
  });

  // users-and-access R3
  it("shows an email already in use beside the email field, and keeps the form", async () => {
    mockApi.session = "live";
    const { user } = renderApp("/users/new");

    // The Owner's email in another letter case: R3 compares without regard to it.
    await fillIn(user, { name: "Another Nok", email: "NOK@example.com", role: "Staff" });
    await user.click(screen.getByRole("button", { name: "Create User" }));

    await screen.findByText("A User with this email already exists.");
    expect(screen.getByLabelText("Email")).toBeInvalid();
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(
      "A User with this email already exists.",
    );
    expect(screen.getByLabelText("Name")).toHaveValue("Another Nok");
    expect(screen.getByRole("radio", { name: "Staff" })).toBeChecked();
    expect(screen.queryByRole("heading", { name: "User created" })).not.toBeInTheDocument();
    expect(mockApi.users).toHaveLength(1);
  });

  it("clears the email message when the Owner changes the email", async () => {
    mockApi.session = "live";
    const { user } = renderApp("/users/new");

    await fillIn(user, { name: "Another Nok", email: "nok@example.com", role: "Staff" });
    await user.click(screen.getByRole("button", { name: "Create User" }));
    await screen.findByText("A User with this email already exists.");

    await user.type(screen.getByLabelText("Email"), "x");

    expect(screen.queryByText("A User with this email already exists.")).not.toBeInTheDocument();
  });

  it("puts a field the API refuses beside that field", async () => {
    mockApi.session = "live";
    server.use(
      getCreateEmailUserMockHandler422({
        status: 422,
        title: "Unprocessable Entity",
        errors: [{ location: "body.email", message: "expected string to be RFC 5322 email" }],
      }),
    );
    const { user } = renderApp("/users/new");

    await fillIn(user, { name: "Mali Chai", email: "mali@example.com", role: "Admin" });
    await user.click(screen.getByRole("button", { name: "Create User" }));

    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInvalid();
  });

  it("says so when the API fails, and keeps the form", async () => {
    mockApi.session = "live";
    server.use(getCreateEmailUserMockHandler500(serverFailure));
    const { user } = renderApp("/users/new");

    await fillIn(user, { name: "Mali Chai", email: "mali@example.com", role: "Admin" });
    await user.click(screen.getByRole("button", { name: "Create User" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^Something went wrong\. Try again\.$/,
    );
    expect(screen.getByLabelText("Name")).toHaveValue("Mali Chai");
  });

  // users-and-access R28, R46 replace legacy Setup-link disclosure assertions.
  it.each(["sent", "failed", "suppressed"] as const)(
    "reports creation separately from %s delivery",
    async (emailDelivery) => {
      mockApi.session = "live";
      let creates = 0;
      server.use(
        getCreateEmailUserMockHandler201(async ({ request }) => {
          creates++;
          const body = await request.json();
          const created = { id: 2, ...body, status: "active" as const, passwordSet: false };
          mockApi.users.push(created);
          return { user: created, emailDelivery };
        }),
      );
      const { user } = renderApp("/users/new");
      await fillIn(user, { name: "Mali Chai", email: "mali@example.com", role: "Admin" });
      await user.click(screen.getByRole("button", { name: "Create User" }));
      await screen.findByRole("heading", { name: "User created" });
      expect(screen.getByText("Mali Chai")).toBeInTheDocument();
      expect(
        screen.getByText(
          emailDelivery === "sent"
            ? "The email provider accepted the instructions. Check the inbox and spam folder."
            : emailDelivery === "failed"
              ? "The User was created, but the email could not be sent."
              : "The User was created, but the email was not sent because of sending limits.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/request instructions through Set up your password on Log in/),
      ).toBeInTheDocument();
      expect(screen.queryByLabelText("Setup link")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Copy link" })).not.toBeInTheDocument();
      expect(creates).toBe(1);
      await user.click(screen.getByRole("link", { name: "Back to Users" }));
      const table = await screen.findByRole("table");
      await waitFor(() => expect(within(table).getAllByRole("row")).toHaveLength(3));
      expect(within(table).getByText("Password not set")).toBeInTheDocument();
    },
  );
});

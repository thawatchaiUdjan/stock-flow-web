import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CreateUserBody } from "@/api/generated/model";
import {
  getCreateUserMockHandler201,
  getCreateUserMockHandler422,
  getCreateUserMockHandler500,
} from "@/api/generated/users/users.msw";
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
    getCreateUserMockHandler201(async ({ request }) => {
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
        setupLink: {
          token: "recorded-token",
          expiresAt: new Date(2026, 10, 7, 14, 12).toISOString(),
        },
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
      getCreateUserMockHandler422({
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
    server.use(getCreateUserMockHandler500(serverFailure));
    const { user } = renderApp("/users/new");

    await fillIn(user, { name: "Mali Chai", email: "mali@example.com", role: "Admin" });
    await user.click(screen.getByRole("button", { name: "Create User" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^Something went wrong\. Try again\.$/,
    );
    expect(screen.getByLabelText("Name")).toHaveValue("Mali Chai");
  });

  describe("the Setup link", () => {
    async function createMali() {
      mockApi.session = "live";
      server.use(
        getCreateUserMockHandler201(() => {
          const user = {
            id: 2,
            name: "Mali Chai",
            email: "mali@example.com",
            role: "admin",
            status: "active",
            passwordSet: false,
          } as const;
          mockApi.users.push(user);
          return {
            user,
            setupLink: {
              token: "token-for-mali",
              expiresAt: new Date(2026, 10, 7, 14, 12).toISOString(),
            },
          };
        }),
      );
      const app = renderApp("/users/new");
      await fillIn(app.user, { name: "Mali Chai", email: "mali@example.com", role: "Admin" });
      await app.user.click(screen.getByRole("button", { name: "Create User" }));
      await screen.findByRole("heading", { name: "User created" });
      return app;
    }

    // users-and-access R28; stock-flow-web ADR 0022; the api returns only a token.
    it("is built from the web app's own origin, with the token in the fragment", async () => {
      await createMali();

      expect(screen.getByLabelText("Setup link")).toHaveValue(
        `${window.location.origin}/set-password#token-for-mali`,
      );
    });

    // users-and-access R27
    it("shows when it expires", async () => {
      await createMali();

      expect(screen.getByText(/Expires 7 Nov, 14:12/)).toBeInTheDocument();
    });

    it("says whose it is and that it won't be shown again", async () => {
      await createMali();

      expect(screen.getByText(/Mali Chai/)).toBeInTheDocument();
      expect(screen.getByText(/won't be shown again/)).toBeInTheDocument();
    });

    it("can be copied", async () => {
      const { user } = await createMali();

      await user.click(screen.getByRole("button", { name: "Copy link" }));

      expect(await navigator.clipboard.readText()).toBe(
        `${window.location.origin}/set-password#token-for-mali`,
      );
      expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
    });

    it("keeps the token out of the address", async () => {
      const { router } = await createMali();

      expect(router.state.location.href).not.toContain("token-for-mali");
      expect(router.state.location.pathname).toBe("/users/new");
    });

    // users-and-access R28: once.
    it("is lost on leaving the view: coming back shows an empty form", async () => {
      const { user, router } = await createMali();

      await user.click(screen.getByRole("link", { name: "Back to Users" }));
      expect(await screen.findByRole("heading", { name: "Users" })).toBeInTheDocument();
      expect(screen.queryByLabelText("Setup link")).not.toBeInTheDocument();

      router.history.back();

      expect(await screen.findByRole("heading", { name: "Create User" })).toBeInTheDocument();
      expect(screen.getByLabelText("Name")).toHaveValue("");
      expect(screen.queryByLabelText("Setup link")).not.toBeInTheDocument();
      expect(screen.queryByText(/token-for-mali/)).not.toBeInTheDocument();
    });

    it("lists the new User, with no password yet, when the Owner goes back to the list", async () => {
      const { user } = await createMali();

      await user.click(screen.getByRole("link", { name: "Back to Users" }));

      const table = await screen.findByRole("table");
      await waitFor(() => expect(within(table).getAllByRole("row")).toHaveLength(3));
      const rows = within(table).getAllByRole("row");
      expect(rows[2]).toHaveTextContent("Mali Chai");
      expect(within(rows[2]!).getByText("Password not set")).toBeInTheDocument();
    });

    it("lets the Owner create another User from a fresh form", async () => {
      const { user } = await createMali();

      await user.click(screen.getByRole("button", { name: "Create another User" }));

      expect(await screen.findByRole("heading", { name: "Create User" })).toBeInTheDocument();
      expect(screen.getByLabelText("Name")).toHaveValue("");
      expect(screen.queryByLabelText("Setup link")).not.toBeInTheDocument();
    });
  });
});

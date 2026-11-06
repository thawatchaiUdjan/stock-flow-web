import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { UpdateUserBody, User } from "@/api/generated/model";
import { getUpdateUserMockHandler500 } from "@/api/generated/users/users.msw";
import { mockApi, serverFailure } from "@/mocks/handlers";
import { renderApp } from "@/test/render-app";
import { server } from "@/test/server";

const mali: User = {
  id: 2,
  name: "Mali Chai",
  email: "Mali.Chai@Example.com",
  role: "admin",
  status: "active",
  passwordSet: true,
};

// What the API received from the screen, as it sent it.
function recordUpdates() {
  const sent: Promise<{ path: string; body: UpdateUserBody }>[] = [];
  server.events.on("request:start", ({ request }) => {
    if (request.method !== "PATCH") return;
    const { url } = request;
    sent.push(
      request
        .clone()
        .json()
        .then((body: UpdateUserBody) => ({ path: new URL(url).pathname, body })),
    );
  });
  return () => Promise.all(sent);
}

async function open(target: User = mali) {
  mockApi.session = "live";
  mockApi.users.push(target);
  const updates = recordUpdates();
  const view = renderApp(`/users/${target.id}/edit`);
  await screen.findByLabelText("Name");
  return { ...view, updates };
}

describe("the User form, editing", () => {
  it("shows the User's name and Role, and offers only Admin and Staff", async () => {
    await open();

    expect(screen.getByLabelText("Name")).toHaveValue("Mali Chai");
    expect(screen.getByRole("radio", { name: "Admin" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Staff" })).not.toBeChecked();
    // users-and-access R9, R10: nobody becomes an Owner here.
    expect(screen.getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual([
      "admin",
      "staff",
    ]);
  });

  // users-and-access R15
  it("shows the email as read-only, and a typed character does not change it", async () => {
    const { user } = await open();
    const email = screen.getByLabelText("Email");

    await user.type(email, "x");

    expect(email).toHaveValue("Mali.Chai@Example.com");
    expect(email).toHaveAttribute("readonly");
  });

  // users-and-access R35
  it("sends the new name and Role, then returns to the list showing them", async () => {
    const { user, updates, router } = await open();

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "สมศรี ใจดี");
    await user.click(screen.getByRole("radio", { name: "Staff" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("heading", { name: "Users" })).toBeInTheDocument();
    expect(await updates()).toEqual([
      { path: "/api/users/2", body: { name: "สมศรี ใจดี", role: "staff" } },
    ]);
    expect(router.state.location.pathname).toBe("/users");
    const row = within(await screen.findByRole("table"))
      .getAllByRole("row")
      .find((one) => one.textContent?.includes("สมศรี ใจดี"));
    expect(row).toBeDefined();
    expect(within(row!).getByRole("cell", { name: "Staff" })).toBeInTheDocument();
  });

  it("sends only what changed", async () => {
    const { user, updates } = await open();

    await user.click(screen.getByRole("radio", { name: "Staff" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await screen.findByRole("heading", { name: "Users" });
    expect(await updates()).toEqual([{ path: "/api/users/2", body: { role: "staff" } }]);
  });

  it("sends the name without the spaces around it", async () => {
    const { user, updates } = await open();

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "  Mali C. ");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await screen.findByRole("heading", { name: "Users" });
    expect(await updates()).toEqual([{ path: "/api/users/2", body: { name: "Mali C." } }]);
  });

  it("sends nothing when nothing changed, and returns to the list", async () => {
    const { user, updates } = await open();

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("heading", { name: "Users" })).toBeInTheDocument();
    expect(await updates()).toEqual([]);
  });

  // users-and-access R14
  it("asks for a name beside the field, and sends nothing, when it is blank", async () => {
    const { user, updates } = await open();

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "   ");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Enter a name.")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInvalid();
    expect(await updates()).toEqual([]);
  });

  it("leaves without saving on Cancel", async () => {
    const { user, updates, router } = await open();

    await user.type(screen.getByLabelText("Name"), " changed");
    await user.click(screen.getByRole("link", { name: "Cancel" }));

    expect(await screen.findByRole("heading", { name: "Users" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/users");
    expect(await updates()).toEqual([]);
  });

  it("keeps the form and says so when the API fails", async () => {
    const { user } = await open();
    server.use(getUpdateUserMockHandler500(serverFailure));

    await user.click(screen.getByRole("radio", { name: "Staff" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Try again.");
    expect(screen.getByRole("radio", { name: "Staff" })).toBeChecked();
  });

  // users-and-access R18, context ADR 0004: also when the Owner's address is typed in.
  it("offers no form for the Owner", async () => {
    mockApi.session = "live";
    renderApp("/users/1/edit");

    expect(await screen.findByRole("heading", { name: "Edit User" })).toBeInTheDocument();
    expect(await screen.findByText("The Owner can't be changed here.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Users" })).toBeInTheDocument();
  });

  it("says so when no User has the address", async () => {
    mockApi.session = "live";
    renderApp("/users/99/edit");

    expect(await screen.findByRole("heading", { name: "Edit User" })).toBeInTheDocument();
    expect(await screen.findByText("No User has this address.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Users" })).toBeInTheDocument();
  });

  it("says so when the address is not a User's number", async () => {
    mockApi.session = "live";
    renderApp("/users/mali/edit");

    expect(await screen.findByText("No User has this address.")).toBeInTheDocument();
  });

  it("opens the form of an Inactive User too", async () => {
    await open({ ...mali, status: "inactive" });

    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue("Mali Chai"));
  });
});

import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  getReadSetupLinkMockHandler500,
  getSetPasswordMockHandler422,
  getSetPasswordMockHandler500,
} from "@/api/generated/setup-links/setup-links.msw";
import { mockApi, owner, setupToken } from "@/mocks/handlers";
import { renderApp } from "@/test/render-app";
import { server } from "@/test/server";

const setupLink = `/set-password#${setupToken}`;
const tooShort = "Use at least 6 characters.";
const noLongerWorks =
  "This Setup link has been used, has expired or was replaced. Ask the Owner for a new one.";
const failure = {
  status: 500,
  title: "Internal Server Error",
  detail: "something went wrong on our side",
};

function sentToTheApi() {
  const paths: string[] = [];
  server.events.on("request:start", ({ request }) => {
    paths.push(new URL(request.url).pathname);
  });
  return paths;
}

describe("Set password", () => {
  // users-and-access R27
  it("shows who the Setup link is for", async () => {
    renderApp(setupLink);

    expect(await screen.findByText(owner.name)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Set your password" })).toBeInTheDocument();
    expect(screen.getByText(owner.email)).toBeInTheDocument();
  });

  it("shows that it is checking the Setup link while it does", async () => {
    renderApp(setupLink);

    expect(await screen.findByText("Checking your Setup link")).toBeInTheDocument();
    await screen.findByText(owner.name);
    expect(screen.queryByText("Checking your Setup link")).not.toBeInTheDocument();
  });

  // users-and-access R19
  it("refuses fewer than 6 characters before anything is sent", async () => {
    const { user } = renderApp(setupLink);
    const password = await screen.findByLabelText("New password");
    const sent = sentToTheApi();

    await user.type(password, "12345");
    await user.click(screen.getByRole("button", { name: "Set password" }));

    expect(await screen.findByText(tooShort)).toBeInTheDocument();
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(sent).toEqual([]);
    expect(mockApi.password).toBeUndefined();
  });

  it("tells the person the minimum before they try", async () => {
    renderApp(setupLink);

    expect(await screen.findByText("At least 6 characters.")).toBeInTheDocument();
  });

  // users-and-access R19, R20, R30. Exactly 6: the client is never stricter than the rule.
  it("accepts 6 characters, sets the password and sends the person to Login", async () => {
    const { user, router } = renderApp(setupLink);

    await user.type(await screen.findByLabelText("New password"), "123456");
    await user.click(screen.getByRole("button", { name: "Set password" }));

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(mockApi.password).toBe("123456");
    expect(mockApi.session).toBe("none");
  });

  it("lets the person log in with the password they set", async () => {
    const { user } = renderApp(setupLink);

    await user.type(await screen.findByLabelText("New password"), "correct-horse");
    await user.click(screen.getByRole("button", { name: "Set password" }));
    await user.type(await screen.findByLabelText("Email"), owner.email);
    await user.type(screen.getByLabelText("Password"), "correct-horse");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  // ADR 0005. The client counts as the API does, so only a rule tightened there reaches this.
  it("shows the API's refusal of a password beside the field, in its own words", async () => {
    server.use(
      getSetPasswordMockHandler422({
        status: 422,
        title: "Unprocessable Entity",
        detail: "validation failed",
        errors: [{ location: "body.password", message: "expected length >= 6" }],
      }),
    );
    const { user } = renderApp(setupLink);
    const password = await screen.findByLabelText("New password");
    const sent = sentToTheApi();

    await user.type(password, "correct-horse");
    await user.click(screen.getByRole("button", { name: "Set password" }));

    expect(await screen.findByText(tooShort)).toBeInTheDocument();
    expect(sent).toEqual(["/api/setup-link/password"]);
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveAccessibleDescription(tooShort);
    expect(screen.queryByText(/expected length/)).not.toBeInTheDocument();
  });

  // users-and-access R27, R29
  it("says a used, expired or replaced link no longer works, and offers no form", async () => {
    mockApi.setupLinkUsed = true;
    renderApp(setupLink);

    expect(await screen.findByRole("alert")).toHaveTextContent(noLongerWorks);
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("says the same of a token the API doesn't know", async () => {
    renderApp("/set-password#not-a-real-token");

    expect(await screen.findByRole("alert")).toHaveTextContent(noLongerWorks);
  });

  it("says the same of a link with no token, without asking the API", async () => {
    const sent = sentToTheApi();
    renderApp("/set-password");

    expect(await screen.findByRole("alert")).toHaveTextContent(noLongerWorks);
    expect(sent).toEqual([]);
  });

  it("says so when the link stops working after the page opened", async () => {
    const { user } = renderApp(setupLink);
    const password = await screen.findByLabelText("New password");

    mockApi.setupLinkUsed = true;
    await user.type(password, "correct-horse");
    await user.click(screen.getByRole("button", { name: "Set password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(noLongerWorks);
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });

  it("shows a general message, not the server's text, when reading the link fails", async () => {
    server.use(getReadSetupLinkMockHandler500(failure));
    const { user } = renderApp(setupLink);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^Something went wrong\. Try again\.$/,
    );

    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByLabelText("New password")).toBeInTheDocument();
  });

  it("keeps the form when setting the password fails", async () => {
    server.use(getSetPasswordMockHandler500(failure));
    const { user } = renderApp(setupLink);
    const password = await screen.findByLabelText("New password");

    await user.type(password, "correct-horse");
    await user.click(screen.getByRole("button", { name: "Set password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^Something went wrong\. Try again\.$/,
    );
    expect(password).toHaveValue("correct-horse");
  });

  it("can be used while the session check would fail: it is a public page", async () => {
    mockApi.session = "ended";
    renderApp(setupLink);

    await waitFor(() => expect(screen.getByText(owner.name)).toBeInTheDocument());
  });
});

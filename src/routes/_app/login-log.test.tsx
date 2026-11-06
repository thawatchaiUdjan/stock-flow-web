import { screen, waitFor, within } from "@testing-library/react";
import { delay } from "msw";
import { describe, expect, it } from "vitest";

import {
  getListLoginLogMockHandler200,
  getListLoginLogMockHandler500,
} from "@/api/generated/login-log/login-log.msw";
import type { LoginLogEntryBody, LoginLogUser } from "@/api/generated/model";
import { mockApi, serverFailure } from "@/mocks/handlers";
import { renderApp } from "@/test/render-app";
import { server } from "@/test/server";

const mali = { id: 2, name: "Mali Chai" };
const anan = { id: 3, name: "Anan Dee" };

function entry(id: number, changes: Partial<LoginLogEntryBody> = {}): LoginLogEntryBody {
  return {
    id,
    at: "2026-11-05T14:12:00Z",
    email: "mali@example.com",
    user: mali,
    result: "login",
    ip: "203.0.113.7",
    userAgent: "Firefox on Windows",
    ...changes,
  };
}

// Every request to the Login log, as the API saw it.
function requestsToTheLog() {
  const urls: URL[] = [];
  server.events.on("request:start", ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/login-log")) urls.push(url);
  });
  return urls;
}

// The filter lists the Users, so they exist for the Owner to choose from.
function addUsers() {
  mockApi.users.push(
    {
      id: mali.id,
      name: mali.name,
      email: "mali@example.com",
      role: "admin",
      status: "active",
      passwordSet: true,
    },
    {
      id: anan.id,
      name: anan.name,
      email: "anan@example.com",
      role: "staff",
      status: "active",
      passwordSet: true,
    },
  );
}

function rowsOfTheTable() {
  return within(screen.getByRole("table")).getAllByRole("row").slice(1);
}

function emails() {
  return rowsOfTheTable().map((row) => within(row).getAllByRole("cell")[1]!.textContent);
}

describe("the Login log", () => {
  // users-and-access R36, R38
  it("shows each entry's time, email, User, result, IP address and browser, newest first", async () => {
    mockApi.session = "live";
    mockApi.loginLog.push(
      entry(1, { at: "2026-11-05T09:00:00Z", email: "old@example.com" }),
      entry(3, {
        at: "2026-11-06T14:12:00Z",
        email: "Mali@Example.com",
        result: "failed-login",
        ip: "198.51.100.4",
        userAgent: "Safari on iPhone",
      }),
      entry(2, { at: "2026-11-05T17:30:00Z", email: "mid@example.com", result: "logout" }),
    );
    renderApp("/login-log");

    const rows = within(await screen.findByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent("Mali@Example.com");
    expect(rows[2]).toHaveTextContent("mid@example.com");
    expect(rows[3]).toHaveTextContent("old@example.com");
    const newest = within(rows[1]!);
    expect(newest.getByText("6 Nov, 14:12")).toBeInTheDocument();
    expect(newest.getByText("Mali Chai")).toBeInTheDocument();
    expect(newest.getByText("Failed login")).toBeInTheDocument();
    expect(newest.getByText("198.51.100.4")).toBeInTheDocument();
    expect(newest.getByText("Safari on iPhone")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("Logout")).toBeInTheDocument();
    expect(within(rows[3]!).getByText("Login")).toBeInTheDocument();
  });

  // users-and-access R36: an email that matches no User is still recorded.
  it("shows the email entered and no User when it matches none", async () => {
    mockApi.session = "live";
    mockApi.loginLog.push(
      entry(1, {
        email: "guess@example.com",
        // The contract types `user` as always present, but the API sends null for no match.
        user: null as unknown as LoginLogUser,
        result: "failed-login",
      }),
    );
    renderApp("/login-log");

    const row = within(await screen.findByRole("table")).getAllByRole("row")[1]!;
    expect(row).toHaveTextContent("guess@example.com");
    expect(within(row).getByText("No User")).toBeInTheDocument();
    expect(within(row).getByText("Failed login")).toBeInTheDocument();
  });

  it("says it is loading until the API answers", async () => {
    mockApi.session = "live";
    server.use(
      getListLoginLogMockHandler200(async () => {
        await delay(100);
        return { entries: [entry(1)], nextBefore: null };
      }),
    );
    renderApp("/login-log");

    expect(await screen.findByText("Loading the Login log")).toBeInTheDocument();
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.queryByText("Loading the Login log")).not.toBeInTheDocument();
  });

  it("says there are no entries yet, and shows no table", async () => {
    mockApi.session = "live";
    renderApp("/login-log");

    expect(await screen.findByText(/No logins yet/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("says why it is empty when the filters match nothing, and clears them", async () => {
    mockApi.session = "live";
    addUsers();
    mockApi.loginLog.push(entry(1, { result: "login" }));
    const { user } = renderApp("/login-log?result=failed-login");

    expect(await screen.findByText("No entries match these filters.")).toBeInTheDocument();
    expect(screen.queryByText(/No logins yet/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Clear filters" }));

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByLabelText("Result")).toHaveValue("");
  });

  it("explains a failure and tries again", async () => {
    mockApi.session = "live";
    server.use(getListLoginLogMockHandler500(serverFailure));
    const { user } = renderApp("/login-log");

    expect(await screen.findByText("Something went wrong. Try again.")).toBeInTheDocument();

    server.use(getListLoginLogMockHandler200({ entries: [entry(1)], nextBefore: null }));
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  // users-and-access R38
  describe("filters", () => {
    function seed() {
      mockApi.session = "live";
      addUsers();
      mockApi.loginLog.push(
        entry(1, { email: "mali-login@example.com", user: mali, result: "login" }),
        entry(2, { email: "mali-failed@example.com", user: mali, result: "failed-login" }),
        entry(3, { email: "anan-failed@example.com", user: anan, result: "failed-login" }),
        entry(4, { email: "anan-login@example.com", user: anan, result: "login" }),
      );
    }

    it("narrow the entries by User", async () => {
      seed();
      const requests = requestsToTheLog();
      const { user } = renderApp("/login-log");
      await screen.findByRole("table");

      await user.selectOptions(screen.getByLabelText("User"), "Mali Chai (mali@example.com)");

      await waitFor(() =>
        expect(emails()).toEqual(["mali-failed@example.com", "mali-login@example.com"]),
      );
      expect(requests.at(-1)?.searchParams.get("userId")).toBe("2");
      expect(requests.at(-1)?.searchParams.has("result")).toBe(false);
    });

    it("narrow the entries by result", async () => {
      seed();
      const requests = requestsToTheLog();
      const { user } = renderApp("/login-log");
      await screen.findByRole("table");

      await user.selectOptions(screen.getByLabelText("Result"), "Failed login");

      await waitFor(() =>
        expect(emails()).toEqual(["anan-failed@example.com", "mali-failed@example.com"]),
      );
      expect(requests.at(-1)?.searchParams.get("result")).toBe("failed-login");
      expect(requests.at(-1)?.searchParams.has("userId")).toBe(false);
    });

    it("work together", async () => {
      seed();
      const requests = requestsToTheLog();
      const { user } = renderApp("/login-log");
      await screen.findByRole("table");

      await user.selectOptions(screen.getByLabelText("User"), "Anan Dee (anan@example.com)");
      await user.selectOptions(screen.getByLabelText("Result"), "Failed login");

      await waitFor(() => expect(emails()).toEqual(["anan-failed@example.com"]));
      expect(requests.at(-1)?.searchParams.get("userId")).toBe("3");
      expect(requests.at(-1)?.searchParams.get("result")).toBe("failed-login");
    });

    it("are in the address, so a link or a reload keeps them", async () => {
      seed();
      renderApp("/login-log?userId=3&result=login");

      await waitFor(() => expect(emails()).toEqual(["anan-login@example.com"]));
      expect(screen.getByLabelText("User")).toHaveValue("3");
      expect(screen.getByLabelText("Result")).toHaveValue("login");
    });

    it("can be undone", async () => {
      seed();
      const { user } = renderApp("/login-log?userId=3");
      await waitFor(() => expect(emails()).toHaveLength(2));

      await user.selectOptions(screen.getByLabelText("User"), "All Users");

      await waitFor(() => expect(emails()).toHaveLength(4));
    });
  });

  // users-and-access R38: the API pages by cursor, 50 entries at a time.
  describe("pages", () => {
    function seedMany() {
      mockApi.session = "live";
      addUsers();
      for (let id = 1; id <= 130; id++) {
        mockApi.loginLog.push(
          entry(id, {
            email: `entry-${id}@example.com`,
            result: id % 2 ? "login" : "failed-login",
          }),
        );
      }
    }

    function firstAndLast() {
      const rows = rowsOfTheTable();
      return { count: rows.length, first: rows[0]!.textContent, last: rows.at(-1)!.textContent };
    }

    it("go from the newest to older entries, and back", async () => {
      seedMany();
      const { user } = renderApp("/login-log");
      await screen.findByRole("table");
      expect(firstAndLast().count).toBe(50);
      expect(firstAndLast().first).toContain("entry-130@example.com");
      expect(firstAndLast().last).toContain("entry-81@example.com");
      expect(screen.queryByRole("link", { name: "Newest entries" })).not.toBeInTheDocument();

      await user.click(screen.getByRole("link", { name: "Older entries" }));
      await waitFor(() => expect(firstAndLast().first).toContain("entry-80@example.com"));
      expect(firstAndLast().last).toContain("entry-31@example.com");

      await user.click(screen.getByRole("link", { name: "Older entries" }));
      await waitFor(() => expect(firstAndLast().first).toContain("entry-30@example.com"));
      expect(firstAndLast().count).toBe(30);
      expect(screen.queryByRole("link", { name: "Older entries" })).not.toBeInTheDocument();

      await user.click(screen.getByRole("link", { name: "Newest entries" }));
      await waitFor(() => expect(firstAndLast().first).toContain("entry-130@example.com"));
    });

    it("keep the filters when moving between them", async () => {
      seedMany();
      const requests = requestsToTheLog();
      const { user } = renderApp("/login-log");
      await screen.findByRole("table");
      await user.selectOptions(screen.getByLabelText("Result"), "Failed login");
      await waitFor(() => expect(firstAndLast().first).toContain("entry-130@example.com"));

      await user.click(await screen.findByRole("link", { name: "Older entries" }));

      await waitFor(() => expect(firstAndLast().first).toContain("entry-30@example.com"));
      expect(firstAndLast().count).toBe(15);
      expect(screen.getByLabelText("Result")).toHaveValue("failed-login");
      expect(requests.at(-1)?.searchParams.get("result")).toBe("failed-login");
      expect(requests.at(-1)?.searchParams.get("before")).toBe("32");
    });

    it("start again from the newest when a filter changes", async () => {
      seedMany();
      const requests = requestsToTheLog();
      const { user } = renderApp("/login-log?before=81");
      await screen.findByRole("table");

      await user.selectOptions(screen.getByLabelText("Result"), "Login");

      await waitFor(() => expect(firstAndLast().first).toContain("entry-129@example.com"));
      expect(requests.at(-1)?.searchParams.has("before")).toBe(false);
    });
  });
});

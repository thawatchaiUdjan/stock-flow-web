import { screen, waitFor, within } from "@testing-library/react";
import { delay, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

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
  // navigation-and-lists R8: the UI default must reach the API.
  it("requests 25 rows by default", async () => {
    mockApi.session = "live";
    const requests = requestsToTheLog();
    renderApp("/login-log");
    await screen.findByText(/No logins yet/);
    expect(requests.at(-1)?.searchParams.get("limit")).toBe("25");
    expect(screen.getByRole("combobox", { name: "Rows per page" })).toHaveValue("25");
  });
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
        return { entries: [entry(1)], nextBefore: null, total: 1 };
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

    server.use(getListLoginLogMockHandler200({ entries: [entry(1)], nextBefore: null, total: 1 }));
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

  // users-and-access R38, navigation-and-lists R8: cursor pages default to 25 rows.
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
      expect(firstAndLast().count).toBe(25);
      expect(firstAndLast().first).toContain("entry-130@example.com");
      expect(firstAndLast().last).toContain("entry-106@example.com");
      expect(screen.getByRole("button", { name: "First page" })).toBeDisabled();

      await user.click(screen.getByRole("button", { name: "Next page" }));
      await waitFor(() => expect(firstAndLast().first).toContain("entry-105@example.com"));
      expect(firstAndLast().last).toContain("entry-81@example.com");

      await user.click(screen.getByRole("button", { name: "Next page" }));
      await waitFor(() => expect(firstAndLast().first).toContain("entry-80@example.com"));
      expect(firstAndLast().count).toBe(25);
      expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();

      await user.click(screen.getByRole("button", { name: "First page" }));
      await waitFor(() => expect(firstAndLast().first).toContain("entry-130@example.com"));
    });

    it("keep the filters when moving between them", async () => {
      seedMany();
      const requests = requestsToTheLog();
      const { user } = renderApp("/login-log");
      await screen.findByRole("table");
      await user.selectOptions(screen.getByLabelText("Result"), "Failed login");
      await waitFor(() => expect(firstAndLast().first).toContain("entry-130@example.com"));

      await user.click(await screen.findByRole("button", { name: "Next page" }));

      await waitFor(() => expect(firstAndLast().first).toContain("entry-80@example.com"));
      expect(firstAndLast().count).toBe(25);
      expect(screen.getByLabelText("Result")).toHaveValue("failed-login");
      expect(requests.at(-1)?.searchParams.get("result")).toBe("failed-login");
      expect(requests.at(-1)?.searchParams.get("offset")).toBe("25");
      expect(screen.getByText("Page 2 of 3 \u00b7 65 matching")).toBeInTheDocument();
    });

    it("start again from the newest when a filter changes", async () => {
      seedMany();
      const requests = requestsToTheLog();
      const { user } = renderApp("/login-log?page=2");
      await screen.findByRole("table");

      await user.selectOptions(screen.getByLabelText("Result"), "Login");

      await waitFor(() => expect(firstAndLast().first).toContain("entry-129@example.com"));
      expect(requests.at(-1)?.searchParams.has("before")).toBe(false);
    });
  });
});

// navigation-and-lists R6, R8: URL size survives cursors; changing it retains filters.
describe("history page sizes", () => {
  it.each([10, 25, 50])(
    "restores %i rows from the URL and retains them through numbered navigation",
    async (size) => {
      mockApi.session = "live";
      addUsers();
      mockApi.loginLog.push(...Array.from({ length: 60 }, (_, i) => entry(i + 1)));
      const sent = requestsToTheLog();
      const { user, router } = renderApp(`/login-log?userId=2&result=login&size=${size}`);
      await screen.findByRole("table");
      expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(size + 1);
      expect(screen.getByLabelText("Rows per page")).toHaveValue(String(size));
      expect(sent.at(-1)?.searchParams.get("limit")).toBe(String(size));
      expect(sent.at(-1)?.searchParams.has("size")).toBe(false);
      await user.click(screen.getByRole("button", { name: "Next page" }));
      await screen.findByText(`Page 2 of ${Math.ceil(60 / size)} \u00b7 60 matching`);
      await waitFor(() => expect(sent.at(-1)?.searchParams.get("offset")).toBe(String(size)));
      expect(sent.at(-1)?.searchParams.get("limit")).toBe(String(size));
      expect(Object.fromEntries(sent.at(-1)!.searchParams)).toMatchObject({
        userId: "2",
        result: "login",
      });
      expect(router.state.location.search).toMatchObject({ size, page: 2 });
      await user.click(screen.getByRole("button", { name: "First page" }));
      await waitFor(() => expect(router.state.location.search.page).toBe(1));
      expect(router.state.location.search.size).toBe(size);
      expect(router.state.location.search).toMatchObject({ size });
    },
  );

  it.each([0, 11, 100, -1, 25.5, "bad", "[10,25]"])(
    "normalizes invalid URL size %s to 25",
    async (size) => {
      mockApi.session = "live";
      addUsers();
      const sent = requestsToTheLog();
      renderApp(`/login-log?size=${size}`);
      await screen.findByText(/No logins yet/);
      expect(screen.getByLabelText("Rows per page")).toHaveValue("25");
      expect(sent.at(-1)?.searchParams.get("limit")).toBe("25");
      expect(sent.at(-1)?.searchParams.has("size")).toBe(false);
    },
  );

  it("resets a later page on size and filter changes without losing the selected size", async () => {
    mockApi.session = "live";
    addUsers();
    const sent = requestsToTheLog();
    const { user, router } = renderApp("/login-log?userId=2&result=login&size=50&page=99");
    await screen.findByText("No entries on this page. Return to the first page.");
    await user.selectOptions(screen.getByLabelText("Rows per page"), "10");
    await waitFor(() => expect(sent.at(-1)?.searchParams.has("before")).toBe(false));
    expect(Object.fromEntries(sent.at(-1)!.searchParams)).toEqual({
      userId: "2",
      result: "login",
      limit: "10",
      offset: "0",
    });
    expect(router.state.location.search.size).toBe(10);
    await router.navigate({
      to: "/login-log",
      search: { ...router.state.location.search, page: 99 },
    });
    await screen.findByText("This page is no longer available.");
    await user.selectOptions(screen.getByLabelText("Result"), "logout");
    await waitFor(() => expect(sent.at(-1)?.searchParams.get("result")).toBe("logout"));
    expect(sent.at(-1)?.searchParams.has("before")).toBe(false);
    expect(sent.at(-1)?.searchParams.get("limit")).toBe("10");
    expect(router.state.location.search.size).toBe(10);
  });

  it("keeps named icon controls visible and recovers from an empty older page", async () => {
    mockApi.session = "live";
    addUsers();
    const { user, router } = renderApp("/login-log?userId=2&result=login&size=10&page=99");
    await screen.findByText("No entries on this page. Return to the first page.");
    const pages = within(screen.getByRole("navigation", { name: "Pages" }));
    expect(pages.getAllByRole("button")).toHaveLength(4);
    const newest = pages.getByRole("button", { name: "First page" });
    const older = pages.getByRole("button", { name: "Next page" });
    expect(newest).toHaveAttribute("title", "First page");
    expect(older).toHaveAttribute("title", "Next page");
    expect(older).toBeDisabled();
    await user.click(older);
    expect(router.state.location.search.page).toBe(99);
    await user.click(newest);
    await screen.findByText("No entries match these filters.");
    expect(router.state.location.search.size).toBe(10);
    expect(newest).toBeDisabled();
  });
});

// navigation-and-lists R4, R6: loading and failure never strand an older cursor.
it.each(["loading", "error"])(
  "keeps history controls usable during an older %s state",
  async (state) => {
    mockApi.session = "live";
    if (state === "loading") {
      server.use(
        getListLoginLogMockHandler200(async () => {
          await delay(300);
          return { entries: [entry(1)], nextBefore: null, total: 1 };
        }),
      );
    } else {
      server.use(getListLoginLogMockHandler500(serverFailure));
    }
    const { user, router } = renderApp("/login-log?size=50&page=99");
    await screen.findByText(
      state === "loading" ? "Loading the Login log" : "Something went wrong. Try again.",
    );
    const pages = within(screen.getByRole("navigation", { name: "Pages" }));
    expect(pages.getByRole("combobox", { name: "Rows per page" })).toHaveValue("50");
    expect(pages.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(pages.getByRole("button", { name: "First page" })).toBeEnabled();
    server.use(getListLoginLogMockHandler200({ entries: [entry(1)], nextBefore: null, total: 1 }));
    await user.click(pages.getByRole("button", { name: "First page" }));
    await screen.findByRole("table");
    expect(router.state.location.search.page).toBe(1);
    expect(router.state.location.search.size).toBe(50);
    expect(pages.getByRole("button", { name: "First page" })).toBeDisabled();
    expect(pages.getByRole("button", { name: "Next page" })).toBeDisabled();
  },
);

// navigation-and-lists R8: clearing filters also keeps the chosen size.
it("retains the selected history size when clearing filters", async () => {
  mockApi.session = "live";
  const sent = requestsToTheLog();
  const { user, router } = renderApp("/login-log?result=logout&size=50");
  await screen.findByText("No entries match these filters.");
  await user.click(screen.getByRole("link", { name: "Clear filters" }));
  await waitFor(() => expect(router.state.location.search).toEqual({ size: 50 }));
  await waitFor(() =>
    expect(Object.fromEntries(sent.at(-1)!.searchParams)).toEqual({ limit: "50", offset: "0" }),
  );
});

// navigation-and-lists R6: numbered requests include offset=0 and exact totals.
it("shows numbered empty results with four unavailable directions", async () => {
  mockApi.session = "live";
  const sent = requestsToTheLog();
  renderApp("/login-log");
  await screen.findByText("Page 1 of 1 · 0 matching");
  expect(Object.fromEntries(sent.at(-1)!.searchParams)).toEqual({ limit: "25", offset: "0" });
  const pages = within(screen.getByRole("navigation", { name: "Pages" }));
  expect(pages.getAllByRole("button")).toHaveLength(4);
  for (const button of pages.getAllByRole("button")) expect(button).toBeDisabled();
});

// navigation-and-lists R4-R6, R8: numbered history controls navigate real bounded pages.
describe("numbered history", () => {
  it("uses Last and Previous with exact matching totals and retained filters", async () => {
    mockApi.session = "live";
    addUsers();
    mockApi.loginLog.push(...Array.from({ length: 61 }, (_, i) => entry(i + 1)));
    const sent = requestsToTheLog();
    const { user, router } = renderApp("/login-log?userId=2&result=login&size=10");
    await screen.findByText("Page 1 of 7 \u00b7 61 matching");
    await user.click(screen.getByRole("button", { name: "Last page" }));
    await screen.findByText("Page 7 of 7 \u00b7 61 matching");
    expect(Object.fromEntries(sent.at(-1)!.searchParams)).toEqual({
      userId: "2",
      result: "login",
      limit: "10",
      offset: "60",
    });
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Last page" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Previous page" }));
    await screen.findByText("Page 6 of 7 \u00b7 61 matching");
    expect(sent.at(-1)!.searchParams.get("offset")).toBe("50");
    expect(router.state.location.search).toMatchObject({ page: 6, size: 10 });
  });

  it("restores a numbered page from a reload URL", async () => {
    mockApi.session = "live";
    addUsers();
    mockApi.loginLog.push(...Array.from({ length: 61 }, (_, i) => entry(i + 1)));
    const sent = requestsToTheLog();
    renderApp("/login-log?userId=2&result=login&size=10&page=3");
    await screen.findByText("Page 3 of 7 \u00b7 61 matching");
    expect(Object.fromEntries(sent.at(-1)!.searchParams)).toEqual({
      userId: "2",
      result: "login",
      limit: "10",
      offset: "20",
    });
  });

  it("opens legacy before URLs at page one with filters and size", async () => {
    mockApi.session = "live";
    addUsers();
    const sent = requestsToTheLog();
    renderApp("/login-log?userId=2&result=login&size=10&before=99");
    await screen.findByText("No entries match these filters.");
    await screen.findByText("Page 1 of 1 \u00b7 0 matching");
    expect(Object.fromEntries(sent.at(-1)!.searchParams)).toEqual({
      userId: "2",
      result: "login",
      limit: "10",
      offset: "0",
    });
  });

  it.each([0, -1, 1.5, "bad", "9007199254740991", 85899347])(
    "normalizes invalid page %s",
    async (page) => {
      mockApi.session = "live";
      addUsers();
      const sent = requestsToTheLog();
      renderApp(`/login-log?page=${page}`);
      await screen.findByText("Page 1 of 1 \u00b7 0 matching");
      expect(sent.at(-1)!.searchParams.get("offset")).toBe("0");
    },
  );

  it.each(["missing total", "501"])(
    "shows an error without an invented count for %s",
    async (failure) => {
      // A slow render advances the clock between snapshots; a selector error must not loop.
      let tick = Date.now();
      const clock = vi.spyOn(Date, "now").mockImplementation(() => tick++);
      try {
        mockApi.session = "live";
        addUsers();
        server.use(
          failure === "501"
            ? getListLoginLogMockHandler500(() => {
                throw HttpResponse.json({ status: 501, type: "about:blank" }, { status: 501 });
              })
            : getListLoginLogMockHandler200({ entries: [], nextBefore: null }),
        );
        const { user } = renderApp("/login-log?page=2&size=10");
        await screen.findByText("Something went wrong. Try again.");
        expect(screen.getByText("Page unavailable")).toBeInTheDocument();
        expect(screen.queryByText(/matching$/)).not.toBeInTheDocument();
        expect(await screen.findByRole("button", { name: "First page" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Last page" })).toBeDisabled();
        server.use(getListLoginLogMockHandler200({ entries: [], nextBefore: null, total: 0 }));
        await user.click(screen.getByRole("button", { name: "Try again" }));
        await screen.findByText("This page is no longer available.");
        await user.click(screen.getByRole("button", { name: "First page" }));
        await screen.findByText("Page 1 of 1 \u00b7 0 matching");
      } finally {
        clock.mockRestore();
      }
    },
  );
});

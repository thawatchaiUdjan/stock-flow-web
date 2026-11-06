import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

import { resetMockApi } from "@/mocks/handlers";

import { server } from "./server";

// Routes are code-split: the first render of a route compiles it, which can pass the 1 s default.
configure({ asyncUtilTimeout: 5000 });

// An unhandled request fails the test: a mock that answers nothing must not pass silently.
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  server.events.removeAllListeners();
  resetMockApi();
});
afterAll(() => server.close());

// jsdom has no scrollTo, and the router calls it on every navigation.
window.scrollTo = vi.fn();

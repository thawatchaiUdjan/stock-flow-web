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

// jsdom has no layout; give responsive charts a viewport without replacing their rendering or keyboard behavior.
vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
  this: HTMLElement,
) {
  return this.classList.contains("recharts-responsive-container")
    ? new DOMRect(0, 0, 320, 160)
    : new DOMRect();
});

// jsdom has no ResizeObserver, and Radix's radio buttons measure themselves with one.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

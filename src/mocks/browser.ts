import { setupWorker } from "msw/browser";

import { handlers, mockApi } from "./handlers";

// The API's cookie outlives a reload, so the mock install does too, for this tab only.
// A test seeds it before the app starts: `sessionStorage.setItem(mockStateKey, JSON.stringify({ ... }))`.
export const mockStateKey = "stock-flow-mock-api";

export const worker = setupWorker(...handlers);

export function keepMockStateAcrossReloads() {
  const saved = sessionStorage.getItem(mockStateKey);
  if (saved) Object.assign(mockApi, JSON.parse(saved));
  worker.events.on("response:mocked", () => {
    sessionStorage.setItem(mockStateKey, JSON.stringify(mockApi));
  });
}

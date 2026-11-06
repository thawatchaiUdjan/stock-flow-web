import { RouterProvider } from "@tanstack/react-router";
import { HttpNetworkFrame } from "msw/experimental";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import { createAppRouter } from "./router";

async function startMocks() {
  // MODE is replaced at build time, so a production build drops this import altogether.
  if (import.meta.env.MODE !== "e2e") return;
  const { keepMockStateAcrossReloads, worker } = await import("./mocks/browser");
  keepMockStateAcrossReloads();
  await worker.start({
    // A reload asks for the page itself, which no handler answers; every other request must be mocked.
    onUnhandledFrame({ frame, defaults }) {
      const isPage =
        frame instanceof HttpNetworkFrame &&
        frame.data.request.headers.get("accept")?.includes("text/html");
      if (!isPage) defaults.error();
    },
  });
}

const router = createAppRouter();

await startMocks();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

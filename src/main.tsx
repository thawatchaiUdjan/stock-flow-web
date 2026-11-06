import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import { createAppRouter } from "./router";

async function startMocks() {
  // MODE is replaced at build time, so a production build drops this import altogether.
  if (import.meta.env.MODE !== "e2e") return;
  const { worker } = await import("./mocks/browser");
  await worker.start({ onUnhandledFrame: "error" });
}

const router = createAppRouter();

await startMocks();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

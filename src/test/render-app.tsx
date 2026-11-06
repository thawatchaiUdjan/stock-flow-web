import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createAppRouter } from "@/router";

// The whole app through its router, at the address a person would open.
export function renderApp(address: string) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [address] }));
  render(<RouterProvider router={router} />);
  return { router, user: userEvent.setup() };
}

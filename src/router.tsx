import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, parseSearchWith, stringifySearchWith } from "@tanstack/react-router";
import type { RouterHistory } from "@tanstack/react-router";

import { ApiError } from "./api/fetcher";
import { getGetCurrentUserQueryKey } from "./api/generated/sessions/sessions";
import { isSessionLost } from "./lib/session";
import { routeTree } from "./routeTree.gen";

// The router reads an address value as JSON, so `?search=1e3` would come out as the number 1000.
// A number that would not print as it was written stays the text that was typed.
function parseExactly(value: string) {
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed === "number" && JSON.stringify(parsed) !== value) throw new Error("inexact");
  return parsed;
}

export function createAppRouter(history?: RouterHistory) {
  // users-and-access R26: a 401 for a User already in the app. A first visit is the routes' to handle.
  const onError = (error: unknown) => {
    if (!isSessionLost(error) || !queryClient.getQueryData(getGetCurrentUserQueryKey())) return;
    queryClient.clear();
    void router.navigate({ to: "/login", search: { redirect: router.state.location.href } });
  };

  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      // An answer from the API won't change on a retry; a lost connection might.
      queries: { retry: (count, error) => !(error instanceof ApiError) && count < 2 },
    },
  });

  const router = createRouter({
    routeTree,
    history,
    context: { queryClient },
    defaultPreloadStaleTime: 0,
    parseSearch: parseSearchWith(parseExactly),
    stringifySearch: stringifySearchWith(JSON.stringify, parseExactly),
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import type { RouterHistory } from "@tanstack/react-router";

import { ApiError } from "./api/fetcher";
import { getGetCurrentUserQueryKey } from "./api/generated/sessions/sessions";
import { isSessionLost } from "./lib/session";
import { routeTree } from "./routeTree.gen";

export function createAppRouter(history?: RouterHistory) {
  // A 401 for a User already in the app. A first visit has no User here: the routes handle that.
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

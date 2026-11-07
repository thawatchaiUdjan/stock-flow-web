import { useRouteContext } from "@tanstack/react-router";

import { useGetCurrentUser } from "@/api/generated/sessions/sessions";

// Live, so a focus re-checks the session and a Role change shows at once (users-and-access R35).
export function useCurrentUser() {
  const { user: checkedUser } = useRouteContext({ from: "/_app" });
  const { data: user = checkedUser } = useGetCurrentUser({ query: { refetchOnMount: false } });
  return user;
}

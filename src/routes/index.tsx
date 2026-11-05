import { createFileRoute } from "@tanstack/react-router";

import { useGetHealth } from "@/api/generated/health/health";

export const Route = createFileRoute("/")({ component: ApiStatus });

// A plumbing check, not a screen: the first one built from docs/design.md replaces it.
function ApiStatus() {
  const health = useGetHealth();

  if (health.isPending) return <p>Checking the API</p>;
  if (health.isError) return <p>API unavailable</p>;
  return <p>API status: {health.data.status}</p>;
}

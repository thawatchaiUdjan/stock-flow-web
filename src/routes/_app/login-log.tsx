import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_app/login-log")({
  component: () => <ComingSoon title="Login log" />,
});

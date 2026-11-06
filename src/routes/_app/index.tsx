import { createFileRoute, redirect } from "@tanstack/react-router";

import { landingPage } from "@/lib/session";

export const Route = createFileRoute("/_app/")({
  beforeLoad: () => {
    throw redirect({ to: landingPage });
  },
});

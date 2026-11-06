import { createFileRoute, redirect } from "@tanstack/react-router";

import { landingPageOf } from "@/lib/access";

export const Route = createFileRoute("/_app/")({
  beforeLoad: ({ context }) => {
    throw redirect({ to: landingPageOf(context.user.role).path });
  },
});

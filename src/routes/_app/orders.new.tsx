import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_app/orders/new")({
  component: () => <ComingSoon title="New order" />,
});

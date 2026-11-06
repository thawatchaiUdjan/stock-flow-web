import { createFileRoute } from "@tanstack/react-router";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_app/products/new")({
  component: () => <ComingSoon title="New product" />,
});

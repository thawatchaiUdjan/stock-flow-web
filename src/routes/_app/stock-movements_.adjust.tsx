import { createFileRoute } from "@tanstack/react-router";

import { StockChangePage } from "@/components/stock-change-page";
import { movementsSearchSchema } from "@/lib/stock-movements-search";

export const Route = createFileRoute("/_app/stock-movements_/adjust")({
  validateSearch: movementsSearchSchema,
  component: StockActionPage,
});

function StockActionPage() {
  return <StockChangePage mode="adjust" search={Route.useSearch()} />;
}

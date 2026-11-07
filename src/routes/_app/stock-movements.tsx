import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_app/stock-movements")({
  // products R16: the Product List links here with the Product; the page that filters by it comes
  // with the Stock movements feature.
  validateSearch: z.object({ productId: z.number().int().min(1).optional().catch(undefined) }),
  component: () => <ComingSoon title="Stock movements" />,
});

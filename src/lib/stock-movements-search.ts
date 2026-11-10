import { z } from "zod";

import { ListStockMovementsKind } from "@/api/generated/model";
import { pagingSearch } from "@/lib/paging";

// ADR 0008: the filters and the page live in the address, so a reload or a shared link keeps them
// (the Product List links here with its Product, products R16). A value the API wouldn't accept is
// dropped rather than sent.
export const movementsSearchSchema = z.object({
  // navigation-and-lists R8: accept only the offered sizes.
  size: pagingSearch.size,
  productId: z.number().int().min(1).optional().catch(undefined),
  kind: z.enum(ListStockMovementsKind).optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  before: z.number().int().min(1).optional().catch(undefined),
});
export type MovementsSearch = z.infer<typeof movementsSearchSchema>;

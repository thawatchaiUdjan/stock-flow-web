import { z } from "zod";

import { ApiError } from "@/api/fetcher";
import { int32Max } from "@/lib/format";
// navigation-and-lists R5: bounded URL state, with 25 rows by default.
export const pagingSearch = {
  page: z
    .number()
    .int()
    .min(1)
    .max(Math.floor(Number.MAX_SAFE_INTEGER / 50))
    .optional()
    .catch(undefined),
  size: z
    .union([z.literal(10), z.literal(25), z.literal(50)])
    .optional()
    .catch(undefined),
};

// context ADR 0009: numbered success must contain a real total, even during contract rollout.
export function numberedHistoryPage<T extends { total?: number }>(data: T): T & { total: number } {
  const total = data.total;
  if (typeof total !== "number" || !Number.isSafeInteger(total) || total < 0) {
    throw new ApiError(500, { type: "about:blank", title: "Missing numbered history total" });
  }
  return { ...data, total };
}

// The history contract bounds offset to int32; invalid URL pages recover at page one.
export function historyPageSearch<T extends { page?: number; size?: number }>(search: T): T {
  return (search.page ?? 1) - 1 > Math.floor(int32Max / (search.size ?? 25))
    ? { ...search, page: undefined }
    : search;
}

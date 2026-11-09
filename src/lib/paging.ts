import { z } from "zod";
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

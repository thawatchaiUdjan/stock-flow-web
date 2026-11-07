import { ApiError } from "./fetcher";
import type { ErrorModelType, ProductStock } from "./generated/model";

// `satisfies` is ADR 0021's CI check: a code missing here, or not in the contract, fails tsc.
const messages = {
  "about:blank": "Something went wrong. Try again.",
  // users-and-access R5: vague on purpose, or it would reveal which emails have a User.
  "login-failed": "Email or password is incorrect.",
  "session-ended": "Your session has ended. Log in again.",
  // users-and-access R3
  "email-taken": "A User with this email already exists.",
  // products R3
  "sku-taken": "Another product already uses this SKU. Use a different one.",
  "target-is-owner": "The Owner can't be changed here.",
  "user-inactive": "This User is Inactive. Set them Active before issuing a Setup link.",
  // stock-movements R6: the form says how many there are (`stockOf`); this is the fallback.
  "insufficient-stock": "There isn't enough stock for this change.",
  // stock-movements R9
  "product-archived": "This product is archived, so its stock can't change. Choose another.",
  // orders R13: completed and cancelled are final; the detail refreshes to say which.
  "order-not-pending": "This order was completed or cancelled already, so it can't change.",
  "setup-link-invalid":
    "This Setup link has been used, has expired or was replaced. Ask the Owner for a new one.",
} satisfies Record<ErrorModelType, string>;

export function hasCode(error: unknown, code: ErrorModelType) {
  return error instanceof ApiError && error.problem.type === code;
}

export function messageFor(code: ErrorModelType) {
  return messages[code];
}

// Never the server's own text: an error reaches the screen through the list above.
export function errorMessage(error: unknown) {
  const code = error instanceof ApiError ? error.problem.type : undefined;
  return (code && messages[code]) ?? messages["about:blank"];
}

// stock-movements R6: the stock the API names for a Product, to say "Only 18 in stock."
export function stockOf(error: unknown, productId: number) {
  if (!(error instanceof ApiError) || error.problem.type !== "insufficient-stock") return undefined;
  const products: ProductStock[] = error.problem.products ?? [];
  return products.find(({ id }) => id === productId)?.stock;
}

// ADR 0005: `errors[].location` names the field, for example `body.password`.
export function hasFieldError(error: unknown, field: string) {
  return (
    error instanceof ApiError &&
    (error.problem.errors ?? []).some(({ location }) => location === `body.${field}`)
  );
}

import { ApiError } from "./fetcher";
import type { ErrorModelType } from "./generated/model";

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

// ADR 0005: `errors[].location` names the field, for example `body.password`.
export function hasFieldError(error: unknown, field: string) {
  return (
    error instanceof ApiError &&
    (error.problem.errors ?? []).some(({ location }) => location === `body.${field}`)
  );
}

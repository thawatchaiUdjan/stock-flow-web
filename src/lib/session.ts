import { ApiError } from "@/api/fetcher";
import type { UserRole } from "@/api/generated/model";

import { canReach, landingPageOf } from "./access";

// A plain 401 or `session-ended`. The other 401, `login-failed`, only comes with no User to lose.
export function isSessionLost(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

// Parsed as the browser would, so `/\evil.com` and a tab inside `//` can't pass as a path.
export function safeReturnAddress(address: string | undefined) {
  const origin = window.location.origin;
  if (!address || !URL.canParse(address, origin)) return undefined;
  const url = new URL(address, origin);
  if (url.origin !== origin || url.pathname.startsWith("//")) return undefined;
  return url.pathname + url.search + url.hash;
}

// users-and-access R24: back to the page that sent the visitor to Login, unless their Role can't reach it.
export function addressAfterLogin(role: UserRole, returnAddress: string | undefined) {
  const address = safeReturnAddress(returnAddress);
  if (address && canReach(role, new URL(address, window.location.origin).pathname)) return address;
  return landingPageOf(role).path;
}

import { ApiError } from "@/api/fetcher";

// users-and-access R12. The ticket "Each Role reaches its own pages" makes this follow the Role.
export const landingPage = "/dashboard";

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

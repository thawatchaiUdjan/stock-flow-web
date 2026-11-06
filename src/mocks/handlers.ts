import { HttpResponse } from "msw";

import type { ErrorModel } from "@/api/generated/model";
import {
  getCreateSessionMockHandler200,
  getEndSessionMockHandler204,
  getGetCurrentUserMockHandler200,
} from "@/api/generated/sessions/sessions.msw";
import {
  getReadSetupLinkMockHandler200,
  getSetPasswordMockHandler204,
} from "@/api/generated/setup-links/setup-links.msw";

export const owner = { name: "Nok Srisuk", email: "nok@example.com", role: "owner" } as const;
export const setupToken = "mock-setup-link-token";

const freshInstall = {
  session: "none" as "none" | "live" | "ended",
  password: undefined as string | undefined,
  setupLinkUsed: false,
};

// "ended" is a cookie matching no live session: the API keeps it, so each request hears so again.
export const mockApi = { ...freshInstall };

export function resetMockApi() {
  Object.assign(mockApi, freshInstall);
}

export const serverFailure = {
  status: 500,
  title: "Internal Server Error",
  detail: "something went wrong on our side",
};

// Thrown from a resolver: the generated handlers answer one status, and MSW sends a thrown Response.
function problem(body: ErrorModel & { status: number }) {
  return HttpResponse.json(body, {
    status: body.status,
    headers: { "Content-Type": "application/problem+json" },
  });
}

function requireSession() {
  if (mockApi.session === "none") {
    throw problem({ status: 401, title: "Unauthorized", detail: "Log in to continue." });
  }
  if (mockApi.session === "ended") {
    throw problem({
      type: "session-ended",
      status: 401,
      title: "Unauthorized",
      detail: "Your session has ended. Log in again.",
    });
  }
}

function requireSetupLink(token: string) {
  if (token !== setupToken || mockApi.setupLinkUsed) {
    throw problem({
      type: "setup-link-invalid",
      status: 410,
      title: "Gone",
      detail: "This Setup link no longer works. Ask the Owner for a new one.",
    });
  }
}

// Orval's default mocks return random strings; each handler here pins what the real API sends.
export const handlers = [
  getGetCurrentUserMockHandler200(() => {
    requireSession();
    return owner;
  }),
  getCreateSessionMockHandler200(async ({ request }) => {
    const { email, password } = await request.json();
    if (email.toLowerCase() !== owner.email || password !== mockApi.password) {
      throw problem({
        type: "login-failed",
        status: 401,
        title: "Unauthorized",
        detail: "Email or password is incorrect.",
      });
    }
    mockApi.session = "live";
    return owner;
  }),
  getEndSessionMockHandler204(() => {
    requireSession();
    mockApi.session = "none";
  }),
  getReadSetupLinkMockHandler200(async ({ request }) => {
    const { token } = await request.json();
    requireSetupLink(token);
    return { name: owner.name, email: owner.email };
  }),
  getSetPasswordMockHandler204(async ({ request }) => {
    const { token, password } = await request.json();
    // Characters, as the API counts them, not UTF-16 units.
    if (Array.from(password).length < 6) {
      throw problem({
        status: 422,
        title: "Unprocessable Entity",
        detail: "validation failed",
        errors: [{ location: "body.password", message: "expected length >= 6", value: password }],
      });
    }
    requireSetupLink(token);
    mockApi.password = password;
    mockApi.setupLinkUsed = true;
  }),
];

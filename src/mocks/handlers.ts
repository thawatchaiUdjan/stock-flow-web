import { HttpResponse } from "msw";

import type { ErrorModel } from "@/api/generated/model";
import type { User } from "@/api/generated/model";
import {
  getCreateSessionMockHandler200,
  getEndSessionMockHandler204,
  getGetCurrentUserMockHandler200,
} from "@/api/generated/sessions/sessions.msw";
import {
  getReadSetupLinkMockHandler200,
  getSetPasswordMockHandler204,
} from "@/api/generated/setup-links/setup-links.msw";
import {
  getCreateUserMockHandler201,
  getListUsersMockHandler200,
} from "@/api/generated/users/users.msw";

export const owner = { name: "Nok Srisuk", email: "nok@example.com", role: "owner" } as const;
export const setupToken = "mock-setup-link-token";

const ownerUser: User = { id: 1, ...owner, status: "active", passwordSet: true };

function freshInstall() {
  return {
    session: "none" as "none" | "live" | "ended",
    password: undefined as string | undefined,
    setupLinkUsed: false,
    // A real install lists its Owner, so the list is never empty (users-and-access R9).
    users: [ownerUser] as User[],
  };
}

// "ended" is a cookie matching no live session: the API keeps it, so each request hears so again.
export const mockApi = freshInstall();

export function resetMockApi() {
  Object.assign(mockApi, freshInstall());
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

const day = 24 * 60 * 60 * 1000;

// Orval's default mocks return random strings; each handler here pins what the real API sends.
export const handlers = [
  getListUsersMockHandler200(() => {
    requireSession();
    return { users: mockApi.users };
  }),
  getCreateUserMockHandler201(async ({ request }) => {
    requireSession();
    const { name, email, role } = await request.json();
    // users-and-access R14: the name is required; the API refuses a blank one.
    if (!/\S/.test(name) || !email.includes("@")) {
      throw problem({
        status: 422,
        title: "Unprocessable Entity",
        detail: "validation failed",
        errors: [
          ...(/\S/.test(name)
            ? []
            : [
                { location: "body.name", message: "expected string to match pattern", value: name },
              ]),
          ...(email.includes("@")
            ? []
            : [
                {
                  location: "body.email",
                  message: "expected string to be RFC 5322 email",
                  value: email,
                },
              ]),
        ],
      });
    }
    // users-and-access R3: compared without regard to letter case.
    if (mockApi.users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
      throw problem({
        type: "email-taken",
        status: 409,
        title: "Conflict",
        detail: "A User has this email already.",
      });
    }
    const user: User = {
      id: Math.max(...mockApi.users.map(({ id }) => id)) + 1,
      name,
      email,
      role,
      status: "active",
      passwordSet: false,
    };
    mockApi.users.push(user);
    // users-and-access R27: 24 hours.
    return {
      user,
      setupLink: {
        token: `mock-token-for-user-${user.id}`,
        expiresAt: new Date(Date.now() + day).toISOString(),
      },
    };
  }),
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

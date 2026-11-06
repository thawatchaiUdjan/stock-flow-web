import { HttpResponse } from "msw";

import type { ErrorModel, User, UserRole } from "@/api/generated/model";
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
  getResetPasswordMockHandler200,
  getUpdateUserMockHandler200,
} from "@/api/generated/users/users.msw";

export const owner = { name: "Nok Srisuk", email: "nok@example.com", role: "owner" } as const;
// Who can log in to the mock install: one person per Role, all with the one `mockApi.password`.
export const people = {
  owner,
  admin: { name: "Anan Chaiyo", email: "anan@example.com", role: "admin" },
  staff: { name: "Suda Prasert", email: "suda@example.com", role: "staff" },
} as const;
export const setupToken = "mock-setup-link-token";

const ownerUser: User = { id: 1, ...owner, status: "active", passwordSet: true };

function freshInstall() {
  return {
    session: "none" as "none" | "live" | "ended",
    // Whose session it is, once it is live.
    role: "owner" as UserRole,
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

// A new object, so a User a test put in the list is never changed behind its back.
function updateMockUser(user: User, changes: Partial<User>) {
  const changed = { ...user, ...changes };
  mockApi.users = mockApi.users.map((one) => (one === user ? changed : one));
  return changed;
}

function targetIsOwner() {
  return problem({
    type: "target-is-owner",
    status: 403,
    title: "Forbidden",
    detail: "The Owner can't be changed.",
  });
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
    const nameOk = /\S/.test(name);
    const emailOk = email.includes("@");
    if (!nameOk || !emailOk) {
      throw problem({
        status: 422,
        title: "Unprocessable Entity",
        detail: "validation failed",
        errors: [
          ...(nameOk
            ? []
            : [
                { location: "body.name", message: "expected string to match pattern", value: name },
              ]),
          ...(emailOk
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
  getUpdateUserMockHandler200(async ({ request, params }) => {
    requireSession();
    const user = mockApi.users.find(({ id }) => id === Number(params.id));
    if (!user) throw problem({ status: 404, title: "Not Found" });
    // users-and-access R18, ADR 0004: every change to the Owner is refused alike.
    if (user.role === "owner") throw targetIsOwner();
    const { name, role, status } = await request.json();
    // users-and-access R14: the name is required; the API refuses a blank one.
    if (name !== undefined && !/\S/.test(name)) {
      throw problem({
        status: 422,
        title: "Unprocessable Entity",
        detail: "validation failed",
        errors: [
          { location: "body.name", message: "expected string to match pattern", value: name },
        ],
      });
    }
    return updateMockUser(user, {
      ...(name !== undefined && { name }),
      ...(role !== undefined && { role }),
      ...(status !== undefined && { status }),
    });
  }),
  getResetPasswordMockHandler200(({ params }) => {
    requireSession();
    const user = mockApi.users.find(({ id }) => id === Number(params.id));
    if (!user) throw problem({ status: 404, title: "Not Found" });
    if (user.role === "owner") throw targetIsOwner();
    // users-and-access R32
    if (user.status === "inactive") {
      throw problem({
        type: "user-inactive",
        status: 409,
        title: "Conflict",
        detail: "This User is Inactive.",
      });
    }
    // users-and-access R31: the old password stops working, and the new link is the only way in.
    updateMockUser(user, { passwordSet: false });
    return {
      token: `mock-reset-token-for-user-${user.id}`,
      expiresAt: new Date(Date.now() + day).toISOString(),
    };
  }),
  getGetCurrentUserMockHandler200(() => {
    requireSession();
    return people[mockApi.role];
  }),
  getCreateSessionMockHandler200(async ({ request }) => {
    const { email, password } = await request.json();
    const person = Object.values(people).find((one) => one.email === email.toLowerCase());
    if (!person || password !== mockApi.password) {
      throw problem({
        type: "login-failed",
        status: 401,
        title: "Unauthorized",
        detail: "Email or password is incorrect.",
      });
    }
    mockApi.session = "live";
    mockApi.role = person.role;
    return person;
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

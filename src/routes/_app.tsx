import { useQueryClient } from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

import { errorMessage } from "@/api/errors";
import type { CurrentUser } from "@/api/generated/model";
import {
  getGetCurrentUserQueryOptions,
  useEndSession,
  useGetCurrentUser,
} from "@/api/generated/sessions/sessions";
import { CenteredSurface } from "@/components/centered-surface";
import { NoAccess } from "@/components/no-access";
import { Button } from "@/components/ui/button";
import { canReach, landingPageOf, pageAt, pagesOf } from "@/lib/access";
import { roleNames } from "@/lib/roles";
import { isSessionLost } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    try {
      const user = await context.queryClient.ensureQueryData({
        ...getGetCurrentUserQueryOptions(),
        revalidateIfStale: true,
      });
      return { user };
    } catch (error) {
      if (!isSessionLost(error)) throw error;
      // users-and-access R24
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  errorComponent: ShellError,
  component: AppShell,
});

const navLinkClass =
  "flex min-h-11 min-w-18 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-small font-medium transition-colors hover:bg-muted shell:h-9.5 shell:min-h-0 shell:min-w-0 shell:flex-none shell:flex-row shell:justify-start shell:gap-2 shell:px-3 shell:text-body";
const activeNavLink = "bg-accent text-accent-foreground hover:bg-accent";

// One markup for both layouts: on a phone the sidebar dissolves into a top strip and a bottom bar.
function AppShell() {
  const { user: checkedUser } = Route.useRouteContext();
  // Live, so a focus re-checks the session and a Role change shows at once (users-and-access R35).
  const { data: user = checkedUser } = useGetCurrentUser({ query: { refetchOnMount: false } });
  const pathname = useLocation({ select: (location) => location.pathname });
  const current = pageAt(pathname);

  return (
    <div className="flex min-h-dvh flex-col shell:flex-row">
      <aside className="contents shell:sticky shell:top-0 shell:flex shell:h-dvh shell:w-54 shell:shrink-0 shell:flex-col shell:gap-6 shell:border-r shell:bg-sidebar shell:p-3">
        <p className="hidden px-3 pt-2 font-semibold shell:block">StockFlow</p>
        <nav
          aria-label="Main"
          className="sticky bottom-0 order-last flex overflow-x-auto border-t bg-sidebar p-1 shell:static shell:order-none shell:flex-1 shell:flex-col shell:overflow-visible shell:border-t-0 shell:p-0"
        >
          {/* users-and-access R11, R22: only the pages of the User's Role. */}
          {pagesOf(user.role).map((page) => (
            <Link
              key={page.path}
              to={page.path}
              className={cn(navLinkClass, page === current && activeNavLink)}
              aria-current={page === current ? "page" : undefined}
            >
              <page.icon aria-hidden size={18} />
              {page.title}
            </Link>
          ))}
        </nav>
        <UserPanel user={user} />
      </aside>
      <main className="mx-auto w-full max-w-320 flex-1 px-3 py-6 shell:px-8 shell:py-8">
        {/* users-and-access R22: said on the page, not a silent redirect. */}
        {canReach(user.role, pathname) ? (
          <Outlet />
        ) : (
          <NoAccess landingPage={landingPageOf(user.role)} />
        )}
      </main>
    </div>
  );
}

function UserPanel({ user }: { user: CurrentUser }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logOut = useEndSession({
    mutation: {
      onSuccess: async () => {
        // users-and-access R7. Cleared first, so nothing reaches whoever logs in next here.
        queryClient.clear();
        await navigate({ to: "/login" });
      },
    },
  });

  return (
    <div className="order-first flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-sidebar px-3 py-2 shell:order-none shell:flex-col shell:items-stretch shell:border-t shell:border-b-0 shell:px-0 shell:pt-3 shell:pb-0">
      <div className="min-w-0 flex-1 shell:flex-none shell:px-3">
        <p className="truncate font-medium">{user.name}</p>
        <p className="text-small text-muted-foreground">{roleNames[user.role]}</p>
      </div>
      <Button variant="outline" disabled={logOut.isPending} onClick={() => logOut.mutate()}>
        <LogOut aria-hidden data-icon="inline-start" />
        {logOut.isPending ? "Logging out" : "Log out"}
      </Button>
      {logOut.isError && (
        <p role="alert" className="w-full text-small text-destructive shell:px-3">
          {errorMessage(logOut.error)}
        </p>
      )}
    </div>
  );
}

// The API failed in a way that says nothing about the session, so this is not a case for Login.
function ShellError({ error }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <CenteredSurface title="This page didn't open">
      <p role="alert">{errorMessage(error)}</p>
      <Button onClick={() => void router.invalidate()}>Try again</Button>
    </CenteredSurface>
  );
}

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
import { getGetCurrentUserQueryOptions, useEndSession } from "@/api/generated/sessions/sessions";
import stockflowMark from "@/assets/stockflow.svg";
import { PrototypeSwitcher, themes, usePrototypeVariant } from "@/components/app-prototype"; // PROTOTYPE
import { CenteredSurface } from "@/components/centered-surface";
import { NoAccess } from "@/components/no-access";
import { Button } from "@/components/ui/button";
import { canReach, landingPageOf, pageAt, pagesOf } from "@/lib/access";
import { useCurrentUser } from "@/lib/current-user";
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
  "flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-3 text-body font-medium transition-colors hover:bg-muted shell:h-9.5 shell:min-h-0 shell:flex-none";

// navigation-and-lists R3: the phone's navigation stays in flow, clear of the work.
function AppShell() {
  const user = useCurrentUser();
  const pathname = useLocation({ select: (location) => location.pathname });
  const reachable = canReach(user.role, pathname);
  const current = reachable ? pageAt(pathname) : undefined;
  const parent = current && "parent" in current ? pageAt(current.parent) : undefined;
  const selected = parent ?? current;
  const theme = themes[usePrototypeVariant()]; // PROTOTYPE

  return (
    <div className={cn("app-shell flex min-h-dvh flex-col shell:flex-row", theme.root)}>
      <aside
        className={cn(
          "contents shell:sticky shell:top-0 shell:flex shell:h-dvh shell:w-54 shell:shrink-0 shell:flex-col shell:gap-6 shell:border-r shell:p-3",
          theme.asideDesktop,
        )}
      >
        {/* navigation-and-lists R1; users-and-access R12 */}
        <Link
          to={landingPageOf(user.role).path}
          aria-label="StockFlow home"
          className={cn(
            "flex min-h-11 items-center gap-2 border-b px-3 py-2 font-semibold transition-colors duration-150 shell:border-0 shell:bg-transparent shell:py-0",
            theme.side,
            theme.side === "bg-sidebar" && "hover:text-primary",
          )}
        >
          <img src={stockflowMark} alt="" className="size-8 shrink-0" />
          StockFlow
        </Link>
        <nav
          aria-label="Main"
          className={cn(
            "grid grid-cols-1 gap-2 border-b p-3 shell:flex shell:flex-1 shell:flex-col shell:border-b-0 shell:bg-transparent shell:p-0",
            theme.side,
          )}
        >
          {/* users-and-access R11, R22: only the pages of the User's Role. */}
          {pagesOf(user.role).map((page) => (
            <Link
              key={page.path}
              to={page.path}
              className={cn(navLinkClass, theme.link, page === selected && theme.active)}
              aria-current={page === selected ? "page" : undefined}
            >
              <page.icon aria-hidden size={18} className="shrink-0" />
              {page.title}
            </Link>
          ))}
        </nav>
        <UserPanel user={user} />
      </aside>
      <div className="min-w-0 flex-1">
        {/* navigation-and-lists R3 */}
        <nav
          aria-label="Current page"
          className={cn(
            "flex min-h-14 flex-wrap items-center gap-x-2 border-b px-3 py-2 shell:px-8",
            theme.top,
          )}
        >
          {parent && (
            <>
              <Link
                to={parent.path}
                className="flex min-h-11 items-center rounded-md text-primary underline decoration-transparent underline-offset-4 transition-colors duration-150 hover:decoration-current shell:min-h-0"
              >
                {parent.title}
              </Link>
              <span aria-hidden className="text-muted-foreground">
                /
              </span>
            </>
          )}
          <span aria-current="page" className="font-medium">
            {reachable ? (current?.title ?? "Page not found") : "No access"}
          </span>
        </nav>
        <main className="mx-auto w-full max-w-320 min-w-0 flex-1 px-3 py-6 shell:px-8 shell:py-8">
          {/* users-and-access R22: said on the page, not a silent redirect. */}
          {reachable ? <Outlet /> : <NoAccess landingPage={landingPageOf(user.role)} />}
        </main>
      </div>
      <PrototypeSwitcher />
    </div>
  );
}

function UserPanel({ user }: { user: CurrentUser }) {
  const theme = themes[usePrototypeVariant()]; // PROTOTYPE
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
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2 shell:order-none shell:flex-col shell:items-stretch shell:border-t shell:border-b-0 shell:bg-transparent shell:px-0 shell:pt-3 shell:pb-0",
        theme.side,
        theme.userText,
      )}
    >
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

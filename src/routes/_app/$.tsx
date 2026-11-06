import { createFileRoute, Link } from "@tanstack/react-router";

import { buttonVariants } from "@/components/ui/button";
import { landingPageOf } from "@/lib/access";

// Under the shell's guard, so an unknown address sends a visitor to Login like any page.
export const Route = createFileRoute("/_app/$")({ component: PageNotFound });

function PageNotFound() {
  const { user } = Route.useRouteContext();
  const landingPage = landingPageOf(user.role);

  return (
    <>
      <h1 className="text-title">Page not found</h1>
      <p className="mt-2 text-muted-foreground">This address doesn't match any page.</p>
      <Link to={landingPage.path} className={buttonVariants({ className: "mt-4" })}>
        Go to {landingPage.title}
      </Link>
    </>
  );
}

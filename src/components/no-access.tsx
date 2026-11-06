import { Link } from "@tanstack/react-router";

import { buttonVariants } from "@/components/ui/button";
import type { AppPage } from "@/lib/access";

// users-and-access R22: said on the page itself, so the User isn't left wondering why it changed.
export function NoAccess({ landingPage }: { landingPage: AppPage }) {
  return (
    <>
      <h1 className="text-title">No access</h1>
      <p className="mt-2 text-muted-foreground">Your Role can't open this page.</p>
      <Link to={landingPage.path} className={buttonVariants({ className: "mt-4" })}>
        Go to {landingPage.title}
      </Link>
    </>
  );
}

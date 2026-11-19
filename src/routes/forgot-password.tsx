import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { useRequestPasswordReset } from "@/api/generated/email-access/email-access";
import { RequestFirstTimeCodeBody } from "@/api/generated/email-access/email-access.zod";
import { CenteredSurface } from "@/components/centered-surface";
import { EmailInstructions } from "@/components/email-instructions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/forgot-password")({
  // Login passes the email it already asked for, so this page does not ask again.
  // The form's own email rule: anything else falls back to asking for the email.
  validateSearch: z.object({
    email: RequestFirstTimeCodeBody.shape.email.optional().catch(undefined),
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const known = Route.useSearch().email;
  const [email, setEmail] = useState(known ?? "");
  const request = useRequestPasswordReset({ mutation: { gcTime: 0 } });
  return (
    <CenteredSurface title="Forgot password">
      <p>
        {known
          ? "We'll send password instructions to this email."
          : "Enter your registered email to request password instructions."}
      </p>
      <EmailInstructions
        email={email}
        onEmailChange={setEmail}
        request={() => request.mutate({ data: { email } })}
        pending={request.isPending}
        error={request.error}
        success={request.isSuccess}
        sendLabel="Send reset link"
        pendingLabel="Sending reset link"
        emailFixed={known != null}
      />
      <Button variant="link" size="sm" className="h-auto min-h-6 self-start p-0" asChild>
        <Link to="/password-setup">Enter a first-time code</Link>
      </Button>
      <Button variant="outline" asChild>
        <Link to="/login">Back to Log in</Link>
      </Button>
    </CenteredSurface>
  );
}

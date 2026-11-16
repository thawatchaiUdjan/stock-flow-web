import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { useRequestPasswordReset } from "@/api/generated/email-access/email-access";
import { CenteredSurface } from "@/components/centered-surface";
import { EmailInstructions } from "@/components/email-instructions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPasswordPage });

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const request = useRequestPasswordReset({ mutation: { gcTime: 0 } });
  return (
    <CenteredSurface title="Forgot password">
      <p>Enter your registered email to request password instructions.</p>
      <EmailInstructions
        email={email}
        onEmailChange={setEmail}
        request={() => request.mutate({ data: { email } })}
        pending={request.isPending}
        error={request.error}
        success={request.isSuccess}
      />
      <Button variant="outline" asChild>
        <Link to="/password-setup">Enter a first-time code</Link>
      </Button>
      <Button variant="outline" asChild>
        <Link to="/login">Back to Log in</Link>
      </Button>
    </CenteredSurface>
  );
}

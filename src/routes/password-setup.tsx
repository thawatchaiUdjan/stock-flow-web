import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useRequestFirstTimeCode } from "@/api/generated/email-access/email-access";
import { CenteredSurface } from "@/components/centered-surface";
import { EmailInstructions } from "@/components/email-instructions";
import { FirstTimeCodeSetup } from "@/components/first-time-code-setup";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/password-setup")({ component: PasswordSetupPage });

function PasswordSetupPage() {
  const [email, setEmail] = useState("");
  // The code step shows once a code has gone out (users-and-access R29).
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();
  const request = useRequestFirstTimeCode({
    mutation: { gcTime: 0, onSuccess: () => setSent(true) },
  });

  return (
    <CenteredSurface title="Set up your password">
      {sent ? (
        <FirstTimeCodeSetup
          email={email}
          onRestart={() => {
            setSent(false);
            request.reset();
          }}
          // users-and-access R30: setting a password sends the person to Login, not into the app.
          onDone={() => void navigate({ to: "/login" })}
        />
      ) : (
        <>
          <p>
            Enter your registered email. We'll send a six-digit code that expires after 10 minutes.
          </p>
          <EmailInstructions
            email={email}
            onEmailChange={setEmail}
            request={() => request.mutate({ data: { email } })}
            pending={request.isPending}
            error={request.error}
            success={false}
            sendLabel="Send code"
            pendingLabel="Sending code"
          />
        </>
      )}
      <Button variant="outline" asChild>
        <Link to="/login">Back to Log in</Link>
      </Button>
    </CenteredSurface>
  );
}

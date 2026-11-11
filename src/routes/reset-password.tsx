import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { hasCode, messageFor } from "@/api/errors";
import { useResetEmailPassword } from "@/api/generated/email-access/email-access";
import { CenteredSurface } from "@/components/centered-surface";
import { EmailPasswordForm } from "@/components/email-password-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reset-password")({ component: ResetPasswordPage });

function ResetPasswordPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hash = useLocation({ select: (location) => location.hash });
  const [credential, setCredential] = useState(() => capture(hash));
  if (hash && hash !== credential.hash) setCredential(capture(hash));
  const token = credential.token;
  const reset = useResetEmailPassword({
    mutation: {
      gcTime: 0,
      onSuccess: () => {
        setCredential({ hash: "", token: null });
        // users-and-access R30-R31: end local authenticated state; never start a session.
        queryClient.clear();
        void navigate({ to: "/login", replace: true });
      },
    },
  });
  const resetMutation = reset.reset;
  useEffect(() => {
    if (!hash) return;
    resetMutation();
    // users-and-access R31: replace the credential-bearing entry without sending a request.
    void navigate({ to: "/reset-password", hash: "", search: {}, replace: true });
  }, [hash, navigate, resetMutation]);
  return (
    <CenteredSurface title="Reset your password">
      {token && !hasCode(reset.error, "password-reset-invalid") ? (
        <EmailPasswordForm
          save={(password) => reset.mutate({ data: { token, password } })}
          pending={reset.isPending}
          error={reset.error}
        />
      ) : (
        <Alert variant="destructive">
          <AlertDescription>{messageFor("password-reset-invalid")}</AlertDescription>
        </Alert>
      )}
      <Button variant="outline" asChild>
        <Link to="/forgot-password">Forgot password</Link>
      </Button>
      <Button variant="outline" asChild>
        <Link to="/login">Back to Log in</Link>
      </Button>
    </CenteredSurface>
  );
}

function capture(hash: string) {
  const tokens = new URLSearchParams(hash).getAll("token");
  return { hash, token: tokens.length === 1 && tokens[0] ? tokens[0] : null };
}

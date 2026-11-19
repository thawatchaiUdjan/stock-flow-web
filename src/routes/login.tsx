import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { errorMessage, hasCode, hasFieldError, messageFor } from "@/api/errors";
import { useIdentifyLoginEmail } from "@/api/generated/email-access/email-access";
import {
  getGetCurrentUserQueryKey,
  getGetCurrentUserQueryOptions,
  useCreateSession,
} from "@/api/generated/sessions/sessions";
import { CenteredSurface } from "@/components/centered-surface";
import { EmailField } from "@/components/email-instructions";
import { LoginPrototypeShell } from "@/components/login-prototype";
import { FirstTimeCodeSetup } from "@/components/first-time-code-setup";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { landingPageOf } from "@/lib/access";
import { addressAfterLogin } from "@/lib/session";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({
    redirect: z.string().optional().catch(undefined),
    variant: z.enum(["A", "B", "C"]).optional().catch(undefined), // PROTOTYPE
  }),
  beforeLoad: async ({ context }) => {
    let user;
    try {
      user = await context.queryClient.ensureQueryData(getGetCurrentUserQueryOptions());
    } catch (error) {
      // users-and-access R26. The API keeps the cookie, so Login hears session-ended too.
      return { sessionEnded: hasCode(error, "session-ended") };
    }
    // users-and-access R25
    throw redirect({ to: landingPageOf(user.role).path });
  },
  component: LoginPage,
});

// users-and-access R2: the email first, then what the API says it may do next.
type Step =
  | { name: "email" }
  | { name: "password"; email: string }
  | { name: "code"; email: string; codeSent: boolean };

// users-and-access R50, R52: the answers that end at the email step with a message.
const notices = {
  "no-account": "No account uses this email. Ask the shop Owner for help.",
  "installation-link":
    "This is the first Owner's email. Use the installation Setup link to set your password.",
} as const;

function LoginPage() {
  const { sessionEnded } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>({ name: "email" });

  const identify = useIdentifyLoginEmail({
    mutation: {
      onSuccess: ({ next, codeDelivery }, { data: { email } }) => {
        if (next === "password") setStep({ name: "password", email });
        // users-and-access R51: the code step also opens when no new code went out.
        if (next === "first-time-code") {
          setStep({
            name: "code",
            email,
            codeSent: codeDelivery === "sent",
          });
        }
      },
    },
  });
  const logIn = useCreateSession({
    mutation: {
      onSuccess: async (user) => {
        queryClient.setQueryData(getGetCurrentUserQueryKey(), user);
        // users-and-access R24
        await navigate({ href: addressAfterLogin(user.role, search.redirect) });
      },
    },
  });

  // No validators: the API answers any email and password alike (users-and-access R5).
  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: ({ value }) => {
      if (step.name === "email") identify.mutate({ data: { email: value.email } });
      if (step.name === "password")
        logIn.mutate({ data: { email: step.email, password: value.password } });
    },
  });

  function backToEmail() {
    form.setFieldValue("password", "");
    identify.reset();
    logIn.reset();
    setStep({ name: "email" });
  }

  if (step.name === "code") {
    return (
      <CenteredSurface title="Set up your password">
        <FirstTimeCodeSetup
          email={step.email}
          codeSent={step.codeSent}
          onRestart={backToEmail}
          // users-and-access R30: setting a password does not log in; the person returns to Login.
          onDone={backToEmail}
        />
      </CenteredSurface>
    );
  }

  const answer = identify.data?.next;
  const notice =
    step.name === "email" && (answer === "no-account" || answer === "installation-link")
      ? notices[answer]
      : undefined;
  const emailRejected = hasFieldError(identify.error, "email");
  const failure = logIn.error ?? (emailRejected ? null : identify.error);

  return (
    <LoginPrototypeShell
      title="Log in"
      subtitle={
        step.name === "email"
          ? "Use your work email to continue."
          : "Enter your password to continue."
      }
      variant={search.variant ?? "A"}
      onVariant={(variant) =>
        void navigate({ to: ".", search: (prev) => ({ ...prev, variant }), replace: true })
      }
    >
      {failure != null && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(failure)}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      {sessionEnded && logIn.isIdle && identify.isIdle && (
        <Alert>
          <AlertDescription>{messageFor("session-ended")}</AlertDescription>
        </Alert>
      )}
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <FieldGroup>
          {step.name === "email" ? (
            <>
              <form.Field name="email">
                {(field) => (
                  <EmailField
                    email={field.state.value}
                    onChange={field.handleChange}
                    disabled={identify.isPending}
                    invalid={emailRejected}
                  />
                )}
              </form.Field>
              <Button type="submit" disabled={identify.isPending}>
                {identify.isPending ? "Checking" : "Continue"}
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium break-all">{step.email}</span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto min-h-6 p-0"
                  onClick={backToEmail}
                >
                  Change email
                </Button>
              </div>
              <form.Field name="password">
                {(field) => (
                  <Field>
                    <div className="flex items-center justify-between gap-2">
                      <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                      <Button variant="link" size="sm" className="h-auto min-h-6 p-0" asChild>
                        <Link to="/forgot-password" search={{ email: step.email }}>
                          Forgot password?
                        </Link>
                      </Button>
                    </div>
                    <Input
                      id={field.name}
                      type="password"
                      autoComplete="current-password"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                  </Field>
                )}
              </form.Field>
              <Button type="submit" disabled={logIn.isPending}>
                {logIn.isPending ? "Logging in" : "Log in"}
              </Button>
            </>
          )}
        </FieldGroup>
      </form>
    </LoginPrototypeShell>
  );
}

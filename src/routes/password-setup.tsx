import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { errorMessage, hasCode, hasFieldError } from "@/api/errors";
import {
  useRequestFirstTimeCode,
  useSetEmailPassword,
  useVerifyFirstTimeCode,
} from "@/api/generated/email-access/email-access";
import { VerifyFirstTimeCodeBody } from "@/api/generated/email-access/email-access.zod";
import { CenteredSurface } from "@/components/centered-surface";
import { EmailInstructions } from "@/components/email-instructions";
import { EmailPasswordForm } from "@/components/email-password-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/password-setup")({ component: PasswordSetupPage });

function PasswordSetupPage() {
  const [email, setEmail] = useState("");
  // users-and-access R42: a grant authorizes password setup only, and survives no reload.
  const [grant, setGrant] = useState<string | null>(null);
  const navigate = useNavigate();
  const request = useRequestFirstTimeCode({ mutation: { gcTime: 0 } });
  const verify = useVerifyFirstTimeCode({
    mutation: {
      gcTime: 0,
      onSuccess: (result) => {
        setGrant(result.token);
        codeForm.reset();
      },
    },
  });
  const password = useSetEmailPassword({
    mutation: {
      gcTime: 0,
      onSuccess: () => {
        setGrant(null);
        void navigate({ to: "/login" });
      },
    },
  });
  const codeForm = useForm({
    defaultValues: { code: "" },
    validators: { onSubmit: VerifyFirstTimeCodeBody.pick({ code: true }) },
    onSubmit: ({ value }) => {
      if (!verify.isPending && !request.isPending)
        verify.mutate({ data: { email, code: value.code } });
    },
  });
  const invalidGrant = hasCode(password.error, "password-setup-invalid");

  return (
    <CenteredSurface title="Set up your password">
      {grant ? (
        <>
          {invalidGrant ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(password.error)}</AlertDescription>
            </Alert>
          ) : (
            <EmailPasswordForm
              email={email}
              save={(value) => password.mutate({ data: { token: grant, password: value } })}
              pending={password.isPending}
              error={password.error}
            />
          )}
          <Button
            variant="outline"
            disabled={password.isPending}
            onClick={() => {
              setGrant(null);
              verify.reset();
              password.reset();
              request.reset();
            }}
          >
            Start password setup again
          </Button>
        </>
      ) : (
        <>
          <p>
            Enter your registered email and the six-digit code from your email. Codes expire after
            10 minutes.
          </p>
          <EmailInstructions
            email={email}
            onEmailChange={(value) => {
              setEmail(value);
              verify.reset();
            }}
            request={() => request.mutate({ data: { email } })}
            pending={request.isPending || verify.isPending}
            error={request.error ?? (hasFieldError(verify.error, "email") ? verify.error : null)}
            success={request.isSuccess}
          />
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void codeForm.handleSubmit();
            }}
          >
            <FieldGroup>
              {verify.isError &&
                !hasFieldError(verify.error, "code") &&
                !hasFieldError(verify.error, "email") && (
                  <Alert variant="destructive">
                    <AlertDescription>{errorMessage(verify.error)}</AlertDescription>
                  </Alert>
                )}
              <codeForm.Field name="code">
                {(field) => {
                  const invalid =
                    field.state.meta.errors.length > 0 || hasFieldError(verify.error, "code");
                  return (
                    <Field data-invalid={invalid}>
                      <FieldLabel htmlFor={field.name}>First-time code</FieldLabel>
                      <Input
                        disabled={verify.isPending || request.isPending}
                        id={field.name}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => {
                          field.handleChange(event.target.value);
                          verify.reset();
                        }}
                        aria-invalid={invalid}
                        aria-describedby={invalid ? "code-error" : "code-hint"}
                      />
                      <FieldDescription id="code-hint">
                        Use the newest code. You can paste all six digits.
                      </FieldDescription>
                      {invalid && (
                        <FieldError id="code-error">
                          Enter the six-digit code from your email.
                        </FieldError>
                      )}
                    </Field>
                  );
                }}
              </codeForm.Field>
              <Button type="submit" disabled={verify.isPending || request.isPending}>
                {verify.isPending ? "Verifying code" : "Verify code"}
              </Button>
            </FieldGroup>
          </form>
        </>
      )}
      <Button variant="outline" asChild>
        <Link to="/login">Back to Log in</Link>
      </Button>
    </CenteredSurface>
  );
}

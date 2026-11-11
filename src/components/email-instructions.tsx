import { useForm } from "@tanstack/react-form";
import { useEffect, useState } from "react";

import { errorMessage, hasFieldError } from "@/api/errors";
import { RequestFirstTimeCodeBody } from "@/api/generated/email-access/email-access.zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export const instructionsMessage = "If this email is eligible, we've sent instructions.";

export function EmailField({
  email,
  onChange,
  invalid = false,
  disabled = false,
}: {
  email: string;
  onChange: (email: string) => void;
  invalid?: boolean;
  disabled?: boolean;
}) {
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor="email">Email</FieldLabel>
      <Input
        disabled={disabled}
        id="email"
        type="email"
        autoComplete="username"
        value={email}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid}
        aria-describedby={invalid ? "email-error" : undefined}
      />
      {invalid && <FieldError id="email-error">Enter a valid email address.</FieldError>}
    </Field>
  );
}

// users-and-access R43-R44: explicit requests only; suppressed sends have the same result.
export function EmailInstructions({
  email,
  onEmailChange,
  request,
  pending,
  error,
  success,
}: {
  email: string;
  onEmailChange: (email: string) => void;
  request: () => void;
  pending: boolean;
  error: unknown;
  success: boolean;
}) {
  const form = useForm({
    defaultValues: { email },
    validators: { onSubmit: RequestFirstTimeCodeBody },
    onSubmit: () => {
      if (!pending) request();
    },
  });
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        {error != null && !hasFieldError(error, "email") && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(error)}</AlertDescription>
          </Alert>
        )}
        <form.Field name="email">
          {(field) => (
            <EmailField
              email={field.state.value}
              onChange={(value) => {
                field.handleChange(value);
                onEmailChange(value);
              }}
              disabled={pending}
              invalid={field.state.meta.errors.length > 0 || hasFieldError(error, "email")}
            />
          )}
        </form.Field>
        {success && <output>{instructionsMessage}</output>}
        <FieldDescription>
          Check your inbox and spam folder. Wait at least a minute before requesting again. Only the
          newest instructions work.
        </FieldDescription>
        {success ? (
          <RequestAgain pending={pending} />
        ) : (
          <Button type="submit" disabled={pending}>
            {pending ? "Requesting instructions" : "Send instructions"}
          </Button>
        )}
      </FieldGroup>
    </form>
  );
}

function RequestAgain({ pending }: { pending: boolean }) {
  const [coolingDown, setCoolingDown] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setCoolingDown(false), 60_000);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <Button type="submit" disabled={pending || coolingDown}>
      Send instructions
    </Button>
  );
}

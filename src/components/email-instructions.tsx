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
  sendLabel,
  pendingLabel,
  emailFixed = false,
}: {
  email: string;
  onEmailChange: (email: string) => void;
  request: () => void;
  pending: boolean;
  error: unknown;
  success: boolean;
  sendLabel: string;
  pendingLabel: string;
  // The email is already known (asked on Login): show it, don't ask again.
  emailFixed?: boolean;
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
        {error != null && (emailFixed || !hasFieldError(error, "email")) && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(error)}</AlertDescription>
          </Alert>
        )}
        {emailFixed ? (
          <p className="font-medium break-all">{email}</p>
        ) : (
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
        )}
        {success && <output>{instructionsMessage}</output>}
        <FieldDescription>
          Check your inbox and spam folder. Wait at least a minute before requesting again. Only the
          newest instructions work.
        </FieldDescription>
        {success ? (
          <RequestAgain pending={pending} label={sendLabel} />
        ) : (
          <Button type="submit" disabled={pending}>
            {pending ? pendingLabel : sendLabel}
          </Button>
        )}
      </FieldGroup>
    </form>
  );
}

function RequestAgain({ pending, label }: { pending: boolean; label: string }) {
  const coolingDown = useCooldownSeconds(1) > 0;
  return (
    <Button type="submit" disabled={pending || coolingDown}>
      {label}
    </Button>
  );
}

const cooldownSeconds = 60;

// users-and-access R43: one send per 60 seconds. `sends` counts successful sends; each restarts the wait.
// Returns the seconds left before the next send; 0 means it can go out.
export function useCooldownSeconds(sends: number) {
  const [tick, setTick] = useState({ sends: 0, left: 0 });
  useEffect(() => {
    if (sends === 0) return;
    const end = Date.now() + cooldownSeconds * 1000;
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setTick({ sends, left });
      if (left === 0) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sends]);
  if (sends === 0) return 0;
  return tick.sends === sends ? tick.left : cooldownSeconds;
}

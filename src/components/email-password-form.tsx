import { useState } from "react";

import { errorMessage, hasFieldError } from "@/api/errors";
import { setEmailPasswordBodyPasswordMin } from "@/api/generated/email-access/email-access.zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function EmailPasswordForm({
  save,
  pending,
  error,
  email,
}: {
  save: (password: string) => void;
  pending: boolean;
  error: unknown;
  email?: string;
}) {
  const [password, setPassword] = useState("");
  const [tooShort, setTooShort] = useState(false);
  const invalid = tooShort || hasFieldError(error, "password");
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        // users-and-access R19: count characters, not UTF-16 units or bytes.
        const short = Array.from(password).length < setEmailPasswordBodyPasswordMin;
        setTooShort(short);
        if (!short && !pending) save(password);
      }}
    >
      <FieldGroup>
        {error != null && !hasFieldError(error, "password") && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(error)}</AlertDescription>
          </Alert>
        )}
        {email && <input hidden readOnly type="email" autoComplete="username" value={email} />}
        <Field data-invalid={invalid}>
          <FieldLabel htmlFor="password">New password</FieldLabel>
          <Input
            disabled={pending}
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setTooShort(false);
            }}
            aria-invalid={invalid}
            aria-describedby={invalid ? "password-error" : "password-hint"}
          />
          <FieldDescription id="password-hint">
            At least {setEmailPasswordBodyPasswordMin} characters.
          </FieldDescription>
          {invalid && (
            <FieldError id="password-error">
              Use at least {setEmailPasswordBodyPasswordMin} characters.
            </FieldError>
          )}
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving password" : "Set password"}
        </Button>
      </FieldGroup>
    </form>
  );
}

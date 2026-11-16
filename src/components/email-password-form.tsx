import { useForm } from "@tanstack/react-form";
import { z } from "zod";

import { errorMessage, hasFieldError } from "@/api/errors";
import { setEmailPasswordBodyPasswordMin } from "@/api/generated/email-access/email-access.zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

// users-and-access R19: count characters, not UTF-16 units or bytes.
const passwordSchema = z.object({
  password: z
    .string()
    .refine(
      (value) => Array.from(value).length >= setEmailPasswordBodyPasswordMin,
      `Use at least ${setEmailPasswordBodyPasswordMin} characters.`,
    ),
});

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
  const form = useForm({
    defaultValues: { password: "" },
    validators: { onSubmit: passwordSchema },
    onSubmit: ({ value }) => {
      if (!pending) save(value.password);
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
        {error != null && !hasFieldError(error, "password") && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(error)}</AlertDescription>
          </Alert>
        )}
        {email && <input hidden readOnly type="email" autoComplete="username" value={email} />}
        <form.Field name="password">
          {(field) => {
            const invalid = field.state.meta.errors.length > 0 || hasFieldError(error, "password");
            return (
              <Field data-invalid={invalid}>
                <FieldLabel htmlFor={field.name}>New password</FieldLabel>
                <Input
                  disabled={pending}
                  id={field.name}
                  type="password"
                  autoComplete="new-password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
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
            );
          }}
        </form.Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving password" : "Set password"}
        </Button>
      </FieldGroup>
    </form>
  );
}

import { useForm } from "@tanstack/react-form";
import { createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

import { errorMessage, hasCode, hasFieldError, messageFor } from "@/api/errors";
import type { ReadSetupLinkOutputBody } from "@/api/generated/model";
import { useReadSetupLink, useSetPassword } from "@/api/generated/setup-links/setup-links";
import { setPasswordBodyPasswordMin } from "@/api/generated/setup-links/setup-links.zod";
import { CenteredSurface } from "@/components/centered-surface";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/set-password")({ component: SetPasswordPage });

const tooShort = `Use at least ${setPasswordBodyPasswordMin} characters.`;

// users-and-access R19. The limit is the contract's, so this can't be stricter than the API.
const passwordSchema = z.object({
  password: z.string().min(setPasswordBodyPasswordMin, tooShort),
});

function SetPasswordPage() {
  // users-and-access R27. The fragment reaches no server, so no request log holds it (ADR 0022).
  const token = useLocation({ select: (location) => location.hash });
  const setupLink = useReadSetupLink(
    { token },
    { query: { enabled: token !== "", staleTime: Infinity } },
  );

  if (token === "" || hasCode(setupLink.error, "setup-link-invalid")) return <LinkNoLongerWorks />;

  if (setupLink.isError) {
    return (
      <CenteredSurface title="Set your password">
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(setupLink.error)}</AlertDescription>
        </Alert>
        <Button onClick={() => void setupLink.refetch()}>Try again</Button>
      </CenteredSurface>
    );
  }

  if (setupLink.isPending) {
    return (
      <CenteredSurface title="Set your password">
        <output className="text-muted-foreground">Checking your Setup link</output>
      </CenteredSurface>
    );
  }

  return <PasswordForm token={token} person={setupLink.data} />;
}

function LinkNoLongerWorks() {
  return (
    <CenteredSurface title="This link can't be used">
      <Alert variant="destructive">
        <AlertDescription>{messageFor("setup-link-invalid")}</AlertDescription>
      </Alert>
    </CenteredSurface>
  );
}

function PasswordForm({ token, person }: { token: string; person: ReadSetupLinkOutputBody }) {
  const navigate = useNavigate();
  const setPassword = useSetPassword({
    mutation: {
      // users-and-access R30
      onSuccess: () => navigate({ to: "/login" }),
    },
  });

  const form = useForm({
    defaultValues: { password: "" },
    validators: { onSubmit: passwordSchema },
    onSubmit: ({ value }) => setPassword.mutate({ data: { token, password: value.password } }),
  });

  if (hasCode(setPassword.error, "setup-link-invalid")) return <LinkNoLongerWorks />;

  const refusedByApi = hasFieldError(setPassword.error, "password");

  return (
    <CenteredSurface title="Set your password">
      <div>
        <p className="font-medium">{person.name}</p>
        <p className="text-muted-foreground">{person.email}</p>
      </div>
      {setPassword.isError && !refusedByApi && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(setPassword.error)}</AlertDescription>
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
          {/* Lets a password manager file the new password under the right email. */}
          <input hidden readOnly type="email" autoComplete="username" value={person.email} />
          <form.Field name="password">
            {(field) => {
              const errors = refusedByApi ? [{ message: tooShort }] : field.state.meta.errors;
              const invalid = errors.length > 0;

              return (
                <Field data-invalid={invalid}>
                  <FieldLabel htmlFor={field.name}>New password</FieldLabel>
                  <Input
                    id={field.name}
                    type="password"
                    autoComplete="new-password"
                    aria-invalid={invalid}
                    aria-describedby={invalid ? "password-error" : "password-hint"}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                  {!invalid && (
                    <FieldDescription id="password-hint">
                      At least {setPasswordBodyPasswordMin} characters.
                    </FieldDescription>
                  )}
                  <FieldError id="password-error" errors={errors} />
                </Field>
              );
            }}
          </form.Field>
          <Button type="submit" disabled={setPassword.isPending}>
            {setPassword.isPending ? "Setting password" : "Set password"}
          </Button>
        </FieldGroup>
      </form>
    </CenteredSurface>
  );
}

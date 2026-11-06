import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

import { errorMessage, hasCode, messageFor } from "@/api/errors";
import {
  getGetCurrentUserQueryKey,
  getGetCurrentUserQueryOptions,
  useCreateSession,
} from "@/api/generated/sessions/sessions";
import { CenteredSurface } from "@/components/centered-surface";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { landingPage, safeReturnAddress } from "@/lib/session";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ redirect: z.string().optional().catch(undefined) }),
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(getGetCurrentUserQueryOptions());
    } catch (error) {
      // users-and-access R26. The API keeps the cookie, so Login hears session-ended too.
      return { sessionEnded: hasCode(error, "session-ended") };
    }
    // users-and-access R25
    throw redirect({ to: landingPage });
  },
  component: LoginPage,
});

function LoginPage() {
  const { sessionEnded } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const logIn = useCreateSession({
    mutation: {
      onSuccess: async (user) => {
        queryClient.setQueryData(getGetCurrentUserQueryKey(), user);
        // users-and-access R24
        await navigate({ href: safeReturnAddress(search.redirect) ?? landingPage });
      },
    },
  });

  // No validators: the API answers any email and password alike (users-and-access R5).
  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: ({ value }) => logIn.mutate({ data: value }),
  });

  return (
    <CenteredSurface title="Log in">
      {logIn.isError && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(logIn.error)}</AlertDescription>
        </Alert>
      )}
      {sessionEnded && logIn.isIdle && (
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
          <form.Field name="email">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                <Input
                  id={field.name}
                  type="email"
                  autoComplete="username"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="password">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Password</FieldLabel>
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
        </FieldGroup>
      </form>
    </CenteredSurface>
  );
}

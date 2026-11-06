import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

import { errorMessage, hasCode, hasFieldError, messageFor } from "@/api/errors";
import type { CreateUserBodyRole } from "@/api/generated/model";
import { getListUsersQueryKey, useCreateUser } from "@/api/generated/users/users";
import { CreateUserBody } from "@/api/generated/users/users.zod";
import { SetupLinkDisplay } from "@/components/setup-link-display";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { fieldMessages, NameField, RoleField } from "@/components/user-fields";

export const Route = createFileRoute("/_app/users/new")({ component: NewUserPage });

// users-and-access R14. The rules are the contract's, so this can't be stricter than the API;
// the spaces around a pasted name or email are dropped before they are checked.
const userSchema = z.object({
  name: z.string().trim().pipe(CreateUserBody.shape.name),
  email: z.string().trim().pipe(CreateUserBody.shape.email),
  role: CreateUserBody.shape.role,
});

function NewUserPage() {
  const queryClient = useQueryClient();
  const createUser = useCreateUser({
    mutation: {
      // users-and-access R28: the Setup link is shown once, so nothing keeps it after this view.
      gcTime: 0,
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }),
    },
  });

  const form = useForm({
    defaultValues: { name: "", email: "", role: "" as CreateUserBodyRole | "" },
    validators: { onSubmit: userSchema },
    onSubmit: ({ value }) =>
      createUser.mutate({
        data: {
          name: value.name.trim(),
          email: value.email.trim(),
          role: value.role as CreateUserBodyRole,
        },
      }),
  });

  if (createUser.data) {
    return (
      <SetupLinkDisplay
        title="User created"
        name={createUser.data.user.name}
        setupLink={createUser.data.setupLink}
        actions={
          <>
            <Button asChild>
              <Link to="/users">Back to Users</Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                createUser.reset();
                form.reset();
              }}
            >
              Create another User
            </Button>
          </>
        }
      />
    );
  }

  // The API's refusals sit beside the field they are about, in the same words as the checks above.
  function emailRefusal() {
    if (hasCode(createUser.error, "email-taken")) {
      // users-and-access R3
      return messageFor("email-taken");
    }
    return hasFieldError(createUser.error, "email") ? fieldMessages.email : undefined;
  }
  const refusedByFields =
    hasCode(createUser.error, "email-taken") ||
    (["name", "email", "role"] as const).some((field) => hasFieldError(createUser.error, field));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title">Create User</h1>
      <div className="flex max-w-160 flex-col gap-4 rounded-lg border bg-card p-6">
        {createUser.isError && !refusedByFields && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(createUser.error)}</AlertDescription>
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
            <form.Field name="name">
              {(field) => (
                <NameField field={field} refused={hasFieldError(createUser.error, "name")} />
              )}
            </form.Field>
            <form.Field name="email">
              {(field) => {
                const error = emailRefusal();
                const invalid = field.state.meta.errors.length > 0 || error !== undefined;

                return (
                  <Field data-invalid={invalid}>
                    <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                    <Input
                      id={field.name}
                      type="email"
                      autoComplete="off"
                      aria-invalid={invalid}
                      aria-describedby={invalid ? "email-error" : undefined}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        // The refusal was about the old email.
                        if (createUser.isError) createUser.reset();
                        field.handleChange(event.target.value);
                      }}
                    />
                    <FieldError id="email-error">
                      {invalid ? (error ?? fieldMessages.email) : null}
                    </FieldError>
                  </Field>
                );
              }}
            </form.Field>
            <form.Field name="role">
              {(field) => (
                <RoleField field={field} refused={hasFieldError(createUser.error, "role")} />
              )}
            </form.Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={createUser.isPending}>
                {createUser.isPending ? "Creating User" : "Create User"}
              </Button>
              <Button variant="outline" asChild>
                <Link to="/users">Cancel</Link>
              </Button>
            </div>
          </FieldGroup>
        </form>
      </div>
    </div>
  );
}

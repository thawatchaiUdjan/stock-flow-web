import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { errorMessage, hasCode, hasFieldError, messageFor } from "@/api/errors";
import type { CreateUserBodyRole, SetupLink } from "@/api/generated/model";
import { getListUsersQueryKey, useCreateUser } from "@/api/generated/users/users";
import { CreateUserBody } from "@/api/generated/users/users.zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatDateTime } from "@/lib/format";
import { roleNames } from "@/lib/roles";

export const Route = createFileRoute("/_app/users/new")({ component: NewUserPage });

const fieldMessages = {
  name: "Enter a name.",
  email: "Enter a valid email address.",
  role: "Choose a Role.",
};

// users-and-access R14. The rules are the contract's, so this can't be stricter than the API;
// the spaces around a pasted name or email are dropped before they are checked.
const userSchema = z.object({
  name: z.string().trim().pipe(CreateUserBody.shape.name),
  email: z.string().trim().pipe(CreateUserBody.shape.email),
  role: CreateUserBody.shape.role,
});

// users-and-access R9, R10: the Owner is made at installation, never here.
const roles = (["admin", "staff"] as const).map((value) => ({ value, label: roleNames[value] }));

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
      <SetupLinkView
        name={createUser.data.user.name}
        setupLink={createUser.data.setupLink}
        onCreateAnother={() => {
          createUser.reset();
          form.reset();
        }}
      />
    );
  }

  // The API's refusals sit beside the field they are about, in the same words as the checks above.
  function fieldMessage(field: keyof typeof fieldMessages) {
    if (field === "email" && hasCode(createUser.error, "email-taken")) {
      // users-and-access R3
      return messageFor("email-taken");
    }
    return hasFieldError(createUser.error, field) ? fieldMessages[field] : undefined;
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
              {(field) => {
                const error = fieldMessage("name");
                const invalid = field.state.meta.errors.length > 0 || error !== undefined;

                return (
                  <Field data-invalid={invalid}>
                    <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                    <Input
                      id={field.name}
                      autoComplete="off"
                      aria-invalid={invalid}
                      aria-describedby={invalid ? "name-error" : undefined}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                    <FieldError id="name-error">{invalid ? fieldMessages.name : null}</FieldError>
                  </Field>
                );
              }}
            </form.Field>
            <form.Field name="email">
              {(field) => {
                const error = fieldMessage("email");
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
              {(field) => {
                const invalid =
                  field.state.meta.errors.length > 0 || fieldMessage("role") !== undefined;

                return (
                  <FieldSet data-invalid={invalid}>
                    <FieldLegend variant="label">Role</FieldLegend>
                    <RadioGroup
                      aria-describedby={invalid ? "role-error" : undefined}
                      value={field.state.value}
                      onValueChange={(value) => field.handleChange(value as CreateUserBodyRole)}
                    >
                      {roles.map(({ value, label }) => (
                        <Field key={value} orientation="horizontal" data-invalid={invalid}>
                          <RadioGroupItem
                            value={value}
                            id={`role-${value}`}
                            aria-invalid={invalid}
                          />
                          <FieldLabel htmlFor={`role-${value}`} className="font-normal">
                            {label}
                          </FieldLabel>
                        </Field>
                      ))}
                    </RadioGroup>
                    <FieldError id="role-error">{invalid ? fieldMessages.role : null}</FieldError>
                  </FieldSet>
                );
              }}
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

// users-and-access R28: shown once, and the API keeps only a hash (ADR 0002).
function SetupLinkView({
  name,
  setupLink,
  onCreateAnother,
}: {
  name: string;
  setupLink: SetupLink;
  onCreateAnother: () => void;
}) {
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  // The api returns only the token, so the link is right on every deployment (ADR 0022).
  const link = `${window.location.origin}/set-password#${setupLink.token}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title">User created</h1>
      <div className="flex max-w-160 flex-col gap-4 rounded-lg border bg-card p-6">
        <p>
          Pass this Setup link to {name}. They use it to set their own password. It won't be shown
          again, so copy it now.
        </p>
        <Field>
          <FieldLabel htmlFor="setup-link">Setup link</FieldLabel>
          <div className="flex flex-col gap-2 shell:flex-row">
            <Input
              id="setup-link"
              readOnly
              value={link}
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button variant="outline" onClick={() => void copyLink()}>
              {copy === "copied" ? (
                <Check aria-hidden data-icon="inline-start" />
              ) : (
                <Copy aria-hidden data-icon="inline-start" />
              )}
              {copy === "copied" ? "Copied" : "Copy link"}
            </Button>
          </div>
          {copy === "failed" && (
            <FieldError>Couldn't copy. Select the link and copy it by hand.</FieldError>
          )}
        </Field>
        {/* users-and-access R27 */}
        <p className="text-muted-foreground">Expires {formatDateTime(setupLink.expiresAt)}.</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/users">Back to Users</Link>
          </Button>
          <Button variant="outline" onClick={onCreateAnother}>
            Create another User
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { z } from "zod";

import { errorMessage, hasFieldError, messageFor } from "@/api/errors";
import type { UpdateUserBody, UpdateUserBodyRole, User } from "@/api/generated/model";
import { getListUsersQueryKey, useListUsers, useUpdateUser } from "@/api/generated/users/users";
import { UpdateUserBody as UpdateUserBodySchema } from "@/api/generated/users/users.zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NameField, RoleField } from "@/components/user-fields";

export const Route = createFileRoute("/_app/users/$id/edit")({ component: EditUserPage });

// users-and-access R14. The rules are the contract's, so this can't be stricter than the API;
// the spaces around a pasted name are dropped before it is checked.
const userSchema = z.object({
  name: z.string().trim().pipe(UpdateUserBodySchema.shape.name.unwrap()),
  role: UpdateUserBodySchema.shape.role.unwrap(),
});

function EditUserPage() {
  const { id } = Route.useParams();
  const users = useListUsers();
  const user = users.data?.users.find((one) => String(one.id) === id);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title">Edit User</h1>
      {users.isPending && <output className="text-muted-foreground">Loading User</output>}
      {users.isError && (
        <>
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(users.error)}</AlertDescription>
          </Alert>
          <Button variant="outline" className="self-start" onClick={() => void users.refetch()}>
            Try again
          </Button>
        </>
      )}
      {users.isSuccess && !user && <Refusal>No User has this address.</Refusal>}
      {/* users-and-access R18, context ADR 0004: the API refuses it too. */}
      {user?.role === "owner" && <Refusal>{messageFor("target-is-owner")}</Refusal>}
      {user && user.role !== "owner" && <EditUserForm key={user.id} user={user} />}
    </div>
  );
}

function Refusal({ children }: { children: ReactNode }) {
  return (
    <div className="flex max-w-160 flex-col items-start gap-4 rounded-lg border bg-card p-6">
      <p>{children}</p>
      <Button asChild>
        <Link to="/users">Back to Users</Link>
      </Button>
    </div>
  );
}

function EditUserForm({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const updateUser = useUpdateUser({
    mutation: {
      onSuccess: async () => {
        // Waited for, so the list opens with the change and not the old row.
        await queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        await navigate({ to: "/users" });
      },
    },
  });

  const form = useForm({
    defaultValues: { name: user.name, role: user.role as UpdateUserBodyRole },
    validators: { onSubmit: userSchema },
    onSubmit: async ({ value }) => {
      const name = value.name.trim();
      const changes: UpdateUserBody = {
        ...(name !== user.name && { name }),
        ...(value.role !== user.role && { role: value.role }),
      };
      if (Object.keys(changes).length === 0) {
        await navigate({ to: "/users" });
        return;
      }
      updateUser.mutate({ id: user.id, data: changes });
    },
  });

  const refusedByFields =
    hasFieldError(updateUser.error, "name") || hasFieldError(updateUser.error, "role");

  return (
    <div className="flex max-w-160 flex-col gap-4 rounded-lg border bg-card p-6">
      {updateUser.isError && !refusedByFields && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(updateUser.error)}</AlertDescription>
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
              <NameField field={field} refused={hasFieldError(updateUser.error, "name")} />
            )}
          </form.Field>
          {/* users-and-access R15 */}
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" readOnly value={user.email} />
          </Field>
          <form.Field name="role">
            {(field) => (
              <RoleField field={field} refused={hasFieldError(updateUser.error, "role")} />
            )}
          </form.Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={updateUser.isPending}>
              {updateUser.isPending ? "Saving changes" : "Save changes"}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/users">Cancel</Link>
            </Button>
          </div>
        </FieldGroup>
      </form>
    </div>
  );
}

import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { z } from "zod";

import { errorMessage, isNotFound } from "@/api/errors";
import type { User } from "@/api/generated/model";
import {
  getListUsersQueryKey,
  useDeleteUser,
  useListUsers,
  useUpdateUser,
} from "@/api/generated/users/users";
import { Confirmation } from "@/components/confirmation";
import { DeleteConfirmation } from "@/components/delete-confirmation";
import { ListPaging } from "@/components/list-paging";
import { RowActions, rowActionItem } from "@/components/row-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentUser } from "@/lib/current-user";
import { pagingSearch } from "@/lib/paging";
import { roleNames, statusNames } from "@/lib/roles";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/users/")({
  validateSearch: z.object(pagingSearch),
  component: UsersPage,
});

function UsersPage() {
  const users = useListUsers();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const page = search.page ?? 1;
  const size = search.size ?? 25;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-title">Users</h1>
        <Button asChild>
          <Link to="/users/new">Create User</Link>
        </Button>
      </div>
      {users.isPending && <output className="text-muted-foreground">Loading Users</output>}
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
      {users.isSuccess && (
        <UsersTable
          users={users.data.users.slice((page - 1) * size, page * size)}
          hasOthers={users.data.users.some(({ role }) => role !== "owner")}
        />
      )}
      <ListPaging
        page={page}
        size={size}
        total={users.data?.users.length}
        busy={users.isFetching}
        onPage={(next) =>
          void navigate({ search: { ...search, page: next === 1 ? undefined : next } })
        }
        onSize={(size) => void navigate({ search: { size, page: undefined } })}
      />
    </div>
  );
}

// On a phone the columns don't fit side by side: the status and the actions take a line each.
const phoneRow = "max-shell:grid max-shell:grid-cols-[1fr_auto]";

function UsersTable({ users, hasOthers }: { hasOthers: boolean; users: User[] }) {
  // users-and-access R9: the Owner is a User, so this is how a new install looks.

  return (
    <>
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className={cn("hover:bg-background", phoneRow)}>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="max-shell:hidden">Status</TableHead>
              <TableHead className="max-shell:hidden">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} className={phoneRow}>
                <TableCell className="whitespace-normal">
                  <p className="font-medium">{user.name}</p>
                  <p className="text-small break-all text-muted-foreground">{user.email}</p>
                </TableCell>
                <TableCell>{roleNames[user.role]}</TableCell>
                <TableCell className="max-shell:col-span-2 max-shell:pt-0">
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={user.status === "active" ? "secondary" : "outline"}>
                      {statusNames[user.status]}
                    </Badge>
                    {/* users-and-access R33 */}
                    {!user.passwordSet && <Badge variant="outline">Password not set</Badge>}
                  </div>
                </TableCell>
                <TableCell className="max-shell:col-span-2 max-shell:pt-0 max-shell:empty:hidden">
                  <UserActions user={user} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {!hasOthers && (
        <p className="text-muted-foreground">
          No other Users yet. Create an Admin or Staff User to give them access.
        </p>
      )}
    </>
  );
}

function UserActions({ user }: { user: User }) {
  const { role } = useCurrentUser();
  const queryClient = useQueryClient();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const remove = useDeleteUser();
  // users-and-access R18, context ADR 0004: nothing can be done to the Owner here.
  if (user.role === "owner") return null;

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });

  return (
    <>
      <RowActions label={user.name} triggerRef={triggerRef}>
        <DropdownMenuItem asChild className={rowActionItem}>
          <Link to="/users/$id/edit" params={{ id: String(user.id) }}>
            Edit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className={rowActionItem} onSelect={() => setStatusOpen(true)}>
          {user.status === "active" ? "Set Inactive" : "Set Active"}
        </DropdownMenuItem>
        {/* users-and-access R55: only the Owner deletes, and only an Inactive User. */}
        {role === "owner" && user.status === "inactive" && (
          <DropdownMenuItem
            variant="destructive"
            className={rowActionItem}
            onSelect={() => setDeleteOpen(true)}
          >
            Delete
          </DropdownMenuItem>
        )}
      </RowActions>
      <StatusConfirmation
        user={user}
        open={statusOpen}
        onOpenChange={setStatusOpen}
        triggerRef={triggerRef}
      />
      <DeleteConfirmation
        subject={user.name}
        consequence={`${user.name} leaves the Users list and can't log in. What they did stays under their name, and their email can be used again.`}
        whenForbidden="Your role can't delete Users. Only the Owner can."
        pending={remove.isPending}
        error={remove.error && !isNotFound(remove.error) ? remove.error : null}
        open={deleteOpen}
        onOpenChange={(next) => {
          setDeleteOpen(next);
          if (!next) remove.reset();
        }}
        returnFocusTo={triggerRef}
        onConfirm={() =>
          remove.mutate(
            { id: user.id },
            {
              onSuccess: () => void refresh().then(() => setDeleteOpen(false)),
              onError: (error) => {
                void refresh();
                if (isNotFound(error)) setDeleteOpen(false);
              },
            },
          )
        }
      />
    </>
  );
}

function StatusConfirmation({
  user,
  open,
  onOpenChange,
  triggerRef,
}: {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const queryClient = useQueryClient();
  const update = useUpdateUser({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }),
    },
  });
  const goingInactive = user.status === "active";
  const action = goingInactive ? "Set Inactive" : "Set Active";

  return (
    <>
      <Confirmation
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next);
          if (!next) update.reset();
        }}
        title={`Set ${user.name} ${goingInactive ? "Inactive" : "Active"}?`}
        // users-and-access R16
        description={
          goingInactive
            ? `${user.name} won't be able to log in, and any session they have ends at once. Their codes and password links stop working too.`
            : `${user.name} will be able to log in again. Sessions, codes and password links that ended do not come back. Ask them to request fresh instructions.`
        }
        confirm={action}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
        pending={update.isPending}
        error={update.error}
        onConfirm={() =>
          update.mutate(
            { id: user.id, data: { status: goingInactive ? "inactive" : "active" } },
            { onSuccess: () => onOpenChange(false) },
          )
        }
      />
    </>
  );
}

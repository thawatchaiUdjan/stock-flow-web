import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { errorMessage } from "@/api/errors";
import type { SetupLink, User } from "@/api/generated/model";
import {
  getListUsersQueryKey,
  useListUsers,
  useResetPassword,
  useUpdateUser,
} from "@/api/generated/users/users";
import { Confirmation } from "@/components/confirmation";
import { ListPaging } from "@/components/list-paging";
import { SetupLinkDisplay } from "@/components/setup-link-display";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { pagingSearch } from "@/lib/paging";
import { roleNames, statusNames } from "@/lib/roles";
import { cn } from "@/lib/utils";

// The Setup link of a reset, and whose it is.
interface IssuedLink {
  name: string;
  setupLink: SetupLink;
}

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
  // users-and-access R28: the Setup link of a reset, shown once and gone when the Owner leaves it.
  const [issued, setIssued] = useState<IssuedLink | null>(null);

  if (issued) {
    return (
      <SetupLinkDisplay
        title="Password reset"
        name={issued.name}
        setupLink={issued.setupLink}
        actions={<Button onClick={() => setIssued(null)}>Back to Users</Button>}
      />
    );
  }

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
          onSetupLink={setIssued}
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

function UsersTable({
  users,
  onSetupLink,
  hasOthers,
}: {
  hasOthers: boolean;
  users: User[];
  onSetupLink: (issued: IssuedLink) => void;
}) {
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
                  <UserActions user={user} onSetupLink={onSetupLink} />
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

function UserActions({
  user,
  onSetupLink,
}: {
  user: User;
  onSetupLink: (issued: IssuedLink) => void;
}) {
  // users-and-access R18, context ADR 0004: nothing can be done to the Owner here.
  if (user.role === "owner") return null;

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" asChild>
        <Link to="/users/$id/edit" params={{ id: String(user.id) }}>
          Edit
        </Link>
      </Button>
      <StatusAction user={user} />
      {/* users-and-access R32: an Inactive User gets no Setup link. */}
      {user.status === "active" && <ResetPasswordAction user={user} onSetupLink={onSetupLink} />}
    </div>
  );
}

function StatusAction({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const update = useUpdateUser({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }),
    },
  });
  const goingInactive = user.status === "active";
  const action = goingInactive ? "Set Inactive" : "Set Active";

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {action}
      </Button>
      <Confirmation
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) update.reset();
        }}
        title={`Set ${user.name} ${goingInactive ? "Inactive" : "Active"}?`}
        // users-and-access R16
        description={
          goingInactive
            ? `${user.name} won't be able to log in, and any session they have ends at once. Their Setup link stops working too.`
            : `${user.name} will be able to log in again. Sessions that ended and Setup links that stopped working don't come back.`
        }
        confirm={action}
        pending={update.isPending}
        error={update.error}
        onConfirm={() =>
          update.mutate(
            { id: user.id, data: { status: goingInactive ? "inactive" : "active" } },
            { onSuccess: () => setOpen(false) },
          )
        }
      />
    </>
  );
}

function ResetPasswordAction({
  user,
  onSetupLink,
}: {
  user: User;
  onSetupLink: (issued: IssuedLink) => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const reset = useResetPassword({
    mutation: {
      // users-and-access R28: the link is shown once, so nothing keeps it.
      gcTime: 0,
      onSuccess: (setupLink) => {
        void queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        onSetupLink({ name: user.name, setupLink });
      },
    },
  });

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Reset password
      </Button>
      <Confirmation
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset.reset();
        }}
        title={`Reset ${user.name}'s password?`}
        // users-and-access R31
        description={
          user.passwordSet
            ? `${user.name}'s password stops working and any session they have ends at once. Any earlier Setup link stops working, and you get a new one to pass to them.`
            : `${user.name} hasn't set a password yet. Any earlier Setup link stops working, and you get a new one to pass to them.`
        }
        confirm="Reset password"
        pending={reset.isPending}
        error={reset.error}
        onConfirm={() => reset.mutate({ id: user.id })}
      />
    </>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";

import { errorMessage } from "@/api/errors";
import type { User } from "@/api/generated/model";
import { useListUsers } from "@/api/generated/users/users";
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
import { roleNames, statusNames } from "@/lib/roles";

export const Route = createFileRoute("/_app/users/")({ component: UsersPage });

function UsersPage() {
  const users = useListUsers();

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
      {users.isSuccess && <UsersTable users={users.data.users} />}
    </div>
  );
}

function UsersTable({ users }: { users: User[] }) {
  // users-and-access R9: the Owner is a User, so this is how a new install looks.
  const hasOthers = users.some(({ role }) => role !== "owner");

  return (
    <>
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-background">
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="whitespace-normal">
                  <p className="font-medium">{user.name}</p>
                  <p className="text-small break-all text-muted-foreground">{user.email}</p>
                </TableCell>
                <TableCell>{roleNames[user.role]}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={user.status === "active" ? "secondary" : "outline"}>
                      {statusNames[user.status]}
                    </Badge>
                    {/* users-and-access R33 */}
                    {!user.passwordSet && <Badge variant="outline">Password not set</Badge>}
                  </div>
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

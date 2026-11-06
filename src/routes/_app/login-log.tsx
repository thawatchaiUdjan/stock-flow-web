import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

import { errorMessage } from "@/api/errors";
import { useListLoginLog } from "@/api/generated/login-log/login-log";
import { LoginLogEntryBodyResult } from "@/api/generated/model";
import type { LoginLogEntryBody, LoginLogUser } from "@/api/generated/model";
import { useListUsers } from "@/api/generated/users/users";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Result = LoginLogEntryBody["result"];

const resultNames = {
  login: "Login",
  "failed-login": "Failed login",
  logout: "Logout",
} as const satisfies Record<Result, string>;

const resultVariants = {
  login: "secondary",
  "failed-login": "destructive",
  logout: "outline",
} as const satisfies Record<Result, "secondary" | "destructive" | "outline">;

// ADR 0008: the filters and the page live in the address, so a reload or a shared link keeps them.
// A value the API wouldn't accept is dropped rather than sent.
const searchSchema = z.object({
  userId: z.number().int().min(1).optional().catch(undefined),
  result: z.enum(LoginLogEntryBodyResult).optional().catch(undefined),
  before: z.number().int().min(1).optional().catch(undefined),
});

export const Route = createFileRoute("/_app/login-log")({
  validateSearch: searchSchema,
  component: LoginLogPage,
});

function LoginLogPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const log = useListLoginLog(search);
  const filtered = search.userId !== undefined || search.result !== undefined;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title">Login log</h1>
      <Filters
        userId={search.userId}
        result={search.result}
        // A filter changes what the pages hold, so the page it was on means nothing any more.
        onChange={(changes) =>
          void navigate({ search: { ...search, ...changes, before: undefined } })
        }
      />
      {log.isPending && <output className="text-muted-foreground">Loading the Login log</output>}
      {log.isError && (
        <>
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(log.error)}</AlertDescription>
          </Alert>
          <Button variant="outline" className="self-start" onClick={() => void log.refetch()}>
            Try again
          </Button>
        </>
      )}
      {log.isSuccess && log.data.entries.length === 0 && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted-foreground">
            {filtered
              ? "No entries match these filters."
              : "No logins yet. Entries appear here when someone logs in, fails to log in or logs out."}
          </p>
          {filtered && (
            <Button variant="outline" asChild>
              <Link to="/login-log">Clear filters</Link>
            </Button>
          )}
        </div>
      )}
      {log.isSuccess && log.data.entries.length > 0 && (
        <>
          <EntriesTable entries={log.data.entries} />
          <Paging
            search={search}
            newest={search.before === undefined}
            nextBefore={log.data.nextBefore}
          />
        </>
      )}
    </div>
  );
}

function Filters({
  userId,
  result,
  onChange,
}: {
  userId: number | undefined;
  result: Result | undefined;
  onChange: (changes: { userId?: number; result?: Result }) => void;
}) {
  const users = useListUsers();

  return (
    <div className="flex flex-wrap gap-4">
      <Field className="w-auto max-shell:w-full">
        <FieldLabel htmlFor="login-log-user">User</FieldLabel>
        <NativeSelect
          id="login-log-user"
          className="max-shell:w-full"
          value={userId ?? ""}
          disabled={users.isPending}
          onChange={(event) =>
            onChange({ userId: event.target.value ? Number(event.target.value) : undefined })
          }
        >
          <NativeSelectOption value="">All Users</NativeSelectOption>
          {users.data?.users.map((user) => (
            <NativeSelectOption key={user.id} value={user.id}>
              {user.name} ({user.email})
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {users.isError && (
          <p role="alert" className="text-small text-destructive">
            {errorMessage(users.error)}
          </p>
        )}
      </Field>
      <Field className="w-auto max-shell:w-full">
        <FieldLabel htmlFor="login-log-result">Result</FieldLabel>
        <NativeSelect
          id="login-log-result"
          className="max-shell:w-full"
          value={result ?? ""}
          onChange={(event) =>
            onChange({
              result: event.target.value ? (event.target.value as Result) : undefined,
            })
          }
        >
          <NativeSelectOption value="">All results</NativeSelectOption>
          {Object.entries(resultNames).map(([value, label]) => (
            <NativeSelectOption key={value} value={value}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
    </div>
  );
}

// On a phone the time, the email and the result stay: they are what makes a guessing attempt
// visible. The rest drops (docs/design.md, *Tables*).
const phoneRow = "max-shell:grid max-shell:grid-cols-[1fr_auto]";
const secondary = "max-shell:hidden";

function EntriesTable({ entries }: { entries: LoginLogEntryBody[] }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader className="max-shell:hidden">
          <TableRow className="hover:bg-background">
            <TableHead>Time</TableHead>
            <TableHead>Email entered</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Result</TableHead>
            <TableHead>IP address</TableHead>
            <TableHead className="w-full whitespace-normal">Browser or device</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            // The contract types `user` as always present, but the API sends null for an email
            // that matches no User (users-and-access R36).
            const user: LoginLogUser | null = entry.user;
            return (
              <TableRow key={entry.id} className={phoneRow}>
                <TableCell className="whitespace-nowrap max-shell:col-span-2 max-shell:pb-0 max-shell:text-small max-shell:text-muted-foreground">
                  {formatDateTime(entry.at)}
                </TableCell>
                <TableCell className="wrap-anywhere whitespace-normal shell:min-w-44">
                  {entry.email}
                </TableCell>
                <TableCell
                  className={cn(secondary, "whitespace-nowrap", !user && "text-muted-foreground")}
                >
                  {user ? user.name : "No User"}
                </TableCell>
                <TableCell>
                  <Badge variant={resultVariants[entry.result]}>{resultNames[entry.result]}</Badge>
                </TableCell>
                <TableCell
                  className={cn(secondary, "wrap-anywhere whitespace-normal shell:min-w-36")}
                >
                  {entry.ip}
                </TableCell>
                {/* One line: the browser calls itself a long string. The whole of it is the tooltip. */}
                <TableCell className={cn(secondary, "max-w-0 truncate")} title={entry.userAgent}>
                  {entry.userAgent}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// The API pages by cursor: it knows where the next page starts, not the previous one.
// The filters ride along in the address, so they survive the move (users-and-access R38).
function Paging({
  search,
  newest,
  nextBefore,
}: {
  search: z.infer<typeof searchSchema>;
  newest: boolean;
  nextBefore: number | null;
}) {
  if (newest && nextBefore === null) return null;

  return (
    <nav aria-label="Pages" className="flex gap-2">
      {!newest && (
        <Button variant="outline" asChild>
          <Link to="/login-log" search={{ ...search, before: undefined }}>
            Newest entries
          </Link>
        </Button>
      )}
      {nextBefore !== null && (
        <Button variant="outline" asChild>
          <Link to="/login-log" search={{ ...search, before: nextBefore }}>
            Older entries
          </Link>
        </Button>
      )}
    </nav>
  );
}

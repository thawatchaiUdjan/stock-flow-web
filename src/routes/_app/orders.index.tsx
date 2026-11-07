import { keepPreviousData } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { errorMessage } from "@/api/errors";
import { ListOrdersStatus } from "@/api/generated/model";
import type { OrderSummary } from "@/api/generated/model";
import { useListOrders } from "@/api/generated/orders/orders";
import { OrderStatusBadge, orderStatusNames } from "@/components/order-status";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBaht, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

// ADR 0008: the search, the status and the page live in the address, so a reload or a shared link
// keeps them. A value the API wouldn't accept is dropped rather than sent.
const searchSchema = z.object({
  search: z.coerce.string().optional().catch(undefined),
  status: z.enum(ListOrdersStatus).optional().catch(undefined),
  page: z.number().int().min(2).optional().catch(undefined),
});
type OrdersSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/_app/orders/")({
  validateSearch: searchSchema,
  component: OrdersListPage,
});

const pageSize = 50;

function OrdersListPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const page = search.page ?? 1;
  // The box keeps its own text, so a slow address update never eats a keystroke.
  const [text, setText] = useState(search.search ?? "");
  const orders = useListOrders(
    {
      ...(search.search?.trim() && { search: search.search.trim() }),
      ...(search.status && { status: search.status }),
      limit: pageSize,
      offset: (page - 1) * pageSize,
    },
    { query: { placeholderData: keepPreviousData } },
  );
  const isEmpty = orders.isSuccess && orders.data.orders.length === 0;
  const filtered = Boolean(search.search?.trim()) || search.status !== undefined || page > 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-title">Orders</h1>
        <Button asChild>
          <Link to="/orders/new">New order</Link>
        </Button>
      </div>
      <Filters
        search={search}
        text={text}
        onText={setText}
        // A filter changes what the pages hold, so the page it was on means nothing any more.
        onChange={(changes) =>
          void navigate({ search: { ...search, ...changes, page: undefined }, replace: true })
        }
      />
      {orders.isPending && <output className="text-muted-foreground">Loading orders</output>}
      {orders.isError && (
        <>
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(orders.error)}</AlertDescription>
          </Alert>
          <Button variant="outline" className="self-start" onClick={() => void orders.refetch()}>
            Try again
          </Button>
        </>
      )}
      {isEmpty && filtered && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted-foreground">No orders match these filters.</p>
          <Button
            variant="outline"
            onClick={() => {
              setText("");
              void navigate({ search: {}, replace: true });
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
      {isEmpty && !filtered && (
        <p className="text-muted-foreground">
          No orders yet. Create the first order to record a sale.
        </p>
      )}
      {orders.isSuccess && orders.data.orders.length > 0 && (
        <>
          <OrdersTable orders={orders.data.orders} />
          <Paging
            search={search}
            page={page}
            shown={orders.data.orders.length}
            total={orders.data.total}
          />
        </>
      )}
    </div>
  );
}

function Filters({
  search,
  text,
  onText,
  onChange,
}: {
  search: OrdersSearch;
  text: string;
  onText: (text: string) => void;
  onChange: (changes: Partial<OrdersSearch>) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
      <Field className="w-72 max-shell:w-full">
        <FieldLabel htmlFor="order-search">Search</FieldLabel>
        <Input
          id="order-search"
          type="search"
          autoComplete="off"
          placeholder="Number or customer"
          value={text}
          onChange={(event) => {
            onText(event.target.value);
            onChange({ search: event.target.value || undefined });
          }}
        />
      </Field>
      <Field className="w-auto max-shell:w-full">
        <FieldLabel htmlFor="order-status">Status</FieldLabel>
        <NativeSelect
          id="order-status"
          className="max-shell:w-full"
          value={search.status ?? ""}
          onChange={(event) =>
            onChange({
              status: event.target.value
                ? (event.target.value as OrderSummary["status"])
                : undefined,
            })
          }
        >
          <NativeSelectOption value="">All statuses</NativeSelectOption>
          {Object.values(ListOrdersStatus).map((status) => (
            <NativeSelectOption key={status} value={status}>
              {orderStatusNames[status]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
    </div>
  );
}

// On a phone the number, status and total stay, in two columns; the rest takes a line below.
const phoneRow = "max-shell:grid max-shell:grid-cols-[1fr_auto]";
const secondary = "max-shell:hidden";

function OrdersTable({ orders }: { orders: OrderSummary[] }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader className="max-shell:hidden">
          <TableRow className="hover:bg-background">
            <TableHead>Order</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-full">Customer</TableHead>
            <TableHead className="text-right">Lines</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id} className={phoneRow}>
              <TableCell className="max-shell:pb-0">
                {/* orders R17 */}
                <Link
                  to="/orders/$number"
                  params={{ number: String(order.number) }}
                  className="font-medium hover:underline"
                >
                  #{order.number}
                </Link>
              </TableCell>
              <TableCell
                className={cn(
                  "whitespace-nowrap",
                  "max-shell:col-span-2 max-shell:row-start-2 max-shell:pt-0 max-shell:pb-0 max-shell:text-small max-shell:text-muted-foreground",
                )}
              >
                {formatDateTime(order.createdAt)}
              </TableCell>
              <TableCell className="whitespace-normal max-shell:col-span-2 max-shell:row-start-3 max-shell:pt-0">
                <span
                  className={cn("wrap-anywhere", order.customer === "" && "text-muted-foreground")}
                >
                  {order.customer === "" ? "No customer" : order.customer}
                </span>
              </TableCell>
              <TableCell className={cn(secondary, "text-right")}>{order.lineCount}</TableCell>
              <TableCell className="text-right whitespace-nowrap max-shell:col-start-2 max-shell:row-start-1 max-shell:pb-0">
                {formatBaht(order.total)}
              </TableCell>
              <TableCell className="max-shell:col-span-2 max-shell:row-start-4 max-shell:pt-0">
                <OrderStatusBadge status={order.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// The API pages by offset and says how many match.
function Paging({
  search,
  page,
  shown,
  total,
}: {
  search: OrdersSearch;
  page: number;
  shown: number;
  total: number;
}) {
  if (total <= pageSize) return null;
  const first = (page - 1) * pageSize + 1;
  const last = first + shown - 1;

  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center gap-3">
      <p className="text-muted-foreground">
        {first} to {last} of {total}
      </p>
      {page > 1 && (
        <Button variant="outline" asChild>
          <Link to="/orders" search={{ ...search, page: page > 2 ? page - 1 : undefined }}>
            Previous page
          </Link>
        </Button>
      )}
      {last < total && (
        <Button variant="outline" asChild>
          <Link to="/orders" search={{ ...search, page: page + 1 }}>
            Next page
          </Link>
        </Button>
      )}
    </nav>
  );
}

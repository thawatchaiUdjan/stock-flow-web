import { createFileRoute, Link } from "@tanstack/react-router";

import { errorMessage } from "@/api/errors";
import type { StockMovement } from "@/api/generated/model";
import { useGetProduct } from "@/api/generated/products/products";
import { useListStockMovements } from "@/api/generated/stock-movements/stock-movements";
import { DateInput } from "@/components/date-input";
import { CursorPaging } from "@/components/list-paging";
import { ProductSelect, useActiveProducts } from "@/components/product-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { useCurrentUser } from "@/lib/current-user";
import { formatDateTime } from "@/lib/format";
import { movementsSearchSchema, type MovementsSearch } from "@/lib/stock-movements-search";
import { cn } from "@/lib/utils";

// stock-movements R3: the words for the four kinds, as the glossary has them.
const kindNames = {
  receive: "Receive",
  adjustment: "Adjustment",
  order: "Order",
  cancellation: "Cancellation",
} as const satisfies Record<StockMovement["kind"], string>;

export const Route = createFileRoute("/_app/stock-movements")({
  validateSearch: movementsSearchSchema,
  component: StockMovementsPage,
});

function StockMovementsPage() {
  const { role } = useCurrentUser();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  // stock-movements R5: only the Owner and Admins adjust.
  const canAdjust = role !== "staff";
  // A range that ends before it starts holds nothing, and is said so rather than asked of the API.
  const backwards = search.from !== undefined && search.to !== undefined && search.from > search.to;
  const movements = useListStockMovements(search, { query: { enabled: !backwards } });
  const filtered =
    search.productId !== undefined ||
    search.kind !== undefined ||
    search.from !== undefined ||
    search.to !== undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-title">Stock movements</h1>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/stock-movements/receive" search={search}>
              Receive stock
            </Link>
          </Button>
          {canAdjust && (
            <Button variant="outline" asChild>
              <Link to="/stock-movements/adjust" search={search}>
                Adjust stock
              </Link>
            </Button>
          )}
        </div>
      </div>
      <Filters
        search={search}
        // A filter changes what the pages hold, so the page it was on means nothing any more.
        onChange={(changes) =>
          void navigate({ search: { ...search, ...changes, before: undefined } })
        }
      />
      {backwards && (
        <p className="text-muted-foreground">From is after To. Choose an earlier From day.</p>
      )}
      {!backwards && movements.isPending && (
        <output className="text-muted-foreground">Loading stock movements</output>
      )}
      {movements.isError && (
        <>
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(movements.error)}</AlertDescription>
          </Alert>
          <Button variant="outline" className="self-start" onClick={() => void movements.refetch()}>
            Try again
          </Button>
        </>
      )}
      {movements.isSuccess && movements.data.movements.length === 0 && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted-foreground">
            {search.before !== undefined
              ? "No older entries on this page. Return to newest entries."
              : filtered
                ? "No stock movements match these filters."
                : "No stock movements yet. Receive stock to start the history of every change."}
          </p>
          {filtered && (
            <Button variant="outline" asChild>
              <Link to="/stock-movements">Clear filters</Link>
            </Button>
          )}
        </div>
      )}
      {movements.isSuccess && movements.data.movements.length > 0 && (
        <>
          <MovementsTable movements={movements.data.movements} />
        </>
      )}
      <CursorPaging
        older={search.before !== undefined}
        busy={movements.isFetching}
        canOlder={movements.isSuccess && movements.data.nextBefore !== null}
        onNewest={() => void navigate({ search: { ...search, before: undefined } })}
        onOlder={() => {
          if (movements.data?.nextBefore != null)
            void navigate({ search: { ...search, before: movements.data.nextBefore } });
        }}
      />
    </div>
  );
}

function Filters({
  search,
  onChange,
}: {
  search: MovementsSearch;
  onChange: (changes: Partial<MovementsSearch>) => void;
}) {
  const active = useActiveProducts();
  // A Product reached from the Product List may be Archived, which the list of Active ones lacks.
  const missing =
    search.productId !== undefined &&
    !active.isPending &&
    !active.products.some(({ id }) => id === search.productId);
  const reached = useGetProduct(search.productId ?? 0, { query: { enabled: missing } });
  const products = reached.data ? [...active.products, reached.data] : active.products;

  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-4">
      <Field className="w-auto max-shell:w-full">
        <FieldLabel htmlFor="movements-product">Product</FieldLabel>
        <ProductSelect
          id="movements-product"
          className="max-shell:w-full"
          products={products}
          placeholder="All products"
          value={search.productId ?? ""}
          disabled={active.isPending}
          onChange={(event) =>
            onChange({ productId: event.target.value ? Number(event.target.value) : undefined })
          }
        />
        {active.error && (
          <p role="alert" className="text-small text-destructive">
            {errorMessage(active.error)}
          </p>
        )}
      </Field>
      <Field className="w-auto max-shell:w-full">
        <FieldLabel htmlFor="movements-kind">Kind</FieldLabel>
        <NativeSelect
          id="movements-kind"
          className="max-shell:w-full"
          value={search.kind ?? ""}
          onChange={(event) =>
            onChange({
              kind: event.target.value ? (event.target.value as StockMovement["kind"]) : undefined,
            })
          }
        >
          <NativeSelectOption value="">All kinds</NativeSelectOption>
          {Object.entries(kindNames).map(([value, label]) => (
            <NativeSelectOption key={value} value={value}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field className="w-auto max-shell:w-full">
        <FieldLabel htmlFor="movements-from">From</FieldLabel>
        <DateInput
          id="movements-from"
          label="From"
          value={search.from ?? ""}
          onValueChange={(value) => onChange({ from: value || undefined })}
        />
      </Field>
      <Field className="w-auto max-shell:w-full">
        <FieldLabel htmlFor="movements-to">To</FieldLabel>
        <DateInput
          id="movements-to"
          label="To"
          value={search.to ?? ""}
          onValueChange={(value) => onChange({ to: value || undefined })}
        />
      </Field>
      <p className="w-full text-small text-muted-foreground">Leave dates empty for all history</p>
    </div>
  );
}

// stock-movements R2's change reads `+12` or `−3` (a true minus sign, not a hyphen).
function formatChange(change: number) {
  return change > 0 ? `+${change}` : `−${Math.abs(change)}`;
}

// docs/design.md: phone rows retain time, Product, kind, change and the full note.
const phoneRow = "max-shell:grid max-shell:grid-cols-[minmax(0,1fr)_auto]";
const secondary = "max-shell:hidden";

function MovementsTable({ movements }: { movements: StockMovement[] }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader className="max-shell:hidden">
          <TableRow className="hover:bg-background">
            <TableHead>Time</TableHead>
            <TableHead className="w-1/3 min-w-48">Product</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead className="text-right">Change</TableHead>
            <TableHead className="text-right">Stock after</TableHead>
            <TableHead>User</TableHead>
            <TableHead className="w-1/3 min-w-48">Note</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((movement) => (
            <TableRow key={movement.id} className={phoneRow}>
              <TableCell className="whitespace-nowrap max-shell:col-span-2 max-shell:pb-0 max-shell:text-small max-shell:text-muted-foreground">
                {formatDateTime(movement.at)}
              </TableCell>
              <TableCell className="min-w-0 whitespace-normal shell:max-w-80 shell:min-w-48">
                <p className="font-medium wrap-anywhere">{movement.product.name}</p>
                <p className="text-small break-all text-muted-foreground">{movement.product.sku}</p>
              </TableCell>
              <TableCell className="whitespace-nowrap max-shell:col-start-1 max-shell:row-start-3 max-shell:pt-0">
                <p>{kindNames[movement.kind]}</p>
                {/* orders R17 */}
                {movement.order && (
                  <Link
                    to="/orders/$number"
                    params={{ number: String(movement.order.number) }}
                    className="text-small text-muted-foreground underline-offset-2 hover:underline"
                  >
                    #{movement.order.number}
                  </Link>
                )}
              </TableCell>
              <TableCell className="text-right max-shell:col-start-2 max-shell:row-span-2 max-shell:row-start-2 max-shell:self-center">
                <span className="text-stock whitespace-nowrap">
                  {formatChange(movement.change)}
                </span>
              </TableCell>
              <TableCell className={cn(secondary, "text-right")}>{movement.stockAfter}</TableCell>
              <TableCell className={cn(secondary, "whitespace-nowrap")}>
                {movement.user.name}
              </TableCell>
              <TableCell className="wrap-anywhere whitespace-normal max-shell:col-span-2 max-shell:pt-0 max-shell:text-small max-shell:text-muted-foreground shell:max-w-80 shell:min-w-48">
                {movement.note}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

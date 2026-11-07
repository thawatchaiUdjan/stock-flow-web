import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { errorMessage } from "@/api/errors";
import { ListStockMovementsKind } from "@/api/generated/model";
import type { StockMovement } from "@/api/generated/model";
import {
  getGetProductQueryKey,
  getListProductsQueryKey,
  useGetProduct,
} from "@/api/generated/products/products";
import {
  getListStockMovementsQueryKey,
  useAdjustStock,
  useListStockMovements,
  useReceiveStock,
} from "@/api/generated/stock-movements/stock-movements";
import { ProductSelect, useActiveProducts } from "@/components/product-select";
import { StockChangeForm } from "@/components/stock-change-form";
import type { StockChangeMode } from "@/components/stock-change-form";
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
import { useCurrentUser } from "@/lib/current-user";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

// stock-movements R3: the words for the four kinds, as the glossary has them.
const kindNames = {
  receive: "Receive",
  adjustment: "Adjustment",
  order: "Order",
  cancellation: "Cancellation",
} as const satisfies Record<StockMovement["kind"], string>;

// ADR 0008: the filters and the page live in the address, so a reload or a shared link keeps them
// (the Product List links here with its Product, products R16). A value the API wouldn't accept is
// dropped rather than sent.
const searchSchema = z.object({
  productId: z.number().int().min(1).optional().catch(undefined),
  kind: z.enum(ListStockMovementsKind).optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  before: z.number().int().min(1).optional().catch(undefined),
});
type MovementsSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/_app/stock-movements")({
  validateSearch: searchSchema,
  component: StockMovementsPage,
});

// What the page says after a movement is saved.
interface Notice {
  title: string;
  text: string;
}

function StockMovementsPage() {
  const { role } = useCurrentUser();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [open, setOpen] = useState<StockChangeMode>();
  const [done, setDone] = useState<Notice>();
  const openForm = (mode: StockChangeMode) => {
    setDone(undefined);
    setOpen(mode);
  };
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
        {open === undefined && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => openForm("receive")}>Receive stock</Button>
            {canAdjust && (
              <Button variant="outline" onClick={() => openForm("adjust")}>
                Adjust stock
              </Button>
            )}
          </div>
        )}
      </div>
      {done && (
        <output className="block rounded-lg border bg-card px-3 py-2">
          <p className="font-medium">{done.title}</p>
          <p className="text-muted-foreground">{done.text}</p>
        </output>
      )}
      {open && (
        <StockChangePanel
          mode={open}
          preset={search.productId}
          onCancel={() => setOpen(undefined)}
          onDone={(notice) => {
            setOpen(undefined);
            setDone(notice);
          }}
        />
      )}
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
            {filtered
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
          <Paging
            search={search}
            newest={search.before === undefined}
            nextBefore={movements.data.nextBefore}
          />
        </>
      )}
    </div>
  );
}

// Receive stock and Adjust stock: the same form, a different operation behind it.
function StockChangePanel({
  mode,
  preset,
  onCancel,
  onDone,
}: {
  mode: StockChangeMode;
  preset: number | undefined;
  onCancel: () => void;
  onDone: (notice: Notice) => void;
}) {
  const queryClient = useQueryClient();
  const products = useActiveProducts();
  const finish = (movement: StockMovement) => {
    // The stock moved with the movement (ADR 0006): the list, and every Product's stock, are stale.
    for (const queryKey of [
      getListStockMovementsQueryKey(),
      getListProductsQueryKey(),
      getGetProductQueryKey(movement.product.id),
    ]) {
      void queryClient.invalidateQueries({ queryKey });
    }
    onDone({
      title: mode === "receive" ? "Stock received" : "Stock adjusted",
      text: `${movement.product.name} (${movement.product.sku}) now has ${movement.stockAfter} in stock.`,
    });
  };
  const receive = useReceiveStock({ mutation: { onSuccess: finish } });
  const adjust = useAdjustStock({ mutation: { onSuccess: finish } });
  const request = mode === "receive" ? receive : adjust;

  if (products.error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{errorMessage(products.error)}</AlertDescription>
      </Alert>
    );
  }
  // The form's first Product is chosen when it opens, so it opens once the Products are here.
  if (products.isPending) {
    return <output className="text-muted-foreground">Loading products</output>;
  }

  return (
    <StockChangeForm
      mode={mode}
      products={products.products}
      preset={preset}
      pending={request.isPending}
      error={request.error}
      submittedProductId={request.variables?.data.productId}
      onEdit={() => request.reset()}
      onCancel={onCancel}
      onSubmit={({ productId, amount, note }) =>
        mode === "receive"
          ? receive.mutate({ data: { productId, quantity: amount, ...(note && { note }) } })
          : adjust.mutate({ data: { productId, change: amount, note } })
      }
    />
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
        <Input
          id="movements-from"
          type="date"
          value={search.from ?? ""}
          onChange={(event) => onChange({ from: event.target.value || undefined })}
        />
      </Field>
      <Field className="w-auto max-shell:w-full">
        <FieldLabel htmlFor="movements-to">To</FieldLabel>
        <Input
          id="movements-to"
          type="date"
          value={search.to ?? ""}
          onChange={(event) => onChange({ to: event.target.value || undefined })}
        />
      </Field>
    </div>
  );
}

// stock-movements R2's change reads `+12` or `−3` (a true minus sign, not a hyphen).
function formatChange(change: number) {
  return change > 0 ? `+${change}` : `−${Math.abs(change)}`;
}

// On a phone the time, Product, kind and change stay: they say what happened. The rest drops
// (docs/design.md, *Tables*).
const phoneRow = "max-shell:grid max-shell:grid-cols-[1fr_auto]";
const secondary = "max-shell:hidden";

function MovementsTable({ movements }: { movements: StockMovement[] }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader className="max-shell:hidden">
          <TableRow className="hover:bg-background">
            <TableHead>Time</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead className="text-right">Change</TableHead>
            <TableHead className="text-right">Stock after</TableHead>
            <TableHead>User</TableHead>
            <TableHead className="w-full">Note</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((movement) => (
            <TableRow key={movement.id} className={phoneRow}>
              <TableCell className="whitespace-nowrap max-shell:col-span-2 max-shell:pb-0 max-shell:text-small max-shell:text-muted-foreground">
                {formatDateTime(movement.at)}
              </TableCell>
              <TableCell className="whitespace-normal">
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
              <TableCell className={cn(secondary, "wrap-anywhere whitespace-normal")}>
                {movement.note}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// The API pages by cursor: it knows where the next page starts, not the previous one.
// The filters ride along in the address, so they survive the move.
function Paging({
  search,
  newest,
  nextBefore,
}: {
  search: MovementsSearch;
  newest: boolean;
  nextBefore: number | null;
}) {
  if (newest && nextBefore === null) return null;

  return (
    <nav aria-label="Pages" className="flex gap-2">
      {!newest && (
        <Button variant="outline" asChild>
          <Link to="/stock-movements" search={{ ...search, before: undefined }}>
            Newest entries
          </Link>
        </Button>
      )}
      {nextBefore !== null && (
        <Button variant="outline" asChild>
          <Link to="/stock-movements" search={{ ...search, before: nextBefore }}>
            Older entries
          </Link>
        </Button>
      )}
    </nav>
  );
}

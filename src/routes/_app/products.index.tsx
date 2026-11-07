import { keepPreviousData } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { errorMessage } from "@/api/errors";
import { ListProductsStockItem } from "@/api/generated/model";
import type { Product } from "@/api/generated/model";
import { useListProducts } from "@/api/generated/products/products";
import { StockLevelBar, StockStateBadge, stockStateNames } from "@/components/stock-level";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentUser } from "@/lib/current-user";
import { formatBaht } from "@/lib/format";
import { cn } from "@/lib/utils";

// ADR 0008: the filters and the page live in the address, so a reload or a shared link keeps them
// (and the Dashboard can link here filtered). A value the API wouldn't accept is dropped.
const searchSchema = z.object({
  search: z.coerce.string().optional().catch(undefined),
  stock: z.array(z.enum(ListProductsStockItem)).optional().catch(undefined),
  status: z.literal("archived").optional().catch(undefined),
  page: z.number().int().min(2).optional().catch(undefined),
});
type ProductsSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/_app/products/")({
  validateSearch: searchSchema,
  component: ProductListPage,
});

const pageSize = 50;
const stockStates = Object.values(ListProductsStockItem);

function ProductListPage() {
  const { role } = useCurrentUser();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const page = search.page ?? 1;
  // The box keeps its own text, so a slow address update never eats a keystroke.
  const [text, setText] = useState(search.search ?? "");
  const products = useListProducts(
    {
      ...(search.search?.trim() && { search: search.search.trim() }),
      ...(search.stock?.length && { stock: search.stock }),
      status: search.status ?? "active",
      limit: pageSize,
      offset: (page - 1) * pageSize,
    },
    { query: { placeholderData: keepPreviousData } },
  );
  // products R10: only the Owner and Admins change Products.
  const canChange = role !== "staff";
  const isEmpty = products.isSuccess && products.data.products.length === 0;
  const filtered =
    Boolean(search.search?.trim()) ||
    Boolean(search.stock?.length) ||
    search.status !== undefined ||
    page > 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-title">Products</h1>
        {/* The empty state offers it itself. */}
        {canChange && !(isEmpty && !filtered) && (
          <Button asChild>
            <Link to="/products/new">Add product</Link>
          </Button>
        )}
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
      {products.isPending && <output className="text-muted-foreground">Loading products</output>}
      {products.isError && (
        <>
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(products.error)}</AlertDescription>
          </Alert>
          <Button variant="outline" className="self-start" onClick={() => void products.refetch()}>
            Try again
          </Button>
        </>
      )}
      {isEmpty && (
        <EmptyState
          filtered={filtered}
          canChange={canChange}
          onClear={() => {
            setText("");
            void navigate({ search: {}, replace: true });
          }}
        />
      )}
      {products.isSuccess && products.data.products.length > 0 && (
        <>
          <ProductsTable products={products.data.products} canChange={canChange} />
          <Paging
            search={search}
            page={page}
            shown={products.data.products.length}
            total={products.data.total}
          />
        </>
      )}
    </div>
  );
}

const toggle =
  "aria-pressed:border-primary aria-pressed:bg-secondary aria-pressed:text-secondary-foreground";

function Filters({
  search,
  text,
  onText,
  onChange,
}: {
  search: ProductsSearch;
  text: string;
  onText: (text: string) => void;
  onChange: (changes: Partial<ProductsSearch>) => void;
}) {
  const selected = search.stock ?? [];
  const archived = search.status === "archived";

  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
      <Field className="w-72 max-shell:w-full">
        <FieldLabel htmlFor="product-search">Search</FieldLabel>
        <Input
          id="product-search"
          type="search"
          autoComplete="off"
          placeholder="Name or SKU"
          value={text}
          onChange={(event) => {
            onText(event.target.value);
            onChange({ search: event.target.value || undefined });
          }}
        />
      </Field>
      <fieldset className="flex min-w-0 flex-wrap gap-2">
        <legend className="sr-only">Stock state</legend>
        {stockStates.map((state) => (
          <Button
            key={state}
            variant="outline"
            aria-pressed={selected.includes(state)}
            className={toggle}
            onClick={() => {
              const next = selected.includes(state)
                ? selected.filter((one) => one !== state)
                : [...selected, state];
              onChange({ stock: next.length > 0 ? next : undefined });
            }}
          >
            {stockStateNames[state]}
          </Button>
        ))}
      </fieldset>
      <fieldset className="flex min-w-0 gap-2">
        <legend className="sr-only">Status</legend>
        <Button
          variant="outline"
          aria-pressed={!archived}
          className={toggle}
          onClick={() => onChange({ status: undefined })}
        >
          Active
        </Button>
        <Button
          variant="outline"
          aria-pressed={archived}
          className={toggle}
          onClick={() => onChange({ status: "archived" })}
        >
          Archived
        </Button>
      </fieldset>
    </div>
  );
}

function EmptyState({
  filtered,
  canChange,
  onClear,
}: {
  filtered: boolean;
  canChange: boolean;
  onClear: () => void;
}) {
  if (filtered) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground">No products match these filters.</p>
        <Button variant="outline" onClick={onClear}>
          Clear filters
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-muted-foreground">
        {canChange
          ? "No products yet. Add your first product to start tracking stock."
          : "No products yet. The Owner or an Admin adds them."}
      </p>
      {canChange && (
        <Button asChild>
          <Link to="/products/new">Add product</Link>
        </Button>
      )}
    </div>
  );
}

// On a phone the name, SKU, stock and state stay, in two columns; the rest takes a line below.
const phoneRow = "max-shell:grid max-shell:grid-cols-[1fr_auto]";
const secondary = "max-shell:hidden";

function ProductsTable({ products, canChange }: { products: Product[]; canChange: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader className="max-shell:hidden">
          <TableRow className="hover:bg-background">
            <TableHead>Product</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead>State</TableHead>
            {canChange && (
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id} className={phoneRow}>
              <TableCell className="whitespace-normal">
                {/* products R16 */}
                <Link
                  to="/stock-movements"
                  search={{ productId: product.id }}
                  className="font-medium wrap-anywhere hover:underline"
                >
                  {product.name}
                </Link>
                <p className="text-small break-all text-muted-foreground">{product.sku}</p>
              </TableCell>
              <TableCell className={secondary}>{product.unit}</TableCell>
              <TableCell className={cn(secondary, "text-right whitespace-nowrap")}>
                {formatBaht(product.price)}
              </TableCell>
              <TableCell className="max-shell:row-span-2 max-shell:text-right shell:w-48">
                <StockFigure product={product} />
              </TableCell>
              <TableCell className="max-shell:col-start-1 max-shell:row-start-2 max-shell:pt-0">
                <StockStateBadge state={product.stockState} />
              </TableCell>
              {canChange && (
                <TableCell className="max-shell:col-span-2 max-shell:pt-0">
                  <Button variant="outline" asChild>
                    <Link
                      to="/products/$id/edit"
                      params={{ id: String(product.id) }}
                      aria-label={`Edit ${product.name}`}
                    >
                      Edit
                    </Link>
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// The stock is the one bold thing in the row; at or below the minimum it reads "18 of 60".
function StockFigure({ product }: { product: Product }) {
  const against = product.stockState !== "in-stock";

  return (
    <div className="flex flex-col gap-1.5 max-shell:items-end">
      <p className="shell:text-right">
        <span className="text-stock">{product.stock}</span>
        {against && <span className="text-muted-foreground"> of {product.minimumStock}</span>}
      </p>
      <StockLevelBar
        stock={product.stock}
        minimumStock={product.minimumStock}
        state={product.stockState}
      />
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
  search: ProductsSearch;
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
          <Link to="/products" search={{ ...search, page: page > 2 ? page - 1 : undefined }}>
            Previous page
          </Link>
        </Button>
      )}
      {last < total && (
        <Button variant="outline" asChild>
          <Link to="/products" search={{ ...search, page: page + 1 }}>
            Next page
          </Link>
        </Button>
      )}
    </nav>
  );
}

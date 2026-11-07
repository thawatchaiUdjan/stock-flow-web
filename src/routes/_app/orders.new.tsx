import { useForm, useStore } from "@tanstack/react-form";
import { keepPreviousData, useQueries, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { errorMessage, hasCode, hasFieldError, messageFor, stockOf } from "@/api/errors";
import type { Product } from "@/api/generated/model";
import {
  getGetOrderQueryKey,
  getListOrdersQueryKey,
  useCreateOrder,
} from "@/api/generated/orders/orders";
import {
  CreateOrderBody,
  createOrderBodyCustomerMax,
  createOrderBodyNoteMax,
} from "@/api/generated/orders/orders.zod";
import {
  getGetProductQueryKey,
  getGetProductQueryOptions,
  getListProductsQueryKey,
  useListProducts,
} from "@/api/generated/products/products";
import { getListStockMovementsQueryKey } from "@/api/generated/stock-movements/stock-movements";
import { StockStateBadge } from "@/components/stock-level";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatBaht } from "@/lib/format";

export const Route = createFileRoute("/_app/orders/new")({ component: NewOrderPage });

// The Product as it was offered: its price and stock then, shown until the API says otherwise.
type LineProduct = Pick<Product, "id" | "name" | "sku" | "price" | "stock" | "stockState">;

interface LineValues {
  product: LineProduct;
  quantity: string;
}

// orders R1: lengths are counted in characters, as the API counts them.
const characters = (text: string) => Array.from(text).length;

// orders R3: a whole quantity of at least 1. The contract keeps it to an int32.
const quantity = z
  .string()
  .trim()
  .transform((text) => (/^\d+$/.test(text) ? Number(text) : Number.NaN))
  .pipe(CreateOrderBody.shape.lines.element.shape.quantity.max(2_147_483_647));

const orderSchema = z
  .object({
    // orders R1: one or more lines.
    lines: z.array(z.object({ product: z.custom<LineProduct>(), quantity })).min(1),
    // orders R1: both optional; spaces around them are dropped before they are counted.
    customer: z
      .string()
      .trim()
      .refine((text) => characters(text) <= createOrderBodyCustomerMax),
    note: z
      .string()
      .trim()
      .refine((text) => characters(text) <= createOrderBodyNoteMax),
  })
  .transform(({ lines, customer, note }) => ({
    lines: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
    ...(customer !== "" && { customer }),
    ...(note !== "" && { note }),
  }));

const quantityMessage = "Enter a whole number of 1 or more.";

// The line's quantity as a number, or undefined while it isn't one.
function quantityOf(text: string) {
  const result = quantity.safeParse(text);
  return result.success ? result.data : undefined;
}

function NewOrderPage() {
  const queryClient = useQueryClient();
  const navigate = Route.useNavigate();

  const createOrder = useCreateOrder({
    mutation: {
      onSuccess: (order) => {
        queryClient.setQueryData(getGetOrderQueryKey(order.number), order);
        // orders R7: the stock left with the Order's movements (context ADR 0006).
        for (const queryKey of [
          getListOrdersQueryKey(),
          getListStockMovementsQueryKey(),
          getListProductsQueryKey(),
          ...order.lines.map((line) => getGetProductQueryKey(line.product.id)),
        ]) {
          void queryClient.invalidateQueries({ queryKey });
        }
        void navigate({
          to: "/orders/$number",
          params: { number: String(order.number) },
          search: { created: true },
        });
      },
      // The stock or the status the search showed is out of date.
      onError: (error) => {
        if (hasCode(error, "insufficient-stock") || hasCode(error, "product-archived")) {
          void queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        }
      },
    },
  });
  const { error } = createOrder;

  const form = useForm({
    defaultValues: { lines: [] as LineValues[], customer: "", note: "" },
    validators: { onSubmit: orderSchema },
    onSubmit: ({ value }) => createOrder.mutate({ data: orderSchema.parse(value) }),
  });
  const lines = useStore(form.store, (state) => state.values.lines);

  // The API doesn't say which Product is Archived (orders R6), so each line's Product is asked for.
  const archivedRefusal = hasCode(error, "product-archived");
  const archived = useQueries({
    queries: archivedRefusal ? lines.map((line) => getGetProductQueryOptions(line.product.id)) : [],
    combine: (results) => ({
      ids: new Set(
        results.flatMap((result) => (result.data?.status === "archived" ? [result.data.id] : [])),
      ),
      isPending: results.some((result) => result.isPending),
    }),
  });

  // orders R8: every short line says so beside it, until its quantity is lowered to the stock.
  function lineMessage(line: LineValues, invalid: boolean) {
    if (archived.ids.has(line.product.id)) return messageFor("product-archived");
    if (invalid) return quantityMessage;
    const inStock = stockOf(error, line.product.id);
    if (inStock !== undefined && !((quantityOf(line.quantity) ?? 0) <= inStock)) {
      return `Only ${inStock} in stock. Lower the quantity to continue.`;
    }
    return undefined;
  }

  const customerRefused = hasFieldError(error, "customer");
  const noteRefused = hasFieldError(error, "note");
  const refusedBeside =
    hasCode(error, "insufficient-stock") ||
    (archivedRefusal && (archived.isPending || archived.ids.size > 0)) ||
    customerRefused ||
    noteRefused;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title">New order</h1>
      <form
        noValidate
        aria-label="New order"
        className="flex max-w-160 flex-col gap-4 rounded-lg border bg-card p-4 shell:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        {error != null && !refusedBeside && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(error)}</AlertDescription>
          </Alert>
        )}
        <FieldGroup>
          <section aria-labelledby="order-products" className="flex flex-col gap-3">
            <h2 id="order-products" className="text-body font-semibold">
              Products
            </h2>
            <ProductSearch
              chosen={new Set(lines.map((line) => line.product.id))}
              onAdd={(product) => {
                form.pushFieldValue("lines", { product, quantity: "1" });
              }}
            />
            <form.Field name="lines" mode="array">
              {(linesField) => (
                <>
                  {linesField.state.value.length === 0 ? (
                    <p className="text-muted-foreground">
                      No products on this order yet. Find one above to add it.
                    </p>
                  ) : (
                    <div className="flex flex-col divide-y rounded-lg border">
                      {linesField.state.value.map((line, index) => (
                        <form.Field key={line.product.id} name={`lines[${index}].quantity`}>
                          {(field) => (
                            <OrderLine
                              line={line}
                              inStock={stockOf(error, line.product.id) ?? line.product.stock}
                              message={lineMessage(line, field.state.meta.errors.length > 0)}
                              onQuantity={field.handleChange}
                              onBlur={field.handleBlur}
                              onRemove={() => linesField.removeValue(index)}
                            />
                          )}
                        </form.Field>
                      ))}
                    </div>
                  )}
                  <FieldError>
                    {linesField.state.meta.errors.length > 0 && lines.length === 0
                      ? "Add at least one product."
                      : null}
                  </FieldError>
                </>
              )}
            </form.Field>
            <Total lines={lines} />
          </section>
          <form.Field name="customer">
            {(field) => {
              const invalid = field.state.meta.errors.length > 0 || customerRefused;
              return (
                <Field data-invalid={invalid}>
                  <FieldLabel htmlFor="order-customer">Customer (optional)</FieldLabel>
                  <Input
                    id="order-customer"
                    autoComplete="off"
                    aria-invalid={invalid}
                    aria-describedby={invalid ? "order-customer-error" : undefined}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                  <FieldError id="order-customer-error">
                    {invalid ? "Keep the customer's name to 120 characters." : null}
                  </FieldError>
                </Field>
              );
            }}
          </form.Field>
          <form.Field name="note">
            {(field) => {
              const invalid = field.state.meta.errors.length > 0 || noteRefused;
              return (
                <Field data-invalid={invalid}>
                  <FieldLabel htmlFor="order-note">Note (optional)</FieldLabel>
                  <Input
                    id="order-note"
                    autoComplete="off"
                    aria-invalid={invalid}
                    aria-describedby={["order-note-hint", invalid && "order-note-error"]
                      .filter(Boolean)
                      .join(" ")}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                  <FieldDescription id="order-note-hint">
                    Anything worth keeping, such as when the customer picks it up.
                  </FieldDescription>
                  <FieldError id="order-note-error">
                    {invalid ? "Keep the note to 200 characters." : null}
                  </FieldError>
                </Field>
              );
            }}
          </form.Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={createOrder.isPending}>
              {createOrder.isPending ? "Creating order" : "Create order"}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/orders">Cancel</Link>
            </Button>
          </div>
        </FieldGroup>
      </form>
    </div>
  );
}

const searchLimit = 8;

// orders R6, R19: Active Products only, each with its stock and price, found by name or SKU.
function ProductSearch({
  chosen,
  onAdd,
}: {
  chosen: Set<number>;
  onAdd: (product: LineProduct) => void;
}) {
  const [text, setText] = useState("");
  const search = text.trim();
  const found = useListProducts(
    { status: "active", search, limit: searchLimit },
    { query: { enabled: search !== "", placeholderData: keepPreviousData } },
  );

  return (
    <div className="flex flex-col gap-2">
      <Field>
        <FieldLabel htmlFor="order-product-search">Find a product</FieldLabel>
        <Input
          id="order-product-search"
          type="search"
          autoComplete="off"
          aria-describedby="order-product-search-hint"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <FieldDescription id="order-product-search-hint">
          Search by name or SKU. Only active products are offered.
        </FieldDescription>
      </Field>
      {search !== "" && found.isPending && (
        <output className="text-muted-foreground">Searching</output>
      )}
      {search !== "" && found.isError && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(found.error)}</AlertDescription>
        </Alert>
      )}
      {search !== "" && found.isSuccess && found.data.products.length === 0 && (
        <p className="text-muted-foreground">No active product matches “{search}”.</p>
      )}
      {search !== "" && found.isSuccess && found.data.products.length > 0 && (
        <>
          <ul
            aria-label="Products found"
            aria-busy={found.isPlaceholderData}
            className="flex flex-col divide-y rounded-lg border"
          >
            {found.data.products.map((product) => (
              <li
                key={product.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2"
              >
                <div className="min-w-0 flex-1 basis-40">
                  <p className="font-medium wrap-anywhere">{product.name}</p>
                  <p className="text-small break-all text-muted-foreground">{product.sku}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end">
                    <p className="flex items-center gap-2">
                      {product.stockState !== "in-stock" && (
                        <StockStateBadge state={product.stockState} />
                      )}
                      <span className="text-stock">{product.stock}</span>{" "}
                      <span className="text-muted-foreground">in stock</span>
                    </p>
                    <p className="text-small text-muted-foreground">
                      {formatBaht(product.price)} each
                    </p>
                  </div>
                  {/* orders R3: a Product is on one line of an Order at most. */}
                  {chosen.has(product.id) ? (
                    <Button type="button" variant="outline" disabled>
                      Added
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      aria-label={`Add ${product.name}`}
                      onClick={() => {
                        onAdd(product);
                        setText("");
                      }}
                    >
                      <Plus aria-hidden />
                      Add
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {found.data.total > found.data.products.length && (
            <p className="text-small text-muted-foreground">
              Showing {found.data.products.length} of {found.data.total}. Keep typing to narrow the
              list.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// A line mounts when its Product is added: the Add button it came from is gone with the search
// text, and its quantity is what comes next. Stable, so it runs once per line.
const focusOnMount = (input: HTMLInputElement | null) => input?.focus();

function OrderLine({
  line,
  inStock,
  message,
  onQuantity,
  onBlur,
  onRemove,
}: {
  line: LineValues;
  inStock: number;
  message: string | undefined;
  onQuantity: (text: string) => void;
  onBlur: () => void;
  onRemove: () => void;
}) {
  const { product } = line;
  const id = `line-${product.id}`;
  const count = quantityOf(line.quantity);
  const invalid = message !== undefined;

  return (
    <fieldset
      aria-labelledby={`${id}-name`}
      data-invalid={invalid}
      className="flex min-w-0 flex-col gap-2 px-3 py-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p id={`${id}-name`} className="font-medium wrap-anywhere">
            {product.name}
          </p>
          <p className="text-small text-muted-foreground">
            <span className="break-all">{product.sku}</span> · {formatBaht(product.price)} each ·{" "}
            {inStock} in stock
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          aria-label={`Remove ${product.name}`}
          onClick={onRemove}
        >
          <X aria-hidden />
          Remove
        </Button>
      </div>
      <div className="flex items-end justify-between gap-3">
        <Field className="w-28">
          <FieldLabel htmlFor={`${id}-quantity`}>Quantity</FieldLabel>
          <Input
            id={`${id}-quantity`}
            ref={focusOnMount}
            inputMode="numeric"
            autoComplete="off"
            className="text-right"
            aria-invalid={invalid}
            aria-describedby={invalid ? `${id}-error` : undefined}
            value={line.quantity}
            onBlur={onBlur}
            onChange={(event) => onQuantity(event.target.value)}
          />
        </Field>
        <p className="flex flex-col items-end">
          <span className="text-small text-muted-foreground">Amount</span>
          {/* orders R4: the quantity times the price. */}
          <span>{count === undefined ? "–" : formatBaht(count * product.price)}</span>
        </p>
      </div>
      <FieldError id={`${id}-error`}>{message ?? null}</FieldError>
    </fieldset>
  );
}

// orders R4, R19: the sum of the lines' amounts, updated as they change. The API fixes the prices
// when the Order is created; these are the ones offered.
function Total({ lines }: { lines: LineValues[] }) {
  const total = lines.reduce(
    (sum, line) => sum + (quantityOf(line.quantity) ?? 0) * line.product.price,
    0,
  );

  return (
    <div className="flex items-center justify-between gap-3 border-t pt-3">
      <span id="order-total" className="font-semibold">
        Total
      </span>
      <output aria-labelledby="order-total" className="font-semibold">
        {formatBaht(total)}
      </output>
    </div>
  );
}

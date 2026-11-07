import { useForm } from "@tanstack/react-form";
import { z } from "zod";

import { errorMessage, hasCode, hasFieldError, messageFor, stockOf } from "@/api/errors";
import type { Product } from "@/api/generated/model";
import { ProductSelect } from "@/components/product-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { characters } from "@/lib/format";

export type StockChangeMode = "receive" | "adjust";

// stock-movements R2: a note is up to 200 characters, counted as the API counts them.
const noteLimit = 200;

// Receive adds units, Adjust moves stock up or down. Either way the API wants one whole number.
const modes = {
  receive: {
    title: "Receive stock",
    pending: "Receiving stock",
    amount: "quantity",
    amountLabel: "Quantity",
    amountHint: "How many units arrived.",
    amountMessage: "Enter a whole number of 1 or more.",
    noteLabel: "Note (optional)",
    noteHint: "Anything worth keeping about the delivery, such as a delivery number.",
  },
  adjust: {
    title: "Adjust stock",
    pending: "Adjusting stock",
    amount: "change",
    amountLabel: "Change",
    amountHint: "Units to add, or to take out with a minus, such as 5 or −3.",
    amountMessage: "Enter a whole number other than 0, such as 5 or −3.",
    noteLabel: "Note",
    noteHint: "Why the stock is wrong. It stays in the history.",
  },
} as const;

// stock-movements R4: a whole number of units, at least 1.
const quantity = z
  .string()
  .trim()
  .transform((text) => (/^\d+$/.test(text) ? Number(text) : Number.NaN))
  .pipe(z.number().int().min(1));

// stock-movements R5: up or down, never 0. The screen writes a minus as "−", so both are read.
const change = z
  .string()
  .trim()
  .transform((text) => (/^[+\-−]?\d+$/.test(text) ? Number(text.replace("−", "-")) : Number.NaN))
  .pipe(
    z
      .number()
      .int()
      .refine((value) => value !== 0),
  );

const productId = z.string().min(1).transform(Number);

const receiveSchema = z.object({
  productId,
  amount: quantity,
  note: z
    .string()
    .trim()
    .refine((text) => characters(text) <= noteLimit),
});

// stock-movements R5: an Adjustment needs a note saying why.
const adjustSchema = z.object({
  productId,
  amount: change,
  note: z
    .string()
    .trim()
    .min(1)
    .refine((text) => characters(text) <= noteLimit),
});

export interface StockChangeInput {
  productId: number;
  amount: number;
  note: string;
}

// Receive and Adjust are one form: the screen around it says which, and what to do with the result.
export function StockChangeForm({
  mode,
  products,
  preset,
  pending,
  error,
  submittedProductId,
  onEdit,
  onCancel,
  onSubmit,
}: {
  mode: StockChangeMode;
  // The Active Products it offers.
  products: Pick<Product, "id" | "name" | "sku" | "stock">[];
  // The Product the page is filtered to, when it is one of those.
  preset: number | undefined;
  pending: boolean;
  error: unknown;
  // The Product the refused request was about.
  submittedProductId: number | undefined;
  // The refusal was about the old values.
  onEdit: () => void;
  onCancel: () => void;
  onSubmit: (input: StockChangeInput) => void;
}) {
  const words = modes[mode];
  const schema = mode === "receive" ? receiveSchema : adjustSchema;
  const form = useForm({
    defaultValues: {
      productId: products.some(({ id }) => id === preset) ? String(preset) : "",
      amount: "",
      note: "",
    },
    validators: { onSubmit: schema },
    onSubmit: ({ value }) => onSubmit(schema.parse(value)),
  });

  const archived = hasCode(error, "product-archived");
  // stock-movements R6: how many are in stock, beside the number that asked for too many.
  const insufficient = hasCode(error, "insufficient-stock");
  const inStock = submittedProductId === undefined ? undefined : stockOf(error, submittedProductId);
  const fieldRefused = (name: string) => hasFieldError(error, name);
  const refusedByFields =
    archived ||
    insufficient ||
    fieldRefused("productId") ||
    fieldRefused(words.amount) ||
    fieldRefused("note");

  function messageOf(name: "productId" | "amount" | "note", errors: unknown[], text = "") {
    const invalid = errors.length > 0;
    if (name === "productId") {
      if (archived) return messageFor("product-archived");
      return invalid || fieldRefused("productId") ? "Choose a product." : undefined;
    }
    if (name === "amount") {
      if (insufficient) {
        return inStock === undefined
          ? messageFor("insufficient-stock")
          : `Only ${inStock} in stock.`;
      }
      return invalid || fieldRefused(words.amount) ? words.amountMessage : undefined;
    }
    if (!invalid && !fieldRefused("note")) return undefined;
    // Too long is the one thing wrong with a note that has something in it.
    if (characters(text.trim()) > noteLimit || mode === "receive") {
      return "Keep the note to 200 characters.";
    }
    return "Say why the stock is wrong.";
  }

  const idOf = (name: string) => `stock-${name}`;
  // The refusal was about the old values.
  const edit = () => {
    if (error != null) onEdit();
  };

  return (
    <form
      noValidate
      aria-labelledby="stock-change-title"
      className="flex max-w-160 flex-col gap-4 rounded-lg border bg-card p-6"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <h2 id="stock-change-title" className="text-body font-semibold">
        {words.title}
      </h2>
      {error != null && !refusedByFields && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(error)}</AlertDescription>
        </Alert>
      )}
      <FieldGroup>
        <form.Field name="productId">
          {(field) => {
            const message = messageOf("productId", field.state.meta.errors);
            return (
              <Field data-invalid={message !== undefined}>
                <FieldLabel htmlFor={idOf("product")}>Product</FieldLabel>
                <ProductSelect
                  id={idOf("product")}
                  products={products}
                  placeholder="Choose a product"
                  showStock
                  aria-invalid={message !== undefined}
                  aria-describedby={message === undefined ? undefined : idOf("product-error")}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    edit();
                    field.handleChange(event.target.value);
                  }}
                />
                <FieldError id={idOf("product-error")}>{message ?? null}</FieldError>
              </Field>
            );
          }}
        </form.Field>
        <form.Field name="amount">
          {(field) => {
            const message = messageOf("amount", field.state.meta.errors);
            return (
              <Field data-invalid={message !== undefined}>
                <FieldLabel htmlFor={idOf("amount")}>{words.amountLabel}</FieldLabel>
                <Input
                  id={idOf("amount")}
                  autoComplete="off"
                  inputMode={mode === "receive" ? "numeric" : "text"}
                  aria-invalid={message !== undefined}
                  aria-describedby={[
                    idOf("amount-hint"),
                    message !== undefined && idOf("amount-error"),
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    edit();
                    field.handleChange(event.target.value);
                  }}
                />
                <FieldDescription id={idOf("amount-hint")}>{words.amountHint}</FieldDescription>
                <FieldError id={idOf("amount-error")}>{message ?? null}</FieldError>
              </Field>
            );
          }}
        </form.Field>
        <form.Field name="note">
          {(field) => {
            const message = messageOf("note", field.state.meta.errors, field.state.value);
            return (
              <Field data-invalid={message !== undefined}>
                <FieldLabel htmlFor={idOf("note")}>{words.noteLabel}</FieldLabel>
                <Input
                  id={idOf("note")}
                  autoComplete="off"
                  aria-invalid={message !== undefined}
                  aria-describedby={[idOf("note-hint"), message !== undefined && idOf("note-error")]
                    .filter(Boolean)
                    .join(" ")}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    edit();
                    field.handleChange(event.target.value);
                  }}
                />
                <FieldDescription id={idOf("note-hint")}>{words.noteHint}</FieldDescription>
                <FieldError id={idOf("note-error")}>{message ?? null}</FieldError>
              </Field>
            );
          }}
        </form.Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? words.pending : words.title}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

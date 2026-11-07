import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import { z } from "zod";

import { errorMessage, hasCode, hasFieldError, messageFor } from "@/api/errors";
import { CreateProductBody } from "@/api/generated/products/products.zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { bahtTextToSatang } from "@/lib/format";

// What the fields hold while they are typed in. The price is baht text, the API's is satang.
export interface ProductValues {
  name: string;
  sku: string;
  unit: string;
  price: string;
  minimumStock: string;
}

// products R2 to R5, R8. The rules are the contract's, so this can't be stricter than the API;
// the spaces around a pasted value are dropped before it is checked, and there is no stock field
// (R6, context ADR 0006).
const productSchema = z.object({
  name: z.string().trim().pipe(CreateProductBody.shape.name),
  sku: z.string().trim().pipe(CreateProductBody.shape.sku),
  unit: z.string().trim().pipe(CreateProductBody.shape.unit),
  price: z
    .string()
    .transform((text) => bahtTextToSatang(text) ?? Number.NaN)
    .pipe(CreateProductBody.shape.price),
  // Left empty it is the API's default, 0.
  minimumStock: z
    .string()
    .trim()
    .transform((text) => (text === "" ? 0 : /^\d+$/.test(text) ? Number(text) : Number.NaN))
    .pipe(CreateProductBody.shape.minimumStock.unwrap()),
});
export type ProductInput = z.output<typeof productSchema>;

const fieldMessages = {
  name: "Enter a name of up to 120 characters.",
  sku: "Enter a SKU of up to 40 letters, digits and hyphens.",
  unit: "Enter the unit, such as pcs or box, up to 20 characters.",
  price: "Enter a price from 0.00 to 9,999,999.99 baht.",
  minimumStock: "Enter a whole number, 0 or more.",
};

const fieldNames = ["name", "sku", "unit", "price", "minimumStock"] as const;
type FieldName = (typeof fieldNames)[number];

const fields: {
  name: FieldName;
  label: string;
  hint?: string;
  input?: ComponentProps<"input">;
}[] = [
  { name: "name", label: "Name" },
  { name: "sku", label: "SKU", hint: "Letters, digits and hyphens. Each product has its own." },
  { name: "unit", label: "Unit", input: { placeholder: "pcs", list: "product-units" } },
  {
    name: "price",
    label: "Price (baht)",
    hint: "What one unit sells for, such as 48.50.",
    input: { inputMode: "decimal" },
  },
  {
    name: "minimumStock",
    label: "Minimum stock",
    hint: "At or below this the product shows as Low.",
    input: { inputMode: "numeric" },
  },
];

// Add and Edit are one form: the screen around it says which, and what to do with the result.
export function ProductForm({
  initial,
  submitLabel,
  pendingLabel,
  pending,
  error,
  onEdit,
  onSubmit,
}: {
  initial: ProductValues;
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  error: unknown;
  // The refusal was about the old values.
  onEdit: () => void;
  onSubmit: (input: ProductInput) => void;
}) {
  const form = useForm({
    defaultValues: initial,
    validators: { onSubmit: productSchema },
    onSubmit: ({ value }) => onSubmit(productSchema.parse(value)),
  });

  // products R3: the SKU's refusal sits beside the SKU, in the words of the code's list.
  const skuTaken = hasCode(error, "sku-taken");
  const refusedByFields = skuTaken || fieldNames.some((name) => hasFieldError(error, name));

  function messageOf(name: FieldName, errors: unknown[]) {
    if (name === "sku" && skuTaken) return messageFor("sku-taken");
    return errors.length > 0 || hasFieldError(error, name) ? fieldMessages[name] : undefined;
  }

  return (
    <div className="flex max-w-160 flex-col gap-4 rounded-lg border bg-card p-6">
      {error != null && !refusedByFields && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(error)}</AlertDescription>
        </Alert>
      )}
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <FieldGroup>
          {fields.map(({ name, label, hint, input }) => (
            <form.Field key={name} name={name}>
              {(field) => {
                const message = messageOf(name, field.state.meta.errors);
                const invalid = message !== undefined;

                return (
                  <Field data-invalid={invalid}>
                    <FieldLabel htmlFor={name}>{label}</FieldLabel>
                    <Input
                      autoComplete="off"
                      {...input}
                      id={name}
                      aria-invalid={invalid}
                      aria-describedby={[hint && `${name}-hint`, invalid && `${name}-error`]
                        .filter(Boolean)
                        .join(" ")}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        if (error != null) onEdit();
                        field.handleChange(event.target.value);
                      }}
                    />
                    {hint && <FieldDescription id={`${name}-hint`}>{hint}</FieldDescription>}
                    <FieldError id={`${name}-error`}>{message ?? null}</FieldError>
                  </Field>
                );
              }}
            </form.Field>
          ))}
          <datalist id="product-units">
            <option value="pcs">pcs</option>
            <option value="box">box</option>
          </datalist>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? pendingLabel : submitLabel}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/products">Cancel</Link>
            </Button>
          </div>
        </FieldGroup>
      </form>
    </div>
  );
}

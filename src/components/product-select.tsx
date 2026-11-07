import { useQueries } from "@tanstack/react-query";
import type { ComponentProps } from "react";

import type { Product } from "@/api/generated/model";
import { getListProductsQueryOptions, useListProducts } from "@/api/generated/products/products";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

const pageSize = 100;
const params = { status: "active", limit: pageSize } as const;

// Every Active Product, by name: the API pages them, so the rest are asked for once the first
// page says how many there are.
export function useActiveProducts() {
  const first = useListProducts({ ...params, offset: 0 });
  const total = first.data?.total ?? 0;
  const later = useQueries({
    queries: Array.from({ length: Math.max(0, Math.ceil(total / pageSize) - 1) }, (_, i) =>
      getListProductsQueryOptions({ ...params, offset: (i + 1) * pageSize }),
    ),
    combine: (results) => ({
      products: results.flatMap((result) => result.data?.products ?? []),
      isPending: results.some((result) => result.isPending),
      error: results.find((result) => result.isError)?.error,
    }),
  });

  return {
    products: [...(first.data?.products ?? []), ...later.products],
    isPending: first.isPending || later.isPending,
    error: first.error ?? later.error ?? undefined,
  };
}

// Products are chosen from a list of what is offered, never typed, so the choice is always a
// Product that exists. `showStock` adds its current stock to each name, for forms that change it.
export function ProductSelect({
  products,
  placeholder,
  showStock,
  ...props
}: Omit<ComponentProps<typeof NativeSelect>, "children"> & {
  products: Pick<Product, "id" | "name" | "sku" | "stock">[];
  placeholder: string;
  showStock?: boolean;
}) {
  return (
    <NativeSelect {...props}>
      <NativeSelectOption value="">{placeholder}</NativeSelectOption>
      {products.map((product) => (
        <NativeSelectOption key={product.id} value={product.id}>
          {product.name} ({product.sku}){showStock && `, ${product.stock} in stock`}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

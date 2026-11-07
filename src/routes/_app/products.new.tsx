import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { getListProductsQueryKey, useCreateProduct } from "@/api/generated/products/products";
import { ProductForm } from "@/components/product-form";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/products/new")({ component: NewProductPage });

const empty = { name: "", sku: "", unit: "", price: "", minimumStock: "0" };

function NewProductPage() {
  const queryClient = useQueryClient();
  const createProduct = useCreateProduct({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }),
    },
  });

  if (createProduct.data) {
    const { name, sku } = createProduct.data;

    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-title">Product added</h1>
        <div className="flex max-w-160 flex-col gap-4 rounded-lg border bg-card p-6">
          <p>
            {name} ({sku}) is on the list with no stock yet. Stock comes in through Stock movements.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/products">Back to products</Link>
            </Button>
            <Button variant="outline" onClick={() => createProduct.reset()}>
              Add another product
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title">New product</h1>
      <ProductForm
        initial={empty}
        submitLabel="Add product"
        pendingLabel="Adding product"
        pending={createProduct.isPending}
        error={createProduct.error}
        onEdit={() => createProduct.reset()}
        onSubmit={(data) => createProduct.mutate({ data })}
      />
    </div>
  );
}

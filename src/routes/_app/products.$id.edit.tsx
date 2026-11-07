import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { errorMessage } from "@/api/errors";
import type { Product, UpdateProductBody } from "@/api/generated/model";
import {
  getGetProductQueryKey,
  getListProductsQueryKey,
  useGetProduct,
  useUpdateProduct,
} from "@/api/generated/products/products";
import { Confirmation } from "@/components/confirmation";
import { ProductForm } from "@/components/product-form";
import type { ProductInput } from "@/components/product-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { satangToBahtText } from "@/lib/format";

export const Route = createFileRoute("/_app/products/$id/edit")({ component: EditProductPage });

function EditProductPage() {
  const { id } = Route.useParams();
  const productId = /^\d+$/.test(id) ? Number(id) : undefined;
  const product = useGetProduct(productId ?? 0, { query: { enabled: productId !== undefined } });
  const notFound = productId === undefined || (product.isError && product.error.status === 404);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title">Edit product</h1>
      {productId !== undefined && product.isPending && (
        <output className="text-muted-foreground">Loading product</output>
      )}
      {!notFound && product.isError && (
        <>
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(product.error)}</AlertDescription>
          </Alert>
          <Button variant="outline" className="self-start" onClick={() => void product.refetch()}>
            Try again
          </Button>
        </>
      )}
      {notFound && (
        <div className="flex max-w-160 flex-col items-start gap-4 rounded-lg border bg-card p-6">
          <p>No product has this address.</p>
          <Button asChild>
            <Link to="/products">Back to products</Link>
          </Button>
        </div>
      )}
      {product.isSuccess && <EditProduct key={product.data.id} product={product.data} />}
    </div>
  );
}

// The list is waited for, so it opens with the change and not the old row.
function useUpdateAndReturn(product: Product) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useUpdateProduct({
    mutation: {
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetProductQueryKey(product.id) }),
        ]);
        await navigate({ to: "/products" });
      },
    },
  });
}

function EditProduct({ product }: { product: Product }) {
  const navigate = useNavigate();
  const update = useUpdateAndReturn(product);

  async function save(input: ProductInput) {
    const changes: UpdateProductBody = {
      ...(input.name !== product.name && { name: input.name }),
      ...(input.sku !== product.sku && { sku: input.sku }),
      ...(input.unit !== product.unit && { unit: input.unit }),
      ...(input.price !== product.price && { price: input.price }),
      ...(input.minimumStock !== product.minimumStock && { minimumStock: input.minimumStock }),
    };
    if (Object.keys(changes).length === 0) {
      await navigate({ to: "/products" });
      return;
    }
    update.mutate({ id: product.id, data: changes });
  }

  return (
    <>
      <ProductForm
        initial={{
          name: product.name,
          sku: product.sku,
          unit: product.unit,
          price: satangToBahtText(product.price),
          minimumStock: String(product.minimumStock),
        }}
        submitLabel="Save changes"
        pendingLabel="Saving changes"
        pending={update.isPending}
        error={update.error}
        onEdit={() => update.reset()}
        onSubmit={(input) => void save(input)}
      />
      <StatusAction product={product} />
    </>
  );
}

// products R11, R12
function StatusAction({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const update = useUpdateAndReturn(product);
  const archiving = product.status === "active";
  const action = archiving ? "Archive" : "Restore";

  return (
    <div className="flex max-w-160 flex-col items-start gap-2">
      <Button variant="outline" onClick={() => setOpen(true)}>
        {action}
      </Button>
      <Confirmation
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) update.reset();
        }}
        title={`${action} ${product.name}?`}
        description={
          archiving
            ? `${product.name} leaves the product list and can't receive stock or be added to an order. Its stock of ${product.stock} stays as it is, and you can restore it later.`
            : `${product.name} is back on the product list and can receive stock and be added to orders again.`
        }
        confirm={action}
        pending={update.isPending}
        error={update.error}
        onConfirm={() =>
          update.mutate({ id: product.id, data: { status: archiving ? "archived" : "active" } })
        }
      />
    </div>
  );
}

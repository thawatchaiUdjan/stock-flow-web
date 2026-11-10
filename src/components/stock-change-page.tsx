import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { errorMessage } from "@/api/errors";
import type { StockMovement } from "@/api/generated/model";
import { getGetProductQueryKey, getListProductsQueryKey } from "@/api/generated/products/products";
import {
  getListStockMovementsQueryKey,
  useAdjustStock,
  useReceiveStock,
} from "@/api/generated/stock-movements/stock-movements";
import { useActiveProducts } from "@/components/product-select";
import { StockChangeForm } from "@/components/stock-change-form";
import type { StockChangeMode } from "@/components/stock-change-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { MovementsSearch } from "@/lib/stock-movements-search";

// What the page says after a movement is saved.
interface Notice {
  title: string;
  text: string;
}

export function StockChangePage({
  mode,
  search,
}: {
  mode: StockChangeMode;
  search: MovementsSearch;
}) {
  const [done, setDone] = useState<Notice>();
  return (
    <div className="flex flex-col gap-4">
      {done ? (
        <>
          <h1 className="text-title">{done.title}</h1>
          <output className="block rounded-lg border bg-card px-3 py-2">{done.text}</output>
          <Button asChild className="self-start">
            <Link to="/stock-movements" search={search}>
              Back to stock movements
            </Link>
          </Button>
        </>
      ) : (
        <StockChangePanel
          mode={mode}
          preset={search.productId}
          onDone={setDone}
          cancelSearch={search}
        />
      )}
    </div>
  );
}

// Receive stock and Adjust stock: the same form, a different operation behind it.
function StockChangePanel({
  mode,
  preset,
  cancelSearch,
  onDone,
}: {
  mode: StockChangeMode;
  preset: number | undefined;
  cancelSearch: MovementsSearch;
  onDone: (notice: Notice) => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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
      onCancel={() => void navigate({ to: "/stock-movements", search: cancelSearch })}
      onSubmit={({ productId, amount, note }) =>
        mode === "receive"
          ? receive.mutate({ data: { productId, quantity: amount, ...(note && { note }) } })
          : adjust.mutate({ data: { productId, change: amount, note } })
      }
    />
  );
}

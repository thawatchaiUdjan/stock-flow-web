import type { ProductStockState } from "@/api/generated/model";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const stockStateNames: Record<ProductStockState, string> = {
  "in-stock": "In stock",
  low: "Low",
  "out-of-stock": "Out of stock",
};

const stateBadge = {
  "in-stock": "outline",
  low: "warning",
  "out-of-stock": "destructive",
} as const satisfies Record<ProductStockState, "outline" | "warning" | "destructive">;

const fills: Record<ProductStockState, string> = {
  "in-stock": "bg-primary",
  low: "bg-warning-fill",
  "out-of-stock": "bg-destructive",
};

// products R9: said in words, and in colour only beside them.
export function StockStateBadge({ state }: { state: ProductStockState }) {
  return <Badge variant={stateBadge[state]}>{stockStateNames[state]}</Badge>;
}

// The bar covers 0 to twice the Minimum stock (or the stock, if that is more), so the minimum is
// always a tick the fill is below, at, or past. docs/design.md: Ink marks the minimum.
export function StockLevelBar({
  stock,
  minimumStock,
  state,
}: {
  stock: number;
  minimumStock: number;
  state: ProductStockState;
}) {
  const scale = Math.max(stock, minimumStock * 2, 1);

  return (
    <div className="relative h-1.5 w-full min-w-16 overflow-hidden rounded-full bg-border">
      <meter
        className="sr-only"
        aria-label={`${stock} in stock, minimum ${minimumStock}`}
        min={0}
        max={scale}
        value={stock}
      />
      <div
        className={cn("h-full rounded-full", fills[state])}
        style={{ width: `${(stock / scale) * 100}%` }}
      />
      {minimumStock > 0 && (
        <div
          className="absolute inset-y-0 w-0.5 bg-foreground"
          style={{ left: `${(minimumStock / scale) * 100}%` }}
        />
      )}
    </div>
  );
}

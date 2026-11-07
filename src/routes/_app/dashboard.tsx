import { createFileRoute, Link } from "@tanstack/react-router";

import { errorMessage } from "@/api/errors";
import { useGetDashboard } from "@/api/generated/dashboard-and-reports/dashboard-and-reports";
import type { DashboardOutputBody, RestockProduct } from "@/api/generated/model";
import { OrdersTable } from "@/components/orders-table";
import { SalesByDay } from "@/components/sales-by-day";
import { StockLevelBar, StockStateBadge } from "@/components/stock-level";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatBaht } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

// dashboard-and-reports R9: dropped when the page closes, so it never opens on the last visit's figures.
function DashboardPage() {
  const dashboard = useGetDashboard({ query: { gcTime: 0 } });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title">Dashboard</h1>
      {dashboard.isPending && <output className="text-muted-foreground">Loading dashboard</output>}
      {dashboard.isError && (
        <>
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(dashboard.error)}</AlertDescription>
          </Alert>
          <Button variant="outline" className="self-start" onClick={() => void dashboard.refetch()}>
            Try again
          </Button>
        </>
      )}
      {dashboard.isSuccess && <DashboardFigures dashboard={dashboard.data} />}
    </div>
  );
}

const surface = "flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4";

function DashboardFigures({ dashboard }: { dashboard: DashboardOutputBody }) {
  const hasSales = dashboard.salesByDay.some(({ sales }) => sales > 0);

  return (
    <>
      {/* dashboard-and-reports R3: Sales are the figure the API worked out (R2), never added up here. */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border shell:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))]">
        <Figure
          className="col-span-2 shell:col-span-1"
          label="Today's sales"
          value={formatBaht(dashboard.sales)}
        />
        <Figure label="Orders completed today" value={String(dashboard.ordersCompleted)} />
        <Figure label="Pending orders" value={String(dashboard.pendingOrders)} />
        <Figure
          label="Low stock"
          value={String(dashboard.lowProducts)}
          tone={dashboard.lowProducts > 0 ? "text-warning" : undefined}
        />
        <Figure
          label="Out of stock"
          value={String(dashboard.outOfStockProducts)}
          tone={dashboard.outOfStockProducts > 0 ? "text-destructive" : undefined}
        />
      </dl>
      <div className="grid gap-4 shell:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* R4 */}
        <section aria-labelledby="sales-heading" className={surface}>
          <h2 id="sales-heading" className="text-body font-semibold">
            Sales, last 14 days
          </h2>
          {hasSales ? (
            <SalesByDay
              title="Sales for each of the last 14 days"
              days={dashboard.salesByDay}
              focus={dashboard.today}
            />
          ) : (
            <p className="text-muted-foreground">
              No sales in the last 14 days. Complete an order to record one.
            </p>
          )}
        </section>
        {/* R5 */}
        <section aria-labelledby="restock-heading" className={surface}>
          <div className="flex items-center justify-between gap-3">
            <h2 id="restock-heading" className="text-body font-semibold">
              Restock
            </h2>
            {dashboard.restock.length > 0 && (
              <Link
                to="/products"
                search={{ stock: ["low", "out-of-stock"] }}
                className="font-medium text-primary hover:underline"
              >
                View all
              </Link>
            )}
          </div>
          {dashboard.restock.length === 0 ? (
            <p className="text-muted-foreground">
              Nothing to restock. Every product is above its minimum stock.
            </p>
          ) : (
            <ul className="divide-y">
              {dashboard.restock.map((product) => (
                <RestockRow key={product.id} product={product} />
              ))}
            </ul>
          )}
        </section>
      </div>
      {/* R6 */}
      <section aria-labelledby="newest-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="newest-heading" className="text-body font-semibold">
            Newest orders
          </h2>
          {dashboard.newestOrders.length > 0 && (
            <Link to="/orders" className="font-medium text-primary hover:underline">
              View all orders
            </Link>
          )}
        </div>
        {dashboard.newestOrders.length === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-muted-foreground">
              No orders yet. Create the first order to record a sale.
            </p>
            <Button asChild>
              <Link to="/orders/new">New order</Link>
            </Button>
          </div>
        ) : (
          <OrdersTable orders={dashboard.newestOrders} />
        )}
      </section>
    </>
  );
}

function Figure({
  label,
  value,
  tone,
  className,
}: {
  label: string;
  value: string;
  tone?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1 bg-card p-4", className)}>
      <dt className="text-small text-muted-foreground">{label}</dt>
      <dd className="text-figure wrap-anywhere">
        <span className={tone}>{value}</span>
      </dd>
    </div>
  );
}

// products R16: the Product leads to the movements that explain its stock. The stock is the one
// bold thing in the row, read against its Minimum stock.
function RestockRow({ product }: { product: RestockProduct }) {
  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/stock-movements"
            search={{ productId: product.id }}
            className="font-medium wrap-anywhere hover:underline"
          >
            {product.name}
          </Link>
          <p className="text-small break-all text-muted-foreground">{product.sku}</p>
        </div>
        <p className="shrink-0 text-right">
          <span className="text-stock">{product.stock}</span>
          <span className="text-muted-foreground"> of {product.minimumStock}</span>
        </p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <StockStateBadge state={product.stockState} />
        <div className="w-24">
          <StockLevelBar
            stock={product.stock}
            minimumStock={product.minimumStock}
            state={product.stockState}
          />
        </div>
      </div>
    </li>
  );
}

import { Link } from "@tanstack/react-router";

import type { OrderSummary } from "@/api/generated/model";
import { OrderStatusBadge } from "@/components/order-status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBaht, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

// On a phone the number, status and total stay, in two columns; the rest takes a line below.
const phoneRow = "max-shell:grid max-shell:grid-cols-[1fr_auto]";
const secondary = "max-shell:hidden";

export function OrdersTable({ orders }: { orders: OrderSummary[] }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader className="max-shell:hidden">
          <TableRow className="hover:bg-background">
            <TableHead>Order</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-full">Customer</TableHead>
            <TableHead className="text-right">Lines</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id} className={phoneRow}>
              <TableCell className="max-shell:pb-0">
                {/* orders R17 */}
                <Link
                  to="/orders/$number"
                  params={{ number: String(order.number) }}
                  className="font-medium hover:underline"
                >
                  #{order.number}
                </Link>
              </TableCell>
              <TableCell
                className={cn(
                  "whitespace-nowrap",
                  "max-shell:col-span-2 max-shell:row-start-2 max-shell:pt-0 max-shell:pb-0 max-shell:text-small max-shell:text-muted-foreground",
                )}
              >
                {formatDateTime(order.createdAt)}
              </TableCell>
              <TableCell className="whitespace-normal max-shell:col-span-2 max-shell:row-start-3 max-shell:pt-0">
                <span
                  className={cn("wrap-anywhere", order.customer === "" && "text-muted-foreground")}
                >
                  {order.customer === "" ? "No customer" : order.customer}
                </span>
              </TableCell>
              <TableCell className={cn(secondary, "text-right")}>{order.lineCount}</TableCell>
              <TableCell className="text-right whitespace-nowrap max-shell:col-start-2 max-shell:row-start-1 max-shell:pb-0">
                {formatBaht(order.total)}
              </TableCell>
              <TableCell className="max-shell:col-span-2 max-shell:row-start-4 max-shell:pt-0">
                <OrderStatusBadge status={order.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

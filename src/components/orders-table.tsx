import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { isNotFound } from "@/api/errors";
import {
  getGetDashboardQueryKey,
  getGetSalesReportQueryKey,
} from "@/api/generated/dashboard-and-reports/dashboard-and-reports";
import type { OrderSummary } from "@/api/generated/model";
import {
  getGetOrderQueryKey,
  getListOrdersQueryKey,
  useDeleteOrder,
} from "@/api/generated/orders/orders";
import { DeleteConfirmation } from "@/components/delete-confirmation";
import { OrderStatusBadge } from "@/components/order-status";
import { RowActions, rowActionItem } from "@/components/row-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentUser } from "@/lib/current-user";
import { formatBaht, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

// On a phone the number, status and total stay, in two columns; the rest takes a line below.
const phoneRow = "max-shell:grid max-shell:grid-cols-[1fr_auto]";
const secondary = "max-shell:hidden";

export function OrdersTable({ orders }: { orders: OrderSummary[] }) {
  // orders R20: only the Owner and Admins delete; Staff have no actions here.
  const canDelete = useCurrentUser().role !== "staff";

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
            {canDelete && (
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            )}
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
              <TableCell className="max-shell:col-start-1 max-shell:row-start-4 max-shell:pt-0">
                <OrderStatusBadge status={order.status} />
              </TableCell>
              {canDelete && (
                <TableCell className="max-shell:col-start-2 max-shell:row-start-4 max-shell:pt-0 max-shell:empty:hidden">
                  <OrderActions order={order} />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function OrderActions({ order }: { order: OrderSummary }) {
  const queryClient = useQueryClient();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const remove = useDeleteOrder();
  // orders R20: a Pending Order holds stock; cancel it first. Nothing else is in the menu for it
  // (the number opens it, and Complete and Cancel live on its page), so it has no menu.
  if (order.status === "pending") return null;

  // Gone or changed under us (404, 409), and the figures that counted it, are read again.
  const refresh = () => {
    queryClient.removeQueries({ queryKey: getGetOrderQueryKey(order.number) });
    void queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetSalesReportQueryKey().slice(0, 1) });
    return queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
  };

  return (
    <>
      <RowActions label={`order #${order.number}`} triggerRef={triggerRef}>
        <DropdownMenuItem asChild className={rowActionItem}>
          <Link to="/orders/$number" params={{ number: String(order.number) }}>
            View order
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          className={rowActionItem}
          onSelect={() => setOpen(true)}
        >
          Delete
        </DropdownMenuItem>
      </RowActions>
      <DeleteConfirmation
        subject={`order #${order.number}`}
        consequence={`Order #${order.number} leaves the Orders List, the Dashboard and Reports. Its stock movements stay, and no stock changes.`}
        whenForbidden="Your role can't delete orders. Only the Owner and Admins can."
        pending={remove.isPending}
        error={remove.error && !isNotFound(remove.error) ? remove.error : null}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) remove.reset();
        }}
        returnFocusTo={triggerRef}
        onConfirm={() =>
          remove.mutate(
            { number: order.number },
            {
              onSuccess: () => void refresh().then(() => setOpen(false)),
              onError: (error) => {
                void refresh();
                if (isNotFound(error)) setOpen(false);
              },
            },
          )
        }
      />
    </>
  );
}

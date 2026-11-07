import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import { errorMessage, hasCode } from "@/api/errors";
import type { Order } from "@/api/generated/model";
import {
  getGetOrderQueryKey,
  getListOrdersQueryKey,
  useCancelOrder,
  useCompleteOrder,
  useGetOrder,
} from "@/api/generated/orders/orders";
import { getGetProductQueryKey, getListProductsQueryKey } from "@/api/generated/products/products";
import { getListStockMovementsQueryKey } from "@/api/generated/stock-movements/stock-movements";
import { Confirmation } from "@/components/confirmation";
import { OrderStatusBadge } from "@/components/order-status";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentUser } from "@/lib/current-user";
import { formatBaht, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_app/orders/$number")({ component: OrderDetailPage });

function BackToOrders() {
  return (
    <Button variant="outline" className="self-start" asChild>
      <Link to="/orders">
        <ArrowLeft aria-hidden size={16} />
        Back to orders
      </Link>
    </Button>
  );
}

function OrderDetailPage() {
  const { number } = Route.useParams();
  const orderNumber = /^\d+$/.test(number) ? Number(number) : undefined;
  const order = useGetOrder(orderNumber ?? 0, { query: { enabled: orderNumber !== undefined } });
  const notFound = orderNumber === undefined || (order.isError && order.error.status === 404);

  return (
    <div className="flex flex-col gap-4">
      {orderNumber !== undefined && order.isPending && (
        <output className="text-muted-foreground">Loading order</output>
      )}
      {!notFound && order.isError && (
        <>
          <h1 className="text-title">Order #{orderNumber}</h1>
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(order.error)}</AlertDescription>
          </Alert>
          <Button variant="outline" className="self-start" onClick={() => void order.refetch()}>
            Try again
          </Button>
        </>
      )}
      {notFound && (
        <>
          <h1 className="text-title">Order not found</h1>
          <div className="flex max-w-160 flex-col items-start gap-4 rounded-lg border bg-card p-6">
            <p>No order has this number.</p>
            <Button asChild>
              <Link to="/orders">Back to orders</Link>
            </Button>
          </div>
        </>
      )}
      {order.isSuccess && <OrderDetail order={order.data} />}
    </div>
  );
}

type Question = "complete" | "cancel";

// What the page says after the Order changes, or after it found it had changed already.
type Notice = { kind: "done"; title: string; text: string } | { kind: "stale"; error: unknown };

function plural(count: number, one: string) {
  return `${count} ${one}${count === 1 ? "" : "s"}`;
}

function OrderDetail({ order }: { order: Order }) {
  const { role } = useCurrentUser();
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState<Question>();
  const [notice, setNotice] = useState<Notice>();

  const refresh = (changed: Order) => {
    queryClient.setQueryData(getGetOrderQueryKey(changed.number), changed);
    void queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
  };
  const complete = useCompleteOrder({
    mutation: {
      onSuccess: (changed) => {
        refresh(changed);
        setAsking(undefined);
        setNotice({
          kind: "done",
          title: "Order completed",
          text: `Order #${changed.number} is completed.`,
        });
      },
      onError: (error) => whenStale(error),
    },
  });
  const cancel = useCancelOrder({
    mutation: {
      onSuccess: (changed) => {
        refresh(changed);
        // orders R12: the stock came back with its movements (ADR 0006).
        for (const queryKey of [
          getListStockMovementsQueryKey(),
          getListProductsQueryKey(),
          ...changed.lines.map((line) => getGetProductQueryKey(line.product.id)),
        ]) {
          void queryClient.invalidateQueries({ queryKey });
        }
        setAsking(undefined);
        setNotice({
          kind: "done",
          title: "Order cancelled",
          text: `Order #${changed.number} is cancelled.`,
        });
      },
      onError: (error) => whenStale(error),
    },
  });
  // orders R13: another User got there first. Say so, and show the Order as it now is.
  function whenStale(error: unknown) {
    if (!hasCode(error, "order-not-pending")) return;
    setAsking(undefined);
    setNotice({ kind: "stale", error });
    void queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(order.number) });
    void queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
  }

  const pending = order.status === "pending";
  // orders R12: only the Owner and Admins cancel.
  const canCancel = role !== "staff";
  const items = order.lines.reduce((sum, line) => sum + line.quantity, 0);
  const request = asking === "cancel" ? cancel : complete;
  const ask = (question: Question) => {
    complete.reset();
    cancel.reset();
    setNotice(undefined);
    setAsking(question);
  };

  return (
    <>
      <BackToOrders />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-title">Order #{order.number}</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        {pending && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => ask("complete")}>Complete order</Button>
            {canCancel && (
              <Button variant="outline" onClick={() => ask("cancel")}>
                Cancel order
              </Button>
            )}
          </div>
        )}
      </div>
      {notice?.kind === "done" && (
        <output className="block rounded-lg border bg-card px-3 py-2">
          <p className="font-medium">{notice.title}</p>
          <p className="text-muted-foreground">{notice.text}</p>
        </output>
      )}
      {notice?.kind === "stale" && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(notice.error)}</AlertDescription>
        </Alert>
      )}
      <Lines order={order} />
      <Facts order={order} />
      <Confirmation
        open={asking === "complete"}
        onOpenChange={(open) => !open && setAsking(undefined)}
        title={`Complete order #${order.number}?`}
        description="The customer has paid and has the goods. A completed order is final: it can't be changed or cancelled."
        confirm="Complete order"
        dismiss="Go back"
        pending={complete.isPending}
        error={asking === "complete" ? request.error : undefined}
        onConfirm={() => complete.mutate({ number: order.number })}
      />
      <Confirmation
        open={asking === "cancel"}
        onOpenChange={(open) => !open && setAsking(undefined)}
        title={`Cancel order #${order.number}?`}
        description={`Cancelling puts ${plural(items, "item")} from its ${plural(order.lines.length, "line")} back into stock. A cancelled order is final: it can't be completed or changed.`}
        confirm="Cancel order"
        dismiss="Go back"
        pending={cancel.isPending}
        error={asking === "cancel" ? request.error : undefined}
        onConfirm={() => cancel.mutate({ number: order.number })}
      />
    </>
  );
}

function Lines({ order }: { order: Order }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-background">
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {order.lines.map((line) => (
            <TableRow key={line.product.id}>
              <TableCell className="whitespace-normal">
                <p className="font-medium wrap-anywhere">{line.product.name}</p>
                <p className="text-small break-all text-muted-foreground">{line.product.sku}</p>
              </TableCell>
              <TableCell className="text-right">{line.quantity}</TableCell>
              <TableCell className="text-right whitespace-nowrap">
                {formatBaht(line.price)}
              </TableCell>
              <TableCell className="text-right whitespace-nowrap">
                {formatBaht(line.amount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3} className="font-semibold">
              Total
            </TableCell>
            <TableCell className="text-right font-semibold whitespace-nowrap">
              {formatBaht(order.total)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-small text-muted-foreground">{label}</dt>
      <dd className="wrap-anywhere">{children}</dd>
    </div>
  );
}

// orders R17: who did it and when, for each step the Order has taken.
function Facts({ order }: { order: Order }) {
  const { completed, cancelled } = order;

  return (
    <dl className="grid max-w-160 gap-4 rounded-lg border bg-card p-4 shell:grid-cols-2">
      <Fact label="Customer">
        {order.customer === "" ? (
          <span className="text-muted-foreground">No customer</span>
        ) : (
          order.customer
        )}
      </Fact>
      <Fact label="Note">
        {order.note === "" ? <span className="text-muted-foreground">No note</span> : order.note}
      </Fact>
      <Fact label="Created">
        {formatDateTime(order.createdAt)} by {order.createdBy.name}
      </Fact>
      {completed && (
        <Fact label="Completed">
          {formatDateTime(completed.at)} by {completed.by.name}
        </Fact>
      )}
      {cancelled && (
        <Fact label="Cancelled">
          {formatDateTime(cancelled.at)} by {cancelled.by.name}
        </Fact>
      )}
    </dl>
  );
}

import type { OrderStatus } from "@/api/generated/model";
import { Badge } from "@/components/ui/badge";

// orders R10: the three states, said in words.
export const orderStatusNames: Record<OrderStatus, string> = {
  pending: "Pending",
  completed: "Completed",
  cancelled: "Cancelled",
};

// Forest marks what can be acted on, so only a Pending Order is tinted (docs/design.md).
const variants = {
  pending: "secondary",
  completed: "outline",
  cancelled: "outline",
} as const satisfies Record<OrderStatus, "secondary" | "outline">;

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={variants[status]}>{orderStatusNames[status]}</Badge>;
}

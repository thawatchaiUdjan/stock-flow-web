import type { SalesDay } from "@/api/generated/model";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBaht, formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";

const chartHeight = "h-40";

// Sales for each day as bars, and the same figures as text under "Show the figures". The API gives
// every day in the range, so a day with no Sales is a bar of 0 and there is no gap
// (dashboard-and-reports R4, R7). `focus` is the day in Ink, such as today.
export function SalesByDay({
  title,
  days,
  focus,
}: {
  title: string;
  days: SalesDay[];
  focus?: string;
}) {
  const highest = Math.max(...days.map(({ sales }) => sales), 0);
  const first = days[0];
  const last = days[days.length - 1];

  return (
    <div className="flex flex-col gap-3">
      {first && last && (
        <>
          <p className="text-small text-muted-foreground">Highest day {formatBaht(highest)}</p>
          <figure
            aria-label={`${title}, ${formatDay(first.date)} to ${formatDay(last.date)}, highest day ${formatBaht(highest)}`}
            className={cn("flex items-end gap-1 border-b", chartHeight)}
          >
            {days.map((one) => (
              <div
                key={one.date}
                title={`${formatDay(one.date)}: ${formatBaht(one.sales)}`}
                className="flex h-full min-w-0 flex-1 flex-col justify-end"
              >
                <div
                  className={cn(
                    "w-full rounded-t-sm",
                    one.date === focus ? "bg-chart-2" : "bg-chart-1",
                  )}
                  // A day with Sales is never invisible, however small beside the highest.
                  style={{
                    height: `${one.sales > 0 ? Math.max((one.sales / highest) * 100, 1.5) : 0}%`,
                  }}
                />
              </div>
            ))}
          </figure>
          <div aria-hidden className="flex gap-1">
            {days.map((one) => (
              <p
                key={one.date}
                className="min-w-0 flex-1 text-center text-small text-muted-foreground"
              >
                {Number(one.date.slice(8))}
              </p>
            ))}
          </div>
        </>
      )}
      <details className="text-body">
        <summary className="w-fit cursor-pointer font-medium hover:underline">
          Show the figures
        </summary>
        <div className="mt-2 overflow-hidden rounded-lg border">
          <Table aria-label={title}>
            <TableHeader>
              <TableRow className="hover:bg-background">
                <TableHead>Day</TableHead>
                <TableHead className="text-right">Orders completed</TableHead>
                <TableHead className="text-right">Sales</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map((one) => (
                <TableRow key={one.date}>
                  <TableCell>{formatDay(one.date)}</TableCell>
                  <TableCell className="text-right">{one.ordersCompleted}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {formatBaht(one.sales)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </details>
    </div>
  );
}

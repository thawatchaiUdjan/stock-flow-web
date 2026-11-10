import { Bar, BarChart, XAxis, YAxis } from "recharts";

import type { SalesDay } from "@/api/generated/model";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBaht, formatDay } from "@/lib/format";

const chartConfig = { sales: { label: "Sales", color: "var(--chart-1)" } } satisfies ChartConfig;

// Past a month the bars are hairlines, so the gaps shrink and only the ends of the range are named.
const denseFrom = 32;

// dashboard-and-reports R4, R7: every day is a bar, so a day with no Sales is 0 and leaves no gap.
export function SalesByDay({
  title,
  days,
  tableOpen,
  tablePage,
  showChart = true,
}: {
  title: string;
  days: SalesDay[];
  tableOpen?: boolean;
  tablePage?: number;
  showChart?: boolean;
}) {
  // navigation-and-lists R7: table paging never truncates the chart.
  const highest = Math.max(...days.map(({ sales }) => sales), 0);
  const first = days[0];
  const last = days[days.length - 1];
  const dense = days.length >= denseFrom;

  return (
    <div className="flex flex-col gap-3">
      {showChart && first && last && (
        <>
          <p className="text-small text-muted-foreground">Highest day {formatBaht(highest)}</p>
          <figure
            aria-label={`${title}, ${formatDay(first.date)} to ${formatDay(last.date)}, highest day ${formatBaht(highest)}`}
            className="min-w-0 border-b"
          >
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-40 w-full"
              initialDimension={{ width: 320, height: 160 }}
            >
              <BarChart
                accessibilityLayer
                data={days}
                margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                barCategoryGap={dense ? 0 : "8%"}
              >
                <XAxis dataKey="date" hide />
                <YAxis domain={[0, highest]} hide />
                <ChartTooltip
                  isAnimationActive={false}
                  cursor={false}
                  position={{ x: 0, y: 0 }}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => formatDay(String(value))}
                      formatter={(value) => (
                        <>
                          <span>Sales</span>
                          <span>{formatBaht(Number(value))}</span>
                        </>
                      )}
                    />
                  }
                />
                <Bar
                  dataKey="sales"
                  fill="var(--color-sales)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                  // A day with Sales is never invisible, however small beside the highest.
                  minPointSize={(value) => (Number(value) > 0 ? 2.4 : 0)}
                />
              </BarChart>
            </ChartContainer>
          </figure>
          {dense ? (
            <p aria-hidden className="flex justify-between text-small text-muted-foreground">
              <span>{formatDay(first.date)}</span>
              <span>{formatDay(last.date)}</span>
            </p>
          ) : (
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
          )}
        </>
      )}
      <details open={tableOpen} className="text-body">
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
              {(tablePage === undefined
                ? days
                : days.slice((tablePage - 1) * 25, tablePage * 25)
              ).map((one) => (
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

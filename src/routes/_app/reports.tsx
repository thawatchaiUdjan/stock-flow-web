import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";

import { errorMessage } from "@/api/errors";
import { ApiError } from "@/api/fetcher";
import { useGetSalesReport } from "@/api/generated/dashboard-and-reports/dashboard-and-reports";
import type { ReportProduct, SalesReportOutputBody } from "@/api/generated/model";
import { Figure } from "@/components/figure";
import { SalesByDay } from "@/components/sales-by-day";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { bangkokDay } from "@/lib/bangkok-day";
import { formatBaht, formatDay } from "@/lib/format";

// dashboard-and-reports R7: the longest range, both ends included.
const maxDays = 366;
const dayLength = 24 * 60 * 60 * 1000;

// ADR 0008: the range lives in the address, so a reload or a shared link keeps it. A value the API
// wouldn't accept is dropped rather than sent.
const searchSchema = z.object({
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
});
type ReportsSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/_app/reports")({
  validateSearch: searchSchema,
  component: ReportsPage,
});

// The API's own checks (R7), made before sending. An end left out is the day the API would use
// (openapi.yaml, the Sales report's `from` and `to`): `to` is today, `from` is the first of the
// month of `to`. The API's 422 is still shown, should it ever refuse what this let through.
function rangeProblem(search: ReportsSearch) {
  const to = search.to ?? bangkokDay(Date.now());
  const from = search.from ?? `${to.slice(0, 8)}01`;
  if (from > to) return "From is after To. Choose a From day on or before To.";
  if ((Date.parse(to) - Date.parse(from)) / dayLength + 1 > maxDays) {
    return `This range is over ${maxDays} days. Choose ${maxDays} days or fewer.`;
  }
  return undefined;
}

function ReportsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const problem = rangeProblem(search);
  // dashboard-and-reports R9: dropped when the page closes, so it never opens on the last figures.
  const report = useGetSalesReport(search, { query: { enabled: !problem, gcTime: 0 } });
  const chosen = search.from !== undefined || search.to !== undefined;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title">Reports</h1>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-4">
        <Field className="w-auto max-shell:w-full">
          <FieldLabel htmlFor="reports-from">From</FieldLabel>
          <Input
            id="reports-from"
            type="date"
            value={search.from ?? ""}
            onChange={(event) =>
              void navigate({ search: { ...search, from: event.target.value || undefined } })
            }
          />
        </Field>
        <Field className="w-auto max-shell:w-full">
          <FieldLabel htmlFor="reports-to">To</FieldLabel>
          <Input
            id="reports-to"
            type="date"
            value={search.to ?? ""}
            onChange={(event) =>
              void navigate({ search: { ...search, to: event.target.value || undefined } })
            }
          />
        </Field>
        {chosen && (
          <Link
            to="/reports"
            search={{}}
            className="font-medium text-primary hover:underline max-shell:w-full"
          >
            This month so far
          </Link>
        )}
      </div>
      {problem && <p className="text-muted-foreground">{problem}</p>}
      {!problem && report.isPending && (
        <output className="text-muted-foreground">Loading report</output>
      )}
      {!problem && report.isError && (
        <>
          <Alert variant="destructive">
            <AlertDescription>{reportError(report.error)}</AlertDescription>
          </Alert>
          <Button variant="outline" className="self-start" onClick={() => void report.refetch()}>
            Try again
          </Button>
        </>
      )}
      {!problem && report.isSuccess && <ReportFigures report={report.data} />}
    </div>
  );
}

// A 422 is the one refusal this page words itself: the API says what is wrong with the range in
// its own terms, and the screen says it in the Shop's (ADR 0021).
function reportError(error: unknown) {
  if (error instanceof ApiError && error.status === 422) {
    return "This range isn't valid. Choose a From day on or before To, and 366 days or fewer.";
  }
  return errorMessage(error);
}

const surface = "flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4";

function ReportFigures({ report }: { report: SalesReportOutputBody }) {
  return (
    <>
      <p className="text-muted-foreground">
        {formatDay(report.from)} to {formatDay(report.to)}
      </p>
      {/* R7: the figures are the API's (R9), never added up here. */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border shell:grid-cols-3">
        <Figure
          className="col-span-2 shell:col-span-1"
          label="Total sales"
          value={formatBaht(report.sales)}
        />
        <Figure label="Orders completed" value={String(report.ordersCompleted)} />
        <Figure label="Average sales per order" value={formatBaht(report.averageSales)} />
      </dl>
      {report.ordersCompleted === 0 ? (
        <p className="text-muted-foreground">
          No sales from {formatDay(report.from)} to {formatDay(report.to)}. Complete an order, or
          choose another range.
        </p>
      ) : (
        <>
          <section aria-labelledby="by-day-heading" className={surface}>
            <h2 id="by-day-heading" className="text-body font-semibold">
              Sales by day
            </h2>
            <SalesByDay
              title="Sales for each day of the range"
              days={report.salesByDay}
              tableOpen
            />
          </section>
          {/* R8 */}
          <section aria-labelledby="top-heading" className="flex flex-col gap-3">
            <h2 id="top-heading" className="text-body font-semibold">
              Top products
            </h2>
            <TopProducts products={report.topProducts} />
          </section>
        </>
      )}
    </>
  );
}

function TopProducts({ products }: { products: ReportProduct[] }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table aria-label="Top products by sales">
        <TableHeader>
          <TableRow className="hover:bg-background">
            <TableHead className="w-full">Product</TableHead>
            <TableHead className="text-right">Quantity sold</TableHead>
            <TableHead className="text-right">Sales</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell className="whitespace-normal">
                <p className="font-medium wrap-anywhere">{product.name}</p>
                <p className="text-small break-all text-muted-foreground">{product.sku}</p>
              </TableCell>
              <TableCell className="text-right">{product.quantitySold}</TableCell>
              <TableCell className="text-right whitespace-nowrap">
                {formatBaht(product.sales)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

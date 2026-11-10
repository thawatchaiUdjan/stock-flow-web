import { ChevronFirstIcon, ChevronLastIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
// navigation-and-lists R4-R5: visible unavailable directions and recovery.
export function ListPaging({
  page,
  size,
  total,
  busy,
  onPage,
  onSize,
}: {
  page: number;
  size: number;
  total?: number;
  busy: boolean;
  onPage: (page: number) => void;
  onSize?: (size: 10 | 25 | 50) => void;
}) {
  const pages = total === undefined ? undefined : Math.max(1, Math.ceil(total / size));
  const outside = pages !== undefined && page > pages;
  return (
    <nav
      aria-label="Pages"
      aria-busy={busy}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-muted-foreground" aria-live="polite">
        {busy
          ? "Loading page"
          : pages === undefined
            ? "Page unavailable"
            : outside
              ? "This page is no longer available."
              : `Page ${page} of ${pages} \u00b7 ${total} matching`}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3 max-shell:w-full shell:ml-auto shell:gap-6">
        {onSize && (
          <label className="flex items-center gap-2 whitespace-nowrap">
            Rows per page
            <NativeSelect
              aria-label="Rows per page"
              value={size}
              onChange={(event) => onSize(Number(event.target.value) as 10 | 25 | 50)}
            >
              {[10, 25, 50].map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {value}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
        )}
        <div className="ml-auto flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="size-11 shell:size-9.5"
            aria-label="First page"
            title="First page"
            disabled={page === 1}
            onClick={() => onPage(1)}
          >
            <ChevronFirstIcon aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-11 shell:size-9.5"
            aria-label="Previous page"
            title="Previous page"
            disabled={busy || pages === undefined || page === 1 || outside}
            onClick={() => onPage(page - 1)}
          >
            <ChevronLeftIcon aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-11 shell:size-9.5"
            aria-label="Next page"
            title="Next page"
            disabled={busy || pages === undefined || page >= pages}
            onClick={() => onPage(page + 1)}
          >
            <ChevronRightIcon aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-11 shell:size-9.5"
            aria-label="Last page"
            title="Last page"
            disabled={busy || pages === undefined || page >= pages}
            onClick={() => pages !== undefined && onPage(pages)}
          >
            <ChevronLastIcon aria-hidden="true" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
// navigation-and-lists R6: cursors carry position, never a total.
export function CursorPaging({
  older,
  busy,
  canOlder,
  onNewest,
  onOlder,
}: {
  older: boolean;
  busy: boolean;
  canOlder: boolean;
  onNewest: () => void;
  onOlder: () => void;
}) {
  return (
    <nav aria-label="Pages" aria-busy={busy} className="flex flex-wrap items-center gap-2">
      <p className="text-muted-foreground">
        {older ? "Viewing older entries" : "Viewing newest entries"}
      </p>
      <Button variant="outline" disabled={!older} onClick={onNewest}>
        Newest entries
      </Button>
      <Button variant="outline" disabled={busy || !canOlder} onClick={onOlder}>
        Older entries
      </Button>
    </nav>
  );
}

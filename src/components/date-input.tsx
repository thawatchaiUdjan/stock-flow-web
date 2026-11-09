import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bangkokDay } from "@/lib/bangkok-day";

const readableDay = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

// dashboard-and-reports R1: date-only values stay on the Shop's calendar.
export function DateInput({
  id,
  label,
  value,
  emptyLabel = "Any date",
  onValueChange,
}: {
  id: string;
  label: string;
  value: string;
  emptyLabel?: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-2 shell:w-52">
      <Input
        id={id}
        type="date"
        aria-describedby={`${id}-display`}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <p id={`${id}-display`} className="text-small text-muted-foreground">
        {value ? readableDay.format(new Date(`${value}T00:00:00Z`)) : emptyLabel}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          aria-label={`Use today for ${label}`}
          onClick={() => onValueChange(bangkokDay(Date.now()))}
        >
          Today
        </Button>
        <Button
          type="button"
          variant="outline"
          aria-label={`Clear ${label}`}
          disabled={!value}
          onClick={() => onValueChange("")}
        >
          Clear
        </Button>
      </div>
    </div>
  );
}

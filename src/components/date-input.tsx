import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { TZDate } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { bangkokDay } from "@/lib/bangkok-day";
import { formatFullDay } from "@/lib/format";

function calendarDay(value: string) {
  return new TZDate(`${value}T12:00:00+07:00`, "Asia/Bangkok");
}

// date-controls R2-R5, R9: only a day activation changes an optional Shop date.
export function DateInput({
  id,
  label,
  value,
  onValueChange,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [today, setToday] = useState(() => calendarDay(bangkokDay(Date.now())));
  const selected = value ? calendarDay(value) : undefined;
  const [month, setMonth] = useState<Date>(selected ?? today);
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          const currentDay = calendarDay(bangkokDay(Date.now()));
          setToday(currentDay);
          setMonth(selected ?? currentDay);
        }
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className="w-full justify-between font-normal max-shell:text-base shell:w-52"
        >
          {value
            ? formatFullDay(value)
            : label === "From"
              ? "Start date"
              : label === "To"
                ? "End date"
                : `Choose ${label.toLowerCase()}`}
          <CalendarIcon aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={8}
        className="max-h-(--radix-popover-content-available-height) w-auto max-w-[calc(100vw-1rem)] overflow-y-auto p-2"
        aria-label={`${label} calendar`}
        aria-describedby={value ? `${id}-instruction` : undefined}
      >
        <Calendar
          mode="single"
          timeZone="Asia/Bangkok"
          today={today}
          selected={selected}
          month={month}
          onMonthChange={setMonth}
          // date-controls R5: this user-opened calendar must focus its selected/today cell.
          // oxlint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          aria-label={`Choose ${label.toLowerCase()} date`}
          onSelect={(day) => {
            onValueChange(day ? bangkokDay(day.getTime()) : "");
            setOpen(false);
          }}
        />
        <div className="flex justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setMonth(new TZDate(month.getFullYear() - 1, month.getMonth(), 1, "Asia/Bangkok"))
            }
          >
            Previous year
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setMonth(new TZDate(month.getFullYear() + 1, month.getMonth(), 1, "Asia/Bangkok"))
            }
          >
            Next year
          </Button>
        </div>
        {value && (
          <p id={`${id}-instruction`} className="max-w-80 text-small text-muted-foreground">
            Select the selected day again to remove it
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

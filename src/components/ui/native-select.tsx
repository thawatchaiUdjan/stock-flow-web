import { cn } from "cn";
import { ChevronDownIcon } from "lucide-react";
import * as React from "react";

// A browser select, sized like `Input` (docs/design.md: 44 px on a phone, 38 px on a desktop).
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <div
      className={cn(
        "group/native-select relative w-fit has-[select:disabled]:opacity-50",
        className,
      )}
      data-slot="native-select-wrapper"
    >
      <select
        data-slot="native-select"
        className="h-11 w-full min-w-0 appearance-none rounded-md border border-input bg-transparent py-1 pr-8 pl-3 text-base transition-colors disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:border-destructive shell:h-9.5 shell:text-body"
        {...props}
      />
      <ChevronDownIcon
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  );
}

function NativeSelectOption({ className, ...props }: React.ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  );
}

export { NativeSelect, NativeSelectOption };

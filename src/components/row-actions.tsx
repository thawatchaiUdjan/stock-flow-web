import { EllipsisVerticalIcon } from "lucide-react";
import type { ReactNode, RefObject } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// docs/design.md, Row actions: one "more actions" menu per row. Radix gives the keyboard and
// screen-reader behaviour (Enter, Space or ArrowDown opens it, arrows move, Escape closes and
// returns focus to the trigger); the trigger and the items are 44 px on a phone.
export function RowActions({
  label,
  triggerRef,
  children,
}: {
  // What the row is, so the trigger reads "Actions for Rice 5 kg".
  label: string;
  // Where focus goes after a question opened from the menu closes.
  triggerRef?: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          size="icon"
          aria-label={`Actions for ${label}`}
          className="size-11 shell:size-9.5"
        >
          <EllipsisVerticalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-44">
        <DropdownMenuGroup>{children}</DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Every item in the menu, so a phone's finger fits.
export const rowActionItem = "max-shell:min-h-11";

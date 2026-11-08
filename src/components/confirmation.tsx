import type { ReactNode } from "react";

import { errorMessage } from "@/api/errors";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

// Asks before an action with consequences; stays open, with the reason, if it fails.
export function Confirmation({
  open,
  onOpenChange,
  title,
  description,
  confirm,
  dismiss = "Cancel",
  pending,
  error,
  whenForbidden,
  onCloseAutoFocus,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirm: string;
  // What the button that leaves the order as it was says.
  dismiss?: string;
  pending: boolean;
  error: unknown;
  // What a 403 says, when the Role may not do this.
  whenForbidden?: string;
  // Where focus goes once the question closes; the default is the button that opened it.
  onCloseAutoFocus?: (event: Event) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error != null && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(error, whenForbidden)}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{dismiss}</AlertDialogCancel>
          {/* Not AlertDialogAction: that closes the question before the API has answered. */}
          <Button disabled={pending} onClick={onConfirm}>
            {confirm}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

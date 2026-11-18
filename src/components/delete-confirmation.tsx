import { Confirmation } from "@/components/confirmation";

// products R17, users-and-access R55, orders R20, domain ADR 0013: deleting is permanent from the
// app's point of view, so the question says so and the button is red. It stays open, with the
// reason, when the API refuses (409, 403); a 404 means it is gone already, which is what was asked.
export function DeleteConfirmation({
  subject,
  consequence,
  whenForbidden,
  pending,
  error,
  open,
  onOpenChange,
  onConfirm,
  returnFocusTo,
}: {
  // "Rice 5 kg", "Mali Chai", "order #12".
  subject: string;
  // What leaves with it, in the record's words.
  consequence: string;
  whenForbidden: string;
  pending: boolean;
  error: unknown;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  returnFocusTo: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <Confirmation
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${subject}?`}
      description={`${consequence} This can't be undone: there is no way to restore it.`}
      confirm="Delete"
      destructive
      pending={pending}
      error={error}
      whenForbidden={whenForbidden}
      // The menu item that opened the question is gone; focus goes to the row's menu button.
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        returnFocusTo.current?.focus();
      }}
      onConfirm={onConfirm}
    />
  );
}

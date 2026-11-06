import { Check, Copy } from "lucide-react";
import { useState, type ReactNode } from "react";

import type { SetupLink } from "@/api/generated/model";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";

// users-and-access R28: shown once, and the API keeps only a hash (ADR 0002).
// `title` says which action issued the link; `actions` are the ways out of this view.
export function SetupLinkDisplay({
  title,
  name,
  setupLink,
  actions,
}: {
  title: string;
  name: string;
  setupLink: SetupLink;
  actions: ReactNode;
}) {
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  // The api returns only the token, so the link is right on every deployment (ADR 0022).
  const link = `${window.location.origin}/set-password#${setupLink.token}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title">{title}</h1>
      <div className="flex max-w-160 flex-col gap-4 rounded-lg border bg-card p-6">
        <p>
          Pass this Setup link to {name}. They use it to set their own password. It won't be shown
          again, so copy it now.
        </p>
        <Field>
          <FieldLabel htmlFor="setup-link">Setup link</FieldLabel>
          <div className="flex flex-col gap-2 shell:flex-row">
            <Input
              id="setup-link"
              readOnly
              value={link}
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button variant="outline" onClick={() => void copyLink()}>
              {copy === "copied" ? (
                <Check aria-hidden data-icon="inline-start" />
              ) : (
                <Copy aria-hidden data-icon="inline-start" />
              )}
              {copy === "copied" ? "Copied" : "Copy link"}
            </Button>
          </div>
          {copy === "failed" && (
            <FieldError>Couldn't copy. Select the link and copy it by hand.</FieldError>
          )}
        </Field>
        {/* users-and-access R27 */}
        <p className="text-muted-foreground">Expires {formatDateTime(setupLink.expiresAt)}.</p>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
    </div>
  );
}

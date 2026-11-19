// PROTOTYPE, throwaway: three structurally different shells for /login, switched by ?variant=A|B|C.
// Question: how should the Login screen look so it is less plain, within or beyond docs/design.md?
// Lives on branch prototype/login-design only; never merged to main.
import { ArrowLeft, ArrowRight } from "lucide-react";
import { type ReactNode, useEffect } from "react";

import stockflowMark from "@/assets/stockflow.svg";

export const variants = [
  { key: "A", name: "Brand header in the card (inside direction)" },
  { key: "B", name: "Split: brand panel + form (breaks 'single surface')" },
  { key: "C", name: "Brand above, form card below, help footer (inside direction)" },
] as const;
export type VariantKey = (typeof variants)[number]["key"];

type ShellProps = { title: string; subtitle: string; children: ReactNode };

function Brand({ size = 32 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5 font-semibold">
      <img src={stockflowMark} alt="" width={size} height={size} />
      StockFlow
    </span>
  );
}

// A: the same single 400 px surface, but with the mark, a purpose line, more air and a rule above the help line.
function VariantA({ title, subtitle, children }: ShellProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-3">
      <div className="flex w-full max-w-100 flex-col rounded-lg border bg-card">
        <div className="flex flex-col gap-6 p-8">
          <Brand />
          <div className="flex flex-col gap-1.5">
            <h1 className="text-title">{title}</h1>
            <p className="text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
        <p className="border-t px-8 py-4 text-sm text-muted-foreground">
          Ask the shop Owner if you don't have an account.
        </p>
      </div>
    </main>
  );
}

// B: two panels. Left says what the product is for and shows a level bar; right is the form.
function VariantB({ title, subtitle, children }: ShellProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-3">
      <div className="grid w-full max-w-215 overflow-hidden rounded-lg border bg-card md:grid-cols-2">
        <section className="flex flex-col justify-between gap-10 bg-secondary p-8">
          <Brand />
          <div className="flex flex-col gap-5">
            <p className="text-title">See what is in stock and what is running low, at a glance.</p>
            <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
              <div className="flex items-baseline justify-between">
                <span className="font-medium">Safety helmet</span>
                <span className="font-semibold">18 of 60</span>
              </div>
              <div className="h-2 rounded-full bg-border">
                <div className="h-2 w-[30%] rounded-full bg-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Low</span>
            </div>
          </div>
        </section>
        <section className="flex flex-col justify-center gap-6 p-8">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-title">{title}</h1>
            <p className="text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}

// C: no brand inside the card. Brand and title sit on the page, centred; the card holds only the form.
function VariantC({ title, subtitle, children }: ShellProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-3">
      <div className="flex flex-col items-center gap-3 text-center">
        <img src={stockflowMark} alt="" width={48} height={48} />
        <span className="font-semibold">StockFlow</span>
        <h1 className="text-title">{title}</h1>
        <p className="max-w-80 text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex w-full max-w-100 flex-col gap-4 rounded-lg border bg-card p-6">
        {children}
      </div>
      <p className="text-sm text-muted-foreground">
        Ask the shop Owner if you don't have an account.
      </p>
    </main>
  );
}

export function LoginPrototypeShell({
  variant,
  onVariant,
  ...props
}: ShellProps & { variant: VariantKey; onVariant: (key: VariantKey) => void }) {
  const index = variants.findIndex((v) => v.key === variant);
  const step = (delta: number) =>
    onVariant(variants[(index + delta + variants.length) % variants.length]!.key);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, [contenteditable]")) return;
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      {variant === "A" && <VariantA {...props} />}
      {variant === "B" && <VariantB {...props} />}
      {variant === "C" && <VariantC {...props} />}
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-foreground px-3 py-2 text-sm text-white shadow-lg">
        <button type="button" aria-label="Previous variant" onClick={() => step(-1)}>
          <ArrowLeft size={16} />
        </button>
        <span>
          {variants[index]!.key} · {variants[index]!.name}
        </span>
        <button type="button" aria-label="Next variant" onClick={() => step(1)}>
          <ArrowRight size={16} />
        </button>
      </div>
    </>
  );
}

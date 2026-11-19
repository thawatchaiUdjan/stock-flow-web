// PROTOTYPE, throwaway: five Fern-based shells for /login, switched by ?variant=A..E.
// Question: how should the Login screen look so it is less plain, within or beyond docs/design.md?
// Lives on branch prototype/login-design only; never merged to main.
import { ArrowLeft, ArrowRight, ClipboardList, Package, TrendingDown } from "lucide-react";
import { type ReactNode, useEffect } from "react";

import stockflowMark from "@/assets/stockflow.svg";

export const variants = [
  { key: "A", name: "Split + abstract level bars" },
  { key: "B", name: "Split + three things you do here" },
  { key: "C", name: "Whole page Fern, white card" },
  { key: "D", name: "Split + oversized Forest mark" },
  { key: "E", name: "Fern top band, card overlaps" },
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

function FormSide({ title, subtitle, children }: ShellProps) {
  return (
    <section className="flex flex-col justify-center gap-6 p-6 min-[800px]:p-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-title">{title}</h1>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

// Shared by A, B, D: the 800 px split frame. Left content differs per variant.
function Split({ left, top = false, ...props }: ShellProps & { left: ReactNode; top?: boolean }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-3">
      <div className="grid w-full max-w-215 overflow-hidden rounded-lg border bg-card min-[800px]:grid-cols-2">
        <section className={`relative flex flex-col ${top ? "gap-4" : "justify-between gap-16"} overflow-hidden border-b bg-secondary p-4 min-[800px]:border-b-0 min-[800px]:p-8`}>
          <Brand />
          <div className="hidden min-[800px]:block">{left}</div>
        </section>
        <FormSide {...props} />
      </div>
    </main>
  );
}

const tagline = "See what's in stock and what's running low, at a glance.";

// A: the sentence plus a few quiet level bars: Forest filled against the empty Line track. No numbers, no names.
function VariantA(props: ShellProps) {
  const fills = ["w-[85%]", "w-[55%]", "w-[30%]", "w-[70%]"];
  return (
    <Split
      {...props}
      left={
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3" aria-hidden>
            {fills.map((w) => (
              <div key={w} className="h-2 rounded-full bg-card">
                <div className={`h-2 rounded-full bg-primary ${w}`} />
              </div>
            ))}
          </div>
          <p className="max-w-64 font-medium">{tagline}</p>
        </div>
      }
    />
  );
}

// B: three plain lines saying what the screens are for (from design.md, Subject).
function VariantB(props: ShellProps) {
  const items = [
    { icon: Package, text: "See what is in stock" },
    { icon: TrendingDown, text: "Spot what is running low" },
    { icon: ClipboardList, text: "Work orders without leaving the page" },
  ];
  return (
    <Split
      {...props}
      left={
        <ul className="flex flex-col gap-4">
          {items.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 font-medium">
              <span className="flex size-9 items-center justify-center rounded-lg bg-card text-primary">
                <Icon size={18} />
              </span>
              {text}
            </li>
          ))}
        </ul>
      }
    />
  );
}

// C: no split. The page itself is Fern; one white card with the brand inside.
function VariantC({ title, subtitle, children }: ShellProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-secondary p-3">
      <div className="flex w-full max-w-100 flex-col gap-6 rounded-lg border bg-card p-8">
        <Brand />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-title">{title}</h1>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>
        {children}
      </div>
      <p className="max-w-80 text-center text-sm text-balance text-muted-foreground">{tagline}</p>
    </main>
  );
}

// D: the real brand mark drawn huge in Forest and cropped by the panel edge.
function VariantD(props: ShellProps) {
  return (
    <Split
      {...props}
      top
      left={
        <>
          <p className="max-w-64 font-medium">{tagline}</p>
          <svg
            aria-hidden
            viewBox="0 0 32 32"
            fill="none"
            className="pointer-events-none absolute -right-16 -bottom-20 size-80 text-primary"
          >
            <g stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" strokeLinecap="round">
              <path d="m8 12 8-4 8 4v9l-8 4-8-4zM8 12l8 4 8-4M16 16v9" />
              <path d="M19 7h6v6m0-6-6 6" />
            </g>
          </svg>
        </>
      }
    />
  );
}

// E: a Fern band across the top of the page, the white card straddling its lower edge.
function VariantE({ title, subtitle, children }: ShellProps) {
  return (
    <main className="min-h-dvh">
      <div className="flex h-56 flex-col items-center justify-start gap-2 bg-secondary px-3 pt-10 text-center">
        <Brand />
        <p className="max-w-96 text-balance text-muted-foreground">{tagline}</p>
      </div>
      <div className="-mt-20 flex justify-center px-3 pb-10">
        <div className="flex w-full max-w-100 flex-col gap-6 rounded-lg border bg-card p-8">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-title">{title}</h1>
            <p className="text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
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
      {variant === "D" && <VariantD {...props} />}
      {variant === "E" && <VariantE {...props} />}
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

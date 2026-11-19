// PROTOTYPE, throwaway: five looks for the app shell and Dashboard, switched by ?variant=A..E.
// Question: how can the app use Fern (and Forest) more, keeping docs/design.md's structure?
// Lives on branch prototype/app-design only; never merged to main. Variant is read from the URL,
// so it resets when you follow a link inside the app; reopen /dashboard?variant=X.
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect } from "react";

export const variants = [
  { key: "A", name: "Current (baseline)" },
  { key: "B", name: "Fern chrome: sidebar + top bar" },
  { key: "C", name: "Fern welcome band on Dashboard" },
  { key: "D", name: "Fern page behind white surfaces" },
  { key: "E", name: "Forest sidebar (primary, solid)" },
] as const;
export type VariantKey = (typeof variants)[number]["key"];

type Theme = {
  root: string;
  asideDesktop: string; // desktop sidebar background, prefixed with shell:
  side: string; // every sidebar strip on a phone, and the brand/nav/user blocks
  top: string; // the breadcrumb bar
  link: string;
  active: string;
  userText: string;
  inverseMark: boolean; // E: the mark is white with Forest strokes, so it stands out on Forest
};

const base: Theme = {
  root: "",
  asideDesktop: "shell:bg-sidebar",
  side: "bg-sidebar",
  top: "bg-sidebar",
  link: "hover:bg-muted",
  active: "bg-accent text-accent-foreground hover:bg-accent",
  userText: "",
  inverseMark: false,
};

export const themes: Record<VariantKey, Theme> = {
  A: base,
  // B: Fern chrome; the selected link turns white so it still stands out against the tint.
  B: {
    ...base,
    asideDesktop: "shell:bg-secondary",
    side: "bg-secondary",
    top: "bg-secondary",
    link: "hover:bg-card/60",
    active: "bg-card text-primary hover:bg-card",
  },
  C: base,
  // D: the page itself is Fern; the sidebar and every surface stay white.
  D: { ...base, root: "bg-secondary" },
  // E: Forest sidebar with white text; the selected link is Fern with Ink.
  E: {
    ...base,
    inverseMark: true,
    asideDesktop: "shell:bg-primary",
    side: "bg-primary text-primary-foreground",
    link: "hover:bg-white/10",
    active: "bg-secondary text-foreground hover:bg-secondary",
    userText:
      "[&_.text-muted-foreground]:text-white/80 [&_button]:border-white/50 [&_button]:bg-transparent [&_button]:text-white [&_button:hover]:bg-white/10",
  },
};

export function usePrototypeVariant(): VariantKey {
  const search = useSearch({ strict: false }) as { variant?: string };
  return variants.find((v) => v.key === search.variant)?.key ?? "A";
}

export function PrototypeSwitcher() {
  const variant = usePrototypeVariant();
  const navigate = useNavigate();
  const index = variants.findIndex((v) => v.key === variant);

  function step(delta: number) {
    const next = variants[(index + delta + variants.length) % variants.length]!.key;
    void navigate({
      to: ".",
      search: ((prev: Record<string, unknown>) => ({ ...prev, variant: next })) as never,
      replace: true,
    });
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.target as HTMLElement).closest("input, textarea, select, [contenteditable]"))
        return;
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
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
  );
}

// PROTOTYPE: the StockFlow mark with its colours swapped: a white rounded square, Forest strokes.
export function InverseMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <rect width="32" height="32" rx="8" fill="#ffffff" />
      <path
        d="m8 12 8-4 8 4v9l-8 4-8-4zM8 12l8 4 8-4M16 16v9"
        stroke="#3a6b4f"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M19 7h6v6m0-6-6 6"
        stroke="#3a6b4f"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

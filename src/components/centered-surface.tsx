import { ClipboardList, Package, TrendingDown } from "lucide-react";
import type { ReactNode } from "react";

import stockflowMark from "@/assets/stockflow.svg";

// Wording only: a sample figure here would pretend to be real stock (docs/design.md, Layout).
const purposes = [
  { Icon: Package, text: "See what is in stock" },
  { Icon: TrendingDown, text: "Spot what is running low" },
  { Icon: ClipboardList, text: "Create orders and see stock update" },
];

// Screens with no User to show a sidebar for: a Fern brand panel beside the form (docs/design.md, Layout).
export function CenteredSurface({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-3">
      <div className="grid w-full max-w-215 overflow-hidden rounded-lg border bg-card shell:grid-cols-2">
        <section className="flex flex-col justify-between gap-8 border-b bg-secondary p-4 shell:border-b-0 shell:p-8">
          <p className="flex items-center gap-2 font-semibold">
            <img src={stockflowMark} alt="" width={32} height={32} />
            StockFlow
          </p>
          <ul className="hidden flex-col gap-4 shell:flex">
            {purposes.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-3 font-medium">
                <span className="flex size-9 items-center justify-center rounded-lg bg-card text-primary">
                  <Icon size={18} aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col justify-center gap-6 p-6 shell:p-8">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-title">{title}</h1>
            {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex flex-col gap-4">{children}</div>
        </section>
      </div>
    </main>
  );
}

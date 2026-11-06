import type { ReactNode } from "react";

// The screens a person reaches with no User to show a sidebar for.
export function CenteredSurface({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-3">
      <div className="flex w-full max-w-100 flex-col gap-4 rounded-lg border bg-card p-6">
        <p className="font-semibold">StockFlow</p>
        <h1 className="text-title">{title}</h1>
        {children}
      </div>
    </main>
  );
}

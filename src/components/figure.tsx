import { cn } from "@/lib/utils";

// One key figure in a `dl` of them (docs/design.md: related figures share a surface, split by rules).
export function Figure({
  label,
  value,
  tone,
  className,
}: {
  label: string;
  value: string;
  tone?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1 bg-card p-4", className)}>
      <dt className="text-small text-muted-foreground">{label}</dt>
      <dd className="text-figure wrap-anywhere">
        <span className={tone}>{value}</span>
      </dd>
    </div>
  );
}

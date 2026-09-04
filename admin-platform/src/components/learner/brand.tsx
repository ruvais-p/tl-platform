import Link from "next/link";
import { cn } from "@/lib/utils";

export function LearnerMark({ className = "" }: { className?: string }) {
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-xs", className)} aria-hidden="true">
      t.
    </span>
  );
}

export function LearnerBrand() {
  return (
    <Link href="/learn" className="learner-pressable inline-flex items-center gap-2.5 rounded-lg font-medium tracking-[-0.02em] text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <LearnerMark />
      <span className="text-[15px]">Tella <span className="font-normal text-muted-foreground">Learn</span></span>
    </Link>
  );
}

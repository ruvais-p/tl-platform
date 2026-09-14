import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function LearnerMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={cn("relative block aspect-[512/234] w-28 shrink-0 overflow-hidden sm:w-32", className)}
      aria-hidden="true"
    >
      <Image
        src="/logo.png"
        alt=""
        fill
        sizes="(max-width: 640px) 208px, 128px"
        className="object-contain object-center"
      />
    </span>
  );
}

export function LearnerBrand({ markClassName = "" }: { markClassName?: string }) {
  return (
    <Link
      href="/learn"
      aria-label="Sofia learning platform home"
      className="learner-pressable inline-flex rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <LearnerMark className={markClassName} />
    </Link>
  );
}

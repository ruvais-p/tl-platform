"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, BriefcaseBusiness, ChevronDown, LayoutDashboard, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { initials } from "@/lib/learner/course";
import { cn } from "@/lib/utils";
import { LearnerBrand } from "./brand";
import { useLearnerAuth } from "./learner-auth-provider";

const nav = [
  { href: "/learn", label: "Overview", icon: LayoutDashboard },
  { href: "/learn/courses", label: "Courses", icon: BookOpen },
  { href: "/learn/opportunities", label: "Opportunities", icon: BriefcaseBusiness },
];

function isCurrent(pathname: string, href: string) {
  return href === "/learn" ? pathname === href : pathname.startsWith(href);
}

function DesktopNavigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Learner navigation" className="hidden items-center gap-1 md:flex">
      {nav.map(({ href, label }) => {
        const active = isCurrent(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "learner-pressable rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function MobileNavigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Learner navigation" className="fixed inset-x-0 bottom-0 grid grid-cols-3 border-t bg-background/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_30px_oklch(0.2_0.02_255/.05)] backdrop-blur-xl md:hidden">
      {nav.map(({ href, label, icon: Icon }) => {
        const active = isCurrent(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "learner-pressable flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active ? "text-brand-strong" : "text-muted-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="size-[18px]" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function AccountMenu({ displayName, logout }: { displayName: string; logout: () => Promise<void> }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="lg" aria-label={`Open account menu for ${displayName}`} />}
      >
        <Avatar size="sm"><AvatarFallback>{initials(displayName)}</AvatarFallback></Avatar>
        <span className="hidden max-w-36 truncate sm:inline">{displayName}</span>
        <ChevronDown data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate text-foreground">{displayName}</span>
            <span className="mt-0.5 block font-normal">Learner account</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => void logout()}>
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LearnerShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useLearnerAuth();

  if (loading) {
    return (
      <div className="learner-theme grid min-h-screen place-items-center bg-background" role="status">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Spinner />
          Opening your learning space…
        </div>
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="learner-theme min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-8 px-4 sm:px-6 lg:px-8">
          <LearnerBrand />
          <DesktopNavigation />
          <div className="ml-auto">
            <AccountMenu displayName={user.display_name} logout={logout} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-8 sm:px-6 sm:pt-10 md:pb-12 lg:px-8">
        {children}
      </main>
      <MobileNavigation />
    </div>
  );
}

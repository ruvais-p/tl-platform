"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  ChartColumn,
  ClipboardCheck,
  FileStack,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { staffResources } from "@/lib/staff/resources";
import { cn } from "@/lib/utils";

type NavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permissions?: string[];
};

const navigation: NavigationItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/courses",
    label: "Curriculum",
    icon: BookOpen,
    permissions: ["curriculum.view_course"],
  },
  {
    href: "/content",
    label: "Content",
    icon: FileStack,
    permissions: [
      "content.view_activitycontent",
      "content.view_video",
      "content.view_experiment",
    ],
  },
  {
    href: "/media",
    label: "Media",
    icon: FolderOpen,
    permissions: ["media_library.view_mediaasset"],
  },
  {
    href: "/learners",
    label: "Learners",
    icon: Users,
    permissions: ["students.view_studentgroup", "students.view_enrollment"],
  },
  {
    href: "/student-groups",
    label: "Student groups",
    icon: Users,
    permissions: ["students.view_studentgroup"],
  },
  {
    href: "/assessments",
    label: "Assessments",
    icon: ClipboardCheck,
    permissions: [
      "assessments.view_question",
      "assessments.view_learningcheck",
    ],
  },
  {
    href: "/access",
    label: "Access",
    icon: ShieldCheck,
    permissions: ["accounts.manage_users"],
  },
  {
    href: "/operations",
    label: "Reports",
    icon: ChartColumn,
    permissions: [
      "progress.view_activityprogress",
      "assessments.view_assessmentattempt",
      "assessments.view_assessmentanswer",
      "progress.view_pointevent",
      "progress.view_badgeaward",
      "progress.view_careeropportunity",
      "progress.view_assessmentattempt",
      "workshops.view_workshopconfig",
      "workshops.view_workshopmodel",
    ],
  },
];

function canSee(item: NavigationItem, permissions: string[]) {
  return (
    !item.permissions ||
    item.permissions.some((permission) => permissions.includes(permission))
  );
}

function roleName(groups: string[]) {
  if (groups.includes("SUPER_ADMIN")) return "Super administrator";
  if (groups.includes("ADMIN")) return "Administrator";
  if (groups.includes("ACADEMIC_MANAGER")) return "Academic manager";
  if (groups.includes("CONTENT_MANAGER")) return "Content manager";
  return "Staff";
}

function Brand() {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-3 text-lg font-semibold tracking-tight"
    >
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        T
      </span>
      Tella Staff
    </Link>
  );
}

function Navigation({
  permissions,
  onNavigate,
}: {
  permissions: string[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const managedKey = pathname.match(/^\/manage\/([^/]+)/)?.[1];
  const managedSection = managedKey
    ? staffResources[managedKey]?.section
    : undefined;
  const managedHref =
    managedSection === "curriculum"
      ? "/courses"
      : managedSection
        ? `/${managedSection}`
        : undefined;
  return (
    <nav aria-label="Primary" className="mt-8 flex flex-col gap-1">
      <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Workspace
      </p>
      {navigation
        .filter((item) => canSee(item, permissions))
        .map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            managedHref === item.href ||
            (item.href !== "/dashboard" &&
              pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon />
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center" role="status">
        <Spinner />
        <span className="sr-only">Loading workspace</span>
      </div>
    );
  }
  if (!user) return null;

  const initials = user.display_name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-muted/30">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-sidebar px-5 py-6 text-sidebar-foreground lg:flex lg:flex-col">
        <Brand />
        <Navigation permissions={user.permissions} />
        <div className="mt-auto flex flex-col gap-4">
          <Separator />
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {user.display_name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {roleName(user.groups)}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Log out"
              onClick={() => void logout()}
            >
              <LogOut />
            </Button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:px-7">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button
                  size="icon"
                  variant="ghost"
                  className="lg:hidden"
                  aria-label="Open navigation"
                />
              }
            >
              <Menu />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-6">
              <SheetTitle className="sr-only">Staff navigation</SheetTitle>
              <Brand />
              <Navigation
                permissions={user.permissions}
                onNavigate={() => setOpen(false)}
              />
              <SheetFooter className="p-0">
                <Separator />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setOpen(false);
                    void logout();
                  }}
                >
                  <LogOut data-icon="inline-start" />
                  Log out
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
          <div className="ml-auto">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user.display_name}
            </span>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

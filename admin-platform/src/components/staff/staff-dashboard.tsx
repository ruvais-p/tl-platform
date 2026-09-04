"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  ChartColumn,
  ClipboardCheck,
  FileStack,
  FolderOpen,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  staffApi,
  type StaffSummaryRecord,
} from "@/lib/staff/api";
import { resourcesBySection } from "@/lib/staff/resources";

type DashboardModule = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  permissions: string[];
};

const modules: DashboardModule[] = [
  {
    title: "Curriculum",
    description:
      "Programs, courses, versions, chapters, subtopics, and activities.",
    href: "/courses",
    icon: BookOpen,
    permissions: ["curriculum.view_course"],
  },
  {
    title: "Content library",
    description: "Content blocks, videos, experiments, and practice sequences.",
    href: "/content",
    icon: FileStack,
    permissions: [
      "content.view_activitycontent",
      "content.view_video",
      "content.view_experiment",
    ],
  },
  {
    title: "Media",
    description: "Upload files and manage playback-ready learning assets.",
    href: "/media",
    icon: FolderOpen,
    permissions: ["media_library.view_mediaasset"],
  },
  {
    title: "Learners",
    description: "Student accounts, cohorts, enrollments, and assignments.",
    href: "/learners",
    icon: Users,
    permissions: ["students.view_studentgroup", "students.view_enrollment"],
  },
  {
    title: "Assessments",
    description: "Question bank, case studies, and learning checks.",
    href: "/assessments",
    icon: ClipboardCheck,
    permissions: [
      "assessments.view_question",
      "assessments.view_learningcheck",
    ],
  },
  {
    title: "Access control",
    description:
      "Create users, assign roles, and review effective permissions.",
    href: "/access",
    icon: ShieldCheck,
    permissions: ["accounts.manage_users"],
  },
  {
    title: "Reports & operations",
    description:
      "Learning progress, assessment outcomes, awards, and compatibility records.",
    href: "/operations",
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

function canOpen(userPermissions: string[], module: DashboardModule) {
  return module.permissions.some((permission) =>
    userPermissions.includes(permission),
  );
}

export function StaffDashboard() {
  const { user, loading } = useAuth();
  const [summary, setSummary] = useState<StaffSummaryRecord[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");
  const userId = user?.id;

  useEffect(() => {
    if (!userId) {
      setSummary([]);
      setSummaryLoading(false);
      return;
    }
    setSummaryLoading(true);
    setSummaryError("");
    staffApi
      .summary()
      .then((payload) => setSummary(payload.records))
      .catch(() => setSummaryError("Platform totals could not be loaded."))
      .finally(() => setSummaryLoading(false));
  }, [userId]);

  if (loading || !user) {
    return (
      <main
        className="mx-auto grid max-w-7xl gap-4 p-5 md:grid-cols-2 md:p-9 lg:grid-cols-3"
        role="status"
      >
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <Skeleton key={item} className="h-52" />
        ))}
      </main>
    );
  }

  const visibleModules = modules.filter((module) =>
    canOpen(user.permissions, module),
  );
  const editableResources = resourcesBySection("content").filter(
    (resource) =>
      resource.addPermission &&
      user.permissions.includes(resource.addPermission),
  ).length;

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-8 p-5 md:p-9">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome, {user.display_name}.
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Your dashboard is assembled from Django’s effective permissions, so
          every workspace below matches what your account can safely manage.
        </p>
      </header>

      <section
        className="grid gap-4 sm:grid-cols-3"
        aria-label="Workspace summary"
      >
        <Card size="sm">
          <CardHeader>
            <CardDescription>Available workspaces</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {visibleModules.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Content tools you can create in</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {editableResources}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Effective permissions</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {user.permissions.length}
            </CardTitle>
          </CardHeader>
        </Card>
      </section>

      <section aria-labelledby="platform-records-heading">
        <div className="mb-4">
          <h2 id="platform-records-heading" className="text-xl font-semibold">
            Platform records
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Live totals are limited to the records your role may view.
          </p>
        </div>
        {summaryError && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{summaryError}</AlertDescription>
          </Alert>
        )}
        {summaryLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" role="status">
            {[0, 1, 2, 3, 4].map((item) => (
              <Skeleton key={item} className="h-32" />
            ))}
            <span className="sr-only">Loading platform totals</span>
          </div>
        ) : (
          summary.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {summary.map((record) => (
                <Card key={record.key} size="sm">
                  <CardHeader>
                    <CardDescription>{record.label}</CardDescription>
                    <CardTitle className="text-2xl tabular-nums">
                      {record.count.toLocaleString()}
                    </CardTitle>
                  </CardHeader>
                  <CardFooter>
                    <Button
                      render={<Link href={record.href} />}
                      nativeButton={false}
                      variant="ghost"
                      className="w-full"
                    >
                      View records
                      <ArrowRight data-icon="inline-end" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )
        )}
      </section>

      <section aria-labelledby="workspaces-heading">
        <div className="mb-4">
          <h2 id="workspaces-heading" className="text-xl font-semibold">
            Your workspaces
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose an area to review or update platform data.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleModules.map((module) => {
            const Icon = module.icon;
            return (
              <Card key={module.href}>
                <CardHeader>
                  <Icon />
                  <CardTitle>{module.title}</CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 text-xs text-muted-foreground">
                  Permission-aware · secured by Django
                </CardContent>
                <CardFooter>
                  <Button
                    render={<Link href={module.href} />}
                    nativeButton={false}
                    variant="ghost"
                    className="w-full"
                  >
                    Open workspace
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </section>
    </main>
  );
}

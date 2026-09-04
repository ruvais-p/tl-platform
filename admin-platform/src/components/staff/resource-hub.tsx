"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Database, ShieldAlert } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  resourcesBySection,
  type StaffResourceDefinition,
} from "@/lib/staff/resources";

const sectionCopy: Record<
  StaffResourceDefinition["section"],
  { title: string; description: string }
> = {
  curriculum: {
    title: "Curriculum",
    description:
      "Manage the structure and publication lifecycle of learning programs.",
  },
  content: {
    title: "Content library",
    description: "Build the resources rendered inside each learning activity.",
  },
  media: {
    title: "Media library",
    description: "Upload and maintain learning files and playback metadata.",
  },
  learners: {
    title: "Learner administration",
    description: "Manage cohorts, memberships, enrollments, and assignments.",
  },
  assessments: {
    title: "Assessment studio",
    description: "Author questions, case studies, and secure learning checks.",
  },
  operations: {
    title: "Reports & operations",
    description:
      "Review learning outcomes and maintain the operational records formerly exposed by Django.",
  },
};

export function ResourceHub({
  section,
}: {
  section: StaffResourceDefinition["section"];
}) {
  const { user, loading } = useAuth();
  const copy = sectionCopy[section];
  const resources = resourcesBySection(section).filter((resource) =>
    user?.permissions.includes(resource.viewPermission),
  );

  if (loading) {
    return (
      <main className="mx-auto grid max-w-7xl gap-4 p-5 md:grid-cols-2 md:p-9">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-44" />
        ))}
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-7 p-5 md:p-9">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">
          Staff workspace
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {copy.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {copy.description}
        </p>
      </header>

      {resources.length === 0 ? (
        <div className="flex flex-col gap-3">
          <Alert>
            <ShieldAlert />
            <AlertTitle>No resources available</AlertTitle>
            <AlertDescription>
              Your role does not have access to any resources in this
              workspace.
            </AlertDescription>
          </Alert>
          <Button
            render={<Link href="/dashboard" />}
            nativeButton={false}
            variant="outline"
            className="w-fit"
          >
            <ArrowLeft data-icon="inline-start" />
            Back to dashboard
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {resources.map((resource) => {
            const canCreate = Boolean(
              resource.addPermission &&
              user?.permissions.includes(resource.addPermission),
            );
            const canEdit = Boolean(
              resource.changePermission &&
              user?.permissions.includes(resource.changePermission),
            );
            return (
              <Card key={resource.key}>
                <CardHeader>
                  <Database />
                  <CardTitle>{resource.title}</CardTitle>
                  <CardDescription>{resource.description}</CardDescription>
                </CardHeader>
                <CardFooter className="mt-auto justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    {canCreate
                      ? "Create & edit"
                      : canEdit
                        ? "Edit"
                        : "View only"}
                  </span>
                  <Button
                    render={<Link href={`/manage/${resource.key}`} />}
                    nativeButton={false}
                    variant="ghost"
                  >
                    Open
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}

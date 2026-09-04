import type { Metadata } from "next";
import { Suspense } from "react";
import { LearnerLoginForm } from "@/components/learner/learner-login-form";

export const metadata: Metadata = { title: "Student sign in" };

export default function LearnerLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="learner-theme grid min-h-screen place-items-center bg-background text-sm font-medium text-muted-foreground">
          Loading sign in…
        </div>
      }
    >
      <LearnerLoginForm />
    </Suspense>
  );
}

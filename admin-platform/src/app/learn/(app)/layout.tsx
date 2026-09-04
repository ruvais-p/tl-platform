import { LearnerAuthProvider } from "@/components/learner/learner-auth-provider";
import { LearnerShell } from "@/components/learner/learner-shell";

export default function LearnerProtectedLayout({ children }: { children: React.ReactNode }) {
  return <LearnerAuthProvider><LearnerShell>{children}</LearnerShell></LearnerAuthProvider>;
}

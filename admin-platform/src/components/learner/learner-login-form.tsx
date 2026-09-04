"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { learnerAuthApi, LearnerApiError } from "@/lib/learner/api";
import { LearnerBrand } from "./brand";

export function LearnerLoginForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const params = useSearchParams();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await learnerAuthApi.login(String(form.get("email")), String(form.get("password")));
      const next = params.get("next");
      router.replace(next?.startsWith("/learn") ? next : "/learn");
    } catch (caught) {
      setError(caught instanceof LearnerApiError ? caught.message : "The learning service is unavailable. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="learner-theme grid min-h-screen place-items-center bg-background px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><LearnerBrand /></div>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>Sign in to continue the learning assigned by your institution.</CardDescription>
          </CardHeader>
          <CardContent>
            <form id="learner-login" className="flex flex-col gap-5" onSubmit={submit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="learner-email">Email address</FieldLabel>
                  <Input id="learner-email" name="email" type="email" autoComplete="email" required placeholder="you@university.edu" className="h-10" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="learner-password">Password</FieldLabel>
                  <Input id="learner-password" name="password" type="password" autoComplete="current-password" required className="h-10" />
                </Field>
              </FieldGroup>
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              <Button type="submit" size="lg" disabled={busy} className="w-full">
                {busy ? <Spinner data-icon="inline-start" /> : null}
                {busy ? "Signing in…" : "Sign in"}
                {!busy ? <ArrowRight data-icon="inline-end" /> : null}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center">
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="size-3.5" />Your university may sign you in automatically through Moodle.</p>
          </CardFooter>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">Curriculum-connected learning · Progress saved online</p>
      </div>
    </main>
  );
}

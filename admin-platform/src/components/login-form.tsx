"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ApiError, authApi } from "@/lib/curriculum/api";

export function LoginForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const params = useSearchParams();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await authApi.login(
        String(data.get("email")),
        String(data.get("password")),
      );
      router.replace(params.get("next") || "/dashboard");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to reach the platform.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-muted/30 px-4 py-10 sm:px-6">
      <section aria-labelledby="staff-login-title" className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-3 text-lg font-semibold tracking-tight">
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground"
          >
            T
          </span>
          Tella Staff
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              <h1 id="staff-login-title">Sign in to Tella</h1>
            </CardTitle>
            <CardDescription>
              Use your staff account to continue to your assigned workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              aria-busy={busy}
              className="flex flex-col gap-5"
              onSubmit={submit}
            >
              <FieldGroup>
                <Field data-disabled={busy || undefined}>
                  <FieldLabel htmlFor="email">Email address</FieldLabel>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    disabled={busy}
                    required
                  />
                </Field>
                <Field data-disabled={busy || undefined}>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    disabled={busy}
                    required
                  />
                </Field>
              </FieldGroup>
              {error && (
                <Alert variant="destructive" role="alert">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={busy}
              >
                {busy && <Spinner data-icon="inline-start" />}
                {busy ? "Signing in…" : "Sign in"}
                {!busy && <ArrowRight data-icon="inline-end" />}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center">
            <p className="flex items-center gap-2 text-center text-xs text-muted-foreground">
              <LockKeyhole aria-hidden="true" className="size-3.5" />
              Access follows the permissions assigned to your account.
            </p>
          </CardFooter>
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Looking for your courses?{" "}
          <Link
            href="/learn/login"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Go to learner sign in
          </Link>
        </p>
      </section>
    </main>
  );
}

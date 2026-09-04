"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LearnerApiError, learnerAuthApi } from "@/lib/learner/api";
import type { User } from "@/lib/learner/types";

type LearnerAuthValue = {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
};

const LearnerAuthContext = createContext<LearnerAuthValue>({ user: null, loading: true, logout: async () => {} });

export function useLearnerAuth() {
  return useContext(LearnerAuthContext);
}

export function LearnerAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    learnerAuthApi.me()
      .then((currentUser) => { if (active) setUser(currentUser); })
      .catch((error) => {
        if (active && error instanceof LearnerApiError && error.status === 401) {
          router.replace(`/learn/login?next=${encodeURIComponent(pathname)}`);
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [pathname, router]);

  async function logout() {
    await learnerAuthApi.logout();
    setUser(null);
    router.replace("/learn/login");
  }

  return <LearnerAuthContext.Provider value={{ user, loading, logout }}>{children}</LearnerAuthContext.Provider>;
}

"use client";

import { SessionContext, useSessionLoader } from "@/hooks/use-session";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const session = useSessionLoader();

  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}

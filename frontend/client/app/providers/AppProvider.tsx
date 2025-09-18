// app/providers/AppProvider.tsx (예시)
"use client";
import { useEffect } from "react";
import { startAuthWatch } from "@/lib/auth-watch";

export function AppProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const stop = startAuthWatch();
    return () => stop?.();
  }, []);

  return <>{children}</>;
}

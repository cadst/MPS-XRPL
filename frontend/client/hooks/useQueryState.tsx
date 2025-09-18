// app/hooks/useQueryState.ts
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function useQueryState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 현재 쿼리 객체로 반환
  const get = useCallback(() => {
    const obj: Record<string, string> = {};
    searchParams.forEach((v, k) => (obj[k] = v));
    return obj;
  }, [searchParams]);

  // 한 번에 여러 쿼리 수정
  const set = useCallback(
    (next: Record<string, string | number | undefined | null>, { replace = false } = {}) => {
      const sp = new URLSearchParams(searchParams.toString());
      Object.entries(next).forEach(([k, v]) => {
        if (v === undefined || v === null || v === "") sp.delete(k);
        else sp.set(k, String(v));
      });
      const url = `${pathname}?${sp.toString()}`;
      replace ? router.replace(url) : router.push(url);
    },
    [pathname, router, searchParams]
  );

  return { get, set, searchParams };
}

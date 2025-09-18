// app/components/common/RouteLoader.tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function RouteLoader() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 페이지 바뀔 때마다 1초 로딩 띄우기
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, [pathname]);

  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/70 text-white">
      <div className="flex flex-col items-center">
        <div className="flex space-x-1 mb-4">
          {[0,1,2,3,4].map(i => (
            <span
              key={i}
              className="w-2 h-6 bg-emerald-400 animate-bounce"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
        <p className="animate-pulse">로딩 중…</p>
      </div>
    </div>
  );
}

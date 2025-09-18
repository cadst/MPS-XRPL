import { Suspense } from "react";

export const dynamic = "force-static"; 

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

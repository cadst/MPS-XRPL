import { Suspense } from "react";
import MusicList from "../components/sections/MusicList";

export const dynamic = "force-static";

export default function AllMusicsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-8">
      <h1 className="mb-4 text-lg font-semibold text-white">전체 음악</h1>
      <Suspense fallback={null}>
        <MusicList />
      </Suspense>
    </main>
  );
}
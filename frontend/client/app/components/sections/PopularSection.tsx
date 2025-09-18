"use client";

import Link from "next/link";

type Item = {
  rank: number;
  id: number;
  title: string;
  artist: string;
  cover: string;
  amount: number; // PopularItem과 맞춤
};

export default function PopularSection({
  items,
  categoryName,
  onSelect,
}: {
  items: Item[];
  categoryName: string;
  onSelect?: (item: Item) => void;
}) {
  const fmt = new Intl.NumberFormat("ko-KR");

  const rankColor = (rank: number) => {
    if (rank === 1) return "text-red-400";
    if (rank === 2) return "text-orange-400";
    if (rank === 3) return "text-yellow-300";
    return "text-white/55";
  };

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-500/40 via-fuchsia-500/40 to-amber-400/40" />

      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <h2 className="text-[13px] font-semibold tracking-wide text-white/90">
          인기 음악 · <span className="text-white">{categoryName}</span>
        </h2>
        <Link
          href={`/categoryDetailPage?category=${encodeURIComponent(categoryName)}`}
          className="rounded-lg px-2 py-1 text-[11px] text-white/70 transition hover:bg-white/5 hover:text-white"
        >
          더보기 →
        </Link>
      </div>

      <ul className="h-[410px] space-y-2 px-4 pb-4 pr-3 overflow-y-hidden">
        {items.slice(0, 5).map((it) => (
          <li key={it.id}>
      <Link
        href={`/music/${it.id}`}
        prefetch={false}
        onClick={(e) => {
          if (onSelect) {
            e.preventDefault();
            onSelect(it);
          }
        }}
        className="group flex h-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/8 hover:shadow-[0_6px_20px_rgba(0,0,0,0.35)]"
      >
        {/* 순위 */}
        <div
          className={`w-6 text-right text-sm font-semibold tabular-nums ${rankColor(
            it.rank
          )}`}
        >
          {it.rank}
        </div>
        <img
          src={it.cover}
          alt={it.title}
          className="h-12 w-12 shrink-0 rounded-lg border border-white/10 object-cover transition duration-300 group-hover:scale-[1.03]"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-white/90">{it.title}</div>
          <div className="truncate text-[12px] text-white/60">{it.artist}</div>
        </div>
        <div className="ml-2 text-right">
          <div className="text-[13px] font-semibold text-white/80">
            ₩{fmt.format(it.amount)}
          </div>
        </div>
      </Link>
    </li>
  ))}
</ul>
    </section>
  );
}

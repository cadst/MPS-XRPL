import Link from "next/link";

type Item = { id: number; title: string; createdAt?: string; created_at?: string };

export default function LatestSection({ items }: { items: Item[] }) {
  return (
    <section className="rounded-xl border border-white/10 bg-zinc-900/70 p-4">
      <h2 className="mb-3 text-sm font-semibold text-white/90">최신 음악</h2>

      {(!items || items.length === 0) ? (
        <p className="text-xs text-white/60">표시할 항목이 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => {
            const date = it.createdAt ?? it.created_at ?? "";
            return (
              <li key={it.id} className="flex items-center justify-between gap-3">
                <Link
                  href={`/music/${it.id}`}
                  className="line-clamp-1 text-sm text-white/90 hover:underline"
                >
                  {it.title}
                </Link>
                <span className="shrink-0 text-xs text-white/60">{date}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

"use client";
import Link from "next/link";
import { LuEye, LuMessageSquare, LuHeart } from "react-icons/lu";

export type Music = {
  id: number;
  title: string;
  artist: string;
  company: string;
  cover: string;
  views: number;
  comments: number;
  likes: number;
  date: string;      // "Mar 22, 2023"
  readTime: string;  // "1 min read"
};

export default function MusicCard({
  m,
  onSelect,
}: {
  m: Music;
  onSelect?: () => void;
}) {
  const CardBody = (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-lg">
      <img
        src={m.cover}
        alt={m.title}
        className="h-[320px] w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />

      {/* 상단 메타 */}
      <div className="pointer-events-none absolute left-4 top-4 text-xs text-white/90">
        <div className="opacity-90">Admin</div>
        <div className="opacity-70">
          {m.date} · {m.readTime}
        </div>
      </div>

      {/* 하단 오버레이 */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 text-white">
        <h3 className="line-clamp-2 text-lg font-semibold">{m.title}</h3>
        <div className="mt-1 text-sm opacity-90">{m.artist}</div>
        <div className="text-xs opacity-70">{m.company}</div>

        <div className="mt-3 flex items-center gap-4 text-xs opacity-90">
          <span className="flex items-center gap-1">
            <LuEye /> {m.views}
          </span>
          <span className="flex items-center gap-1">
            <LuMessageSquare /> {m.comments}
          </span>
          <span className="flex items-center gap-1">
            <LuHeart /> {m.likes}
          </span>
        </div>
      </div>
    </div>
  );

  // onSelect가 있으면 버튼으로 렌더(모달 오픈용)
  if (onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className="group block w-full text-left focus:outline-none focus:ring-2 focus:ring-white/20 rounded-xl"
        aria-label={`${m.title} 상세보기`}
      >
        {CardBody}
      </button>
    );
  }

  // 없으면 기존처럼 상세 페이지 링크로 이동
  return (
    <Link href={`/music/${m.id}`} className="group block" aria-label={`${m.title} 상세보기`}>
      {CardBody}
    </Link>
  );
}

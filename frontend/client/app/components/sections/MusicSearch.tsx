"use client";
import { useState, useEffect } from "react";

export default function MusicSearch({
  value,
  onChange,
  onSearch,            
}: {
  value?: string;
  onChange: (v: string) => void;
  onSearch?: (v: string) => void;
}) {
  const [q, setQ] = useState(value ?? "");
  useEffect(() => setQ(value ?? ""), [value]);

  const submit = () => {
    if (onSearch) onSearch(q.trim());
    else onChange(q.trim());
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      className="inline-flex w-full max-w-2xl items-center overflow-hidden rounded-full border border-teal-200/70 bg-white/80 p-1 pl-3 shadow-sm backdrop-blur dark:bg-zinc-900/60"
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="제목·아티스트로 검색"
        className="flex-1 bg-transparent text-sm outline-none placeholder-zinc-400 dark:text-white"
      />
      <button
        type="submit"
        className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-black
                   bg-teal-400 hover:bg-teal-300 active:translate-y-[1px]
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        검색
      </button>
    </form>
  );
}
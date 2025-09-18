// components/sections/PlaylistCreateModal.tsx
"use client";

import { useState } from "react";
import { createPlaylist, type CreatePlaylistReq, type CreatePlaylistResp } from "@/lib/api/playlist";

export default function PlaylistCreateModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (pl: CreatePlaylistResp) => void;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return alert("플레이리스트 이름을 입력하세요");
    try {
      setLoading(true);
      const dto: CreatePlaylistReq = { name: name.trim() };
      const pl = await createPlaylist(dto); // ← 여기서 api(fetch) 호출
      onCreated?.(pl);
      setName("");
      onClose();
    } catch (err: any) {
      alert(err?.message || "생성 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <section className="relative z-[1001] w-[min(480px,92vw)] rounded-2xl bg-white text-zinc-900 shadow-xl
                          dark:bg-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 p-5">
        <h2 className="text-lg font-semibold">새 플레이리스트 만들기</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="플레이리스트 이름"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-800"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose}
              className="h-9 rounded-md border border-zinc-200 dark:border-white/10 px-4 text-sm">
              취소
            </button>
            <button type="submit" disabled={loading}
              className="h-9 rounded-md bg-violet-600 text-white px-4 text-sm font-medium hover:bg-violet-700 disabled:opacity-60">
              {loading ? "생성 중…" : "생성"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";

export type ProfileEditValues = {
  ceo_name: string;
  phone: string;
  homepage_url: string;
  profile_image_url: string; // 서버 저장용 (상대/절대 모두 허용)
  avatarUrl?: string;        // 프론트 미리보기용
};

export default function ProfileEditModal({
  open,
  onClose,
  initial,
  onSave, // (values, file?) => 부모에서 PATCH 처리
}: {
  open: boolean;
  onClose: () => void;
  initial: ProfileEditValues;
  onSave: (
    values: Pick<
      ProfileEditValues,
      "ceo_name" | "phone" | "homepage_url" | "profile_image_url"
    >,
    file?: File
  ) => void | Promise<void>;
}) {
  const [v, setV] = useState<ProfileEditValues>(initial);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string>("");

  // 결과 알림 모달
  const [resultOpen, setResultOpen] = useState(false);
  const [resultMsg, setResultMsg] = useState<"성공하셨습니다." | "변경에 실패하셨습니다.">("성공하셨습니다.");

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (!open) return;
    setV(initial);
    setPickedFile(null);
    setErr("");
  }, [open, initial]);

  // ESC 닫기 + 포커스 + 스크롤 잠금
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // 파일 선택
  const openPicker = () => fileRef.current?.click();
  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setPickedFile(f);
  };

  // 로컬 미리보기 URL 생성/해제
  useEffect(() => {
    if (!pickedFile) {
      setLocalPreview("");
      return;
    }
    const url = URL.createObjectURL(pickedFile);
    setLocalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pickedFile]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");

    if (!v.ceo_name?.trim()) {
      setErr("대표자명을 입력해 주세요.");
      return;
    }

    try {
      await Promise.resolve(
        onSave(
          {
            ceo_name: v.ceo_name?.trim(),
            phone: v.phone?.trim() ?? "",
            homepage_url: v.homepage_url?.trim() ?? "",
            // 파일을 보낼 거면 profile_image_url이 비어 있어도 OK
            profile_image_url: v.profile_image_url ?? v.avatarUrl ?? "",
          },
          pickedFile || undefined
        )
      );

      // 성공 알림 후 닫기
      setResultMsg("성공하셨습니다.");
      setResultOpen(true);
      // 알림 닫힘과 동시에 편집 모달 닫기
    } catch (_e) {
      // 실패 알림 (편집 모달은 그대로)
      setResultMsg("변경에 실패하셨습니다.");
      setResultOpen(true);
    }
  };

  const closeResult = () => {
    setResultOpen(false);
    if (resultMsg === "성공하셨습니다.") onClose();
  };

  if (!open) return null;

  const previewSrc = localPreview || v.avatarUrl || v.profile_image_url || "";

  return (
    <>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center">
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        {/* Dialog */}
        <div
          ref={dialogRef}
          tabIndex={-1}
          className="relative z-[1001] w-[92vw] max-w-xl rounded-2xl border border-white/10 bg-white text-zinc-900 shadow-xl outline-none dark:bg-zinc-900 dark:text-zinc-100"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-white/10">
            <h2 className="text-base font-semibold">프로필 편집</h2>
            <button
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-white/10"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <form onSubmit={onSubmit} className="px-5 py-4">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="shrink-0">
                <div className="h-20 w-20 rounded-xl overflow-hidden border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-zinc-800">
                  {previewSrc ? (
                    <img alt="avatar" src={previewSrc} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-xs text-zinc-400">
                      No Image
                    </div>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePick}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={openPicker}
                  className="mt-2 h-8 w-full rounded-lg border border-zinc-300 text-sm hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/10"
                >
                  {previewSrc ? "이미지 변경" : "이미지 선택"}
                </button>
              </div>

              {/* Fields */}
              <div className="grow space-y-4">
                <div>
                  <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">대표자명</label>
                  <input
                    value={v.ceo_name}
                    onChange={(e) => setV((p) => ({ ...p, ceo_name: e.target.value }))}
                    className="w-full h-10 rounded-lg border border-zinc-300 px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border:white/10 dark:bg-zinc-900"
                    placeholder="홍길동"
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">대표 전화</label>
                  <input
                    value={v.phone}
                    onChange={(e) => setV((p) => ({ ...p, phone: e.target.value }))}
                    inputMode="tel"
                    className="w-full h-10 rounded-lg border border-zinc-300 px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-white/10 dark:bg-zinc-900"
                    placeholder="02-123-4567 / 010-1234-5678"
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">홈페이지 URL</label>
                  <input
                    value={v.homepage_url}
                    onChange={(e) => setV((p) => ({ ...p, homepage_url: e.target.value }))}
                    inputMode="url"
                    className="w-full h-10 rounded-lg border border-zinc-300 px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-white/10 dark:bg-zinc-900"
                    placeholder="https://example.com"
                  />
                </div>
              </div>
            </div>

            {err && <p className="mt-3 text-xs text-red-400">{err}</p>}

            <div className="mt-5 flex justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="h-9 rounded-lg border px-4 text-sm font-medium border-zinc-300 hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/10"
              >
                취소
              </button>
              <button
                type="submit"
                className="h-9 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-white/90"
              >
                저장
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 결과 알림 모달 */}
      {resultOpen && (
        <div className="fixed inset-0 z-[1100] grid place-items-center">
          <div className="absolute inset-0 bg-black/60" onClick={closeResult} />
          <div className="relative z-[1101] w-[88vw] max-w-sm rounded-2xl border border-white/10 bg-white p-5 text-center text-zinc-900 shadow-xl dark:bg-zinc-900 dark:text-zinc-50">
            <p className="text-sm">{resultMsg}</p>
            <button
              onClick={closeResult}
              className="mt-4 h-9 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-white/90"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}

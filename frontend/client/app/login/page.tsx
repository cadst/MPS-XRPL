"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { setAccessToken } from "../../lib/api/auth/token";
import { normalizeLoginError } from "../../lib/api/core/error";
import { api } from "@/lib/api/core/http";
import SuccessModal from "../components/sections/SuccessModal";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showSuccess, setShowSuccess] = useState(false); 
  const r = useRouter();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setErr("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const payload = {
      email: String(fd.get("email") || "").trim().toLowerCase(),
      password: String(fd.get("password") || ""),
    };

    try {
      const resp = await login(payload);
      setAccessToken(resp.accessToken);
      window.dispatchEvent(new Event("mps:auth:changed"));

      try {
        await api("/auth/me", { skipAuthRedirect: true });
      } catch {}

      const returnTo = sessionStorage.getItem("returnTo") || "/";
      sessionStorage.removeItem("returnTo");

      setShowSuccess(true);

      setTimeout(() => {
        setShowSuccess(false);
        r.replace(returnTo);
      }, 1500);
    } catch (e: any) {
      setErr(normalizeLoginError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden text-white">
      <SuccessModal
        isOpen={showSuccess}
        message="로그인이 완료되었습니다."
        variant="success"
        mode="modal"
        autoCloseMs={1500}
        onClose={() => setShowSuccess(false)}
      />

      <video
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        src="/videos/blockchain.mp4"
        poster="/images/hero-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
      <div className="pointer-events-none absolute inset-0 bg-black/40" />

      <div className="relative z-10 grid h-full place-items-center p-6">
        <div className="w-[min(920px,92vw)] h-[520px] rounded-2xl overflow-hidden mb-20">
          <div className="pt-6 text-center">
            <div
              className="text-3xl font-extrabold tracking-tight"
              style={{ textShadow: "0 6px 24px rgba(0,0,0,.5)" }}
            >
              로그인
            </div>
          </div>

          <div
            className="mx-auto mt-10 w-[360px] rounded-xl p-6"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.04))",
              border: "1px solid rgba(255,255,255,.08)",
              boxShadow:
                "0 1px 0 rgba(255,255,255,.06) inset, 0 12px 40px rgba(0,0,0,.45)",
              backdropFilter: "blur(10px)",
            }}
          >
            <form onSubmit={onSubmit} className="space-y-4">
              <label className="block text-[10px] tracking-wider text-white/60">
                이메일
              </label>
              <input
                className="w-full rounded-md bg-white/5 border border-white/10 px-4 py-3 text-sm placeholder-white/40 outline-none focus:border-white/25 focus:bg-white/[.07] transition"
                type="email"
                name="email"
                placeholder="you@example.com"
                autoComplete="username"
                required
              />

              <label className="block text-[10px] tracking-wider text-white/60">
                비밀번호
              </label>
              <input
                className="w-full rounded-md bg-white/5 border border-white/10 px-4 py-3 text-sm placeholder-white/40 outline-none focus:border-white/25 focus:bg-white/[.07] transition"
                type="password"
                name="password"
                placeholder="비밀번호를 입력하세요"
                autoComplete="current-password"
                required
              />

              {err && <p className="text-xs text-red-300">{err}</p>}

              <button
                className="w-full mt-2 inline-flex items-center justify-center rounded-md bg-white text-black text-sm font-semibold px-4 py-2 disabled:opacity-50 hover:bg-white/90 transition"
                disabled={loading}
                type="submit"
              >
                {loading ? "로그인 중…" : "로그인"}
              </button>

              <div className="flex items-center justify-between pt-2">
                <Link
                  href="/register/#top"
                  className="text-xs text-white/60 hover:text-white/90 underline underline-offset-4"
                >
                  회원가입
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

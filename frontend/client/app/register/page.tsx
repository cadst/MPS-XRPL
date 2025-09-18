// app/register/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyBizno, registerCompany } from "../../lib/api/companies";

/* ---------- 유틸 ---------- */
function copyToClipboard(text: string) {
  if (!text) return Promise.resolve();
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
  return Promise.resolve();
}

// 브라우저에서 랜덤 API 키 생성(백업/모의용)
function generateApiKey(len = 40) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let s = "sk_live_";
  for (let i = 0; i < bytes.length; i++) s += alphabet[bytes[i] % alphabet.length];
  return s;
}

// 사업자번호 정규화/체크섬
function normalizeBizNo(input: string) {
  return (input ?? "").replace(/[^0-9]/g, "");
}
function isBizNoChecksumOk(biz10: string) {
  if (!/^\d{10}$/.test(biz10)) return false;
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5],
    d = biz10.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += d[i] * w[i];
  sum += Math.floor((d[8] * 5) / 10);
  return ((10 - (sum % 10)) % 10) === d[9];
}

/* ---------- 타입 ---------- */
type FormState = {
  name: string;
  business_number: string;
  email: string;
  password: string;
  phone: string;
  ceo_name: string;
  profile_image_url: string;
  homepage_url: string;
};

const REGISTER_SKIP_NTS = (process.env.NEXT_PUBLIC_REGISTER_SKIP_NTS ?? "") === "1";

export default function RegisterPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const mock = sp.get("mock") === "1"; // ?mock=1 → 서버 건너뛰고 즉시 키 모달

  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // 배경 비디오
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    v.play().catch(() => {});
  }, []);

  // 페이지 진입 시 스크롤 잠금
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // validators
  const isEmail = (v: string) => /\S+@\S+\.\S+/.test(v);
  const isBizNoFormatted = (v: string) => /^\d{3}-\d{2}-\d{5}$/.test(v);

  const [f, setF] = useState<FormState>({
    name: "",
    business_number: "",
    email: "",
    password: "",
    phone: "",
    ceo_name: "",
    profile_image_url: "",
    homepage_url: "",
  });

  const step1Valid = useMemo(
    () => f.name.trim().length > 0 && isBizNoFormatted(f.business_number) && isEmail(f.email) && f.password.length >= 8,
    [f],
  );

  const step2Valid = useMemo(
    () =>
      f.phone.trim().length > 0 &&
      f.ceo_name.trim().length > 0 &&
      (f.profile_image_url.trim() === "" || /^https?:\/\//.test(f.profile_image_url)) &&
      (f.homepage_url.trim() === "" || /^https?:\/\//.test(f.homepage_url)),
    [f],
  );

  // 사업자번호 표시 포맷
  const formatBizNo = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 10);
    const a = digits.slice(0, 3);
    const b = digits.slice(3, 5);
    const c = digits.slice(5, 10);
    let out = a;
    if (b) out += "-" + b;
    if (c) out += "-" + c;
    return out;
  };

  const handleChange =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let v = e.target.value;
      if (key === "business_number") v = formatBizNo(v);
      setF((p) => ({ ...p, [key]: v }));
    };

  const goNext = () => {
    setErr("");
    if (step === 1 && !step1Valid) {
      setErr("1단계 필수 항목을 올바르게 입력해 주세요.");
      return;
    }
    setStep(2);
  };

  const goPrev = () => {
    setErr("");
    setStep(1);
  };

  // 프로필 파일 (회원가입 제출 때 같이 보냄)
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const openFilePicker = () => fileRef.current?.click();

  const handleProfilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileFile(file); // 미리 업로드하지 않고, 제출 시 함께 전송
  };

  /* ---------- 사업자번호 버튼 검증 ---------- */
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const biz10 = useMemo(() => normalizeBizNo(f.business_number), [f.business_number]);
  const checksumOk = useMemo(() => isBizNoChecksumOk(biz10), [biz10]);

  async function onVerifyBizno() {
    setVerifyMsg(null);
    if (!biz10) {
      setVerifyMsg("형식 오류(숫자 10자리 아님)");
      return; // 10자리는 최소 보장
    }
  
    // 체크섬은 "보조 메시지"로만 사용
    const localHint = checksumOk ? "로컬검증OK" : "체크섬NG";
  
    setVerifyLoading(true);
    try {
      const r = await verifyBizno(biz10);      // ← 항상 서버 호출
      if (r.ok) {
        setVerifyMsg(`사용 가능 (${r.source === "LOCAL" ? "로컬" : "국세청"}${r.tax_type ? `·${r.tax_type}` : ""}) | ${localHint}`);
      } else {
        setVerifyMsg(`사용 불가${r.reason ? `·${r.reason}` : ""} | ${localHint}`);
      }
    } catch (e: any) {
      setVerifyMsg(`검증 실패: ${String(e?.message ?? e)} | ${localHint}`);
    } finally {
      setVerifyLoading(false);
    }
  }

  /* ---------- 회원가입 제출 ---------- */
  const [keyOpen, setKeyOpen] = useState(false);
  const [issuedKey, setIssuedKey] = useState("");
  const [keyVisible, setKeyVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const openKeyModal = (key: string) => {
    setIssuedKey(key);
    setKeyVisible(false);
    setCopied(false);
    setKeyOpen(true);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr("");

    if (step === 1) {
      goNext();
      return;
    }
    if (!step2Valid) {
      setErr("2단계 항목을 확인해 주세요.");
      return;
    }

    setLoading(true);
    try {
      // 1) MOCK 모드: 서버 호출 없이 즉시 키 생성 → 모달
      if (mock) {
        const key = generateApiKey();
        openKeyModal(key);
        return;
      }

      // 2) 실제 서버 호출 (파일 있으면 같이 전송)
      const result = await registerCompany(
        {
          name: f.name,
          business_number: biz10, // 숫자 10자리로 정규화하여 전송
          email: f.email,
          password: f.password,
          phone: f.phone,
          ceo_name: f.ceo_name,
          profile_image_url: f.profile_image_url, // 파일이 있으면 서버에서 덮어씀
          homepage_url: f.homepage_url,
        },
        { skipNts: REGISTER_SKIP_NTS, profileFile } // ← 파일 동시 전송
      );

      const apiKey: string = result.api_key ?? "";
      openKeyModal(apiKey || generateApiKey());
    } catch (e: any) {
      if (mock) {
        openKeyModal(generateApiKey());
      } else {
        setErr(e.message || "회원가입 실패");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmKey = () => {
    setKeyOpen(false);
    router.replace("/login");
  };

  const handleCopyKey = async () => {
    await copyToClipboard(issuedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center px-1 py-1 text-white overflow-hidden">
      {/* 배경 비디오 */}
      <video
        ref={videoRef}
        className="fixed inset-0 h-full w-full object-cover z-0"
        src="/videos/blockchain.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
      <div className="fixed inset-0 bg-black/40 z-10 pointer-events-none" />

      {/* 회원가입 카드 */}
      <div className="relative z-20 w-[min(920px,92vw)] h-[620px] rounded-2xl overflow-hidden mb-[50px]">
        <div className="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2">
          <h1
            className="text-2xl md:text-3xl font-extrabold tracking-tight text-center mb-3"
            style={{ textShadow: "0 6px 24px rgba(0,0,0,.5)" }}
          >
            회원가입
          </h1>

          <div
            className="rounded-2xl p-5 md:p-6"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.04))",
              border: "1px solid rgba(255,255,255,.08)",
              boxShadow: "0 1px 0 rgba(255,255,255,.06) inset, 0 12px 40px rgba(0,0,0,.45)",
              backdropFilter: "blur(10px)",
            }}
          >
            {/* 단계 표시 */}
            <div className="mb-2">
              <div className="flex items-center justify-between text-xs text-white/70">
                <span>기본 정보</span>
                <span>기업 정보</span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-white transition-all" style={{ width: step === 1 ? "50%" : "100%" }} />
              </div>
              <div className="mt-2 text-center text-xs text-white/60">{step}/2 단계</div>
            </div>

            {/* 폼 */}
            <form onSubmit={onSubmit} className="space-y-4">
              {step === 1 && (
                <>
                  <Field label="회사명">
                    <input
                      name="name"
                      value={f.name}
                      onChange={handleChange("name")}
                      required
                      placeholder="회사명"
                      className="w-full h-12 rounded-lg bg-white/5 border border-white/10 px-4 text-sm placeholder-white/40 outline-none focus:border-white/25 focus:bg-white/[.07] transition"
                    />
                  </Field>

                  <Field label="사업자번호('-' 포함)">
                    <div className="flex gap-2">
                      <input
                        name="business_number"
                        value={f.business_number}
                        onChange={handleChange("business_number")}
                        required
                        inputMode="numeric"
                        placeholder="000-00-00000"
                        className="w-full h-12 rounded-lg bg-white/5 border border-white/10 px-4 text-sm placeholder-white/40 outline-none focus:border-white/25 focus:bg-white/[.07] transition"
                      />
                      <button
                        type="button"
                        onClick={onVerifyBizno}
                        disabled={!biz10 || !checksumOk || verifyLoading}
                        className="h-12 px-4 rounded-lg bg-white text-black text-sm font-semibold disabled:opacity-50 hover:bg-white/90 transition"
                      >
                        {verifyLoading ? "확인 중…" : "번호 확인"}
                      </button>
                    </div>
                    <div className="mt-1 text-xs text-white/70">
                      {!biz10
                        ? "숫자 10자리"
                        : !checksumOk
                        ? "형식/체크섬 오류"
                        : verifyMsg ?? "체크섬 통과 (서버 검증 전)"}
                    </div>
                  </Field>

                  <Field label="로그인 이메일">
                    <input
                      name="email"
                      type="email"
                      value={f.email}
                      onChange={handleChange("email")}
                      required
                      placeholder="you@example.com"
                      className="w-full h-12 rounded-lg bg-white/5 border border-white/10 px-4 text-sm placeholder-white/40 outline-none focus:border-white/25 focus:bg-white/[.07] transition"
                    />
                  </Field>

                  <Field label="비밀번호 (8자 이상)">
                    <input
                      name="password"
                      type="password"
                      value={f.password}
                      onChange={handleChange("password")}
                      required
                      minLength={8}
                      placeholder="영문 대/소문자+숫자+특수문자 포함"
                      className="w-full h-12 rounded-lg bg-white/5 border border-white/10 px-4 text-sm placeholder-white/40 outline-none focus:border-white/25 focus:bg-white/[.07] transition"
                    />
                  </Field>
                </>
              )}

              {step === 2 && (
                <>
                  <Field label="대표 전화번호">
                    <input
                      name="phone"
                      value={f.phone}
                      onChange={handleChange("phone")}
                      placeholder="02-1234-5678"
                      required
                      className="w-full h-12 rounded-lg bg-white/5 border border-white/10 px-4 text-sm placeholder-white/40 outline-none focus:border-white/25 focus:bg-white/[.07] transition"
                    />
                  </Field>

                  <Field label="대표자명">
                    <input
                      name="ceo_name"
                      value={f.ceo_name}
                      onChange={handleChange("ceo_name")}
                      placeholder="홍길동"
                      required
                      className="w-full h-12 rounded-lg bg-white/5 border border-white/10 px-4 text-sm placeholder-white/40 outline-none focus:border-white/25 focus:bg-white/[.07] transition"
                    />
                  </Field>

                  {/* 업로드 */}
                  <Field label="프로필 이미지 (선택)">
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleProfilePick} className="hidden" />
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={openFilePicker}
                        className="h-10 px-4 rounded-lg bg-white text-black text-sm font-semibold hover:bg-white/90 transition"
                      >
                        {profileFile || f.profile_image_url ? "이미지 변경" : "이미지 선택"}
                      </button>

                      <div className="text-xs text-white/70 truncate">
                        {f.profile_image_url && <span className="break-all">선택됨(URL): {f.profile_image_url}</span>}
                        {!f.profile_image_url && profileFile && <span className="truncate">{profileFile.name}</span>}
                        {!profileFile && !f.profile_image_url && <span className="text-white/40">이미지를 선택하세요</span>}
                      </div>
                    </div>

                    {(profileFile || f.profile_image_url) && (
                      <div className="mt-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={profileFile ? URL.createObjectURL(profileFile) : f.profile_image_url}
                          alt="프로필 미리보기"
                          className="h-24 w-24 rounded-lg object-cover border border-white/10"
                        />
                      </div>
                    )}
                  </Field>

                  <Field label="홈페이지 URL (선택)">
                    <input
                      name="homepage_url"
                      value={f.homepage_url}
                      onChange={handleChange("homepage_url")}
                      placeholder="https://..."
                      className="w-full h-12 rounded-lg bg-white/5 border border-white/10 px-4 text-sm placeholder-white/40 outline-none focus:border-white/25 focus:bg-white/[.07] transition"
                    />
                  </Field>
                </>
              )}

              {err && <p className="text-xs text-red-300">{err}</p>}

              {/* 액션 */}
              <div className="pt-2 flex gap-3">
                {step === 2 && (
                  <button
                    type="button"
                    onClick={goPrev}
                    className="h-12 flex-1 rounded-lg border border-white/15 text-white/90 hover:bg-white/5 transition"
                  >
                    이전
                  </button>
                )}

                {step === 1 && (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!step1Valid}
                    className="h-12 flex-1 rounded-lg bg-white text-black text-base font-semibold disabled:opacity-50 hover:bg-white/90 transition"
                  >
                    다음
                  </button>
                )}

                {step === 2 && (
                  <button
                    type="submit"
                    disabled={loading || !step2Valid}
                    className="h-12 flex-1 rounded-lg bg-white text-black text-base font-semibold disabled:opacity-50 hover:bg-white/90 transition"
                  >
                    {loading ? "회원가입 중…" : "회원가입"}
                  </button>
                )}
              </div>

              <div className="pt-2 text-center">
                <Link href="/login#top" className="text-xs text-white/60 hover:text-white/90 underline underline-offset-4">
                  이미 계정이 있으신가요? 로그인
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* ========= 발급된 API 키 모달 ========= */}
      {keyOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" />
          <section
            role="dialog"
            aria-modal="true"
            className="relative z-[1001] w-[min(560px,92vw)] rounded-2xl bg-white text-zinc-900 shadow-xl dark:bg-zinc-900 dark:text-white border border-zinc-200 dark:border-white/10 p-5"
          >
            <h2 className="text-lg font-semibold">회원가입이 완료되었습니다</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              아래 API 키는 보안상 <b>지금 한 번만</b> 표시됩니다. 안전한 곳에 보관하세요.
            </p>

            <div className="mt-4 rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 p-3">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">API Key</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all text-sm">
                  {keyVisible ? issuedKey : "•".repeat(Math.max(issuedKey.length, 8))}
                </code>
                <button
                  onClick={() => setKeyVisible((v) => !v)}
                  className="h-8 rounded-md border border-zinc-200 dark:border-white/10 px-2 text-xs hover:bg-zinc-100 dark:hover:bg-white/10"
                >
                  {keyVisible ? "숨기기" : "보기"}
                </button>
                <button
                  onClick={handleCopyKey}
                  className="h-8 rounded-md bg-zinc-900 text-white px-3 text-xs hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                >
                  {copied ? "복사됨" : "복사"}
                </button>
              </div>
            </div>

            <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              • 키를 분실하면 재발급이 필요합니다. <br />• 다른 사람과 공유하지 마세요.
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={handleConfirmKey}
                className="h-10 rounded-md bg-zinc-900 text-white px-4 text-sm font-medium hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
              >
                확인
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

/** 공통 필드 래퍼 */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] mb-1 tracking-wider text-white/70">{label}</span>
      {children}
    </label>
  );
}

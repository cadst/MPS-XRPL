// 이미지 파일 절대 경로 설정
export function assetUrl(u?: string | null) {
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u; // 이미 절대경로면 그대로
    const base = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/+$/, "");
    return `${base}${u.startsWith("/") ? u : `/${u}`}`; // http://localhost:4000 + /uploads/...
  }
  
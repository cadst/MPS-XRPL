// app/utils/resolveImageUrl.ts
type ImageType = "profile" | "music";

export function resolveImageUrl(absOrRel?: string | null, type: ImageType = "music") {
  const base = (process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000").replace(/\/+$/, "");
  const prefix = type === "profile" ? "/uploads/profile/" : "/uploads/images/";
  const fallback = `${base}${type === "profile" ? "/uploads/profile/default.png" : "/uploads/images/cover.png"}`;

  const vRaw = (absOrRel ?? "").trim();

  // 1) 비어있거나 무효값 → cover.png
  if (!vRaw || vRaw === "null" || vRaw === "undefined") return fallback;

  // 2) placeholder.* 는 무조건 cover.png
  if (/^\/?placeholder\.(png|jpe?g|webp|gif)$/i.test(vRaw)) return fallback;

  // 3) 절대 URL은 그대로
  if (/^https?:\/\//i.test(vRaw)) return vRaw;

  // 4) /assets/* (Next public) 는 그대로
  if (vRaw.startsWith("/assets/")) return vRaw;

  // 5) /uploads/* 는 base만 붙이고, 슬래시 중복 제거
  if (vRaw.startsWith("/uploads/")) return `${base}${vRaw}`;

  // 6) 그 외 파일명만 온 경우 → type별 업로드 폴더로
  const file = vRaw.replace(/^\/+/, ""); // 선행 슬래시 제거
  return `${base}${prefix}${file}`;
}

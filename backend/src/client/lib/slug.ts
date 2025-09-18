export function slugifyKo(input: string): string {
    return String(input)
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\uac00-\ud7a3-]/g, "");
  }
  
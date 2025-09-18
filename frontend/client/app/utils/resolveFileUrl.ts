export function resolveFileUrl(absOrRel?: string | null, folder: 'music'|'images'|'profile'='music') {
    const base = (process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4000').replace(/\/+$/, '');
    const v = String(absOrRel ?? '').trim();
    if (!v || v === 'null' || v === 'undefined') return '';
  
    if (/^https?:\/\//i.test(v)) return v;                // 절대 URL
    if (v.startsWith('/uploads/')) return `${base}${v}`;  // 이미 /uploads/*
    if (v.startsWith('uploads/'))  return `${base}/${v}`; // uploads/*
  
    // 폴더부터 시작하는 상대경로도 보정 (music/..., images/..., profile/...)
    if (/^(music|images|profile)\//.test(v)) return `${base}/uploads/${v}`;
  
    // 파일명만 온 경우
    return `${base}/uploads/${folder}/${v.replace(/^\/+/, '')}`;
  }
  
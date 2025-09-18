export default function DeveloperDocsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10 md:px-8">
      <a
        href="#overview"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-zinc-900 focus:px-3 focus:py-2 focus:text-white dark:focus:bg-white dark:focus:text-zinc-900"
      >
        Skip to content
      </a>

      <header className="mb-6 sm:mb-10 space-y-2">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          개발자 문서
        </h1>
        <p className="text-[13px] sm:text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          MPS에서 제공되는 API를 통해 외부 서비스에서 음원을 이용하는데 필요한 설명을 제공하는 가이드입니다. <br className="hidden sm:block" />
          인증은 API Key 기반이며, 스트리밍은 HTTP Range + 진행 토큰(<code>X-Play-Token</code>)을 사용합니다.
        </p>
      </header>

      <nav
        aria-label="API Navigation"
        className="sticky top-0 z-20 mb-10 rounded-lg border border-zinc-200/70 bg-white/80 px-2 sm:px-4 py-2.5 sm:py-4 text-sm backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/60"
      >
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar [-webkit-overflow-scrolling:touch]">
          {[
            ["#overview", "개요"],
            ["#auth", "인증"],
            ["#stream", "음원 스트리밍"],
            ["#range-flow", "Range & 토큰"],
            ["#lyrics", "가사 다운로드"],
            ["#errors", "오류 코드"],
            ["#examples", "예시 코드"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="group relative flex-shrink-0 rounded-md px-3 py-2 text-[13px] sm:text-sm font-medium tracking-wide text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              <span>{label}</span>
              <span className="pointer-events-none absolute inset-x-2 -bottom-0.5 hidden h-[2px] origin-center scale-x-0 rounded bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-transform group-hover:scale-x-100 sm:block" />
            </a>
          ))}
        </div>
      </nav>

      <section id="overview" className="scroll-mt-24 sm:scroll-mt-28 mb-12 sm:mb-16">
        <h2 className="mb-3 sm:mb-5 text-lg sm:text-xl font-semibold leading-tight text-zinc-900 dark:text-white">1. 개요</h2>
        <div className="rounded-xl border border-zinc-200/80 bg-white/60 p-4 sm:p-6 text-[13px] sm:text-sm leading-relaxed shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-zinc-900/40">
          <ul className="list-disc space-y-2 pl-5 text-zinc-600 dark:text-zinc-400">
            <li><span className="font-medium text-zinc-700 dark:text-zinc-200">Base URL</span> 은 별도로 발급/공지됩니다. (예: <code>https://api.example.com</code>)</li>
            <li>모든 요청은 <strong>HTTPS</strong> 로 전송해야 합니다.</li>
            <li><span className="font-medium">순차 Range</span> 요청만 수행하면 서버가 진행/검증을 자동 관리합니다.</li>
            <li><code>X-Play-Token</code> 은 세션 식별 토큰이며 항상 최신 값을 연속 요청에 포함합니다.</li>
          </ul>
        </div>
      </section>

      <section id="auth" className="scroll-mt-24 sm:scroll-mt-28 mb-12 sm:mb-16">
        <h2 className="mb-3 sm:mb-5 text-lg sm:text-xl font-semibold leading-tight text-zinc-900 dark:text-white">2. 인증</h2>
        <div className="rounded-xl border border-zinc-200/80 bg-white/60 p-4 sm:p-6 text-[13px] sm:text-sm leading-relaxed shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-zinc-900/40">
          <p className="mb-3 sm:mb-4 font-medium text-zinc-800 dark:text-zinc-200">API Key</p>
          <ul className="list-disc space-y-1 pl-5 text-zinc-600 dark:text-zinc-400">
            <li>발급받은 키를 <code>X-API-Key</code> 헤더에 포함합니다.</li>
            <li>대체(권장 X): <code>?api_key=YOUR_KEY</code> 쿼리 파라미터 가능 (서버는 헤더 우선).</li>
            <li>노출 방지를 위해 클라이언트(웹) 직접 삽입 대신 서버 간 프록시 권장.</li>
          </ul>
          <div className="mt-3 sm:mt-4 rounded-md bg-zinc-950 p-3 sm:p-4 font-mono text-[12px] sm:text-xs text-zinc-200 dark:bg-zinc-900 overflow-auto">
            <pre><code>{`# 예시\ncurl -H "X-API-Key: YOUR_API_KEY" https://api.example.com/music/123/play?pt=...`}</code></pre>
          </div>
        </div>
      </section>

      <section id="stream" className="scroll-mt-24 sm:scroll-mt-28 mb-12 sm:mb-16">
        <h2 className="mb-3 sm:mb-5 text-lg sm:text-xl font-semibold leading-tight text-zinc-900 dark:text-white">3. 음원 스트리밍</h2>
        <div className="space-y-4 sm:space-y-5 rounded-xl border border-zinc-200/80 bg-white/60 p-4 sm:p-6 text-[13px] sm:text-sm leading-relaxed shadow-sm backdrop-blur-sm text-zinc-600 dark:border-white/10 dark:bg-zinc-900/40 dark:text-zinc-400">
          <p>엔드포인트: <code>GET /music/:music_id/play</code></p>
          <p className="font-medium text-zinc-800 dark:text-zinc-200">필수/주요 요소</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><code>X-API-Key</code>: 기업 인증</li>
            <li><code>Range</code> 헤더: 부분 전송 (예: <code>bytes=0-</code>). 초기 요청에 Range 누락 시 서버가 기본 청크를 보냅니다.</li>
            <li><code>X-Play-Token</code>: 진행 토큰 (첫 응답 헤더에서 수신 → 이후 요청에 그대로 전달)</li>
            <li><code>pt</code> 쿼리 또는 <code>pt</code> 쿠키: 토큰 대체 전송 수단 (모바일/브라우저 호환)</li>
          </ul>
          <p className="font-medium text-zinc-800 dark:text-zinc-200">응답 특징</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><code>206 Partial Content</code> (Range 사용 시)</li>
            <li><code>Content-Range</code>, <code>Accept-Ranges: bytes</code></li>
            <li><code>Content-Type: audio/mpeg</code> (파일 형식에 따라 다를 수 있음)</li>
            <li><code>X-Play-Token</code> & <code>Set-Cookie: pt=...</code></li>
            <li>캐시 방지 헤더(<code>Cache-Control: no-store</code>)</li>
          </ul>
          <p className="font-medium text-zinc-800 dark:text-zinc-200">재생 흐름 요약</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>API Key 포함 최초 요청 (권장: <code>Range: bytes=0-</code>)</li>
            <li>응답에서 <code>X-Play-Token</code> 추출</li>
            <li>다음 Range 청크 요청마다 동일 토큰 전송</li>
            <li>파일 끝까지(또는 필요한 구간까지) 순차 진행</li>
          </ol>
          <p className="text-[12px] sm:text-xs text-zinc-500 dark:text-zinc-500">유효재생 로직은 서버 내부에서 자동 처리되며, 클라이언트는 순차 Range 요청만 수행하면 됩니다.</p>
        </div>
      </section>

      <section id="range-flow" className="scroll-mt-24 sm:scroll-mt-28 mb-12 sm:mb-16">
        <h2 className="mb-3 sm:mb-5 text-lg sm:text-xl font-semibold leading-tight text-zinc-900 dark:text-white">4. Range & 토큰 흐름</h2>
        <div className="rounded-xl border border-zinc-200/80 bg-white/60 p-4 sm:p-6 text-[13px] sm:text-sm leading-relaxed shadow-sm backdrop-blur-sm text-zinc-600 dark:border-white/10 dark:bg-zinc-900/40 dark:text-zinc-400 space-y-3 sm:space-y-4">
          <p>토큰은 재생 세션 상태(어떤 음원/기업인지, 서버가 추적한 전송 진행도 등)를 안전하게 식별하는 값입니다.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>음원 ID 또는 회사가 바뀌면 새 토큰이 발급될 수 있음.</li>
            <li>토큰이 오래되었거나 손상되면 서버가 새 토큰을 발급 (헤더/쿠키로 교체).</li>
            <li>항상 최신 응답 헤더의 <code>X-Play-Token</code> 값을 다음 요청에 사용하십시오.</li>
            <li>병렬 다중 Range 요청은 권장하지 않습니다 (순차 진행).</li>
          </ul>
          <div className="mt-2 rounded-md bg-zinc-950 p-3 sm:p-4 font-mono text-[12px] sm:text-xs text-zinc-200 dark:bg-zinc-900 overflow-auto">
            <pre><code>{`# 1) 최초 0바이트부터 요청 (권장)\ncurl -i \\\n  -H "X-API-Key: YOUR_API_KEY" \\\n  -H "Range: bytes=0-" \\\n  https://api.example.com/music/123/play\n\n# 응답 헤더 일부 예시\n# HTTP/1.1 206 Partial Content\n# Content-Range: bytes 0-65535/5345678\n# X-Play-Token: eyJ2IjoxLCJtdXNpY0lkIjoxMjMs... (생략)\n\n# 2) 다음 청크 요청\ncurl -i \\\n  -H "X-API-Key: YOUR_API_KEY" \\\n  -H "Range: bytes=65536-131071" \\\n  -H "X-Play-Token: 받은_토큰" \\\n  https://api.example.com/music/123/play`}</code></pre>
          </div>
        </div>
      </section>

      <section id="lyrics" className="scroll-mt-24 sm:scroll-mt-28 mb-12 sm:mb-16">
        <h2 className="mb-3 sm:mb-5 text-lg sm:text-xl font-semibold leading-tight text-zinc-900 dark:text-white">5. 가사 다운로드</h2>
        <div className="space-y-3 sm:space-y-4 rounded-xl border border-zinc-200/80 bg-white/60 p-4 sm:p-6 text-[13px] sm:text-sm leading-relaxed shadow-sm backdrop-blur-sm text-zinc-600 dark:border-white/10 dark:bg-zinc-900/40 dark:text-zinc-400">
          <p>엔드포인트: <code>GET /lyric/:music_id/download</code></p>
          <ul className="list-disc pl-5 space-y-1">
            <li><code>X-API-Key</code> 필수</li>
            <li>응답: <code>200 OK</code> + <code>Content-Type: text/plain; charset=utf-8</code></li>
            <li><code>Content-Disposition: attachment; filename="lyrics_&lt;id&gt;.txt"</code></li>
          </ul>
          <div className="rounded-md bg-zinc-950 p-3 sm:p-4 font-mono text-[12px] sm:text-xs text-zinc-200 dark:bg-zinc-900 overflow-auto">
            <pre><code>{`curl -L \\\n  -H "X-API-Key: YOUR_API_KEY" \\\n  https://api.example.com/lyric/123/download \\\n  -o lyrics_123.txt`}</code></pre>
          </div>
        </div>
      </section>

      <section id="errors" className="scroll-mt-24 sm:scroll-mt-28 mb-12 sm:mb-16">
        <h2 className="mb-3 sm:mb-5 text-lg sm:text-xl font-semibold leading-tight text-zinc-900 dark:text-white">6. 오류 코드</h2>
        <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white/60 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-zinc-900/40">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] sm:text-sm">
              <thead className="bg-zinc-50/80 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300">
                <tr>
                  <th className="px-3 sm:px-4 py-2 font-medium">Status</th>
                  <th className="px-3 sm:px-4 py-2 font-medium">설명</th>
                  <th className="px-3 sm:px-4 py-2 font-medium">대응</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-white/10">
                <tr>
                  <td className="px-3 sm:px-4 py-2">401</td>
                  <td className="px-3 sm:px-4 py-2">유효하지 않은 또는 누락된 API Key</td>
                  <td className="px-3 sm:px-4 py-2">키 확인 후 재요청</td>
                </tr>
                <tr>
                  <td className="px-3 sm:px-4 py-2">403</td>
                  <td className="px-3 sm:px-4 py-2">해당 음원/가사에 대한 권한 없음</td>
                  <td className="px-3 sm:px-4 py-2">계정 등급/권한 확인</td>
                </tr>
                <tr>
                  <td className="px-3 sm:px-4 py-2">404</td>
                  <td className="px-3 sm:px-4 py-2">음원 또는 가사 파일 없음</td>
                  <td className="px-3 sm:px-4 py-2">ID 및 자원 존재 여부 확인</td>
                </tr>
                <tr>
                  <td className="px-3 sm:px-4 py-2">416</td>
                  <td className="px-3 sm:px-4 py-2">Range 범위가 잘못됨</td>
                  <td className="px-3 sm:px-4 py-2">정상 바이트 범위로 재시도</td>
                </tr>
                <tr>
                  <td className="px-3 sm:px-4 py-2">500</td>
                  <td className="px-3 sm:px-4 py-2">서버 내부 오류</td>
                  <td className="px-3 sm:px-4 py-2">지속 시 담당자 문의</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="examples" className="scroll-mt-24 sm:scroll-mt-28 mb-16 sm:mb-20">
        <h2 className="mb-3 sm:mb-5 text-lg sm:text-xl font-semibold leading-tight text-zinc-900 dark:text-white">7. 예시 코드</h2>
        <div className="space-y-6 sm:space-y-8 rounded-xl border border-zinc-200/80 bg-white/60 p-4 sm:p-6 text-[13px] sm:text-sm leading-relaxed shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-zinc-900/40">
          <div>
            <h3 className="mb-2 font-medium text-zinc-800 dark:text-zinc-200">브라우저 (fetch) - 순차 스트리밍</h3>
            <div className="rounded-md bg-zinc-950 p-3 sm:p-4 font-mono text-[12px] sm:text-xs text-zinc-200 dark:bg-zinc-900 overflow-auto">
              <pre><code>{`async function streamMusic(musicId, apiKey) {\n  let token = null;\n  let start = 0;\n  const chunkSize = 256 * 1024; // 원하는 단위 (정책 외 참고용)\n  let fileSize = null;\n  const audioChunks = [];\n\n  while (true) {\n    const end = start + chunkSize - 1;\n    const headers = {\n      'X-API-Key': apiKey,\n      'Range': fileSize\n        ? 'bytes=' + start + '-' + Math.min(end, fileSize - 1)\n        : 'bytes=' + start + '-'\n    };\n    if (token) headers['X-Play-Token'] = token;\n\n    const res = await fetch('https://api.example.com/music/' + musicId + '/play', { headers });\n    if (res.status === 404) throw new Error('Not found');\n    if (res.status === 401) throw new Error('Auth error');\n    if (res.status !== 206 && res.status !== 200) throw new Error('Unexpected');\n\n    token = res.headers.get('x-play-token') || token;\n    const cr = res.headers.get('content-range');\n    if (cr && /bytes (\\\\d+)-(\\\\d+)\\\\/(\\\\d+)/.test(cr)) {\n      const match = cr.match(/bytes (\\\\d+)-(\\\\d+)\\\\/(\\\\d+)/);\n      const e = match[2];\n      const total = match[3];\n      fileSize = parseInt(total, 10);\n      start = parseInt(e, 10) + 1;\n    } else {\n      start = fileSize || Infinity;\n    }\n\n    const buf = await res.arrayBuffer();\n    audioChunks.push(new Uint8Array(buf));\n    if (fileSize && start >= fileSize) break;\n  }\n\n  return new Blob(audioChunks, { type: 'audio/mpeg' });\n}`}</code></pre>
            </div>
          </div>
          <div>
            <h3 className="mb-2 font-medium text-zinc-800 dark:text-zinc-200">Node.js (axios)</h3>
            <div className="rounded-md bg-zinc-950 p-3 sm:p-4 font-mono text-[12px] sm:text-xs text-zinc-200 dark:bg-zinc-900 overflow-auto">
              <pre><code>{`import axios from 'axios';\n\nasync function downloadLyrics(musicId, apiKey) {\n  const res = await axios.get(\n    'https://api.example.com/lyric/' + musicId + '/download',\n    { headers: { 'X-API-Key': apiKey }, responseType: 'text' }\n  );\n  return res.data; // plain text\n}`}</code></pre>
            </div>
          </div>
          <div>
            <h3 className="mb-2 font-medium text-zinc-800 dark:text-zinc-200">cURL - 연속 Range 요청</h3>
            <div className="rounded-md bg-zinc-950 p-3 sm:p-4 font-mono text-[12px] sm:text-xs text-zinc-200 dark:bg-zinc-900 overflow-auto">
              <pre><code>{`# 첫 요청\ncurl -D headers1.txt -H "X-API-Key: YOUR_API_KEY" -H "Range: bytes=0-" \\\n  https://api.example.com/music/123/play --output part1.bin\n\n# 토큰 추출 (예: grep/awk 등 사용) 후 다음 요청\nTOKEN=$(grep -i 'X-Play-Token' headers1.txt | cut -d' ' -f2 | tr -d '\r')\nCR=$(grep -i 'Content-Range' headers1.txt)\nEND=$(echo $CR | sed -E 's/bytes ([0-9]+)-([0-9]+)\/(.*)/\\2/')\nNEXT=$((END+1))\n\ncurl -H "X-API-Key: YOUR_API_KEY" \\\n  -H "Range: bytes=$NEXT-" \\\n  -H "X-Play-Token: $TOKEN" \\\n  https://api.example.com/music/123/play --output part2.bin`}</code></pre>
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-16 sm:mt-20 border-t border-zinc-200 pt-5 sm:pt-6 text-center text-[12px] sm:text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-500">
        © {new Date().getFullYear()} Music Platform API
      </footer>
    </main>
  );
}



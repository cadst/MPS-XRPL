export const dynamic = 'force-dynamic';   // 항상 서버에서 새로 렌더

async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export default async function Page() {
  await delay(1500); // 테스트용 지연
  return <main>메인</main>;
}
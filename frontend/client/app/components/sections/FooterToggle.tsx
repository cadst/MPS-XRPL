// app/components/sections/FooterToggle.tsx
"use client";
import { useAudioPlayer } from "@/app/providers/AudioPlayerProvider";

export default function FooterToggle() {
  const { visible, togglePlayer, playTrack } = useAudioPlayer();

  return (
    <>
      <button onClick={togglePlayer}
        className="fixed bottom-24 right-4 z-[60] rounded-full border border-white/15 bg-zinc-900/80 px-4 py-2 text-sm text-white">
        {visible ? "플레이어 숨기기" : "플레이어 보이기"}
      </button>

      {/* 테스트용: 샘플 재생 */}
      {/* <button onClick={() => playTrack({ id:1, title:"Saturday Nights", artist:"Khalid", cover:"...", src:"https://..." })}>
        샘플 재생
      </button> */}
    </>
  );
}

// app/components/common/Footer.tsx
"use client";
import FooterPlayer from "../sections/FooterPlayer";
import { useAudioPlayer } from "@/app/providers/AudioPlayerProvider";

export default function Footer() {
  const {
    current, next, prev,
    shouldAutoplay, consumeAutoplay,
    visible,          
    hidePlayer,      
  } = useAudioPlayer();

  if (!visible) return null; 

  return (
    <FooterPlayer
      track={current}
      onNext={next}
      onPrev={prev}
      autoPlay={shouldAutoplay}
      onAutoPlayConsumed={consumeAutoplay}
      onClose={hidePlayer}   
    />
  );
}

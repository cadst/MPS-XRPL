// app/components/LayoutClient.tsx
"use client";

import Footer from "../common/Footer";
import { useAudioPlayer } from "@/app/providers/AudioPlayerProvider";

export default function LayoutClient() {
  const { visible } = useAudioPlayer();
  return (
    <>
      {/* <div id="modal-root" /> */}
      {visible && <Footer />} 
    </>
  );
}

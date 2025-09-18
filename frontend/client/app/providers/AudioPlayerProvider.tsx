"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

export type PlayerTrack = {
  id: number | string;
  title: string;
  artist: string;
  cover?: string;
  src: string;
  duration?: number;
};

type Ctx = {
  current: PlayerTrack | null;
  queue: PlayerTrack[];
  index: number;
  playTrack: (t: PlayerTrack, queue?: PlayerTrack[], startIndex?: number) => void;
  next: () => void;
  prev: () => void;
  shouldAutoplay: boolean;
  consumeAutoplay: () => void;

  // 👇 추가: 보이기/숨기기 제어
  visible: boolean;
  showPlayer: () => void;
  hidePlayer: () => void;
  togglePlayer: () => void;
};

const AudioPlayerContext = createContext<Ctx | null>(null);

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [index, setIndex] = useState(0);
  const [current, setCurrent] = useState<PlayerTrack | null>(null);
  const [shouldAutoplay, setShouldAutoplay] = useState(false);
  const [visible, setVisible] = useState(false);        

  const showPlayer = () => setVisible(true);
  const hidePlayer = () => setVisible(false);
  const togglePlayer = () => setVisible(v => !v);

  const playTrack: Ctx["playTrack"] = (t, q, startIdx) => {
    if (q && q.length) {
      setQueue(q);
      setIndex(startIdx ?? 0);
    } else {
      setQueue([t]);
      setIndex(0);
    }
    setCurrent(t);
    setShouldAutoplay(true);
    setVisible(true);                                  
  };

  const next = () => {
    if (!queue.length) return;
    const ni = (index + 1) % queue.length;
    setIndex(ni);
    setCurrent(queue[ni]);
    setShouldAutoplay(true);
    setVisible(true);
  };

  const prev = () => {
    if (!queue.length) return;
    const pi = (index - 1 + queue.length) % queue.length;
    setIndex(pi);
    setCurrent(queue[pi]);
    setShouldAutoplay(true);
    setVisible(true);
  };

  const consumeAutoplay = () => setShouldAutoplay(false);

  const value = useMemo(
    () => ({
      current, queue, index, playTrack, next, prev,
      shouldAutoplay, consumeAutoplay,
      visible, showPlayer, hidePlayer, togglePlayer,  
    }),
    [current, queue, index, shouldAutoplay, visible]
  );

  return <AudioPlayerContext.Provider value={value}>{children}</AudioPlayerContext.Provider>;
}

export function useAudioPlayer() {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
  return ctx;
}

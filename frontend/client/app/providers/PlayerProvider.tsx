"use client";
import { createContext, useCallback, useContext, useState, ReactNode } from "react";

export type TrackInfo = {
  id: number;
  title: string;
  artist: string;
  cover?: string;
  streamUrl?: string; // startMusicPlay로 받은 실재 스트림 URL
};

type PlayerCtx = {
  current: TrackInfo | null;
  isOpen: boolean;
  isPlaying: boolean;
  playTrack: (t: TrackInfo) => void;
  pause: () => void;
  resume: () => void;
  close: () => void;
  setCurrent: (updater: TrackInfo | null) => void;
};

const Ctx = createContext<PlayerCtx | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<TrackInfo | null>(null);
  const [isOpen, setOpen] = useState(false);
  const [isPlaying, setPlaying] = useState(false);

  const playTrack = useCallback((t: TrackInfo) => {
    setCurrent(t);
    setOpen(true);
    setPlaying(true);
  }, []);

  const pause = () => setPlaying(false);
  const resume = () => setPlaying(true);
  const close = () => {
    setPlaying(false);
    setOpen(false);
  };

  return (
    <Ctx.Provider value={{ current, isOpen, isPlaying, playTrack, pause, resume, close, setCurrent }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Wrap your app with <PlayerProvider/> in layout.tsx");
  return ctx;
}

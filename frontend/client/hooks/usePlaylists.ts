'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getPlaylists,
  getPlaylistTracks,
  usePlaylist,
  removePlaylistTracks,
  replacePlaylistTracks,
  deletePlaylist as apiDeletePlaylist,
  type PlaylistCard,
  type Track,
} from '@/lib/api/playlist';

type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

export function usePlaylistsList() {
  const abortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<AsyncState<PlaylistCard[]>>({
    data: null, loading: false, error: null,
  });

  const reload = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await getPlaylists();          
      if (ac.signal.aborted) return;
      setState({ data, loading: false, error: null });
    } catch (e: any) {
      if (ac.signal.aborted) return;
      setState({ data: null, loading: false, error: e?.message ?? '목록 조회 실패' });
    }
  }, []);

  useEffect(() => {
    reload();
    return () => abortRef.current?.abort();
  }, [reload]);

  return { ...state, reload };
}

export function usePlaylistTracks(playlistId: number | null) {
  const abortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<AsyncState<Track[]>>({
    data: null, loading: false, error: null,
  });

  const reload = useCallback(async () => {
    if (!playlistId) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await getPlaylistTracks(playlistId);   
      if (ac.signal.aborted) return;
      setState({ data, loading: false, error: null });
    } catch (e: any) {
      if (ac.signal.aborted) return;
      setState({ data: null, loading: false, error: e?.message ?? '트랙 조회 실패' });
    }
  }, [playlistId]);

  useEffect(() => {
    reload();
    return () => abortRef.current?.abort();
  }, [reload]);

  return { ...state, reload };
}

export function usePlaylistActions(playlistId: number | null) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T,>(fn: () => Promise<T>) => {
    setPending(true); setError(null);
    try {
      const r = await fn();
      setPending(false);
      return r;
    } catch (e: any) {
      setPending(false); setError(e?.message ?? '요청 실패');
      throw e;
    }
  }, []);

  const actions = useMemo(() => ({
    useSelected: (ids?: number[]) => {
      if (!playlistId) return Promise.reject(new Error('No playlistId'));
      return run(() => usePlaylist(playlistId, ids));                  
    },
    removeSelected: (ids: number[]) => {
      if (!playlistId) return Promise.reject(new Error('No playlistId'));
      if (!ids?.length) return Promise.reject(new Error('선택된 트랙이 없습니다.'));
      return run(() => removePlaylistTracks(playlistId, ids));         
    },
    replaceTracks: (ids: number[]) => {
      if (!playlistId) return Promise.reject(new Error('No playlistId'));
      return run(() => replacePlaylistTracks(playlistId, ids));        
    },
    deletePlaylist: () => {
      if (!playlistId) return Promise.reject(new Error('No playlistId'));
      return run(() => apiDeletePlaylist(playlistId));                  
    },
  }), [playlistId, run]);

  return { ...actions, pending, error };
}

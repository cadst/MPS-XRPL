// app/api/playlist.ts
import { api } from './core/http';

export type PlaylistCard = { id: number; name: string; count: number; cover?: string | null };
export type Track = {
  id: number;
  title: string;
  artist: string;
  coverUrl?: string | null;
  audioUrl: string;
  durationSec?: number | null;
};

export type CreatePlaylistReq = {
  name: string;
  trackIds?: number[];
};

export type CreatePlaylistResp = {
  id: number;
  name: string;
  count: number;
  cover: string | null;
};

export type PlaylistDetail = {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
};

export type UseResp = { count: number; addedToCompany?: number };
export type MutateResp = { playlistId: number; count: number; added?: number }; // ← added 확장
export type DeleteResp = { deleted: true };

const BASE = '/playlist';

function asArray(resp: any): any[] {
  if (Array.isArray(resp)) return resp;
  if (resp && Array.isArray(resp.rows)) return resp.rows;
  throw new Error('Invalid response');
}

function normCard(r: any): PlaylistCard {
  return {
    id: Number(r.id),
    name: String(r.name ?? ''),
    count: Number(r.count ?? r.cnt ?? 0),
    cover: (r.cover ?? r.cover_url ?? null) as string | null,
  };
}

function normTrack(r: any): Track {
  return {
    id: Number(r.id),
    title: String(r.title ?? ''),
    artist: String(r.artist ?? 'Various'),
    coverUrl: (r.coverUrl ?? r.cover_url ?? r.cover_image_url ?? null) as string | null,
    audioUrl: String(r.audioUrl ?? r.audio_url ?? ''),
    durationSec:
      r.durationSec != null
        ? Number(r.durationSec)
        : r.duration_sec != null
        ? Number(r.duration_sec)
        : null,
  };
}

/** -------- API -------- */

// GET /playlist
export async function getPlaylists(): Promise<PlaylistCard[]> {
  const res = await api(`${BASE}`);
  return asArray(res).map(normCard);
}

// GET /playlist/:id
export async function getPlaylistDetail(playlistId: number): Promise<PlaylistDetail> {
  return await api(`${BASE}/${playlistId}`);
}

// GET /playlist/:id/tracks
export async function getPlaylistTracks(playlistId: number): Promise<Track[]> {
  const res = await api(`${BASE}/${playlistId}/tracks`);
  return asArray(res).map(normTrack);
}

// POST /playlist/:id/use
export async function usePlaylist(playlistId: number, trackIds?: number[]): Promise<UseResp> {
  const body = trackIds?.length ? { trackIds } : {};
  return await api(`${BASE}/${playlistId}/use`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// PUT /playlist/:id/tracks (전체 교체)
export async function replacePlaylistTracks(playlistId: number, trackIds: number[]): Promise<MutateResp> {
  return await api(`${BASE}/${playlistId}/tracks`, {
    method: 'PUT',
    body: JSON.stringify({ trackIds }),
  });
}

export async function addTracksToPlaylist(playlistId: number, trackIds: number[]): Promise<MutateResp> {
  return await api(`${BASE}/${playlistId}/tracks`, {
    method: 'POST',
    body: JSON.stringify({ trackIds }),
  });
}

// (편의) 단일 트랙 추가
export async function addTrackToPlaylist(playlistId: number, trackId: number): Promise<MutateResp> {
  return addTracksToPlaylist(playlistId, [trackId]);
}

export async function removePlaylistTracks(playlistId: number, trackIds: number[]): Promise<MutateResp> {
  return await api(`${BASE}/${playlistId}/tracks/remove`, {
    method: 'POST',
    body: JSON.stringify({ trackIds }),
  });
}

// DELETE /playlist/:id
export async function deletePlaylist(playlistId: number): Promise<DeleteResp> {
  return await api(`${BASE}/${playlistId}`, { method: 'DELETE' });
}

// POST /playlist (생성)
export async function createPlaylist(dto: CreatePlaylistReq): Promise<CreatePlaylistResp> {
  // api()가 JSON을 돌려주는 헬퍼라는 전제에 맞춰 일관화
  const res = await api(`${BASE}`, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
  return res as CreatePlaylistResp;
}

import type { Track } from "./catalog";

export type Playlist = { id: string; name: string; description?: string; tracks: Track[] };

// Object URLs are session-scoped; resolve downloaded audio through IndexedDB at playback.
export function portableTrack(track: Track): Track {
  return {
    ...track,
    url: track.url.startsWith("blob:") ? "" : track.url,
    cover: track.cover.startsWith("blob:") ? "" : track.cover,
  };
}

export function addToPlaylist(playlist: Playlist, track: Track): Playlist {
  return playlist.tracks.some((item) => item.id === track.id)
    ? playlist
    : { ...playlist, tracks: [...playlist.tracks, portableTrack(track)] };
}

export function moveTrack(playlist: Playlist, id: string, direction: number): Playlist {
  const index = playlist.tracks.findIndex((track) => track.id === id);
  const destination = index + direction;
  if (index < 0 || destination < 0 || destination >= playlist.tracks.length) return playlist;
  const tracks = [...playlist.tracks];
  const item = tracks.splice(index, 1)[0];
  if (!item) return playlist;
  tracks.splice(destination, 0, item);
  return { ...playlist, tracks };
}
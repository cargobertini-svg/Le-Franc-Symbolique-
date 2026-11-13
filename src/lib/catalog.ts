export interface Track {
  id: string; title: string; artist: string; cover: string; url: string;
  duration: number; source: "exclusif" | "audius" | "itunes";
  plays: number; likes: number; color: string;
}
export const colorFor = (_s: string) => "var(--gold)";
const AUDIUS = "https://discoveryprovider.audius.co/v1";
const APP = "app_name=LeFrancSymbolique";
const mapAudius = (t: any): Track => ({
  id: `aud-${t.id}`, title: t.title, artist: t.user?.name || "Créateur Indépendant",
  cover: t.artwork?.["480x480"] || t.artwork?.["150x150"] || "",
  url: `${AUDIUS}/tracks/${t.id}/stream?${APP}`, duration: t.duration || 180, source: "audius",
  plays: t.play_count || 0, likes: t.favorite_count || 0, color: colorFor(String(t.id)),
});
const mapItunes = (i: any): Track => ({
  id: `itu-${i.trackId}`, title: i.trackName, artist: i.artistName,
  cover: (i.artworkUrl100 || "").replace("100x100bb", "600x600bb"), url: i.previewUrl, duration: 30, source: "itunes",
  plays: 9800 + (i.trackId % 50000), likes: 300 + (i.trackId % 3000), color: colorFor(String(i.trackId)),
});
export async function fetchTrending(): Promise<Track[]> {
  try { const r = await fetch(`${AUDIUS}/tracks/trending?limit=24&${APP}`); const j = await r.json(); return (j.data || []).map(mapAudius); } catch { return []; }
}
export async function fetchItunes(term: string, limit = 18): Promise<Track[]> {
  try { const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${limit}`);
    const j = await r.json(); return (j.results || []).filter((i: any) => i.previewUrl).map(mapItunes); } catch { return []; }
}
export async function searchAll(q: string): Promise<Track[]> {
  const [a, b] = await Promise.all([
    fetch(`${AUDIUS}/tracks/search?query=${encodeURIComponent(q)}&limit=10&${APP}`).then(r => r.json()).then(j => (j.data || []).map(mapAudius)).catch(() => []),
    fetchItunes(q, 10),
  ]);
  return [...a, ...b];
}
export const fmt = (s: number) => !s || isNaN(s) ? "0:00" : `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
export const compact = (n: number) => new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(n);
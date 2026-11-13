import { describe, expect, it } from "vitest";
import { addToPlaylist, moveTrack, portableTrack, type Playlist } from "@/lib/music-library";
import type { Track } from "@/lib/catalog";
const a: Track = {
  id: "a",
  title: "A",
  artist: "Artiste",
  cover: "",
  url: "https://audio.test/a.mp3",
  duration: 30,
  source: "itunes",
  plays: 0,
  likes: 0,
  color: "",
};
const b = { ...a, id: "b" };
const playlist: Playlist = { id: "p", name: "Mes titres", tracks: [a, b] };
describe("Bibliothèque partagée", () => {
  it("n’ajoute pas deux fois le même titre", () =>
    expect(addToPlaylist(playlist, a).tracks.map((t) => t.id)).toEqual(["a", "b"]));
  it("réorganise les titres sans modifier la liste initiale", () => {
    expect(moveTrack(playlist, "b", -1).tracks.map((t) => t.id)).toEqual(["b", "a"]);
    expect(playlist.tracks[0]?.id).toBe("a");
  });
  it("ne perd pas de titre au-delà des limites", () =>
    expect(moveTrack(playlist, "a", -1)).toBe(playlist));
  it("ne conserve pas les URL temporaires entre les sessions", () =>
    expect(portableTrack({ ...a, url: "blob:audio", cover: "blob:cover" })).toMatchObject({
      url: "",
      cover: "",
      id: "a",
    }));
});
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Playlist } from "@/lib/music-library";

export function PlaylistEditor({
  playlist,
  onSave,
}: {
  playlist: Playlist;
  onSave: (playlist: Playlist) => void;
}) {
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description || "");
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim())
          onSave({ ...playlist, name: name.trim(), description: description.trim() });
      }}
    >
      <label className="block text-sm">
        Nom de la playlist
        <input
          className="form-input mt-2 w-full"
          aria-label="Nom de la playlist"
          required
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="block text-sm">
        Description
        <textarea
          className="form-input mt-2 w-full"
          aria-label="Description de la playlist"
          maxLength={500}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <Button type="submit" disabled={!name.trim()}>
        Enregistrer
      </Button>
    </form>
  );
}
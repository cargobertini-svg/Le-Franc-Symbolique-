import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Home,
  Search,
  BadgeCheck,
  Plus,
  Play,
  Pause,
  Heart,
  Repeat2,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  ChevronDown,
  Music,
  MessageSquare,
  Share2,
  Mic2,
  Maximize2,
  Upload,
  Library,
  Loader2,
  Download,
  ListMusic,
  SlidersHorizontal,
  Timer,
  Gift,
  Wallet,
  Trash2,
  Check,
  User,
  ArrowUpRight,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  type Track,
  fetchTrending,
  fetchItunes,
  searchAll,
  colorFor,
  fmt,
  compact,
} from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAudio, FREQUENCIES } from "./useAudio";
import { PlaylistEditor } from "./PlaylistEditor";
import { addToPlaylist, moveTrack, portableTrack, type Playlist } from "@/lib/music-library";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { loadAudio, saveAudio, deleteAudio } from "@/lib/local-music";
import {
  earnFs,
  FCFA_PER_FS,
  GIFTS,
  REFERRAL_FS,
  SLEEP_MINUTES,
  canWithdraw,
  parseLrc,
} from "@/lib/fs-rules";

type View = "home" | "explore" | "library" | "profile" | "creator";
type Panel =
  | "comments"
  | "queue"
  | "equalizer"
  | "timer"
  | "playlist"
  | "gift"
  | "withdraw"
  | "studio"
  | "edit"
  | "playlist-edit"
  | null;

type Comment = { id: string; trackId: string; time: number; text: string; author: string };
type Profile = { name: string; username: string; bio: string; photo: string };
const NAV = [
  { id: "home", icon: Home, label: "Découvrir" },
  { id: "explore", icon: Search, label: "Explorer" },
  { id: "library", icon: Library, label: "Bibliothèque" },
  { id: "profile", icon: User, label: "Profil / Studio" },
] as const;
function IconButton({
  label,
  children,
  onClick,
  active = false,
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`shrink-0 rounded-full ${active ? "text-gold" : "text-foreground"}`}
    >
      {children}
    </Button>
  );
}
function Cover({ t, className = "" }: { t: Pick<Track, "cover" | "title">; className?: string }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [t.cover]);
  return t.cover && !bad ? (
    <img
      src={t.cover}
      alt={t.title}
      loading="lazy"
      onError={() => setBad(true)}
      className={`object-cover ${className}`}
    />
  ) : (
    <div className={`cover-fallback grid place-items-center ${className}`}>
      <Music className="h-1/3 w-1/3 text-gold" />
    </div>
  );
}
function Progress({ ratio, onSeek }: { ratio: number; onSeek: (v: number) => void }) {
  return (
    <div
      className="progress-control group relative flex h-6 w-full min-w-0 items-center"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="progress-track h-1 w-full rounded-full group-hover:h-1.5">
        <div
          className="h-full rounded-full bg-gold"
          style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }}
        />
      </div>
      <input
        aria-label="Position de lecture"
        type="range"
        min="0"
        max="1"
        step="0.001"
        value={Math.min(1, Math.max(0, ratio || 0))}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="progress-input absolute inset-0 h-6 w-full cursor-pointer"
      />
    </div>
  );
}
function Lyrics({ text, time }: { text: string; time: number }) {
  const lines = useMemo(() => parseLrc(text), [text]);
  const active = lines.reduce((a, l, i) => (l.time <= time ? i : a), -1);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({
        block: "center",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      });
  }, [active]);
  return (
    <div ref={ref} className="lyrics-view h-full overflow-y-auto px-5 py-12 text-center">
      {lines.length ? (
        lines.map((l, i) => (
          <p
            key={`${l.time}-${i}`}
            data-active={i === active}
            className={`my-5 text-2xl font-bold ${i === active ? "text-gold" : "text-muted-foreground"}`}
          >
            {l.text}
          </p>
        ))
      ) : (
        <p className="text-muted-foreground">
          Aucune parole synchronisée disponible pour ce titre.
        </p>
      )}
    </div>
  );
}

export default function LfsApp() {
  const mobile = useIsMobile();
  const [view, setView] = useState<View>("home");
  const [panel, setPanel] = useState<Panel>(null);
  const [artist, setArtist] = useState("");
  const [trending, setTrending] = useState<Track[]>([]);
  const [afro, setAfro] = useState<Track[]>([]);
  const [hits, setHits] = useState<Track[]>([]);
  const [mine, setMine] = useState<Track[]>([]);
  const [downloads, setDownloads] = useState<Track[]>([]);
  const [queue, setQueue] = useState<Track[]>([]);
  const [current, setCurrent] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [crossfade, setCrossfade] = useState(false);
  const [lowData, setLowData] = useState(false);
  const [likes, setLikes] = useState<Record<string, boolean>>({});
  const [follows, setFollows] = useState<Record<string, boolean>>({});
  const [reposts, setReposts] = useState<Record<string, boolean>>({});
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [lrc, setLrc] = useState<Record<string, string>>({});
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState<{ text: string; amount: number }[]>([]);
  const [profile, setProfile] = useState<Profile>({
    name: "Mon profil",
    username: "auditeur-fs",
    bio: "",
    photo: "",
  });
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [libraryTab, setLibraryTab] = useState("Téléchargements");
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [target, setTarget] = useState<Track | null>(null);
  const [draft, setDraft] = useState("");
  const [playlistName, setPlaylistName] = useState("");
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [sleepUntil, setSleepUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [amount, setAmount] = useState(500);
  const [phone, setPhone] = useState("");
  const [provider, setProvider] = useState("Orange Money");
  const [online, setOnline] = useState(true);
  const [savedTracks, setSavedTracks] = useState<Track[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Playlist | null>(null);
  const initialLink = useRef<{ track: string | null; playlist: string | null } | null>(null);
  const all = useMemo(
    () =>
      Array.from(
        new Map(
          [...savedTracks, ...results, ...mine, ...downloads, ...trending, ...afro, ...hits].map(
            (t) => [t.id, t],
          ),
        ).values(),
      ),
    [savedTracks, results, mine, downloads, trending, afro, hits],
  );
  const step = (direction = 1) => {
    if (!current) return;
    const list = queue.length ? queue : all;
    if (!list.length) {
      setPlaying(false);
      return;
    }
    const i = list.findIndex((t) => t.id === current.id);
    const candidates = list.filter((t) => t.id !== current.id);
    const t =
      shuffle && direction > 0
        ? (candidates[Math.floor(Math.random() * candidates.length)] ?? current)
        : list[(i + direction + list.length) % list.length];
    if (t) {
      setCurrent(t);
      setPlaying(true);
    }
  };
  const engine = useAudio(
    current,
    playing,
    setPlaying,
    () => step(1),
    repeat,
    crossfade,
    volume,
    () => setBalance((v) => v + earnFs(1)),
  );
  const { progress, duration, seek } = engine;
  const ratio = duration ? progress / duration : 0;
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    initialLink.current = { track: q.get("track"), playlist: q.get("playlist") };
    try {
      const saved = JSON.parse(localStorage.getItem("lfs-personal") || "null");
      if (saved) {
        setSavedTracks(saved.tracks || []);
        setLowData(!!saved.preferences?.lowData);
        setVolume(saved.preferences?.volume ?? 0.85);
        setCrossfade(!!saved.preferences?.crossfade);
        setLikes(saved.likes || {});
        setFollows(saved.follows || {});
        setReposts(saved.reposts || {});
        setPlaylists(saved.playlists || []);
        setComments(saved.comments || []);
        setLrc(saved.lrc || {});
        setProfile(saved.profile || profile);
        setBalance(saved.balance || 0);
        setHistory(saved.history || []);
      }
    } catch {
      toast.error("Les données locales n’ont pas pu être restaurées.");
    }
    setReady(true);
    loadAudio()
      .then((rows) => {
        setDownloads(rows);
        setMine(rows.filter((t) => t.source === "exclusif"));
      })
      .catch(() => toast.error("Le stockage hors-ligne est indisponible."));
    void refreshCatalogs();
    const connection = () => setOnline(navigator.onLine);
    connection();
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    return () => {
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(
        "lfs-personal",
        JSON.stringify({
          likes,
          follows,
          reposts,
          playlists: playlists.map((p) => ({ ...p, tracks: p.tracks.map(portableTrack) })),
          tracks: savedTracks.map(portableTrack),
          preferences: { lowData, volume, crossfade },
          comments,
          lrc,
          profile,
          balance,
          history,
        }),
      );
    } catch {
      toast.error("Stockage local plein.");
    }
  }, [
    ready,
    likes,
    follows,
    reposts,
    playlists,
    savedTracks,
    lowData,
    volume,
    crossfade,
    comments,
    lrc,
    profile,
    balance,
    history,
  ]);
  useEffect(() => {
    if (!current && all.length) {
      setCurrent(all[0] ?? null);
      setQueue(all.slice(0, 30));
    }
  }, [all, current]);
  useEffect(() => {
    const link = initialLink.current;
    if (!link) return;
    if (link.playlist) {
      const p = playlists.find((p) => p.id === link.playlist);
      setView("library");
      setLibraryTab("Playlists");
      if (p) {
        setSelectedPlaylist(p.id);
        setQueue(p.tracks);
        setCurrent(p.tracks[0] ?? null);
      } else if (ready) toast.info("Cette playlist n’est pas enregistrée sur cet appareil.");
      link.playlist = null;
    }
    if (link.track) {
      const t = all.find((t) => t.id === link.track);
      if (t) {
        setCurrent(t);
        setExpanded(true);
        link.track = null;
      } else if (link.track.startsWith("aud-")) {
        const id = link.track.slice(4);
        link.track = null;
        fetch(
          `https://discoveryprovider.audius.co/v1/tracks/${encodeURIComponent(id)}?app_name=LeFrancSymbolique`,
        )
          .then((r) => r.json())
          .then((j) => {
            if (!j.data) return;
            const t: Track = {
              id: `aud-${j.data.id}`,
              title: j.data.title,
              artist: j.data.user?.name || "Créateur",
              cover: j.data.artwork?.["480x480"] || "",
              url: `https://discoveryprovider.audius.co/v1/tracks/${j.data.id}/stream?app_name=LeFrancSymbolique`,
              duration: j.data.duration,
              source: "audius",
              plays: j.data.play_count || 0,
              likes: j.data.favorite_count || 0,
              color: colorFor(id),
            };
            setCurrent(t);
            setExpanded(true);
          })
          .catch(() => toast.error("Lien indisponible."));
      } else if (link.track.startsWith("itu-")) {
        const id = link.track.slice(4);
        link.track = null;
        fetch(`https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}`)
          .then((r) => r.json())
          .then((j) => {
            const t = j.results?.[0];
            if (t?.previewUrl) {
              setCurrent({
                id: `itu-${t.trackId}`,
                title: t.trackName,
                artist: t.artistName,
                cover: t.artworkUrl100,
                url: t.previewUrl,
                duration: 30,
                source: "itunes",
                plays: 0,
                likes: 0,
                color: colorFor(id),
              });
              setExpanded(true);
            }
          })
          .catch(() => toast.error("Lien indisponible."));
      }
    }
  }, [all, playlists, ready]);
  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(
      () =>
        searchAll(search).then((r) => {
          if (!cancelled) {
            setResults(r);
            setSearching(false);
          }
        }),
      350,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);
  useEffect(() => {
    if (!sleepUntil) {
      setCountdown(0);
      return;
    }
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((sleepUntil - Date.now()) / 1000));
      setCountdown(left);
      if (!left) {
        setPlaying(false);
        setSleepUntil(null);
        toast.info("Minuterie terminée.");
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [sleepUntil]);
  const refreshCatalogs = async () => {
    setCatalogLoading(true);
    try {
      const [a, b, c] = await Promise.all([
        fetchTrending(),
        fetchItunes("afrobeats"),
        fetchItunes("makossa", 12),
      ]);
      setTrending(a);
      setAfro(b);
      setHits(c);
      if (!a.length && !b.length && !c.length)
        toast.error("Les catalogues sont indisponibles. Vos titres locaux restent accessibles.");
    } finally {
      setCatalogLoading(false);
    }
  };
  const flip = (setter: typeof setLikes, id: string) => {
    const track = all.find((t) => t.id === id);
    if (track)
      setSavedTracks((v) => (v.some((x) => x.id === id) ? v : [...v, portableTrack(track)]));
    setter((v) => ({ ...v, [id]: !v[id] }));
  };
  const play = (t: Track, list?: Track[]) => {
    const local = downloads.find((d) => d.id === t.id);
    if (!(local ?? t).url) {
      toast.error("Ce fichier local n’est plus disponible. Réimportez-le depuis le Studio.");
      return;
    }
    setCurrent(local ?? t);
    if (list) setQueue(list.map((x) => downloads.find((d) => d.id === x.id) ?? x));
    setPlaying(true);
  };
  const openArtist = (name: string) => {
    setArtist(name);
    setView("creator");
    setExpanded(false);
  };
  const copy = async (url: string, message = "Lien copié") => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(message);
    } catch {
      toast.error("Copie indisponible dans ce navigateur.");
    }
  };
  const shareTrack = (t: Track) => {
    if (t.source === "exclusif") {
      toast.info(
        "Ce son est local : son lien ne permet pas encore de l’écouter sur un autre appareil.",
      );
      return;
    }
    void copy(`${location.origin}/?track=${encodeURIComponent(t.id)}`);
  };
  const openPanel = (p: Panel, t: Track | null = current) => {
    setTarget(t);
    setPanel(p);
    setDraft("");
  };
  const download = async (t: Track) => {
    if (downloading[t.id]) return;
    setDownloading((v) => ({ ...v, [t.id]: true }));
    try {
      await saveAudio(t);
      const rows = await loadAudio();
      setDownloads(rows);
      toast.success(
        t.source === "itunes" ? "Extrait de 30 secondes téléchargé" : "Titre disponible hors-ligne",
      );
    } catch {
      toast.error("Téléchargement refusé ou réseau indisponible. Aucun audio n’a été enregistré.");
    } finally {
      setDownloading((v) => ({ ...v, [t.id]: false }));
    }
  };
  const addPlaylist = (p: Playlist) => {
    if (!target) return;
    if (p.tracks.some((t) => t.id === target.id)) {
      toast.info("Ce titre est déjà dans la playlist.");
      return;
    }
    setPlaylists((rows) => rows.map((row) => (row.id === p.id ? addToPlaylist(row, target) : row)));
    toast.success(`Ajouté à ${p.name}`);
    setPanel(null);
  };
  const trackComments = comments.filter((c) => c.trackId === target?.id);
  const liveComment = comments
    .filter((c) => c.trackId === current?.id && progress >= c.time && progress < c.time + 4)
    .at(-1);
  const personalTracks = mine;
  const artistTracks = all.filter((t) => t.artist === artist);
  const profileStats = {
    plays: personalTracks.reduce((a, t) => a + t.plays, 0),
    followers: 0,
    published: personalTracks.length,
    popular: [...personalTracks].sort((a, b) => b.plays - a.plays)[0],
  };
  const actions = (t: Track) => (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <IconButton label="Ajouter à une playlist" onClick={() => openPanel("playlist", t)}>
        <Plus />
      </IconButton>
      <IconButton
        label={downloads.some((d) => d.id === t.id) ? "Déjà téléchargé" : "Télécharger"}
        active={downloads.some((d) => d.id === t.id)}
        disabled={!!downloading[t.id]}
        onClick={() => void download(t)}
      >
        {downloading[t.id] ? (
          <Loader2 className="animate-spin" />
        ) : downloads.some((d) => d.id === t.id) ? (
          <Check />
        ) : (
          <Download />
        )}
      </IconButton>
      <IconButton label="J’aime" active={!!likes[t.id]} onClick={() => flip(setLikes, t.id)}>
        <Heart className={likes[t.id] ? "fill-current" : ""} />
      </IconButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Autres actions" title="Autres actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="z-[80]" align="end">
          <DropdownMenuItem
            onSelect={() => {
              setQueue((v) => (v.some((x) => x.id === t.id) ? v : [...v, t]));
              toast.success("Titre ajouté à la file d’attente");
            }}
          >
            <ListMusic />
            Ajouter à la file
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openPanel("comments", t)}>
            <MessageSquare />
            Commentaires
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => flip(setReposts, t.id)}>
            <Repeat2 />
            {reposts[t.id] ? "Annuler le repost" : "Republier localement"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openArtist(t.artist)}>
            <User />
            Voir le créateur
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => shareTrack(t)}>
            <Share2 />
            Partager le lien
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
  const trackRow = (t: Track, list: Track[], remove?: () => void) => (
    <div key={t.id} className="flex items-center gap-3 border-b border-border py-3">
      <Button
        variant="ghost"
        className="h-auto min-w-0 flex-1 justify-start px-0"
        onClick={() => play(t, list)}
      >
        <Cover t={t} className="h-12 w-12 shrink-0 rounded-lg" />
        <span className="min-w-0 text-left">
          <span
            className={`block truncate font-semibold ${current?.id === t.id ? "text-gold" : ""}`}
          >
            {t.title}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{t.artist}</span>
        </span>
      </Button>
      {actions(t)}
      {remove && (
        <IconButton label="Supprimer" onClick={remove}>
          <Trash2 />
        </IconButton>
      )}
    </div>
  );
  const card = (t: Track, list: Track[]) => (
    <article key={t.id} className="group min-w-0">
      <Button
        variant="ghost"
        className="relative h-auto w-full p-0"
        aria-label={`Écouter ${t.title}`}
        onClick={() => play(t, list)}
      >
        <Cover t={t} className="aspect-square w-full rounded-lg" />
        <span className="absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-gold text-primary-foreground">
          <Play className="fill-current" />
        </span>
      </Button>
      <p className={`mt-2 truncate text-sm font-bold ${current?.id === t.id ? "text-gold" : ""}`}>
        {t.title}
      </p>
      <Button
        variant="link"
        className="h-6 max-w-full justify-start truncate p-0 text-xs text-muted-foreground"
        onClick={() => openArtist(t.artist)}
      >
        {t.artist}
      </Button>
      {actions(t)}
    </article>
  );
  const playerTools = () => (
    <div className="flex flex-wrap items-center justify-center gap-1">
      <IconButton label="Aléatoire" active={shuffle} onClick={() => setShuffle(!shuffle)}>
        <Shuffle />
      </IconButton>
      <IconButton label="Répéter le titre" active={repeat} onClick={() => setRepeat(!repeat)}>
        <Repeat />
      </IconButton>
      <IconButton label="File d’attente" onClick={() => openPanel("queue")}>
        <ListMusic />
      </IconButton>
      <IconButton label="Égaliseur" onClick={() => openPanel("equalizer")}>
        <SlidersHorizontal />
      </IconButton>
      <IconButton label="Minuterie" active={!!sleepUntil} onClick={() => openPanel("timer")}>
        <Timer />
      </IconButton>
      <IconButton label="Commentaires" onClick={() => openPanel("comments")}>
        <MessageSquare />
      </IconButton>
      <IconButton label="Envoyer un cadeau" onClick={() => openPanel("gift")}>
        <Gift />
      </IconButton>
      {current && actions(current)}
    </div>
  );
  const lowToggle = (
    <label className="flex items-center justify-between gap-4 py-3 text-sm">
      <span>Économie de données</span>
      <Switch
        aria-label="Économie de données"
        checked={lowData}
        onCheckedChange={(v) => {
          setLowData(v);
          toast.info(
            v
              ? "Préchargement évité. Le débit reste celui du catalogue ; 64 kbps nécessite un service de conversion."
              : "Mode standard activé",
          );
        }}
      />
    </label>
  );
  const playlist = playlists.find((p) => p.id === selectedPlaylist);
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-root text-foreground">
      <Toaster position="top-center" />
      <div className="flex min-h-0 flex-1 md:gap-2 md:p-2">
        <aside className="hidden w-60 shrink-0 flex-col bg-panel px-4 py-5 md:flex">
          <div className="mb-8 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-gold-gradient font-extrabold text-primary-foreground">
              FS
            </span>
            <div>
              <p className="text-sm font-extrabold">LE FRANC</p>
              <p className="text-xs font-bold text-gold">SYMBOLIQUE</p>
            </div>
          </div>
          <nav aria-label="Navigation principale" className="space-y-2">
            {NAV.map((n) => (
              <Button
                key={n.id}
                aria-current={
                  view === n.id || (view === "creator" && n.id === "profile") ? "page" : undefined
                }
                variant="ghost"
                onClick={() => setView(n.id)}
                className={`w-full justify-start ${view === n.id ? "bg-mini text-gold" : "text-muted-foreground"}`}
              >
                <n.icon />
                {n.label}
              </Button>
            ))}
          </nav>
          <div className="mt-8 flex items-center justify-between">
            <h2 className="text-sm font-bold">Ma bibliothèque</h2>
            <IconButton label="Créer une playlist" onClick={() => openPanel("playlist", null)}>
              <Plus />
            </IconButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {playlists.map((p) => (
              <Button
                key={p.id}
                variant="ghost"
                className="mt-2 w-full justify-start"
                onClick={() => {
                  setView("library");
                  setLibraryTab("Playlists");
                  setSelectedPlaylist(p.id);
                }}
              >
                <ListMusic />
                <span className="truncate">{p.name}</span>
              </Button>
            ))}
            {queue.slice(0, 8).map((t) => (
              <Button
                key={t.id}
                variant="ghost"
                onClick={() => play(t)}
                className="mt-2 h-auto w-full justify-start px-1"
              >
                <Cover t={t} className="h-10 w-10 shrink-0 rounded-lg" />
                <span className="min-w-0 text-left">
                  <span className="block truncate text-xs">{t.title}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {t.artist}
                  </span>
                </span>
              </Button>
            ))}
          </div>
          <Button variant="outline" onClick={() => openPanel("studio")}>
            <Upload />
            Publier un son
          </Button>
        </aside>
        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-panel md:rounded-lg">
          <header className="z-20 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-panel/90 px-4 backdrop-blur-xl">
            <span className="font-extrabold text-gold md:hidden">FS</span>
            <h1 className="min-w-0 flex-1 truncate text-sm font-bold">
              {view === "home"
                ? "Le Franc Symbolique"
                : view === "creator"
                  ? artist
                  : NAV.find((n) => n.id === view)?.label}
            </h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setView("profile");
                setExpanded(false);
              }}
              className="text-gold"
            >
              <Wallet />
              <span className="tabular-nums">{compact(balance)} FS</span>
              <span className="hidden lg:inline text-muted-foreground">· simulation</span>
            </Button>
            <IconButton label="Publier un son" onClick={() => openPanel("studio")}>
              <Plus />
            </IconButton>
          </header>
          {!online && (
            <div className="bg-mini px-4 py-2 text-xs text-gold">
              Hors-ligne · vos téléchargements restent disponibles
            </div>
          )}
          {view === "home" ? (
            <Feed
              loading={catalogLoading}
              onRetry={() => void refreshCatalogs()}
              tracks={all.filter((t) => t.url || downloads.some((d) => d.id === t.id)).slice(0, 30)}
              current={current}
              playing={playing}
              ratio={ratio}
              progress={progress}
              duration={duration}
              onSeek={seek}
              onPlay={(t) => play(t, all)}
              onToggle={() => setPlaying(!playing)}
              onArtist={openArtist}
              likes={likes}
              follows={follows}
              reposts={reposts}
              comments={comments}
              onLike={(id) => flip(setLikes, id)}
              onFollow={(id) => flip(setFollows, id)}
              onRepost={(id) => flip(setReposts, id)}
              onPanel={openPanel}
              onShare={shareTrack}
              onFull={(t) => {
                if (current?.id !== t.id) play(t, all);
                setExpanded(true);
              }}
              liveComment={liveComment}
            />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-32 pt-5 md:px-6">
              {view === "explore" && (
                <>
                  <div className="relative mb-6">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                      aria-label="Rechercher un titre ou un créateur"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Titres, artistes, créateurs…"
                      className="form-input w-full pl-10"
                    />
                  </div>
                  {search ? (
                    <>
                      <h2 className="mb-4 truncate text-xl font-bold">
                        Résultats pour « {search} »
                      </h2>
                      {searching ? (
                        <Loader2 className="animate-spin text-gold" />
                      ) : !results.length ? (
                        <p className="text-muted-foreground">Aucun résultat.</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                          {results.map((t) => card(t, results))}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {[
                        { title: "Exclusivités du Studio", list: mine },
                        { title: "Tendances Audius", list: trending },
                        { title: "Afrobeats du moment", list: afro },
                        { title: "Héritage Makossa", list: hits },
                      ]
                        .filter((s) => s.list.length)
                        .map((s) => (
                          <section key={s.title} className="mb-8">
                            <h2 className="mb-4 text-xl font-bold">{s.title}</h2>
                            <div className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto md:grid md:grid-cols-3 lg:grid-cols-4">
                              {s.list.slice(0, 12).map((t) => (
                                <div key={t.id} className="w-40 shrink-0 snap-start md:w-auto">
                                  {card(t, s.list)}
                                </div>
                              ))}
                            </div>
                          </section>
                        ))}
                      {!all.length &&
                        (catalogLoading ? (
                          <p role="status" className="text-muted-foreground">
                            Chargement des catalogues…
                          </p>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-muted-foreground">
                              Aucun catalogue disponible actuellement.
                            </p>
                            <Button variant="outline" onClick={() => void refreshCatalogs()}>
                              Réessayer
                            </Button>
                          </div>
                        ))}
                    </>
                  )}
                </>
              )}
              {view === "library" && (
                <>
                  <div className="mb-5 flex flex-wrap items-center gap-2">
                    {["Téléchargements", "Titres aimés", "Playlists", "Reposts"].map((tab) => (
                      <Button
                        key={tab}
                        variant={libraryTab === tab ? "default" : "ghost"}
                        size="sm"
                        onClick={() => {
                          setLibraryTab(tab);
                          setSelectedPlaylist(null);
                        }}
                      >
                        {tab}
                      </Button>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => openPanel("playlist", null)}>
                      <Plus />
                      Créer une playlist
                    </Button>
                  </div>
                  {libraryTab === "Téléchargements" && (
                    <>
                      {!downloads.length && (
                        <p className="text-muted-foreground">
                          Aucun téléchargement sur cet appareil.
                        </p>
                      )}
                      {downloads.map((t) =>
                        trackRow(
                          t,
                          downloads,
                          () =>
                            void deleteAudio(t.id)
                              .then(() => {
                                setDownloads((v) => v.filter((x) => x.id !== t.id));
                                setMine((v) => v.filter((x) => x.id !== t.id));
                                toast.success("Fichier retiré de cet appareil");
                              })
                              .catch(() => toast.error("Suppression impossible.")),
                        ),
                      )}
                    </>
                  )}
                  {libraryTab === "Titres aimés" && (
                    <>
                      {!all.some((t) => likes[t.id]) && (
                        <p className="text-muted-foreground">Aucun titre aimé.</p>
                      )}
                      {all
                        .filter((t) => likes[t.id])
                        .map((t) =>
                          trackRow(
                            t,
                            all.filter((t) => likes[t.id]),
                          ),
                        )}
                    </>
                  )}
                  {libraryTab === "Reposts" && (
                    <>
                      <p className="mb-4 text-xs text-muted-foreground">
                        Reposts personnels enregistrés sur cet appareil.
                      </p>
                      {!all.some((t) => reposts[t.id]) && (
                        <p className="text-muted-foreground">Aucun repost.</p>
                      )}
                      {all
                        .filter((t) => reposts[t.id])
                        .map((t) =>
                          trackRow(
                            t,
                            all.filter((t) => reposts[t.id]),
                          ),
                        )}
                    </>
                  )}
                  {libraryTab === "Playlists" && (
                    <>
                      {playlist ? (
                        <>
                          <div className="mb-4 flex flex-wrap gap-2">
                            <Button variant="ghost" onClick={() => setSelectedPlaylist(null)}>
                              Toutes les playlists
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() =>
                                void copy(
                                  `${location.origin}/?playlist=${playlist.id}`,
                                  "Lien copié · playlist locale à cet appareil",
                                )
                              }
                            >
                              <Share2 />
                              Partager le lien
                            </Button>
                          </div>
                          <h2 className="break-words text-xl font-bold">{playlist.name}</h2>
                          <p className="my-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                            {playlist.description ||
                              `${playlist.tracks.length} titres · playlist locale`}
                          </p>
                          <div className="mb-4 flex flex-wrap gap-2">
                            <Button
                              disabled={!playlist.tracks.length}
                              onClick={() => {
                                const first = playlist.tracks[0];
                                if (first) play(first, playlist.tracks);
                              }}
                            >
                              <Play />
                              Lire la playlist
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => openPanel("playlist-edit", null)}
                            >
                              Modifier
                            </Button>
                            <IconButton
                              label="Supprimer la playlist"
                              onClick={() => setDeleteTarget(playlist)}
                            >
                              <Trash2 />
                            </IconButton>
                          </div>
                          {playlist.tracks.map((t, i) => (
                            <div key={t.id} className="flex items-center gap-1">
                              <div className="min-w-0 flex-1">
                                {trackRow(t, playlist.tracks, () => {
                                  setPlaylists((v) =>
                                    v.map((p) =>
                                      p.id === playlist.id
                                        ? { ...p, tracks: p.tracks.filter((x) => x.id !== t.id) }
                                        : p,
                                    ),
                                  );
                                  toast.success("Titre retiré de la playlist");
                                })}
                              </div>
                              <div className="flex flex-col">
                                <IconButton
                                  label="Monter le titre"
                                  disabled={i === 0}
                                  onClick={() =>
                                    setPlaylists((v) =>
                                      v.map((p) =>
                                        p.id === playlist.id ? moveTrack(p, t.id, -1) : p,
                                      ),
                                    )
                                  }
                                >
                                  <ArrowUp />
                                </IconButton>
                                <IconButton
                                  label="Descendre le titre"
                                  disabled={i === playlist.tracks.length - 1}
                                  onClick={() =>
                                    setPlaylists((v) =>
                                      v.map((p) =>
                                        p.id === playlist.id ? moveTrack(p, t.id, 1) : p,
                                      ),
                                    )
                                  }
                                >
                                  <ArrowDown />
                                </IconButton>
                              </div>
                            </div>
                          ))}
                          {!playlist.tracks.length && (
                            <p className="mt-4 text-muted-foreground">Cette playlist est vide.</p>
                          )}
                        </>
                      ) : (
                        <>
                          {!playlists.length && (
                            <p className="text-muted-foreground">Aucune playlist créée.</p>
                          )}
                          {playlists.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between border-b border-border py-3"
                            >
                              <Button
                                variant="ghost"
                                className="min-w-0"
                                onClick={() => setSelectedPlaylist(p.id)}
                              >
                                <ListMusic />
                                <span className="truncate">
                                  {p.name} · {p.tracks.length} titres
                                </span>
                              </Button>
                              <IconButton
                                label="Supprimer la playlist"
                                onClick={() => setDeleteTarget(p)}
                              >
                                <Trash2 />
                              </IconButton>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </>
              )}
              {view === "creator" && (
                <>
                  <div className="flex items-end gap-4 py-6">
                    {artistTracks[0] && (
                      <Cover t={artistTracks[0]} className="h-24 w-24 shrink-0 rounded-full" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs text-gold">Artiste du catalogue</p>
                      <h2 className="truncate text-2xl font-extrabold md:text-4xl">{artist}</h2>
                      <p className="text-sm text-muted-foreground">
                        {compact(artistTracks.reduce((s, t) => s + t.plays, 0))} écoutes catalogue
                      </p>
                    </div>
                  </div>
                  <Button
                    variant={follows[artist] ? "outline" : "default"}
                    onClick={() => flip(setFollows, artist)}
                  >
                    {follows[artist] ? <Check /> : <Plus />}
                    {follows[artist] ? "Abonné" : "Suivre"}
                  </Button>
                  <h2 className="mb-4 mt-8 text-xl font-bold">Discographie</h2>
                  {artistTracks.map((t) => trackRow(t, artistTracks))}
                  {!artistTracks.length && (
                    <p className="text-muted-foreground">Aucun titre chargé pour ce créateur.</p>
                  )}
                </>
              )}
              {view === "profile" && (
                <>
                  <section className="border-b border-border pb-6">
                    <div className="flex items-center gap-4">
                      <Cover
                        t={{ cover: profile.photo, title: profile.name }}
                        className="h-20 w-20 shrink-0 rounded-full"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gold">Profil personnel · local</p>
                        <h2 className="truncate text-2xl font-extrabold">{profile.name}</h2>
                        <p className="truncate text-sm text-muted-foreground">
                          @{profile.username}
                        </p>
                      </div>
                    </div>
                    <p className="my-4 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {profile.bio || "Ma bio"}
                    </p>
                    <p className="mb-4 text-xs text-muted-foreground">
                      0 abonnés · {Object.values(follows).filter(Boolean).length} abonnements ·{" "}
                      {compact(profileStats.plays)} écoutes de mes créations
                    </p>
                    <Button variant="outline" onClick={() => openPanel("edit")}>
                      <User />
                      Modifier le profil
                    </Button>
                  </section>
                  <section className="border-b border-border py-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold">Wallet FS</h2>
                      <span className="text-xs text-muted-foreground">Simulation locale</span>
                    </div>
                    <p className="mt-4 text-4xl font-extrabold tabular-nums text-gold">
                      {balance.toLocaleString("fr-FR")} <span className="text-lg">FS</span>
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {(balance * FCFA_PER_FS).toLocaleString("fr-FR")} FCFA · 1 seconde écoutée = 1
                      FS
                    </p>
                    <Button className="mt-4" onClick={() => openPanel("withdraw")}>
                      <ArrowUpRight />
                      Retirer mes gains
                    </Button>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Aucun argent réel : les gains ne sont pas validés et les paiements ne sont pas
                      connectés.
                    </p>
                    <h3 className="mt-5 font-semibold">Historique</h3>
                    {balance > 0 && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Solde d’écoute et cadeaux local : {balance} FS
                      </p>
                    )}
                    {history.slice(0, 8).map((h, i) => (
                      <p key={i} className="mt-2 flex justify-between gap-2 text-sm">
                        <span>{h.text}</span>
                        <span className="shrink-0 text-gold">{h.amount} FS</span>
                      </p>
                    ))}
                  </section>
                  <section className="border-b border-border py-6">
                    <h2 className="mb-3 text-xl font-bold">Parrainage</h2>
                    <p className="mb-3 text-sm text-muted-foreground">
                      0 ami confirmé · +{REFERRAL_FS.toLocaleString("fr-FR")} FS par ami après
                      validation
                    </p>
                    <Button
                      variant="outline"
                      onClick={() =>
                        void copy(`${location.origin}/?ref=${encodeURIComponent(profile.username)}`)
                      }
                    >
                      <Share2 />
                      Copier le lien
                    </Button>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Validation du parrainage non connectée.
                    </p>
                  </section>
                  <section className="border-b border-border py-6">
                    <h2 className="mb-4 text-xl font-bold">Studio Créateur</h2>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                      {[
                        { label: "Total des écoutes", value: profileStats.plays },
                        { label: "Abonnés confirmés", value: profileStats.followers },
                        { label: "Titres publiés", value: profileStats.published },
                        { label: "Cadeaux reçus confirmés", value: 0 },
                      ].map((s) => (
                        <div key={s.label}>
                          <p className="text-2xl font-bold text-gold">{s.value}</p>
                          <p className="text-xs text-muted-foreground">{s.label}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-5 truncate text-sm">
                      Le plus populaire : {profileStats.popular?.title || "Aucun titre"}
                    </p>
                    <Button className="mt-4" onClick={() => openPanel("studio")}>
                      <Upload />
                      Publier un son
                    </Button>
                    <div className="mt-4">{mine.map((t) => trackRow(t, mine))}</div>
                  </section>
                  <section className="border-b border-border py-6">
                    <h2 className="mb-3 text-xl font-bold">Mes abonnements</h2>
                    {Object.keys(follows)
                      .filter((name) => follows[name])
                      .map((name) => (
                        <Button
                          key={name}
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => openArtist(name)}
                        >
                          <User />
                          <span className="truncate">{name}</span>
                        </Button>
                      ))}
                    {!Object.values(follows).some(Boolean) && (
                      <p className="text-sm text-muted-foreground">Aucun abonnement local.</p>
                    )}
                  </section>
                  <h2 className="mt-6 text-xl font-bold">Préférences de lecture</h2>
                  {lowToggle}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setView("library");
                      setLibraryTab("Playlists");
                    }}
                  >
                    Mes créations & playlists
                    <ListMusic />
                  </Button>
                </>
              )}
            </div>
          )}
        </main>
      </div>
      {current && (
        <footer className="hidden shrink-0 items-center gap-4 border-t border-border bg-root px-4 py-2 md:flex">
          <div className="flex w-1/4 min-w-0 items-center gap-3">
            <Cover t={current} className="h-12 w-12 shrink-0 rounded-lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{current.title}</p>
              <Button
                variant="link"
                className="h-5 max-w-full truncate p-0 text-xs text-muted-foreground"
                onClick={() => openArtist(current.artist)}
              >
                {current.artist}
              </Button>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-center gap-2">
              <IconButton label="Aléatoire" active={shuffle} onClick={() => setShuffle(!shuffle)}>
                <Shuffle />
              </IconButton>
              <IconButton label="Précédent" onClick={() => step(-1)}>
                <SkipBack />
              </IconButton>
              <Button
                size="icon"
                className="rounded-full"
                aria-label={playing ? "Pause" : "Lecture"}
                onClick={() => setPlaying(!playing)}
              >
                {playing ? <Pause /> : <Play />}
              </Button>
              <IconButton label="Suivant" onClick={() => step()}>
                <SkipForward />
              </IconButton>
              <IconButton
                label="Répéter le titre"
                active={repeat}
                onClick={() => setRepeat(!repeat)}
              >
                <Repeat />
              </IconButton>
            </div>
            <div className="flex items-center gap-2 text-[10px] tabular-nums text-muted-foreground">
              <span>{fmt(progress)}</span>
              <Progress ratio={ratio} onSeek={seek} />
              <span>{fmt(duration)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <IconButton label="File d’attente" onClick={() => openPanel("queue")}>
              <ListMusic />
            </IconButton>
            <IconButton label="Égaliseur" onClick={() => openPanel("equalizer")}>
              <SlidersHorizontal />
            </IconButton>
            <IconButton
              label="Paroles"
              onClick={() => {
                setExpanded(true);
                setShowLyrics(true);
              }}
            >
              <Mic2 />
            </IconButton>
            <IconButton label="Télécharger" onClick={() => void download(current)}>
              <Download />
            </IconButton>
            <IconButton label="Plein écran" onClick={() => setExpanded(true)}>
              <Maximize2 />
            </IconButton>
            <span className="hidden xl:flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              <input
                aria-label="Volume"
                type="range"
                min="0"
                max="1"
                step=".01"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-20 accent-gold"
              />
            </span>
          </div>
        </footer>
      )}
      {current && view !== "home" && (
        <div className="fixed inset-x-2 bottom-[68px] z-30 flex h-14 items-center gap-2 overflow-hidden rounded-lg bg-mini px-2 md:hidden">
          <Button
            variant="ghost"
            onClick={() => setExpanded(true)}
            className="h-auto min-w-0 flex-1 justify-start p-0"
          >
            <Cover t={current} className="h-10 w-10 shrink-0 rounded-md" />
            <span className="min-w-0 text-left">
              <span className="block truncate text-xs font-bold">{current.title}</span>
              <span className="block truncate text-[10px] text-muted-foreground">
                {current.artist}
              </span>
            </span>
          </Button>
          <IconButton label={playing ? "Pause" : "Lecture"} onClick={() => setPlaying(!playing)}>
            {playing ? <Pause /> : <Play />}
          </IconButton>
          <div className="absolute inset-x-2 bottom-0 h-1 progress-track">
            <div className="h-full bg-gold" style={{ width: `${ratio * 100}%` }} />
          </div>
        </div>
      )}
      <nav
        aria-label="Navigation mobile"
        className="z-30 grid h-16 shrink-0 grid-cols-4 border-t border-border bg-root md:hidden"
      >
        {NAV.map((n) => (
          <Button
            variant="ghost"
            key={n.id}
            aria-current={view === n.id ? "page" : undefined}
            onClick={() => setView(n.id)}
            className={`h-16 min-w-0 flex-col gap-1 rounded-none px-1 text-[10px] ${view === n.id ? "text-gold" : "text-muted-foreground"}`}
          >
            <n.icon />
            <span className="max-w-full truncate">
              {n.id === "profile" ? "Profil / Studio" : n.label}
            </span>
          </Button>
        ))}
      </nav>
      <Sheet open={expanded} onOpenChange={setExpanded}>
        <SheetContent
          side="bottom"
          className="fullscreen-player h-dvh overflow-y-auto border-0 bg-sheet p-0"
          aria-describedby={undefined}
        >
          <SheetTitle className="sr-only">Lecteur Le Franc Symbolique</SheetTitle>
          {current && (
            <>
              <Cover
                t={current}
                className="pointer-events-none absolute inset-0 h-full w-full scale-110 opacity-20 blur-3xl"
              />
              <div className="relative mx-auto flex min-h-full max-w-lg flex-col px-5 pb-8 pt-5">
                <div className="flex items-center justify-between">
                  <IconButton label="Réduire le lecteur" onClick={() => setExpanded(false)}>
                    <ChevronDown />
                  </IconButton>
                  <p className="text-[10px] font-bold text-gold">LE FRANC SYMBOLIQUE</p>
                  <IconButton
                    label="Paroles"
                    active={showLyrics}
                    onClick={() => setShowLyrics(!showLyrics)}
                  >
                    <Mic2 />
                  </IconButton>
                </div>
                <div className="mx-auto my-5 aspect-square w-full max-w-[290px] overflow-hidden">
                  {showLyrics ? (
                    <Lyrics text={lrc[current.id] || ""} time={progress} />
                  ) : (
                    <Cover t={current} className="h-full w-full rounded-lg" />
                  )}
                </div>
                <div className="flex min-w-0 items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-2xl font-extrabold">{current.title}</h2>
                    <Button
                      variant="link"
                      className="h-7 max-w-full truncate p-0 text-muted-foreground"
                      onClick={() => openArtist(current.artist)}
                    >
                      {current.artist}
                    </Button>
                  </div>
                  <IconButton
                    label="J’aime"
                    active={!!likes[current.id]}
                    onClick={() => flip(setLikes, current.id)}
                  >
                    <Heart className={likes[current.id] ? "fill-current" : ""} />
                  </IconButton>
                </div>
                <div className="mt-3">
                  <Progress ratio={ratio} onSeek={seek} />
                  <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
                    <span>{fmt(progress)}</span>
                    <span>{fmt(duration)}</span>
                  </div>
                </div>
                <div className="my-4 flex justify-center gap-6">
                  <IconButton label="Précédent" onClick={() => step(-1)}>
                    <SkipBack />
                  </IconButton>
                  <Button
                    size="icon"
                    className="h-14 w-14 rounded-full"
                    aria-label={playing ? "Pause" : "Lecture"}
                    onClick={() => setPlaying(!playing)}
                  >
                    {playing ? <Pause /> : <Play />}
                  </Button>
                  <IconButton label="Suivant" onClick={() => step()}>
                    <SkipForward />
                  </IconButton>
                </div>
                {playerTools()}
                <div className="mt-3 flex justify-between text-xs">
                  <span className="text-gold">Wallet simulation · {balance} FS</span>
                  <span className="text-muted-foreground">
                    {countdown
                      ? `Arrêt dans ${fmt(countdown)}`
                      : current.source === "itunes"
                        ? "Extrait 30 s"
                        : "Audio intégral"}
                  </span>
                </div>
                {lowToggle}
                <label className="flex items-center gap-3 text-xs">
                  <Volume2 className="h-4 w-4" />
                  <input
                    aria-label="Volume"
                    className="w-full accent-gold"
                    type="range"
                    min="0"
                    max="1"
                    step=".01"
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                  />
                </label>
                {showLyrics && (
                  <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-gold">
                    <Upload className="h-4 w-4" />
                    Importer les paroles (.lrc)
                    <input
                      type="file"
                      accept=".lrc,text/plain"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          const text = await f.text();
                          if (!parseLrc(text).length) {
                            toast.error("Aucun horodatage LRC valide.");
                            return;
                          }
                          setLrc((v) => ({ ...v, [current.id]: text }));
                        }
                      }}
                    />
                  </label>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <Sheet
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <SheetContent
          side={mobile ? "bottom" : "right"}
          className="z-[70] flex max-h-[88dvh] flex-col overflow-y-auto bg-panel md:h-dvh md:max-h-none md:w-[420px] md:max-w-[420px]"
          aria-describedby="panel-description"
        >
          <SheetTitle>
            {
              (
                {
                  comments: "Commentaires en direct",
                  queue: "File d’attente",
                  equalizer: "Égaliseur",
                  timer: "Minuterie de sommeil",
                  playlist: "Mes playlists",
                  gift: "Envoyer un cadeau",
                  withdraw: "Retirer mes gains",
                  studio: "Studio Créateur",
                  edit: "Modifier le profil",
                  "playlist-edit": "Modifier la playlist",
                } as Record<string, string>
              )[panel || ""]
            }
          </SheetTitle>
          <SheetDescription id="panel-description" className="text-xs">
            {panel === "comments"
              ? "Commentaires locaux à cet appareil."
              : panel === "withdraw" || panel === "gift"
                ? "Simulation locale · aucun transfert financier."
                : panel === "playlist"
                  ? "Playlists enregistrées sur cet appareil."
                  : panel === "studio"
                    ? "Votre son sera conservé sur cet appareil."
                    : target?.title || "Le Franc Symbolique"}
          </SheetDescription>
          {panel === "comments" && (
            <>
              <div className="min-h-[100px] flex-1 space-y-4 overflow-y-auto py-4">
                {!trackComments.length && (
                  <p className="text-sm text-muted-foreground">Soyez le premier à commenter.</p>
                )}
                {trackComments.map((c) => (
                  <div key={c.id}>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-6 p-0"
                      onClick={() => {
                        const t = all.find((t) => t.id === c.trackId);
                        if (!t) return;
                        if (current?.id !== t.id) {
                          play(t);
                          toast.info("Relancez ce repère après le chargement du titre.");
                        } else seek(duration ? c.time / duration : 0);
                      }}
                    >
                      {fmt(c.time)}
                    </Button>
                    <span className="ml-2 text-xs text-muted-foreground">{c.author}</span>
                    <p className="break-words text-sm">{c.text}</p>
                  </div>
                ))}
              </div>
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!target || !draft.trim()) return;
                  setComments((v) => [
                    ...v,
                    {
                      id: crypto.randomUUID(),
                      trackId: target.id,
                      time: current?.id === target.id ? Math.floor(progress) : 0,
                      text: draft.trim(),
                      author: profile.name,
                    },
                  ]);
                  setSavedTracks((v) =>
                    v.some((t) => t.id === target.id) ? v : [...v, portableTrack(target)],
                  );
                  setDraft("");
                  toast.success("Commentaire enregistré sur cet appareil");
                }}
              >
                <label className="min-w-0 flex-1 text-xs text-gold">
                  À {fmt(current?.id === target?.id ? progress : 0)}
                  <textarea
                    aria-label="Votre commentaire"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    maxLength={1000}
                    required
                    className="form-input mt-1 w-full"
                    placeholder="Votre commentaire…"
                  />
                </label>
                <Button type="submit" disabled={!target || !draft.trim()}>
                  Publier
                </Button>
              </form>
            </>
          )}
          {panel === "queue" && (
            <>
              <div className="flex gap-2">
                <Button
                  variant={shuffle ? "default" : "outline"}
                  onClick={() => setShuffle(!shuffle)}
                >
                  <Shuffle />
                  Aléatoire
                </Button>
                <Button variant={repeat ? "default" : "outline"} onClick={() => setRepeat(!repeat)}>
                  <Repeat />
                  Répéter
                </Button>
              </div>
              {queue.length ? (
                queue
                  .filter((t) => t.id !== current?.id)
                  .map((t) =>
                    trackRow(t, queue, () => setQueue((v) => v.filter((x) => x.id !== t.id))),
                  )
              ) : (
                <p className="text-muted-foreground">File vide.</p>
              )}
            </>
          )}
          {panel === "equalizer" && (
            <>
              <Button
                variant={engine.eqEnabled ? "outline" : "default"}
                onClick={() => void engine.enableEq()}
                disabled={engine.eqEnabled}
              >
                {engine.eqEnabled ? <Check /> : <SlidersHorizontal />}
                {engine.eqEnabled ? "Égaliseur activé" : "Activer l’égaliseur"}
              </Button>
              <div className="space-y-5 py-4">
                {FREQUENCIES.map((f, i) => (
                  <label key={f} className="block text-xs">
                    <span className="flex justify-between">
                      <span>{f >= 1000 ? `${f / 1000} kHz` : `${f} Hz`}</span>
                      <span>{engine.bands[i]} dB</span>
                    </span>
                    <input
                      aria-label={`${f} Hz`}
                      type="range"
                      min="-12"
                      max="12"
                      step="1"
                      disabled={!engine.eqEnabled}
                      value={engine.bands[i]}
                      onChange={(e) => engine.adjustBand(i, Number(e.target.value))}
                      className="mt-2 w-full accent-gold"
                    />
                  </label>
                ))}
              </div>
              <label className="flex justify-between text-sm">
                Renforcement des basses
                <Switch
                  aria-label="Renforcement des basses"
                  disabled={!engine.eqEnabled}
                  checked={engine.bass}
                  onCheckedChange={engine.boostBass}
                />
              </label>
              <label className="flex justify-between text-sm">
                Fondu enchaîné (3 s)
                <Switch
                  aria-label="Fondu enchaîné 3 secondes"
                  checked={crossfade}
                  onCheckedChange={setCrossfade}
                />
              </label>
              {lowToggle}
            </>
          )}
          {panel === "timer" && (
            <>
              <p className="text-sm text-muted-foreground">
                {countdown ? `Arrêt dans ${fmt(countdown)}` : "Aucune minuterie active"}
              </p>
              {SLEEP_MINUTES.map((m) => (
                <Button
                  key={m}
                  variant="outline"
                  onClick={() => {
                    setSleepUntil(Date.now() + m * 60000);
                    setCountdown(m * 60);
                    toast.success(`Arrêt programmé dans ${m} minutes`);
                    setPanel(null);
                  }}
                >
                  <Timer />
                  {m} minutes
                </Button>
              ))}
              <Button
                variant="ghost"
                onClick={() => {
                  setSleepUntil(null);
                  toast.info("Minuterie annulée");
                }}
              >
                Annuler la minuterie
              </Button>
            </>
          )}
          {panel === "playlist" && (
            <>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!playlistName.trim()) return;
                  setPlaylists((v) => [
                    ...v,
                    {
                      id: crypto.randomUUID(),
                      name: playlistName.trim(),
                      description: "",
                      tracks: target ? [portableTrack(target)] : [],
                    },
                  ]);
                  setPlaylistName("");
                  toast.success("Playlist créée");
                  setPanel(null);
                }}
              >
                <input
                  aria-label="Nom de la playlist"
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  className="form-input min-w-0 flex-1"
                  placeholder="Nom de la playlist"
                  required
                  maxLength={80}
                />
                <Button type="submit" aria-label="Créer une playlist">
                  <Plus />
                </Button>
              </form>
              {playlists.map((p) => (
                <Button
                  key={p.id}
                  variant="outline"
                  className="justify-start"
                  onClick={() =>
                    target
                      ? addPlaylist(p)
                      : (setView("library"),
                        setLibraryTab("Playlists"),
                        setSelectedPlaylist(p.id),
                        setPanel(null))
                  }
                >
                  <ListMusic />
                  <span className="truncate">{p.name}</span>
                  {target && <Plus className="ml-auto" />}
                </Button>
              ))}
            </>
          )}
          {panel === "gift" && (
            <>
              <p className="text-gold">Solde simulation : {balance} FS</p>
              {GIFTS.map((g) => (
                <Button
                  key={g.name}
                  variant="outline"
                  disabled={balance < g.cost || !target}
                  onClick={() => {
                    setBalance((v) => v - g.cost);
                    setHistory((v) => [
                      { text: `Cadeau simulé : ${g.name} à ${target?.artist}`, amount: -g.cost },
                      ...v,
                    ]);
                    toast.success(`${g.name} envoyé en simulation uniquement`);
                    setPanel(null);
                  }}
                >
                  <Gift />
                  {g.name} · {g.cost} FS
                </Button>
              ))}
            </>
          )}
          {panel === "withdraw" && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!canWithdraw(amount, balance)) {
                  toast.error("Minimum 500 FS et solde suffisant requis.");
                  return;
                }
                toast.info(
                  "Demande non envoyée : les paiements Mobile Money ne sont pas connectés. Votre solde reste inchangé.",
                );
              }}
            >
              <label className="block text-sm">
                Service
                <select
                  aria-label="Service Mobile Money"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="form-input mt-2 w-full"
                >
                  {["Orange Money", "MTN MoMo", "Wave"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Numéro de téléphone
                <input
                  aria-label="Numéro de téléphone"
                  type="tel"
                  required
                  pattern="[+0-9 ()-]{8,20}"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="form-input mt-2 w-full"
                />
              </label>
              <label className="block text-sm">
                Montant en FS
                <input
                  aria-label="Montant en FS"
                  type="number"
                  min="500"
                  step="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="form-input mt-2 w-full"
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Minimum 500 FS · {(amount * FCFA_PER_FS).toLocaleString("fr-FR")} FCFA
              </p>
              <Button type="submit">Vérifier la demande (simulation)</Button>
            </form>
          )}
          {panel === "playlist-edit" && playlist && (
            <PlaylistEditor
              key={playlist.id}
              playlist={playlist}
              onSave={(updated) => {
                setPlaylists((v) => v.map((p) => (p.id === updated.id ? updated : p)));
                setPanel(null);
                toast.success("Playlist mise à jour");
              }}
            />
          )}
          {panel === "edit" && (
            <ProfileEditor
              profile={profile}
              onSave={(p) => {
                setProfile(p);
                setPanel(null);
                toast.success("Profil local mis à jour");
              }}
            />
          )}
          {panel === "studio" && (
            <Studio
              onPublish={async (t, blob, text) => {
                await saveAudio(t, blob);
                const rows = await loadAudio();
                setDownloads(rows);
                setMine(rows.filter((x) => x.source === "exclusif"));
                const local = rows.find((x) => x.id === t.id) ?? t;
                setCurrent(local);
                setQueue((v) => [local, ...v]);
                setPlaying(true);
                if (text) setLrc((v) => ({ ...v, [t.id]: text }));
                setPanel(null);
                toast.success("Son publié sur cet appareil");
              }}
              defaultArtist={profile.name}
            />
          )}
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Supprimer cette playlist ?</AlertDialogTitle>
          <AlertDialogDescription>
            « {deleteTarget?.name} » sera supprimée sur cet appareil. Les fichiers audio seront
            conservés.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setPlaylists((v) => v.filter((p) => p.id !== deleteTarget?.id));
                setSelectedPlaylist(null);
                setDeleteTarget(null);
                toast.success("Playlist supprimée");
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Feed({
  loading,
  onRetry,
  tracks,
  current,
  playing,
  ratio,
  progress,
  duration,
  onSeek,
  onPlay,
  onToggle,
  onArtist,
  likes,
  follows,
  reposts,
  comments,
  onLike,
  onFollow,
  onRepost,
  onPanel,
  onShare,
  onFull,
  liveComment,
}: {
  loading: boolean;
  onRetry: () => void;
  tracks: Track[];
  current: Track | null;
  playing: boolean;
  ratio: number;
  progress: number;
  duration: number;
  onSeek: (r: number) => void;
  onPlay: (t: Track) => void;
  onToggle: () => void;
  onArtist: (a: string) => void;
  likes: Record<string, boolean>;
  follows: Record<string, boolean>;
  reposts: Record<string, boolean>;
  comments: Comment[];
  onLike: (id: string) => void;
  onFollow: (id: string) => void;
  onRepost: (id: string) => void;
  onPanel: (p: Panel, t: Track) => void;
  onShare: (t: Track) => void;
  onFull: (t: Track) => void;
  liveComment?: Comment | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const engaged = useRef(false);
  const callback = useRef(onPlay);
  callback.current = onPlay;
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting && engaged.current) {
            const t = tracks.find((t) => t.id === (e.target as HTMLElement).dataset["track"]);
            if (t) callback.current(t);
          }
        }),
      { root, threshold: 0.7 },
    );
    root.querySelectorAll("[data-track]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [tracks]);
  return (
    <div
      ref={ref}
      className="no-scrollbar min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto"
      onWheel={() => {
        engaged.current = true;
      }}
      onTouchStart={() => {
        engaged.current = true;
      }}
    >
      {!tracks.length ? (
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <Music className="h-12 w-12 text-gold" />
          <p role="status" className="text-sm text-muted-foreground">
            {loading ? "Connexion aux catalogues…" : "Aucun titre disponible actuellement."}
          </p>
          {!loading && (
            <Button variant="outline" onClick={onRetry}>
              Réessayer
            </Button>
          )}
        </div>
      ) : (
        tracks.map((t) => {
          const active = current?.id === t.id;
          return (
            <article
              key={t.id}
              data-track={t.id}
              className="feed-item relative flex h-full min-h-full snap-start snap-always flex-col overflow-hidden"
            >
              <Cover
                t={t}
                className="pointer-events-none absolute inset-0 h-full w-full scale-125 opacity-35 blur-3xl"
              />
              <div className="feed-shade pointer-events-none absolute inset-0" />
              <div className="relative flex min-h-0 flex-1 items-center justify-center pl-5 pr-16 pt-4 md:pl-16 md:pr-24">
                <Button
                  variant="ghost"
                  aria-label={active && playing ? "Pause" : `Écouter ${t.title}`}
                  onClick={() => {
                    engaged.current = true;
                    active ? onToggle() : onPlay(t);
                  }}
                  className="relative h-auto w-full max-w-[330px] p-0"
                >
                  <Cover t={t} className="aspect-square w-full rounded-lg shadow-cover" />
                  {(!playing || !active) && (
                    <span className="absolute grid h-14 w-14 place-items-center rounded-full bg-root/65 text-gold">
                      <Play className="fill-current" />
                    </span>
                  )}
                </Button>
              </div>
              <div className="absolute bottom-32 right-2 flex w-14 flex-col items-center gap-2 md:right-6 md:gap-3">
                <Button
                  variant="ghost"
                  aria-label={follows[t.artist] ? "Ne plus suivre" : "Suivre"}
                  title="Suivre le créateur"
                  onClick={() => onFollow(t.artist)}
                  className="relative h-11 w-11 rounded-full p-0"
                >
                  <Cover t={t} className="h-9 w-9 rounded-full" />
                  <span className="absolute -bottom-1 grid h-5 w-5 place-items-center rounded-full bg-gold text-primary-foreground">
                    {follows[t.artist] ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                  </span>
                </Button>
                {[
                  {
                    icon: Heart,
                    label: "J’aime",
                    value: compact(t.likes + (likes[t.id] ? 1 : 0)),
                    active: likes[t.id],
                    fn: () => onLike(t.id),
                  },
                  {
                    icon: Repeat2,
                    label: "Republier",
                    value: "Repost",
                    active: reposts[t.id],
                    fn: () => onRepost(t.id),
                  },
                  {
                    icon: MessageSquare,
                    label: "Commentaires",
                    value: String(comments.filter((c) => c.trackId === t.id).length),
                    active: false,
                    fn: () => onPanel("comments", t),
                  },
                  {
                    icon: Share2,
                    label: "Partager",
                    value: "Partager",
                    active: false,
                    fn: () => onShare(t),
                  },
                  {
                    icon: Gift,
                    label: "Envoyer un cadeau",
                    value: "Cadeau",
                    active: false,
                    fn: () => onPanel("gift", t),
                  },
                ].map((a) => (
                  <div key={a.label} className="text-center">
                    <IconButton label={a.label} active={!!a.active} onClick={a.fn}>
                      <a.icon className={a.active ? "fill-current" : ""} />
                    </IconButton>
                    <p className="text-[9px] text-muted-foreground">{a.value}</p>
                  </div>
                ))}
              </div>
              <div className="relative px-5 pb-5 pr-16 md:mx-auto md:w-full md:max-w-xl md:pr-20">
                <p className="mb-1 text-[10px] font-semibold uppercase text-gold">
                  {t.source === "itunes" ? "Extrait · 30 secondes" : "Découverte audio"}
                </p>
                <h2 className="truncate text-xl font-extrabold md:text-2xl">{t.title}</h2>
                <Button
                  variant="link"
                  onClick={() => onArtist(t.artist)}
                  className="h-6 max-w-full justify-start truncate p-0 text-sm text-muted-foreground"
                >
                  @{t.artist}
                </Button>
                {active && liveComment && (
                  <p className="mt-1 truncate text-xs text-gold">
                    {fmt(liveComment.time)} · {liveComment.text}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-2 text-[10px] tabular-nums text-muted-foreground">
                  <span>{fmt(active ? progress : 0)}</span>
                  <Progress
                    ratio={active ? ratio : 0}
                    onSeek={(r) => {
                      if (active) onSeek(r);
                      else onPlay(t);
                    }}
                  />
                  <span>{fmt(active ? duration : t.duration)}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Button size="sm" onClick={() => onFull(t)} className="min-w-0">
                    <Maximize2 />
                    {t.source === "itunes" ? "Écouter l’extrait" : "Ouvrir le lecteur"}
                  </Button>
                  <IconButton label="Ajouter à une playlist" onClick={() => onPanel("playlist", t)}>
                    <Plus />
                  </IconButton>
                </div>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
function ProfileEditor({ profile, onSave }: { profile: Profile; onSave: (p: Profile) => void }) {
  const [value, setValue] = useState(profile);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(value);
      }}
    >
      <Cover t={{ cover: value.photo, title: value.name }} className="h-24 w-24 rounded-full" />
      <label className="block text-xs text-gold">
        Modifier la photo
        <input
          aria-label="Photo de profil"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 5 * 1024 * 1024) {
              toast.error("Photo trop volumineuse (5 Mo maximum).");
              return;
            }
            const r = new FileReader();
            r.onload = () => {
              if (typeof r.result === "string")
                setValue((v) => ({ ...v, photo: r.result as string }));
            };
            r.readAsDataURL(f);
          }}
          className="mt-2 block w-full text-xs"
        />
      </label>
      <label className="block text-sm">
        Nom
        <input
          aria-label="Nom du profil"
          className="form-input mt-1 w-full"
          value={value.name}
          required
          maxLength={80}
          onChange={(e) => setValue((v) => ({ ...v, name: e.target.value }))}
        />
      </label>
      <label className="block text-sm">
        Identifiant
        <input
          aria-label="Identifiant"
          className="form-input mt-1 w-full"
          value={value.username}
          required
          pattern="[a-zA-Z0-9_-]+"
          onChange={(e) => setValue((v) => ({ ...v, username: e.target.value }))}
        />
      </label>
      <label className="block text-sm">
        Bio
        <textarea
          aria-label="Bio"
          className="form-input mt-1 w-full"
          value={value.bio}
          maxLength={500}
          onChange={(e) => setValue((v) => ({ ...v, bio: e.target.value }))}
        />
      </label>
      <Button type="submit">Enregistrer</Button>
    </form>
  );
}
function Studio({
  onPublish,
  defaultArtist,
}: {
  onPublish: (t: Track, blob: Blob, lrc: string) => Promise<void>;
  defaultArtist: string;
}) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState(defaultArtist);
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!file || !title.trim()) return;
        setBusy(true);
        try {
          const id = `lfs-${crypto.randomUUID()}`;
          await onPublish(
            {
              id,
              title: title.trim(),
              artist: artist.trim() || defaultArtist,
              cover,
              url: "",
              duration: 0,
              source: "exclusif",
              plays: 0,
              likes: 0,
              color: colorFor(id),
            },
            file,
            text,
          );
        } catch {
          toast.error("Échec de l’enregistrement local. Vérifiez l’espace disponible.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block text-sm">
        Fichier audio
        <input
          aria-label="Fichier audio"
          type="file"
          accept="audio/*"
          required
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setFile(f);
              if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
            }
          }}
          className="mt-2 block w-full text-xs"
        />
      </label>
      <label className="block text-sm">
        Pochette
        <input
          aria-label="Pochette"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 5 * 1024 * 1024) {
              toast.error("Pochette trop volumineuse (5 Mo maximum).");
              return;
            }
            const r = new FileReader();
            r.onload = () => {
              if (typeof r.result === "string") setCover(r.result);
            };
            r.readAsDataURL(f);
          }}
          className="mt-2 block w-full text-xs"
        />
      </label>
      {cover && (
        <Cover
          t={{ cover, title: title || "Pochette" }}
          className="aspect-square w-32 rounded-lg"
        />
      )}
      <label className="block text-sm">
        Titre
        <input
          aria-label="Titre du morceau"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className="form-input mt-1 w-full"
        />
      </label>
      <label className="block text-sm">
        Créateur
        <input
          aria-label="Nom du créateur"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          className="form-input mt-1 w-full"
        />
      </label>
      <label className="block text-sm">
        Paroles synchronisées (LRC, facultatif)
        <textarea
          aria-label="Paroles LRC"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="[00:45]Votre refrain"
          className="form-input mt-1 w-full"
        />
      </label>
      <Button type="submit" disabled={!file || busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Upload />}Publier maintenant
      </Button>
    </form>
  );
}
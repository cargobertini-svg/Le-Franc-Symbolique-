import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import LfsApp from "@/components/lfs/App";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Le Franc Symbolique — Streaming & créateurs" },
      { name: "description", content: "Écoutez, découvrez et publiez de la musique : streaming, clips courts et profils créateurs." },
      { property: "og:title", content: "Le Franc Symbolique — Streaming & créateurs" },
      { property: "og:description", content: "Écoutez, découvrez et publiez de la musique : streaming, clips courts et profils créateurs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ClientOnly fallback={<div className="h-dvh bg-root" />}><LfsApp /></ClientOnly>,
});
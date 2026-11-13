// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// Never set ssr.external or resolve.external: the Worker has no runtime module resolution, so
// the build fails. Never add compression (compressPublicAssets, vite-plugin-compression):
// hosting already compresses at the edge.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isGitHubPagesBuild = process.env.GITHUB_PAGES === "true";

export default defineConfig({
  vite: {
    base: "/Le-Franc-Symbolique-/",
  },
  // Static GitHub Pages output does not need the Nitro server bundle.
  ...(isGitHubPagesBuild ? { nitro: false } : {}),
  tanstackStart: {
    ...(isGitHubPagesBuild
      ? {
          spa: {
            enabled: true,
            maskPath: "/Le-Franc-Symbolique-/",
            prerender: { outputPath: "/index.html" },
          },
        }
      : {}),
    server: { entry: "server" },
  },
});

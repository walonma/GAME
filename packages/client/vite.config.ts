import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Alias straight to the shared package's TS source. This sidesteps a Rollup/CJS
// interop pitfall with npm-workspace symlinks (named imports from the compiled
// dist/index.js silently fail to resolve because the symlink-resolved real path
// falls outside Rollup's default node_modules-only commonjs include pattern),
// and it means client dev/build never depends on a separate `shared` build step.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@mahjong/shared": fileURLToPath(new URL("../shared/src/index.ts", import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
});

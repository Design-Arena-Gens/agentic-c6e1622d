import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@config": resolve(__dirname, "config"),
      "@sparkjs/renderer": resolve(__dirname, "src/vendor/sparkjs/renderer.ts")
    }
  },
  build: {
    target: "esnext",
    sourcemap: true,
    outDir: "dist"
  },
  server: {
    headers: {
      "Cache-Control": "public, max-age=0, must-revalidate"
    }
  }
});

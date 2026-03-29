import path from "path";
import { createRequire } from "node:module";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const require = createRequire(import.meta.url);
import react from "@vitejs/plugin-react";
import tailwind from "tailwindcss";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appTarget = process.env.VITE_APP_TARGET || 'app';

// If plugin dist exists, we bundle it so Android media notification works. Otherwise we externalize so build passes.
const pluginRoot = path.resolve(__dirname, "node_modules/@capgo/capacitor-media-session");
const pluginEntry =
  existsSync(path.join(pluginRoot, "dist/esm/index.js"))
    ? path.join(pluginRoot, "dist/esm/index.js")
    : existsSync(path.join(pluginRoot, "dist/plugin.js"))
      ? path.join(pluginRoot, "dist/plugin.js")
      : null;

export default defineConfig({
  define: {
    __APP_TARGET__: JSON.stringify(appTarget),
  },
  plugins: [react()],
  base: "./",
  publicDir: 'public',
  resolve: {
    alias: {
      ...(pluginEntry && {
        "@capgo/capacitor-media-session": pluginEntry,
      }),
      // SheetJS: bare "xlsx" → CJS main confuses some Rollup installs; lock to ESM file via Node resolver (hoist/pnpm-safe).
      xlsx: require.resolve("xlsx/xlsx.mjs"),
    },
  },
  build: {
    rollupOptions: {
      ...(pluginEntry ? {} : { external: ['@capgo/capacitor-media-session'] }),
      output: {
        // Single bundle: avoids TDZ from chunk load order on Android WebView.
        inlineDynamicImports: true,
      },
    },
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: true,
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1000
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      'xlsx',
      'jspdf',
      'jspdf-autotable',
    ],
  },
  css: {
    postcss: {
      plugins: [tailwind()],
    },
  },
});

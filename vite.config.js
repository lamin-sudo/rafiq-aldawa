import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    // The "@" -> src alias used to be injected by the previous build plugin;
    // it is declared here explicitly now (mirrored in jsconfig.json for the editor).
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    // Copy the hand-written service worker from src/ into the build output so the
    // offline cache registered in main.jsx actually resolves at /sw.js (it used to 404).
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectRegister: null,
      injectManifest: { injectionPoint: undefined },
      manifest: false,
      devOptions: { enabled: false },
    }),
  ],
});

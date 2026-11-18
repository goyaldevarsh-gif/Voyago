import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the app from /<repo>/. Override with VITE_BASE when needed.
const base = process.env.VITE_BASE ?? '/Voyago/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Voyago',
        short_name: 'Voyago',
        description: 'Pack Smart. Travel Better.',
        theme_color: '#102A43',
        background_color: '#F4F8FA',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,woff2,svg}'],
        navigateFallback: `${base}index.html`
      }
    })
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] }
});

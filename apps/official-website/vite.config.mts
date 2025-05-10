/// <reference types='vitest' />
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/official-website',

  plugins: [
    react(),
    tailwindcss(),
    nxViteTsPaths(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      workbox: {
        offlineGoogleAnalytics: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],

  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },

  build: {
    chunkSizeWarningLimit: 700, // three lib is always around 680kb
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          'three-loaders': [
            'three/examples/jsm/loaders/GLTFLoader',
            'three/examples/jsm/loaders/DRACOLoader',
            'three/examples/jsm/loaders/KTX2Loader',
            'three/examples/jsm/loaders/USDZLoader',
          ],
          'gltf-transform': [
            '@gltf-transform/extensions',
            '@gltf-transform/functions',
            '@gltf-transform/core',
          ],
          'react-three-fiber': ['@react-three/fiber'],
          'react-three-drei': ['@react-three/drei'],
          'react-vendor': ['react', 'react-dom', 'react-router'],
          'ui-vendor': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-avatar',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-icons',
            '@radix-ui/react-label',
            '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-progress',
            '@radix-ui/react-slot',
            'sonner',
            'tailwind-merge',
          ],
        },
      },
    },

    outDir: '../../dist/apps/official-website',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});

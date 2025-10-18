import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    ViteImageOptimizer({
      // Only run during build (not dev)
      test: /\.(jpe?g|png|gif|tiff|webp|svg|avif)$/i,

      // PNG optimization settings
      png: {
        quality: 90,
      },

      // JPEG optimization settings
      jpeg: {
        quality: 90,
      },

      // WebP generation settings
      webp: {
        quality: 90,
      },

      // Cache optimized images to speed up subsequent builds
      cache: true,
      cacheLocation: './node_modules/.cache/vite-plugin-image-optimizer',
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk - core React libraries
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],

          // Firebase chunk - all Firebase services
          'vendor-firebase': [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
            'firebase/storage',
            'firebase/functions'
          ],

          // React Query chunk
          'vendor-query': ['@tanstack/react-query'],

          // Utilities chunk
          'vendor-utils': ['papaparse'],

          // Admin pages chunk (only loaded by admins)
          'admin': [
            './src/pages/AdminUpload.tsx',
            './src/pages/AdminTeams.tsx',
            './src/pages/AdminPlayers.tsx',
            './src/pages/AdminLeague.tsx',
            './src/pages/AdminDraftTest.tsx',
            './src/pages/AdminDraftSetup.tsx',
            './src/pages/AdminViewRosters.tsx',
            './src/pages/AdminRookiePicks.tsx',
            './src/pages/AdminDraftPicks.tsx',
            './src/pages/AdminTradeManager.tsx',
            './src/pages/AdminPortfolio.tsx',
            './src/pages/AdminMigration.tsx',
            './src/pages/AdminPicksView.tsx'
          ],
        },
      },
    },
    // Increase chunk size warning limit since we're intentionally code-splitting
    chunkSizeWarningLimit: 600,
  },
})

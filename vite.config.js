import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['logo-192x192.png', 'logo-512x512.png'],
      manifest: {
        id: '/',
        name: 'Bagas Journal',
        short_name: 'BagasJournal',
        description: 'Aplikasi Voice Journal cerdas untuk mencatat dengan gaya tulisan tangan.',
        start_url: '/',
        theme_color: '#3b82f6',
        background_color: '#fdfdfd',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'logo-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})

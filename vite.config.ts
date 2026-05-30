import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3001,
      host: true, // Changed from '0.0.0.0' to true as per instruction
      allowedHosts: true,
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'ourlife-logo.png'],
        manifest: {
          name: 'OurLife Fitness',
          short_name: 'OurLife',
          description: 'Your personal fitness and habit tracker',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          scope: '/',
          start_url: '/',
          orientation: 'portrait',
          icons: [
            {
              src: 'ourlife-logo.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'ourlife-logo.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    }
  };
});

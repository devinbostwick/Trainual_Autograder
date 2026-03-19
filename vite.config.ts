import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, __dirname, '');
    return {
      root: 'src',
      publicDir: '../public',
      build: {
        outDir: '../dist',
        emptyOutDir: true,
      },
      base: '/Trainual_Autograder/',
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://localhost:3001',
            changeOrigin: true,
          }
        }
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.CLAUDE_API_KEY': JSON.stringify(env.CLAUDE_API_KEY),
        'process.env.TRAINUAL_PASSWORD': JSON.stringify(env.TRAINUAL_PASSWORD),
        'process.env.TRAINUAL_PROXY': JSON.stringify(env.TRAINUAL_PROXY),
        'process.env.ADMIN_PASSWORD': JSON.stringify(env.ADMIN_PASSWORD),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        }
      }
    };
});

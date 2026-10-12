import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'BACKEND_');

  return {
    plugins: [react()],
    server: {
      host: true,
      allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.io'],
      proxy: {
        '/api': {
          target: env.BACKEND_URL || 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },
  };
});
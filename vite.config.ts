import { defineConfig } from 'vite';
export default defineConfig({ base: '/wick/', build: { target: 'es2022', chunkSizeWarningLimit: 4000 }, server: { host: true } });

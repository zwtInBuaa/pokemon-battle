import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // @pkmn/sim references Node's `global`; map it to the browser global object.
  define: { global: 'globalThis' },
  server: { port: 5173, host: true },
  build: { chunkSizeWarningLimit: 4000 },
});
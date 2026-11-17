import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': '""',
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': '""',
  },
  build: {
    ssr: 'tests/keyboard.test.jsx',
    outDir: 'dist-ssr/keyboard',
    rollupOptions: {
      // Initialize DOM APIs before React's event feature detection runs.
      external: id => /keyboardDom\.mjs$/.test(id),
      output: { paths: id => /keyboardDom\.mjs$/.test(id) ? '../../tests/keyboardDom.mjs' : id },
    },
  },
});

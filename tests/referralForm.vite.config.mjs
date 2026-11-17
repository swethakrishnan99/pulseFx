import { mergeConfig } from 'vite';
import base from './vite.config.mjs';
export default mergeConfig(base, {
  define: {
    'import.meta.env.VITE_SUPABASE_URL': '"https://referral-test.example"',
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': '"test-public-key"',
  },
  build: { ssr: 'tests/referralForm.test.jsx', outDir: 'dist-ssr/referral-form' },
});

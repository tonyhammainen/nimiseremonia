import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The Supabase Marketplace integration on Vercel names its variables for
// Next.js, not Vite, so the two public values are picked up under whichever
// name exists and baked into the bundle under one name. Only these two: the
// service-role key and the correct names must never reach the browser.
export default defineConfig(({ mode }) => {
    const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
    const pick = (...names: string[]) =>
        names.map((name) => env[name]).find((value) => value) ?? '';
    return {
        plugins: [react(), tailwindcss()],
        define: {
            'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
                pick(
                    'VITE_SUPABASE_URL',
                    'NEXT_PUBLIC_SUPABASE_URL',
                    'SUPABASE_URL',
                ),
            ),
            'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
                pick(
                    'VITE_SUPABASE_ANON_KEY',
                    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
                    'SUPABASE_ANON_KEY',
                    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
                    'SUPABASE_PUBLISHABLE_KEY',
                ),
            ),
        },
    };
});

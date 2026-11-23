import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Two projects, split by file extension: pure logic (`.test.ts`) runs in Node,
// component behaviour (`.test.tsx`) runs in jsdom.
export default defineConfig({
    test: {
        projects: [
            {
                test: {
                    name: 'logic',
                    environment: 'node',
                    include: [
                        'shared/**/*.test.ts',
                        'src/**/*.test.ts',
                        'api/**/*.test.ts',
                    ],
                },
            },
            {
                plugins: [react()],
                test: {
                    name: 'dom',
                    environment: 'jsdom',
                    include: ['src/**/*.test.tsx'],
                    setupFiles: ['./src/test/setup.ts'],
                },
            },
        ],
    },
});

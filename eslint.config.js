import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    { ignores: ['dist', '.vercel', 'coverage'] },
    {
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ['src/**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2022,
            globals: globals.browser,
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            // Flags every effect that starts a fetch whose result lands in
            // state - which is how the views here load and poll their data.
            'react-hooks/set-state-in-effect': 'off',
            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true },
            ],
        },
    },
    {
        // Serverless functions and build config run on Node.
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ['api/**/*.ts', '*.config.ts', '*.config.js'],
        languageOptions: {
            ecmaVersion: 2022,
            globals: globals.node,
        },
    },
    {
        // Shared code runs in both, so it gets no environment globals.
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ['shared/**/*.ts'],
        languageOptions: { ecmaVersion: 2022 },
    },
);

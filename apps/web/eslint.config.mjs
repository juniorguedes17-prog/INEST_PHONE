import eslint from '@eslint/js';
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import tseslint from 'typescript-eslint';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const pnpmStoreDir = resolve(rootDir, 'node_modules/.pnpm');
const nextPluginDir = readdirSync(pnpmStoreDir).find((entry) =>
  entry.startsWith('@next+eslint-plugin-next@'),
);
const nextPlugin = nextPluginDir
  ? (
      await import(
        pathToFileURL(
          resolve(
            pnpmStoreDir,
            nextPluginDir,
            'node_modules/@next/eslint-plugin-next/dist/index.js',
          ),
        ).href
      )
    ).default
  : null;

export default [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'postcss.config.js'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...(nextPlugin
    ? [
        {
          plugins: {
            '@next/next': nextPlugin,
          },
          rules: {
            ...nextPlugin.configs.recommended.rules,
            ...nextPlugin.configs['core-web-vitals'].rules,
            '@next/next/no-html-link-for-pages': 'off',
          },
          settings: {
            next: {
              rootDir: ['apps/web/'],
            },
          },
        },
      ]
    : []),
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        React: 'readonly',
        JSX: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off',
    },
  },
];

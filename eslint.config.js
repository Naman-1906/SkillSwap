import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['**/dist/**', '**/node_modules/**', '**/dist*.{js,jsx}']),
  {
    files: ['**/*.{js,jsx,cjs}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^[A-Z_]|^motion$' }],
    },
  },
  {
    files: [
      'server.js',
      'backend/**/*.js',
      'scripts/**/*.{js,cjs}',
      'src/validation/expressMiddleware.js',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['tests/**/*.{js,cjs}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.vitest },
    },
  },
])

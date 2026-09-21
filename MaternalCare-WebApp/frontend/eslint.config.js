/**
 * ESLint, for the React client.
 *
 * There was none. Several components carried `eslint-disable-next-line
 * react-hooks/exhaustive-deps` for a rule nothing was running, which is
 * the tell: the intent to lint was there, the linter was not. This is
 * the standard Vite + React + TypeScript set — the TypeScript rules, the
 * two Hooks rules (which catch real bugs: a stale closure in an effect,
 * a hook inside a condition) and Fast Refresh's one constraint.
 *
 *   npm run lint
 */
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dist-native', 'node_modules'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      /*
       * Hooks v7 ships the React Compiler's rules alongside the two classic
       * ones. `rules-of-hooks` and `exhaustive-deps` catch real bugs and
       * stay as they are. The compiler rules flag idioms this client uses
       * on purpose — a setState in an effect that mirrors a prop, a ref
       * read during render for a measurement — and are advisory here until
       * the code is written for the compiler.
       */
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      /* the chart tooltips, icon props and SpeechRecognition are typed `any`
         where the upstream types are missing; flagged, not failed */
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['*.config.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
);

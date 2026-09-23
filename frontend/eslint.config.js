// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 astarat-code
// Flat ESLint configuration (ESLint 9) — `npm run lint`.
//
// The CRA build already runs eslint-config-react-app. This file is for manual checks
// and for CI: the same React/hooks rules, without depending on the build pipeline.
const js = require('@eslint/js');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const jsxA11y = require('eslint-plugin-jsx-a11y');
const importPlugin = require('eslint-plugin-import');
const globals = require('globals');

module.exports = [
  { ignores: ['build/**', 'node_modules/**', 'src-tauri/**'] },
  // Les directives `eslint-disable` en place visent le jeu de règles de CRA, plus large
  // que celui-ci : les signaler comme inutiles ici ne dirait rien du build.
  { linterOptions: { reportUnusedDisableDirectives: 'off' } },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      // `require` : webpack le résout, quelques modules s'en servent pour un import
      // circulaire différé. `process` : remplacé à la compilation par CRA.
      globals: { ...globals.browser, process: 'readonly', require: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      import: importPlugin,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // Le JSX n'a plus besoin de React dans la portée depuis React 17.
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // L'interface est en français : les apostrophes sont partout dans le texte JSX.
      'react/no-unescaped-entities': 'off',
      // `catch {}` volontairement vide : le code du projet l'utilise pour « ce cas
      // n'a rien à réparer », avec un commentaire à côté.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Les espaces insécables sont du texte (montants « 150 000 € »), pas du code.
      'no-irregular-whitespace': ['error', { skipStrings: true, skipTemplates: true, skipRegExps: true }],
      // `console.log` est la trace de debug qu'on oublie : elle ne doit pas revenir dans
      // le code publié. Les autres sont soit des erreurs à voir (warn/error), soit des
      // diagnostics neutralisés en production dans src/index.js (debug/info).
      'no-console': ['error', { allow: ['warn', 'error', 'debug', 'info'] }],
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
  {
    // Scripts de contrôle et de test : Node, pas de JSX. Les suites de sécurité
    // simulent le navigateur (localStorage, crypto) en posant leurs propres globales.
    files: ['scripts/**/*.js', '*.config.js', 'craco.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node, localStorage: 'writable', window: 'writable' },
    },
    rules: {
      'no-console': 'off',
      'no-irregular-whitespace': ['error', { skipStrings: true, skipTemplates: true, skipRegExps: true }],
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
];

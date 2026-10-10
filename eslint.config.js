// @ts-check
/**
 * Lint rules: ESLint's and typescript-eslint's recommended sets for code, and
 * angular-eslint's for components and templates (including accessibility).
 * Run with `npm run lint`; the CI workflow runs it on every push.
 */
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = tseslint.config(
  {
    ignores: ['dist/', '.angular/', 'node_modules/', 'coverage/'],
  },
  {
    files: ['**/*.ts'],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended, ...tseslint.configs.stylistic, ...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: ['stemma', 'app'], style: 'kebab-case' }],
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'stemma', style: 'camelCase' }],
      // Underscore names are deliberately unused (a value taken out of an object with a rest pattern).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {
      // A person row renders its own name inside the button.
      '@angular-eslint/template/elements-content': ['error', { allowList: ['stemmaPersonRow'] }],
    },
  },
);

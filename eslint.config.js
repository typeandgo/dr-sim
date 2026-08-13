import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Proje kuralları: 300-coding (arrow export, açık hata yönetimi), 900-security (eval/innerHTML yasak)
const SECURITY_SYNTAX = [
  {
    selector: "MemberExpression[property.name='innerHTML']",
    message: 'innerHTML yasak — metin yazımı textContent ile yapılır (kural 900).',
  },
  {
    selector: "MemberExpression[property.name='outerHTML']",
    message: 'outerHTML yasak — DOM h() factory ile kurulur (kural 900).',
  },
  {
    selector: "NewExpression[callee.name='Function']",
    message: 'new Function yasak — MV3 CSP altında çalışmaz (kural 900).',
  },
  {
    selector: "CallExpression[callee.name='eval']",
    message: 'eval yasak (kural 900).',
  },
];

const STYLE_SYNTAX = [
  {
    selector: 'ExportNamedDeclaration > FunctionDeclaration',
    message: 'Export edilen fonksiyonlar arrow function olmalı (export const fn = () => {}).',
  },
  {
    selector: 'ExportDefaultDeclaration > FunctionDeclaration',
    message: 'Export edilen fonksiyonlar arrow function olmalı.',
  },
];

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'src/presets/*.json'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.webextensions },
    },
    rules: {
      'no-restricted-syntax': ['error', ...SECURITY_SYNTAX, ...STYLE_SYNTAX],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-param-reassign': ['error', { props: false }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'object-shorthand': 'error',
      curly: ['error', 'multi-line'],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
    },
  },
  {
    files: ['**/*.spec.ts'],
    languageOptions: { globals: { ...globals.browser, ...globals.webextensions, ...globals.node } },
    rules: {
      'no-restricted-syntax': ['error', ...SECURITY_SYNTAX],
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs', 'tests/**/*.mjs', '*.config.ts', '*.config.js'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-restricted-syntax': 'off', 'no-console': 'off' },
  },
);

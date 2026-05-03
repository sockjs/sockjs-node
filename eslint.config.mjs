import { defineConfig } from 'eslint/config';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import js from '@eslint/js';

export default defineConfig([
  { files: ['**/*.js', '**/*.mjs'], languageOptions: { globals: globals.node } },
  { plugins: { js }, extends: ['js/recommended'] },
  eslintPluginPrettierRecommended
]);

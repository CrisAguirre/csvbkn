import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    ignores: ['node_modules/**', 'logs/**'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.jest
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
  }
];

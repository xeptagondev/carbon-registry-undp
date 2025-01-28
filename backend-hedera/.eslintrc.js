module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
    ecmaVersion: 12
  },
  plugins: ['@typescript-eslint/eslint-plugin','prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
    es2021: true
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',

    // General
    // 'indent': ['error', 2], // 2 spaces for indentation
    'linebreak-style': ['error', 'unix'], // Unix linebreak style
    'max-len': ['error', { code: 120 }], // Max line length of 120 characters
    'semi': ['error', 'always'], // Always use semicolons
    'quotes': ['error', 'single'], // Use single quotes
    'no-magic-numbers': ['warn', { ignore: [0, 1] }], // Warn on magic numbers except 0 and 1
    'no-console': 'warn', // Warn on console.log usage

    // Variables
    'camelcase': ['error', { properties: 'always' }], // Use camelCase for variables
    'no-underscore-dangle': ['off'], // Allow underscores in variable names (adjust if needed)

    // Functions
    'func-names': ['error', 'always'], // Require named function expressions
    'prefer-arrow-callback': ['error'], // Prefer arrow functions for callbacks

    // Classes
    'class-methods-use-this': ['off'], // Disable rule to enforce that class methods use `this`

    // Comments
    'no-warning-comments': ['warn', { terms: ['todo', 'fixme'], location: 'start' }], // Warn on TODO and FIXME comments

    // Imports
    // 'import/no-extraneous-dependencies': ['error', { devDependencies: true }], // Allow devDependencies in import statements
    'import/prefer-default-export': ['off'], // Allow named exports
  },
};
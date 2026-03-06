module.exports = {
  extends: [
    '@electron-toolkit/eslint-config-ts/recommended',
    '@electron-toolkit/eslint-config-ts/eslint-recommended'
  ],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
  }
}

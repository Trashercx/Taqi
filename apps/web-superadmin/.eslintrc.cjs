module.exports = {
  root: true,
  extends: ['@superadmin/eslint-config', 'plugin:react-hooks/recommended'],
  plugins: ['react-refresh'],
  parserOptions: {
    ecmaFeatures: { jsx: true },
  },
  env: { browser: true, es2022: true },
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
};

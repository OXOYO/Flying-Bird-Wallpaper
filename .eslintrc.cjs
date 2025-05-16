/* eslint-env node */
require('@rushstack/eslint-patch/modern-module-resolution')
const autoImportGlobals = require('./.eslintrc-auto-import.json')

module.exports = {
  // 使用 vue-eslint-parser 作为主解析器
  parser: 'vue-eslint-parser',
  parserOptions: {
    // 对于非 Vue 文件使用 @babel/eslint-parser
    parser: '@babel/eslint-parser',
    ecmaVersion: 2022, // 支持 ES2022 语法
    sourceType: 'module', // 使用 ES 模块
    requireConfigFile: false, // 不需要单独的 Babel 配置文件
    babelOptions: {
      presets: ['@babel/preset-env'] // 使用 @babel/preset-env 支持最新语法
    },
    // 支持 JSX
    ecmaFeatures: {
      jsx: true
    }
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended',
    '@electron-toolkit',
    '@vue/eslint-config-prettier',
    './.eslintrc-auto-import.json'
  ],
  globals: autoImportGlobals.globals || {},
  rules: {
    'vue/require-default-prop': 'off',
    'vue/multi-word-component-names': 'off'
  },
  env: {
    es2022: true, // 启用 ES2022 环境
    node: true, // 启用 Node.js 环境
    browser: true // 启用浏览器环境（如果需要）
  }
}

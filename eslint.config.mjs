/* eslint-env node */
import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import electronToolkit from '@electron-toolkit/eslint-config'
import vuePrettier from '@vue/eslint-config-prettier'
import autoImportGlobals from './.eslintrc-auto-import.json' assert { type: 'json' }

export default [
  // JS 推荐规则
  js.configs.recommended,

  // Vue3 Flat Config 推荐规则
  vue.configs['flat/recommended'],

  // Electron Toolkit 配置
  electronToolkit,

  // Prettier 配置
  vuePrettier,

  // 针对 .vue 文件的自定义规则
  {
    files: ['**/*.vue'],
    rules: {
      'vue/require-default-prop': 'off',
      'vue/multi-word-component-names': 'off'
    }
  },

  // 全局变量
  {
    languageOptions: {
      globals: autoImportGlobals.globals || {}
    }
  },

  // 忽略文件
  {
    ignores: ['node_modules', 'dist', 'out', '*.d.ts', '.gitignore']
  }
]

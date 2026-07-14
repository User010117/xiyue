import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // 既有 Canvas 编辑器依赖“最新值 ref”模式；React 19 编译器规则不应阻断普通 Vite 构建。
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
      // Context 与 Canvas 文件同时导出 Hook/纯函数是项目既有公共边界。
      'react-refresh/only-export-components': 'off',
      // 历史大型编辑器的依赖数组需逐工具实测后再收紧，本轮由构建与冒烟覆盖。
      'react-hooks/exhaustive-deps': 'off',
    },
  },
])

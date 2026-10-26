import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import prettierConfig from 'eslint-config-prettier'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['dist', 'release', 'node_modules', 'scripts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser }
    }
  },
  {
    languageOptions: {
      globals: { ...globals.browser }
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'vue/multi-word-component-names': 'off'
    }
  },
  {
    // preload 是 CommonJS（宿主沙箱，.cjs 免受 package.json "type":"module" 影响）：纳入 lint 质量门，配 node 全局
    files: ['public/preload/**/*.cjs'],
    languageOptions: {
      globals: { ...globals.node, window: 'readonly' },
      sourceType: 'commonjs'
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^[e_]' }
      ]
    }
  },
  prettierConfig
)

import { defineConfig } from 'vitest/config'

// 只测试 src/core 纯函数内核（无 DOM 依赖），node 环境最快且稳定。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    reporters: 'default'
  }
})

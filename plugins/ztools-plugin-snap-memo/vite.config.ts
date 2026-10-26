import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base 使用相对路径：打包后 logo/字体等资源在 ZTools 任意安装路径下都能解析。
export default defineConfig({
  plugins: [vue()],
  base: './',
  server: {
    port: 5183,
    // plugin.json development.main 写死 5183：端口被占时直接失败（换端口会导致宿主加载白屏且难排查）
    strictPort: true
  },
  build: {
    target: 'es2021',
    // 首屏同步渲染：主入口不拆异步 chunk，编辑器/设置/数据页组件由运行时 defineAsyncComponent 懒加载。
    chunkSizeWarningLimit: 700
  }
})

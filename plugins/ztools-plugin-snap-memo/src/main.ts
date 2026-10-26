import { createApp } from 'vue'
import App from './App.vue'
import './styles/theme.css'
import './styles/base.css'

/**
 * 入口：挂载应用 + 全局错误兜底。
 * 任何渲染异常都不允许白屏：errorHandler 里打印并把可复制的信息挂到 DOM。
 */
const app = createApp(App)

function showFatalError(message: string): void {
  console.error('[snap-memo] 渲染异常', message)
  const host = document.getElementById('app')
  if (host && !host.firstChild) {
    const box = document.createElement('pre')
    box.style.cssText =
      'margin:16px;padding:12px;border:1px solid #ccc;border-radius:8px;font-size:12px;white-space:pre-wrap;user-select:text;'
    box.textContent = `插件发生异常（可复制以下信息反馈）：\n${message}`
    host.appendChild(box)
  }
}

app.config.errorHandler = (err, _instance, info) => {
  showFatalError(`${String(err)}\n${info}`)
}

window.addEventListener('unhandledrejection', (e) => {
  console.error('[snap-memo] 未处理的 Promise 异常', e.reason)
})

app.mount('#app')

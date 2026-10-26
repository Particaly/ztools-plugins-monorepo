/**
 * 浏览器开发态适配：localStorage 作为存储、页面内输入框替代子输入框、
 * Blob 下载 / file input 替代文件对话框。仅用于 `npm run dev` 与截图测试，
 * 不承诺任何持久化语义（localStorage 容量小、可被清空）。
 */
import type { PlatformApi, PluginEnterAction } from './types'

const LS_DOC_PREFIX = 'snapmemo:doc:'
const LS_KV_PREFIX = 'snapmemo:kv:'

let enterHandler: ((action: PluginEnterAction) => void) | null = null
let outHandler: (() => void) | null = null

/** 构建浏览器 mock 实例。 */
export function createBrowserPlatform(): PlatformApi {
  const self: PlatformApi = {
    kind: 'browser',
    isMac: typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || ''),
    onPluginEnter(cb) {
      enterHandler = cb
      // 开发态默认以主入口进入一次，方便直接打开页面调试
      setTimeout(() => enterHandler?.({ code: 'snap-memo', type: 'text', payload: '' }), 0)
    },
    onPluginOut(cb) {
      outHandler = cb
    },
    onPluginDetach() {
      /* 浏览器开发态无分离窗口概念 */
    },
    onDbPull() {
      /* 浏览器开发态无云同步 */
    },
    outPlugin() {
      outHandler?.()
      console.info('[mock] outPlugin')
    },
    showMainWindow() {
      /* 浏览器开发态无窗口概念 */
    },
    subInput: null,
    setExpendHeight(px) {
      document.documentElement.style.setProperty('--mock-expend-height', `${px}px`)
    },
    async copyText(text) {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch {
        return false
      }
    },
    async pasteText(text) {
      const ok = await self.copyText(text)
      return ok ? 'copied' : 'failed'
    },
    async readClipboardText() {
      try {
        return await navigator.clipboard.readText()
      } catch {
        return null
      }
    },
    async copyImage(dataUrl) {
      if (typeof ClipboardItem === 'undefined' || typeof fetch !== 'function') return false
      try {
        const blob = await (await fetch(dataUrl)).blob()
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
        return true
      } catch {
        return false
      }
    },
    async pasteImage(dataUrl) {
      const ok = await self.copyImage(dataUrl)
      return ok ? 'copied' : 'failed'
    },
    async readClipboardImage() {
      // 浏览器安全模型不允许直接读剪贴板图片，开发态一律视为无图片
      return null
    },
    async openImageExternal() {
      // 浏览器开发态没有临时文件与 shell 能力，系统查看器入口不可用（UI 会提示失败）
      return false
    },
    files: {
      async pickAndReadText() {
        return new Promise((resolve) => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = '.json,.txt,.md,.csv'
          input.onchange = () => {
            const file = input.files?.[0]
            if (!file) {
              resolve(null)
              return
            }
            file
              .text()
              .then((text) => resolve({ name: file.name, text }))
              .catch(() => resolve(null))
          }
          input.click()
        })
      },
      async pickSaveAndWrite(defaultName, content) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = defaultName
        a.click()
        URL.revokeObjectURL(url)
        return 'saved'
      },
      async pickImage() {
        return new Promise((resolve) => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = 'image/png,image/jpeg,image/gif,image/webp,image/bmp'
          input.onchange = () => {
            const file = input.files?.[0]
            if (!file) {
              resolve(null)
              return
            }
            const reader = new FileReader()
            reader.onload = () => resolve({ name: file.name, dataUrl: String(reader.result ?? '') })
            reader.onerror = () => resolve(null)
            reader.readAsDataURL(file)
          }
          input.click()
        })
      }
    },
    // 浏览器开发态没有宿主 OCR 提供商，设置页开关禁用
    ocr: null,
    db: {
      getDoc<T>(id: string) {
        const raw = localStorage.getItem(LS_DOC_PREFIX + id)
        if (raw === null) return null
        try {
          return { id, value: JSON.parse(raw) as T }
        } catch {
          return null
        }
      },
      putDoc(id, value) {
        try {
          localStorage.setItem(LS_DOC_PREFIX + id, JSON.stringify(value))
          return true
        } catch {
          return false
        }
      },
      removeDoc(id) {
        localStorage.removeItem(LS_DOC_PREFIX + id)
        return true
      },
      allDocs(prefix: string) {
        const results: Array<{ id: string; value: unknown }> = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (!key || !key.startsWith(LS_DOC_PREFIX + prefix)) continue
          const id = key.slice(LS_DOC_PREFIX.length)
          try {
            results.push({ id, value: JSON.parse(localStorage.getItem(key) ?? 'null') })
          } catch {
            // 坏数据跳过
          }
        }
        return results
      }
    },
    // 浏览器开发态没有附件 API，repository 会回退把 dataURL 存进 kv
    attachments: null,
    kv: {
      getItem<T>(key: string) {
        const raw = localStorage.getItem(LS_KV_PREFIX + key)
        if (raw === null) return null
        try {
          return JSON.parse(raw) as T
        } catch {
          return null
        }
      },
      setItem(key, value) {
        localStorage.setItem(LS_KV_PREFIX + key, JSON.stringify(value))
      },
      removeItem(key) {
        localStorage.removeItem(LS_KV_PREFIX + key)
      }
    },
    features: null,
    notify(body) {
      console.info('[mock] notify:', body)
    },
    isDark() {
      return matchMedia('(prefers-color-scheme: dark)').matches
    },
    watchDark(cb) {
      const mq = matchMedia('(prefers-color-scheme: dark)')
      const listener = () => cb(self.isDark())
      mq.addEventListener('change', listener)
      return () => mq.removeEventListener('change', listener)
    }
  }
  return self
}

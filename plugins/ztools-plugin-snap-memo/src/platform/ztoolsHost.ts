/**
 * ZTools 宿主适配：所有 window.ztools 访问都经过判空与特性检测；
 * 任一 API 缺失时按 docs/PLAN.md 的降级方案收敛，绝不抛到 UI 层。
 */
import type {
  DynamicFeatureInput,
  PasteOutcome,
  PlatformApi,
  PluginEnterAction
} from './types'
import { parseDataUrl } from '../core/image'
import { extractOcrText } from '../core/ocr'

/** 惰性取宿主对象；页面加载早期可能尚未注入。 */
function z(): ZToolsApi | null {
  return typeof window !== 'undefined' && typeof window.ztools === 'object' && window.ztools !== null
    ? window.ztools
    : null
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

/** 异步版 safe：Promise 拒绝 / 同步抛错都收敛为 fallback，不冒泡到 UI。 */
async function safeAsync<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

function preload(): SnapMemoPreload | null {
  if (typeof window === 'undefined') return null
  const p = (window as unknown as Record<string, unknown>).snapMemoFs
  return p && typeof p === 'object' ? (p as SnapMemoPreload) : null
}

/**
 * IPC 载荷净化：Vue reactive 对象（Proxy）无法被 Electron 结构化克隆，sendSync 会抛
 * "An object could not be cloned"（编辑备忘时 state 里的 memo 连同嵌套 tags 数组都是 Proxy）。
 * db 文档最终以 JSON 存储，这里先做 JSON 往返：剥掉 Proxy、丢弃 undefined，与宿主存储语义一致。
 */
export function toIpcPlain<T>(value: T): T {
  return value === undefined ? (undefined as T) : (JSON.parse(JSON.stringify(value)) as T)
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// ---- 生命周期：覆盖式 setter，宿主钩子只注册一次 ----

let enterHandler: ((action: PluginEnterAction) => void) | null = null
let outHandler: (() => void) | null = null
let detachHandler: (() => void) | null = null
let dbPullHandler: (() => void) | null = null
let hooksRegistered = false

/** 注册插件进入/退出/分离/云同步回调（可重复调用更新回调，宿主钩子仅注册一次）。 */
function ensureHooks(): void {
  if (hooksRegistered) return
  const api = z()
  if (!api) return
  hooksRegistered = true
  if (typeof api.onPluginEnter === 'function') {
    api.onPluginEnter((action) => {
      enterHandler?.({
        code: action?.code ?? '',
        type: action?.type ?? '',
        payload: action?.payload
      })
    })
  }
  if (typeof api.onPluginOut === 'function') {
    api.onPluginOut(() => {
      outHandler?.()
    })
  }
  if (typeof api.onPluginDetach === 'function') {
    api.onPluginDetach(() => {
      detachHandler?.()
    })
  }
  if (typeof api.onDbPull === 'function') {
    api.onDbPull(() => {
      dbPullHandler?.()
    })
  }
}

/** 子输入框可用性（进入时再探测一次，防宿主晚注入）。 */
function subInputAvailable(): boolean {
  const api = z()
  return Boolean(api && typeof api.setSubInput === 'function')
}

// ---- 粘贴降级链 ----

async function pasteText(text: string, opts?: { restoreClipboard?: boolean }): Promise<PasteOutcome> {
  const api = z()
  // 恢复剪贴板：同时备份文本与图片（原剪贴板可能是图片，只备文本会把它弄丢）
  let backupText: string | null = null
  let backupImage: string | null = null
  if (opts?.restoreClipboard) {
    backupText = await readClipboardText()
    if (backupText === null || backupText === '') backupImage = await readClipboardImage()
  }
  if (api && typeof api.hideMainWindowPasteText === 'function') {
    const ok = safe(() => {
      api.hideMainWindowPasteText(text)
      return true
    }, false)
    if (ok) {
      await restoreClipboard(backupText, backupImage)
      return 'pasted'
    }
  }
  const copied = await copyText(text)
  if (!copied) return 'failed'
  if (api && typeof api.simulateKeyboardTap === 'function' && typeof api.hideMainWindow === 'function') {
    const isMac = Boolean(api.isMacOS && api.isMacOS())
    safe(() => {
      api.hideMainWindow()
    }, undefined)
    await delay(150)
    safe(() => {
      api.simulateKeyboardTap('v', isMac ? 'command' : 'control')
    }, undefined)
    await restoreClipboard(backupText, backupImage, 500)
    return 'pasted-fallback'
  }
  await restoreClipboard(backupText, backupImage)
  return 'copied'
}

/**
 * 粘贴完成后恢复原剪贴板（等前台应用消费完剪贴板）。
 * 原剪贴板是图片时优先恢复图片；两个备份都为 null（读取不可用）时跳过。
 */
async function restoreClipboard(backupText: string | null, backupImage: string | null, extraDelayMs = 400): Promise<void> {
  if (backupImage) {
    await delay(extraDelayMs)
    await copyImage(backupImage)
    return
  }
  if (backupText === null) return
  await delay(extraDelayMs)
  await copyText(backupText)
}

async function copyText(text: string): Promise<boolean> {
  const api = z()
  if (api && typeof api.copyText === 'function') {
    return safe(() => api.copyText(text), false)
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }
  return false
}

async function readClipboardText(): Promise<string | null> {
  const p = preload()
  if (p && typeof p.readClipboardText === 'function') {
    // preload 契约：返回 null 表示剪贴板能力不可用；返回 ''（空串）表示可用但为空
    return safe(() => p.readClipboardText(), null)
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
    try {
      return await navigator.clipboard.readText()
    } catch {
      return null
    }
  }
  return null
}

// ---- 图片剪贴板：复制 / 粘贴 / 读取 ----

async function copyImage(dataUrl: string): Promise<boolean> {
  const parsed = parseDataUrl(dataUrl)
  if (!parsed) return false
  const api = z()
  if (api && typeof api.copyImage === 'function') {
    return safe(() => api.copyImage(parsed.base64), false)
  }
  // 浏览器兜底：ClipboardItem 写入 PNG
  if (typeof ClipboardItem !== 'undefined' && typeof fetch === 'function') {
    try {
      const blob = await (await fetch(dataUrl)).blob()
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      return true
    } catch {
      return false
    }
  }
  return false
}

async function pasteImage(dataUrl: string, opts?: { restoreClipboard?: boolean }): Promise<PasteOutcome> {
  const parsed = parseDataUrl(dataUrl)
  if (!parsed) return 'failed'
  const api = z()
  // 恢复剪贴板需要先备份原图片（仅 preload 可读时可用）
  const backup = opts?.restoreClipboard ? await readClipboardImage() : null
  if (api && typeof api.hideMainWindowPasteImage === 'function') {
    const ok = safe(() => {
      api.hideMainWindowPasteImage(parsed.base64)
      return true
    }, false)
    if (ok) {
      await maybeRestoreImage(backup)
      return 'pasted'
    }
  }
  const copied = await copyImage(dataUrl)
  if (!copied) return 'failed'
  await maybeRestoreImage(backup)
  return 'copied'
}

/** 粘贴图片完成后恢复原剪贴板图片（等前台应用消费完剪贴板）。 */
async function maybeRestoreImage(backup: string | null, extraDelayMs = 500): Promise<void> {
  if (!backup) return
  await delay(extraDelayMs)
  await copyImage(backup)
}

async function readClipboardImage(): Promise<string | null> {
  const p = preload()
  if (p && typeof p.readClipboardImage === 'function') {
    const dataUrl = safe(() => p.readClipboardImage(), '')
    return dataUrl === '' ? null : dataUrl
  }
  return null
}

/**
 * 用系统默认看图软件打开图片：先把 dataURL 经 preload 写入受控临时文件，
 * 再调用宿主 shellOpenPath（按扩展名交给系统默认应用）。任一环节不可用返回 false。
 */
async function openImageExternal(dataUrl: string): Promise<boolean> {
  const p = preload()
  if (!p || typeof p.writeTempImage !== 'function') return false
  let filePath = ''
  try {
    filePath = p.writeTempImage(dataUrl)
  } catch {
    return false
  }
  const api = z()
  if (api && typeof api.shellOpenPath === 'function') {
    return safe(() => {
      api.shellOpenPath(filePath)
      return true
    }, false)
  }
  return false
}

/** 弹对话框选择图片文件，经 preload 读为 dataURL；浏览器兜底 file input。 */
async function pickImage(): Promise<{ name: string; dataUrl: string } | null> {
  const api = z()
  const extensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']
  if (api && typeof api.showOpenDialog === 'function') {
    const paths = safe(
      () =>
        api.showOpenDialog({
          title: '选择图片',
          filters: [{ name: '图片', extensions }],
          properties: ['openFile']
        }),
      undefined
    )
    const path = paths && paths[0]
    if (!path) return null
    const p = preload()
    if (!p || typeof p.readImageFile !== 'function') return null
    try {
      return { name: path.split(/[\\/]/).pop() ?? path, dataUrl: p.readImageFile(path) }
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : '读取图片失败')
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = extensions.map((e) => `.${e}`).join(',')
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

// ---- 文件对话框 + preload 读写 ----

async function pickAndReadText(extensions?: string[]): Promise<{ name: string; text: string } | null> {
  const api = z()
  if (api && typeof api.showOpenDialog === 'function') {
    const paths = safe(
      () =>
        api.showOpenDialog({
          title: '选择导入文件',
          filters: [
            {
              name: '数据文件',
              extensions: extensions && extensions.length > 0 ? extensions : ['json', 'txt', 'md', 'csv']
            }
          ],
          properties: ['openFile']
        }),
      undefined
    )
    const path = paths && paths[0]
    if (!path) return null
    const p = preload()
    if (!p) return null
    try {
      return { name: path.split(/[\\/]/).pop() ?? path, text: p.readTextFile(path) }
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : '读取文件失败')
    }
  }
  // 浏览器兜底：input[type=file]
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = (extensions ?? ['json', 'txt', 'md', 'csv']).map((e) => `.${e}`).join(',')
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
}

async function pickSaveAndWrite(defaultName: string, content: string): Promise<'saved' | 'cancelled' | 'error'> {
  const api = z()
  if (api && typeof api.showSaveDialog === 'function') {
    const ext = defaultName.split('.').pop() ?? 'json'
    // 默认保存到下载目录（宿主能力缺失时退回纯文件名）
    const downloads = api.getPath ? safe(() => api.getPath('downloads'), '') : ''
    const defaultPath = downloads ? `${downloads}/${defaultName}` : defaultName
    const path = safe(
      () =>
        api.showSaveDialog({
          title: '保存导出文件',
          defaultPath,
          filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
        }),
      undefined
    )
    if (!path) return 'cancelled'
    const p = preload()
    if (!p) return 'error'
    try {
      p.writeTextFile(path, content)
      return 'saved'
    } catch (e) {
      console.error('[snap-memo] 写文件失败', e)
      return 'error'
    }
  }
  // 浏览器兜底：Blob 下载
  try {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = defaultName
    a.click()
    URL.revokeObjectURL(url)
    return 'saved'
  } catch {
    return 'error'
  }
}

/** 构建宿主适配实例（应用启动时调用一次）。 */
export function createZtoolsPlatform(): PlatformApi {
  ensureHooks()
  const self: PlatformApi = {
    kind: 'ztools',
    get isMac() {
      const api = z()
      return Boolean(api?.isMacOS?.())
    },
    onPluginEnter(cb) {
      enterHandler = cb
      ensureHooks()
    },
    onPluginOut(cb) {
      outHandler = cb
      ensureHooks()
    },
    onPluginDetach(cb) {
      detachHandler = cb
      ensureHooks()
    },
    onDbPull(cb) {
      dbPullHandler = cb
      ensureHooks()
    },
    outPlugin(isKill) {
      const api = z()
      if (api && typeof api.outPlugin === 'function') safe(() => api.outPlugin(isKill), undefined)
    },
    showMainWindow() {
      const api = z()
      if (api && typeof api.showMainWindow === 'function') safe(() => api.showMainWindow(), undefined)
    },
    get subInput() {
      if (!subInputAvailable()) return null
      const api = z()!
      return {
        available: true,
        set(onChange: (text: string) => void, placeholder: string, focus = true) {
          safe(() => {
            api.setSubInput((input: { text?: string }) => onChange(input?.text ?? ''), placeholder, focus)
          }, undefined)
        },
        setValue(text: string) {
          safe(() => api.setSubInputValue(text), undefined)
        },
        focus() {
          safe(() => api.subInputFocus(), undefined)
        },
        blur() {
          safe(() => api.subInputBlur(), undefined)
        }
      }
    },
    setExpendHeight(px) {
      const api = z()
      if (api && typeof api.setExpendHeight === 'function') safe(() => api.setExpendHeight(px), undefined)
    },
    copyText,
    pasteText,
    readClipboardText,
    copyImage,
    pasteImage,
    readClipboardImage,
    openImageExternal,
    db: {
      getDoc<T>(id: string) {
        const api = z()
        if (!api?.db) return null
        const doc = safe(() => api.db.get(id) as DbDoc | null, null)
        if (!doc) return null
        const { _id, _rev, ...value } = doc
        return { id: _id, value: value as T }
      },
    putDoc(id, value) {
      const api = z()
      if (!api?.db) return false
      /** 执行写入并返回宿主结果；error=true 或抛错都打日志，绝不静默（保存失败必须能定位原因）。 */
      const write = (doc: DbDoc): DbReturn | null => {
        try {
          const result = (api.db.put(toIpcPlain(doc)) ?? null) as DbReturn | null
          if (result && result.error) {
            console.error('[snap-memo] db.put 被宿主拒绝', id, result.name ?? '', result.message ?? '')
          }
          return result
        } catch (e) {
          console.error('[snap-memo] db.put 抛错', id, e)
          return null
        }
      }
      const isOk = (r: DbReturn | null): boolean => Boolean(r && (r.ok || !r.error))
      let existing: DbDoc | null = null
      try {
        existing = (api.db.get(id) as DbDoc | null) ?? null
      } catch (e) {
        console.error('[snap-memo] db.get 抛错（写入前取 _rev）', id, e)
      }
      // 保留宿主侧附件桩：编辑图片备忘的文档时不能把 _attachments 丢掉（附件字节按 docId 存，桩丢了即孤儿）
      const base = {
        ...(existing?._attachments ? { _attachments: existing._attachments } : {}),
        ...(value as object)
      }
      const first = write({ _id: id, ...(existing?._rev ? { _rev: existing._rev } : {}), ...base } as DbDoc)
      if (isOk(first)) return true
      // 宿主要求 _rev 与 winningRev 严格一致：云同步/并发改写造成分叉后，按文档内 _rev 重试永远冲突。
      // 仅冲突时走「删除重建」恢复（tombstone 复活路径绕过 _rev 校验，数据以本次写入为准）；其他错误不动数据。
      if (!first || first.name !== 'conflict' || !self.db.removeDoc(id)) return false
      console.warn('[snap-memo] db.put 冲突，删除后重建文档', id)
      return isOk(write({ _id: id, ...base } as DbDoc))
    },
    removeDoc(id) {
      const api = z()
      if (!api?.db) return false
      try {
        const result = api.db.remove(id)
        if (result && result.error && result.name !== 'not_found') {
          console.error('[snap-memo] db.remove 被宿主拒绝', id, result.name ?? '', result.message ?? '')
        }
        return Boolean(result?.ok)
      } catch (e) {
        console.error('[snap-memo] db.remove 抛错', id, e)
        return false
      }
    },
      allDocs(prefix) {
        const api = z()
        if (!api?.db) return []
        const docs = safe(() => api.db.allDocs(prefix) as DbDoc[], [])
        return docs.map((doc) => {
          const { _id, _rev, ...value } = doc
          return { id: _id, value }
        })
      }
    },
    get attachments() {
      const api = z()
      if (!api?.db || typeof api.db.postAttachment !== 'function' || typeof api.db.getAttachment !== 'function') {
        return null
      }
      return {
        put(docId: string, mime: string, bytes: Uint8Array): boolean {
          let result: DbReturn | null
          try {
            result = (api.db.postAttachment(docId, bytes, mime) ?? null) as DbReturn | null
          } catch (e) {
            console.error('[snap-memo] postAttachment 抛错', docId, e)
            return false
          }
          if (result && result.error) {
            console.error('[snap-memo] postAttachment 被宿主拒绝', docId, result.name ?? '', result.message ?? '')
            return false
          }
          return Boolean(result && (result.ok || !result.error))
        },
        get(docId: string): { bytes: Uint8Array; mime: string } | null {
          return safe(() => {
            const bytes = api.db.getAttachment(docId)
            if (!bytes || bytes.length === 0) return null
            const mime =
              typeof api.db.getAttachmentType === 'function'
                ? api.db.getAttachmentType(docId) ?? 'image/png'
                : 'image/png'
            return { bytes, mime }
          }, null)
        }
      }
    },
    kv: {
      getItem<T>(key: string) {
        const api = z()
        if (api?.dbStorage) return safe(() => (api.dbStorage.getItem(key) ?? null) as T | null, null)
        return null
      },
      setItem(key, value) {
        const api = z()
        if (api?.dbStorage) safe(() => api.dbStorage.setItem(key, toIpcPlain(value)), undefined)
      },
      removeItem(key) {
        const api = z()
        if (api?.dbStorage) safe(() => api.dbStorage.removeItem(key), undefined)
      }
    },
    files: {
      pickAndReadText,
      pickSaveAndWrite,
      pickImage
    },
    get ocr() {
      const api = z()
      // OCR 能力 = 宿主便捷封装 ztools.ocr（走用户设为默认的 OCR 提供商）
      const ocrFn = api?.ocr
      if (typeof ocrFn !== 'function') return null
      return {
        async recognize(dataUrl: string): Promise<string | null> {
          const result = await safeAsync(() => ocrFn(dataUrl), null)
          return extractOcrText(result)
        }
      }
    },
    get features() {
      const api = z()
      if (!api || typeof api.setFeature !== 'function' || typeof api.removeFeature !== 'function') return null
      return {
        set(feature: DynamicFeatureInput) {
          return safe(() => {
            api.setFeature({
              code: feature.code,
              explain: feature.explain,
              icon: 'logo.png',
              mainHide: true,
              cmds: feature.cmds
            })
            return true
          }, false)
        },
        remove(code: string) {
          return safe(() => api.removeFeature(code), false)
        },
        list(): Array<{ code: string }> {
          return safe(
            () => (api.getFeatures?.() ?? []).map((f) => ({ code: String(f?.code ?? '') })).filter((f) => f.code),
            []
          )
        }
      }
    },
    notify(body) {
      const api = z()
      if (api && typeof api.showNotification === 'function') safe(() => api.showNotification(body), undefined)
    },
    isDark() {
      const api = z()
      if (api && typeof api.isDarkColors === 'function') return safe(() => api.isDarkColors(), false)
      if (typeof matchMedia === 'function') return matchMedia('(prefers-color-scheme: dark)').matches
      return false
    },
    watchDark(cb) {
      const cleanups: Array<() => void> = []
      if (typeof matchMedia === 'function') {
        const mq = matchMedia('(prefers-color-scheme: dark)')
        const listener = () => cb(self.isDark())
        mq.addEventListener('change', listener)
        cleanups.push(() => mq.removeEventListener('change', listener))
      }
      // 宿主的主题可能是应用级设置（不跟随系统）：轮询 isDarkColors 兜底，
      // 宿主能力缺失时 isDark() 内部自然回退 prefers-color-scheme，轮询无害。
      const timer = setInterval(() => {
        const api = z()
        if (api && typeof api.isDarkColors === 'function') cb(self.isDark())
      }, 3000)
      cleanups.push(() => clearInterval(timer))
      return () => cleanups.forEach((fn) => fn())
    }
  }
  return self
}

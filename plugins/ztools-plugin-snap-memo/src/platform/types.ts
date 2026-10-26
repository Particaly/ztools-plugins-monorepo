/**
 * 平台适配层接口：UI 与 store 只依赖此接口，不直接触碰 window.ztools。
 * ZTools 宿主与浏览器开发态各有一个实现，保证 `npm run dev` 可独立开发与截图。
 */

export type HostKind = 'ztools' | 'browser'

/** 粘贴结果，用于反馈与降级提示。 */
export type PasteOutcome =
  | 'pasted' /** hideMainWindowPasteText 成功 */
  | 'pasted-fallback' /** copyText + hideMainWindow + simulateKeyboardTap 成功 */
  | 'copied' /** 仅复制成功（需手动粘贴） */
  | 'failed' /** 全部失败 */

export interface PluginEnterAction {
  code: string
  type: string
  payload: unknown
}

export interface DynamicFeatureInput {
  code: string
  explain: string
  cmds: string[]
}

export interface PlatformApi {
  kind: HostKind
  isMac: boolean

  /** 生命周期：实现层保证宿主钩子只注册一次（覆盖式 setter），回调可更新。 */
  onPluginEnter(cb: (action: PluginEnterAction) => void): void
  onPluginOut(cb: () => void): void
  /** 插件分离到独立窗口时触发（宿主能力；浏览器 mock 为 no-op 注册）。 */
  onPluginDetach(cb: () => void): void
  /** 云同步拉取到数据时触发（宿主能力；浏览器 mock 为 no-op 注册）。 */
  onDbPull(cb: () => void): void
  /** 退出插件（isKill=true 结束进程）。 */
  outPlugin(isKill?: boolean): void
  /** 显示主窗口（动态触发词粘贴需要弹填写框时唤回）。 */
  showMainWindow(): void

  /** 宿主子输入框；不可用时 available=false，UI 降级为页面内搜索框。 */
  subInput: {
    available: boolean
    set(onChange: (text: string) => void, placeholder: string, focus?: boolean): void
    setValue(text: string): void
    focus(): void
    blur(): void
  } | null

  /** 设置插件区高度（px）。 */
  setExpendHeight(px: number): void

  /** 复制文本（异步统一签名）。 */
  copyText(text: string): Promise<boolean>
  /**
   * 粘贴到前台应用：三级降级链。
   * restoreClipboard=true 时在粘贴完成后尽力恢复原剪贴板内容。
   */
  pasteText(text: string, opts?: { restoreClipboard?: boolean }): Promise<PasteOutcome>
  /** 读取剪贴板纯文本；不可用返回 null。 */
  readClipboardText(): Promise<string | null>

  /** 复制图片到剪贴板（入参为 dataURL）；失败返回 false。 */
  copyImage(dataUrl: string): Promise<boolean>
  /**
   * 粘贴图片到前台应用：hideMainWindowPasteImage → 复制降级。
   * restoreClipboard=true 时尽力恢复原剪贴板（含原图片）。
   */
  pasteImage(dataUrl: string, opts?: { restoreClipboard?: boolean }): Promise<PasteOutcome>
  /** 读取剪贴板图片，返回 PNG dataURL；无图片或不可用返回 null。 */
  readClipboardImage(): Promise<string | null>

  /**
   * 用系统默认看图软件打开图片：dataURL 先写入受控临时文件，再走宿主 shellOpenPath。
   * 宿主或 preload 能力缺失、写入/打开失败时返回 false（调用方负责提示）。
   */
  openImageExternal(dataUrl: string): Promise<boolean>

  /**
   * 图片文字识别：走 ZTools「提供商」机制中用户设为默认的 OCR 提供商
   * （宿主便捷封装 ztools.ocr；如微信 OCR / AI 识图）。
   * 宿主未提供 OCR 能力时为 null。
   */
  ocr: {
    /**
     * 识别图片文字。
     * @param dataUrl 图片 dataURI（provider 契约接受 data URI）
     * @returns 识别文本；无法识别或调用失败返回 null
     */
    recognize(dataUrl: string): Promise<string | null>
  } | null

  /** 文档型存储（宿主 db / 浏览器 localStorage）。 */
  db: {
    getDoc<T = unknown>(id: string): { id: string; value: T } | null
    putDoc(id: string, value: unknown): boolean
    removeDoc(id: string): boolean
    allDocs(prefix: string): Array<{ id: string; value: unknown }>
  }

  /**
   * 图片附件存取（宿主 db.postAttachment/getAttachment）；
   * 宿主不支持附件时为 null（调用方回退到 kv 存 dataURL）。
   * docId 为完整文档 ID（附件要求文档已存在）。
   */
  attachments: {
    put(docId: string, mime: string, bytes: Uint8Array): boolean
    get(docId: string): { bytes: Uint8Array; mime: string } | null
  } | null

  /** 轻量键值（宿主 dbStorage / 浏览器 localStorage）。 */
  kv: {
    getItem<T = unknown>(key: string): T | null
    setItem(key: string, value: unknown): void
    removeItem(key: string): void
  }

  /** 文件读写（宿主 preload / 浏览器 file input + 下载）。 */
  files: {
    pickAndReadText(extensions?: string[]): Promise<{ name: string; text: string } | null>
    /** 保存文本文件；返回 saved/cancelled/error。 */
    pickSaveAndWrite(defaultName: string, content: string): Promise<'saved' | 'cancelled' | 'error'>
    /** 弹文件对话框选择图片，返回 { name, dataUrl }；取消返回 null。 */
    pickImage(): Promise<{ name: string; dataUrl: string } | null>
  }

  /** 动态 Feature（自定义触发词）；不可用为 null。 */
  features: {
    set(feature: DynamicFeatureInput): boolean
    remove(code: string): boolean
    /** 列出已注册的动态 Feature（清理孤儿用）；不可用返回空数组。 */
    list(): Array<{ code: string }>
  } | null

  /** 系统通知（页面可能已被隐藏时使用）。 */
  notify(body: string): void

  /** 明暗主题：当前值 + 变化监听（返回取消函数）。 */
  isDark(): boolean
  watchDark(cb: (dark: boolean) => void): () => void
}

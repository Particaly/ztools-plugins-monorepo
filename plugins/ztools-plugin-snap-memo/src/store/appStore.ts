/**
 * 应用状态与动作（轻量 reactive store，替代 Pinia 以降低启动开销）。
 * 组件只读状态、只调动作；持久化经 repository，平台能力经 platform。
 * 删除即物理删除（删除前自动快照 + 5 秒撤销 Toast），无回收站。
 */
import { computed, reactive, ref } from 'vue'
import { platform, type ImageViewOutcome, type PasteOutcome } from '../platform'
import { createRepository, type Repository } from './repository'
import {
  getCachedSearchEntry,
  searchMemos,
  sortNoQuery,
  type ScoredMemo
} from '../core/search'
import { resolveSegments, parsePlaceholders, hasInputPlaceholder, type InputPrompt, type Segment } from '../core/placeholders'
import { newGroupId, newMemoId } from '../core/id'
import { buildSeedData } from '../core/seed'
import {
  buildExportPayload,
  parseImportPayload,
  parseTextImport,
  planImport,
  toCsv,
  toMarkdown,
  type ExportPayload,
  type ImportPlan,
  type TextImportEntry
} from '../core/transfer'
import { convertMemoQuickPaste } from '../core/mqpImport'
import {
  CONTENT_MAX_BYTES,
  CONTENT_WARN_BYTES,
  IMAGE_MAX_BYTES,
  DEFAULT_SETTINGS,
  type Group,
  type GroupFilter,
  type Memo,
  type MemoImage,
  type Settings
} from '../core/types'
import { dataUrlBytes, exceedsImageLimit, fnv1aHash, imageDimensions, normalizeImagePayload, parseDataUrl, base64ToBytes } from '../core/image'
import {
  IMG_TOKEN_RE,
  MAX_MEMO_IMAGES,
  allImageSlots,
  firstImageSlot,
  hasImages,
  isImageOnlyContent,
  replaceImageTokenIds,
  stripImageTokens,
  uniqueImageIds
} from '../core/inlineImage'
import { bytesToBlobUrl, generateThumb, THUMB_LARGE_MAX, THUMB_SMALL_MAX } from '../core/thumbnail'
import { t } from '../i18n/zh-CN'

export type ViewName = 'list' | 'editor' | 'settings' | 'data'

/**
 * 预览面板两态：split 列表+面板分栏（默认）；hidden 仅列表（面板收起）。
 * 设置项 showPreviewPane 是面板总开关：关闭即彻底停用（hidden 且不可再展开，
 * Space / ⌘/Ctrl+P / 单击条目均无效），开启时进入插件初始为 split。
 */
export type PreviewMode = 'split' | 'hidden'

export interface Toast {
  id: number
  text: string
  kind: 'info' | 'success' | 'error'
  actionLabel?: string
  onAction?: () => void
  duration: number
}

export interface EditorForm {
  mode: 'new' | 'edit'
  memoId: string | null
  title: string
  /** 正文（含行内图片标记 {img:<slotId>}，图片在正文内原地排版）。 */
  content: string
  groupId: string | null
  tagsText: string
  keyword: string
  pinned: boolean
  sensitive: boolean
}

/** 编辑器顶栏字段弹窗的目标字段（一次只开一个）。 */
export type EditorMetaField = 'group' | 'tags' | 'keyword'

export interface PendingPaste {
  memo: Memo
  segments: Segment[]
  prompts: InputPrompt[]
  answers: Record<string, string>
  copyOnly: boolean
}

/** 右键菜单状态：屏幕坐标 + 目标条目。 */
export interface ContextMenuState {
  x: number
  y: number
  memoId: string
}

/** 预览面板行内编辑草稿：仅文本条目，直接改标题与正文；非 null 即处于编辑态。 */
export interface PreviewEditDraft {
  memoId: string
  title: string
  content: string
}

/** 应用内确认对话框（替代原生 window.confirm，宿主 WebView 可能禁用原生对话框）。 */
export interface ConfirmState {
  text: string
  danger?: boolean
  onOk: () => void
}

/** 批量操作浮条的目标分组选项。 */
export interface BatchGroupOption {
  id: string | null
  label: string
}

/** 图片全屏浮层状态：正在查看的图片（memoId + 图片槽 ID）；null 表示关闭。 */
export interface LightboxState {
  memoId: string
  imageId: string
}

/** 图片缩略图运行时状态（内存缓存，不落库；small/large 为缩小后的 dataURL）。 */
export interface ImageThumbState {
  status: 'pending' | 'ready' | 'failed'
  /** 列表折叠行用小图（≤192px）。 */
  small: string
  /** 悬浮快览用大图（≤480px），按需生成。 */
  large?: string
  /** 源图原始像素宽高（先解析文件头，解码后校正）。 */
  width: number
  height: number
}

const DRAFT_MAX_AGE_MS = 10 * 60 * 1000
/** 图片 dataURL 运行时缓存上限（条数；超限淘汰最久未访问，附件/kv 仍可回源）。 */
const IMAGE_CACHE_MAX = 48
/** 缩略图缓存上限（条数；小图仅数十 KB，可放大缓存）。 */
const THUMB_CACHE_MAX = 300
/** 全尺寸展示 Blob URL 缓存上限（条数；淘汰时 revoke 释放内存；行内图片拉高并发持有量）。 */
const IMAGE_DISPLAY_CACHE_MAX = 64
/** 缩略图生成并发数（解码占主线程，限流避免滚动时打满）。 */
const THUMB_CONCURRENCY = 2

let toastSeq = 1

/** 构建全局唯一 store 实例（main.ts 初始化一次）。 */
export function createAppStore(repo: Repository = createRepository(platform)) {
  const state = reactive({
    ready: false,
    memos: [] as Memo[],
    groups: [] as Group[],
    settings: { ...DEFAULT_SETTINGS } as Settings,
    query: '',
    filter: 'all' as GroupFilter,
    view: 'list' as ViewName,
    previousView: 'list' as ViewName,
    selectionId: null as string | null,
    /** 最近一次选区移动的方向（1 向下 / -1 向上 / 0 非键盘）：列表据此决定滚动对齐方式。 */
    selectionMoveDir: 0 as 0 | 1 | -1,
    editor: null as EditorForm | null,
    /**
     * 编辑器字段弹窗（顶栏分组/标签/触发词徽片点开的设置弹窗）：
     * 状态进 store 供全局键盘路由感知——弹窗开着时 Esc 只关弹窗，不关编辑器。
     */
    editorMeta: null as EditorMetaField | null,
    /** 分组管理弹窗（列表视图上的浮层）：全局键盘路由需感知，Esc 先关弹窗而不是退出插件 */
    showGroupManager: false,
    /** 预览面板显隐（showPreviewPane=false 时恒为 hidden 且不可展开，见 togglePreviewPane）。 */
    previewMode: 'split' as PreviewMode,
    /** 预览面板行内编辑草稿：焦点在标题/正文输入框时存在，失焦自动保存后置 null。 */
    previewEdit: null as PreviewEditDraft | null,
    /** 条目右键菜单（屏幕坐标定位；null 表示关闭）。 */
    contextMenu: null as ContextMenuState | null,
    revealSensitive: new Set<string>(),
    /** 批量多选模式与选中集合（Mod+A 进入/退出）。 */
    batchMode: false,
    batchSelection: new Set<string>(),
    batchAnchor: null as string | null,
    /** 应用内确认对话框；null 表示关闭。 */
    confirm: null as ConfirmState | null,
    /** 快捷键帮助浮层。 */
    helpVisible: false,
    /** 列表内联展开的条目 ID（与 listMode='full' 叠加取反；会话内状态，不持久化）。 */
    expandedItems: new Set<string>(),
    /** 图片全屏浮层（null 表示关闭）；←/→ 在当前列表全部图片（跨条目展开）间切换。 */
    lightbox: null as LightboxState | null,
    toasts: [] as Toast[],
    pendingPaste: null as PendingPaste | null,
    dark: platform.isDark(),
    /** 系统当前明暗（themeMode='system' 时 dark 跟随此值）。 */
    systemDark: platform.isDark(),
    enterCount: 0,
    brokenDocs: 0,
    backupAt: null as number | null,
    /** 编辑器暂存的新增/换图像素（图片槽 ID → dataURL）：仅存内存，保存时落盘、取消即弃。 */
    editorImages: {} as Record<string, string>,
    /** 图片 dataURL 运行时缓存（图片槽 ID → dataURL，LRU 淘汰），首次渲染时从附件/kv 惰性加载。 */
    imageUrls: {} as Record<string, string>,
    /** 图片缩略图缓存（图片槽 ID → 缩小图，LRU 淘汰）；列表渲染只走这里，不再解码原图。 */
    imageThumbs: {} as Record<string, ImageThumbState>,
    /** 全尺寸展示 Blob URL 缓存（展开区/全屏查看用，淘汰时 revoke）。 */
    imageDisplays: {} as Record<string, string>,
    /** 正在进行 OCR 的 memoId 集合，用于按钮 loading 态与防重入。 */
    ocrRunning: new Set<string>()
  })

  // 图片缓存访问顺序（LRU）；与对应缓存对象的键集合保持一致
  const imageCacheOrder: string[] = []
  const thumbCacheOrder: string[] = []
  const imageDisplayOrder: string[] = []

  /** 最近一次可撤销动作（Mod+Z 触发）；随新的可撤销动作覆盖。 */
  let lastUndoAction: (() => void) | null = null

  // JSON 导入的中间状态（预览面板用）
  const lastImportPayload = ref<ExportPayload | null>(null)
  const importPlan = ref<ImportPlan | null>(null)

  // ---------- 派生数据 ----------

  const groupNameMap = computed(() => {
    const map = new Map<string, Group>()
    for (const g of state.groups) map.set(g.id, g)
    return map
  })

  const activeMemos = computed(() => {
    switch (state.filter) {
      case 'all':
        return state.memos
      case 'pinned':
        return state.memos.filter((m) => m.pinned)
      case 'recent':
        return state.memos.filter((m) => m.lastUsedAt).sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))
      case 'images':
        return state.memos.filter((m) => hasImages(m))
      default: {
        const gid = state.filter.slice('group:'.length)
        return state.memos.filter((m) => m.groupId === gid)
      }
    }
  })

  const results = computed<ScoredMemo[]>(() => {
    const list = activeMemos.value
    const q = state.query.trim()
    if (!q) return sortNoQuery(list, state.settings.sortBy).map((memo) => ({ memo, score: 0 }))
    const entries = list.map((m) => getCachedSearchEntry(m, groupNameMap.value.get(m.groupId ?? '')?.name ?? ''))
    return searchMemos(list, entries, q)
  })

  const visibleMemos = computed(() => results.value.map((r) => r.memo))

  const selectionIndex = computed(() => {
    const id = state.selectionId
    if (!id) return -1
    return visibleMemos.value.findIndex((m) => m.id === id)
  })

  const selectedMemo = computed(() => {
    const idx = selectionIndex.value
    return idx >= 0 ? visibleMemos.value[idx] ?? null : null
  })

  /** 批量浮条的分组下拉选项（未分组 + 现有分组）。 */
  const batchGroupOptions = computed<BatchGroupOption[]>(() => [
    { id: null, label: t('batch.ungrouped') },
    ...state.groups.map((g) => ({ id: g.id, label: g.name }))
  ])

  /** 编辑器标签联想：全部已用标签。 */
  const allTags = computed(() => {
    const set = new Set<string>()
    for (const m of state.memos) for (const tag of m.tags) set.add(tag)
    return [...set].sort()
  })

  // ---------- 基础动作 ----------

  function toast(
    text: string,
    opts: { kind?: Toast['kind']; actionLabel?: string; onAction?: () => void; duration?: number } = {}
  ): void {
    const item: Toast = {
      id: toastSeq++,
      text,
      kind: opts.kind ?? 'info',
      actionLabel: opts.actionLabel,
      onAction: opts.onAction,
      duration: opts.duration ?? 2600
    }
    if (item.onAction) lastUndoAction = item.onAction
    state.toasts.push(item)
    if (state.toasts.length > 3) {
      // 超限时优先淘汰普通 Toast，带撤销动作的保留到最后（避免撤销按钮被挤掉）
      const dropIdx = state.toasts.findIndex((x) => !x.onAction)
      state.toasts.splice(dropIdx >= 0 ? dropIdx : 0, 1)
    }
    const isUndo = Boolean(opts.onAction)
    setTimeout(() => dismissToast(item.id), isUndo ? 5000 : item.duration)
  }

  function dismissToast(id: number): void {
    const idx = state.toasts.findIndex((x) => x.id === id)
    if (idx >= 0) state.toasts.splice(idx, 1)
  }

  /** Mod+Z：撤销最近一次可撤销动作（删除/批量删除）。 */
  function undoLastAction(): boolean {
    const fn = lastUndoAction
    if (!fn) return false
    lastUndoAction = null
    fn()
    return true
  }

  /** 静默持久化：失败才提示（recordUsage/置顶等高频写路径，成功时不打扰）。 */
  function persistQuiet(memo: Memo): void {
    if (!repo.saveMemo(memo)) toast(t('toasts.saveFailed'), { kind: 'error' })
  }

  function reload(): void {
    const data = repo.loadAll()
    state.memos = data.memos
    state.groups = data.groups
    state.settings = data.settings
    state.brokenDocs = countBrokenDocs()
    if (state.brokenDocs > 0) toast(t('toasts.dbBroken', { count: state.brokenDocs }), { kind: 'error' })
  }

  function countBrokenDocs(): number {
    // allDocs 已在 loadAll 里过滤坏数据；这里通过文档数与有效数对比
    const total = platform.db.allDocs('sm/memo/').length
    return Math.max(0, total - state.memos.length)
  }

  function seedIfNeeded(): void {
    if (repo.isSeeded()) return
    const hasData = state.memos.length > 0 || state.groups.length > 0
    if (!hasData) {
      const seed = buildSeedData()
      state.groups = seed.groups
      state.memos = seed.memos
      for (const memo of state.memos) repo.saveMemo(memo)
      repo.saveGroups(state.groups)
    }
    repo.markSeeded()
  }

  /** 空状态“导入示例”入口：按名称映射分组后重建示例条目（不重复导入）。 */
  function importSeed(): void {
    if (state.memos.length > 0) return
    const seed = buildSeedData()
    const nameToId = new Map<string, string>()
    for (const g of seed.groups) {
      const existing = state.groups.find((x) => x.name === g.name)
      if (existing) {
        nameToId.set(g.name, existing.id)
        continue
      }
      const created = createGroup(g.name, g.color)
      if (created) nameToId.set(g.name, created.id)
    }
    const now = Date.now()
    seed.memos.forEach((memo, i) => {
      const originGroup = seed.groups.find((g) => g.id === memo.groupId)
      const groupId = originGroup ? (nameToId.get(originGroup.name) ?? null) : null
      const clone: Memo = { ...memo, id: newMemoId(now + i), groupId, createdAt: now + i, updatedAt: now + i }
      state.memos.push(clone)
      repo.saveMemo(clone)
    })
    toast(t('toasts.saved'), { kind: 'success', duration: 1200 })
  }

  function init(): void {
    reload()
    seedIfNeeded()
    state.previewMode = state.settings.showPreviewPane ? 'split' : 'hidden'
    applyTheme()
    state.backupAt = repo.loadBackup()?.savedAt ?? null
    reconcileKeywordFeatures()
    state.ready = true
  }

  /** 云端数据到达（onDbPull）：编辑中不打断，其余情况刷新列表。 */
  function onDbSync(): void {
    if (!state.ready || state.editor !== null || state.previewEdit !== null) return
    reload()
    reconcileKeywordFeatures()
    toast(t('toasts.dbSynced'), { kind: 'info' })
  }

  // ---------- 主题 ----------

  /** 按设置的主题模式计算生效明暗：dark 固定暗色，light 固定亮色，system 跟随系统。 */
  function applyTheme(): void {
    state.dark = state.settings.themeMode === 'dark' || (state.settings.themeMode === 'system' && state.systemDark)
  }

  /** 系统明暗变化（由 App.vue 的 watchDark 转发）；跟随系统模式下即时生效。 */
  function setSystemDark(dark: boolean): void {
    state.systemDark = dark
    applyTheme()
  }

  // ---------- 搜索与选择 ----------

  function setQuery(q: string): void {
    state.query = q
    const vis = visibleMemos.value
    if (vis.length > 0) {
      if (!state.selectionId || !vis.some((m) => m.id === state.selectionId)) state.selectionId = vis[0].id
    } else {
      state.selectionId = null
    }
  }

  function moveSelection(delta: number): boolean {
    const vis = visibleMemos.value
    if (vis.length === 0) return false
    const idx = selectionIndex.value
    const next = idx === -1 ? 0 : (idx + delta + vis.length) % vis.length
    state.selectionMoveDir = delta > 0 ? 1 : -1
    state.selectionId = vis[next].id
    return true
  }

  /** 跳到第一条 / 最后一条（Home/End）。 */
  function jumpSelection(edge: 'first' | 'last'): boolean {
    const vis = visibleMemos.value
    if (vis.length === 0) return false
    state.selectionMoveDir = edge === 'first' ? 1 : -1
    state.selectionId = (edge === 'first' ? vis[0] : vis[vis.length - 1])!.id
    return true
  }

  /** 翻页选择（PageUp/PageDown），页大小取 10。 */
  function pageSelection(direction: 1 | -1): boolean {
    const vis = visibleMemos.value
    if (vis.length === 0) return false
    const idx = Math.max(0, selectionIndex.value)
    const next = Math.max(0, Math.min(vis.length - 1, idx + direction * 10))
    state.selectionMoveDir = direction
    state.selectionId = vis[next]!.id
    return true
  }

  /** 选中指定条目（组件不得直接改 state）。 */
  function selectMemo(id: string): void {
    state.selectionMoveDir = 0
    state.selectionId = id
  }

  /** 合并编辑器表单字段（分组内联新建等场景）。 */
  function patchEditor(patch: Partial<EditorForm>): void {
    if (state.editor) state.editor = { ...state.editor, ...patch }
  }

  /** 打开编辑器字段弹窗（分组/标签/触发词，一次一个）；传 null 即关闭。 */
  function setEditorMeta(field: EditorMetaField | null): void {
    state.editorMeta = field
  }

  /** 关闭编辑器字段弹窗。 */
  function closeEditorMeta(): void {
    state.editorMeta = null
  }

  function cycleFilter(direction: 1 | -1): void {
    const chips: GroupFilter[] = ['all', 'pinned', 'recent', 'images', ...state.groups.map((g) => `group:${g.id}` as GroupFilter)]
    const idx = chips.indexOf(state.filter)
    const next = chips[((idx === -1 ? 0 : idx + direction) + chips.length) % chips.length]
    setFilter(next)
  }

  function setFilter(filter: GroupFilter): void {
    state.filter = filter
    state.selectionId = visibleMemos.value[0]?.id ?? null
  }

  // ---------- 视图 ----------

  function switchView(view: ViewName): void {
    if (state.view !== view) {
      state.previousView = state.view
      state.view = view
    }
    state.batchSelection.clear()
    state.batchAnchor = null
    state.contextMenu = null
  }

  function backToPrevious(): boolean {
    if (state.view === 'list') return false
    const target: ViewName = state.previousView === 'editor' ? 'list' : state.previousView
    switchView(target)
    return true
  }

  // ---------- 应用内确认对话框 ----------

  function requestConfirm(text: string, onOk: () => void, opts: { danger?: boolean } = {}): void {
    state.confirm = { text, danger: opts.danger, onOk }
  }

  function resolveConfirm(ok: boolean): void {
    const c = state.confirm
    state.confirm = null
    if (ok && c) c.onOk()
  }

  // ---------- 帮助浮层 ----------

  function toggleHelp(visible?: boolean): void {
    state.helpVisible = visible ?? !state.helpVisible
  }

  // ---------- 粘贴 ----------

  async function pasteMemo(memo: Memo, opts: { copyOnly?: boolean } = {}): Promise<void> {
    // 图文混排条目按文字粘贴：图片标记先剥离再走占位符解析（纯图条目在 executePaste 里走图片路径）
    const segments = parsePlaceholders(stripImageTokens(memo.content))
    if (hasInputPlaceholder(segments) && !opts.copyOnly) {
      const first = resolveSegments(segments, {})
      state.pendingPaste = { memo, segments, prompts: first.prompts, answers: {}, copyOnly: false }
      return
    }
    await executePaste(memo, segments, {}, opts.copyOnly ?? false)
  }

  /** 粘贴结果 → 用户提示（文本与图片两条路径共用）。 */
  function reportPasteOutcome(outcome: PasteOutcome): void {
    if (outcome === 'pasted') {
      toast(t('toasts.pasted'), { kind: 'success', duration: 1200 })
    } else if (outcome === 'pasted-fallback') {
      toast(t('toasts.pasteFallback'), { kind: 'success' })
    } else if (outcome === 'copied') {
      platform.notify(t('toasts.copied'))
      toast(t('toasts.copied'), { kind: 'info' })
    } else {
      platform.notify(t('toasts.pasteFailed'))
      toast(t('toasts.pasteFailed'), { kind: 'error' })
    }
  }

  /** 取图片 dataURL（LRU 缓存；超限淘汰最久未访问，需要时从附件/kv 回源）。粘贴/复制/OCR 等宿主 API 路径用。 */
  function memoImage(slotId: string): string {
    const cached = state.imageUrls[slotId]
    if (cached) {
      touchImageCache(slotId)
      return cached
    }
    const url = repo.loadImage(slotId)
    if (url) cacheImage(slotId, url)
    return url ?? ''
  }

  /**
   * 取全尺寸展示 URL（Blob URL，LRU 缓存、淘汰 revoke）。
   * 展示路径与 dataURL 路径分离：字节 → Blob 不经 base64 字符串，内存约省一半。
   */
  function memoImageDisplay(slotId: string): string {
    const cached = state.imageDisplays[slotId]
    if (cached) {
      touchDisplayCache(slotId)
      return cached
    }
    const data = repo.loadImageBytes(slotId)
    if (!data) return ''
    const url = bytesToBlobUrl(data.bytes, data.mime)
    state.imageDisplays[slotId] = url
    touchDisplayCache(slotId)
    return url
  }

  // ---- 缩略图管线：列表渲染只解码缩小图，原图仅展开/全屏/粘贴时加载 ----

  const thumbQueue: string[] = []
  let thumbActive = 0

  /**
   * 确保某条目首图缩略图可用（列表行/网格墙用）：幂等，未缓存则入队异步生成。
   * 由列表/网格对可见行调用；pending 期间组件渲染占位块，ready 后响应式刷新。
   */
  function ensureThumb(memo: Memo): void {
    const slot = firstImageSlot(memo)
    if (!slot) return
    const img = memo.images?.find((x) => x.id === slot)
    ensureThumbSlot(slot, img ? { width: img.width, height: img.height } : undefined)
  }

  /** 确保某图片槽的缩略图可用（行内图片渲染用）；dimsHint 为元数据里的宽高（可为 0）。 */
  function ensureThumbSlot(slotId: string, dimsHint?: { width: number; height: number }): void {
    if (state.imageThumbs[slotId]) {
      touchThumbCache(slotId)
      return
    }
    state.imageThumbs[slotId] = {
      status: 'pending',
      small: '',
      width: dimsHint?.width ?? 0,
      height: dimsHint?.height ?? 0
    }
    touchThumbCache(slotId)
    thumbQueue.push(slotId)
    runThumbQueue()
  }

  /** 队列泵：限并发（解码在主线程 canvas，需给滚动让路），完成一个补一个。 */
  function runThumbQueue(): void {
    if (thumbActive >= THUMB_CONCURRENCY) return
    const slotId = thumbQueue.shift()
    if (slotId === undefined) return
    thumbActive += 1
    void generateThumbJob(slotId).finally(() => {
      thumbActive -= 1
      runThumbQueue()
    })
  }

  /** 单条缩略图生成：文件头先出尺寸（徽标可先行显示），再解码缩小；附件缺失标记失败。 */
  async function generateThumbJob(slotId: string): Promise<void> {
    const entry = state.imageThumbs[slotId]
    if (!entry || entry.status !== 'pending') return
    const data = repo.loadImageBytes(slotId)
    if (!data) {
      entry.status = 'failed'
      return
    }
    const dims = imageDimensions(data.bytes)
    if (dims) {
      entry.width = dims.width
      entry.height = dims.height
      backfillMemoDims(slotId, dims, data.bytes.length)
    }
    const source = bytesToBlobUrl(data.bytes, data.mime)
    const result = await generateThumb(source, THUMB_SMALL_MAX)
    URL.revokeObjectURL(source)
    if (state.imageThumbs[slotId] !== entry) return // 期间被淘汰/删除，丢弃结果
    if (!result) {
      entry.status = 'failed'
      return
    }
    entry.small = result.dataUrl
    entry.width = result.width
    entry.height = result.height
    backfillMemoDims(slotId, result, data.bytes.length)
    entry.status = 'ready'
  }

  /** 老数据缺尺寸元数据时在内存补齐（下次任意持久化顺带落库，不做滚动期写库）。 */
  function backfillMemoDims(slotId: string, dims: { width: number; height: number }, bytes: number): void {
    const memo = state.memos.find((m) => m.images?.some((img) => img.id === slotId))
    if (!memo) return
    const image = memo.images?.find((img) => img.id === slotId)
    if (!image) return
    if (!image.width || !image.height) {
      image.width = dims.width
      image.height = dims.height
    }
    if (!image.bytes) image.bytes = bytes
  }

  /** 悬浮快览用大图（≤480px）：按需生成并写回缓存条目，失败静默（快览回退小图）。 */
  function ensureThumbLarge(slotId: string): void {
    const entry = state.imageThumbs[slotId]
    if (!entry || entry.status !== 'ready' || entry.large) return
    const data = repo.loadImageBytes(slotId)
    if (!data) return
    const source = bytesToBlobUrl(data.bytes, data.mime)
    void generateThumb(source, THUMB_LARGE_MAX).then((result) => {
      URL.revokeObjectURL(source)
      if (result && state.imageThumbs[slotId] === entry) entry.large = result.dataUrl
    })
  }

  function cacheImage(memoId: string, dataUrl: string): void {
    state.imageUrls[memoId] = dataUrl
    touchImageCache(memoId)
    while (imageCacheOrder.length > IMAGE_CACHE_MAX) {
      const oldest = imageCacheOrder.shift()
      if (oldest === undefined) break
      if (!imageCacheOrder.includes(oldest)) delete state.imageUrls[oldest]
    }
  }

  function touchImageCache(memoId: string): void {
    const idx = imageCacheOrder.indexOf(memoId)
    if (idx >= 0) imageCacheOrder.splice(idx, 1)
    imageCacheOrder.push(memoId)
  }

  function touchThumbCache(memoId: string): void {
    const idx = thumbCacheOrder.indexOf(memoId)
    if (idx >= 0) thumbCacheOrder.splice(idx, 1)
    thumbCacheOrder.push(memoId)
    while (thumbCacheOrder.length > THUMB_CACHE_MAX) {
      const oldest = thumbCacheOrder.shift()
      if (oldest === undefined) break
      if (!thumbCacheOrder.includes(oldest)) delete state.imageThumbs[oldest]
    }
  }

  function touchDisplayCache(memoId: string): void {
    const idx = imageDisplayOrder.indexOf(memoId)
    if (idx >= 0) imageDisplayOrder.splice(idx, 1)
    imageDisplayOrder.push(memoId)
    while (imageDisplayOrder.length > IMAGE_DISPLAY_CACHE_MAX) {
      const oldest = imageDisplayOrder.shift()
      if (oldest === undefined) break
      if (imageDisplayOrder.includes(oldest)) continue
      const url = state.imageDisplays[oldest]
      if (url) URL.revokeObjectURL(url)
      delete state.imageDisplays[oldest]
    }
  }

  /** 清掉一条图片的全部运行时缓存（dataURL / 缩略图 / 展示 Blob URL）。 */
  function dropImageCache(memoId: string): void {
    delete state.imageUrls[memoId]
    let idx = imageCacheOrder.indexOf(memoId)
    if (idx >= 0) imageCacheOrder.splice(idx, 1)
    delete state.imageThumbs[memoId]
    idx = thumbCacheOrder.indexOf(memoId)
    if (idx >= 0) thumbCacheOrder.splice(idx, 1)
    const display = state.imageDisplays[memoId]
    if (display) URL.revokeObjectURL(display)
    delete state.imageDisplays[memoId]
    idx = imageDisplayOrder.indexOf(memoId)
    if (idx >= 0) imageDisplayOrder.splice(idx, 1)
  }

  async function executePaste(
    memo: Memo,
    segments: Segment[],
    answers: Record<string, string>,
    copyOnly: boolean
  ): Promise<void> {
    // 纯图条目（正文除图片标记外无文字）：粘贴图片本体；混排条目走文字路径（标记已剥离）
    const firstSlot = firstImageSlot(memo)
    if (firstSlot && isImageOnlyContent(memo.content)) {
      const dataUrl = memoImage(firstSlot)
      if (!dataUrl) {
        toast(t('toasts.imageMissing'), { kind: 'error' })
        return
      }
      recordUsage(memo)
      if (copyOnly) {
        const ok = await platform.copyImage(dataUrl)
        toast(ok ? t('toasts.imageCopied') : t('toasts.pasteFailed'), { kind: ok ? 'success' : 'error' })
        return
      }
      const outcome = await platform.pasteImage(dataUrl, { restoreClipboard: state.settings.restoreClipboard })
      reportPasteOutcome(outcome)
      return
    }
    const clipboardText = await platform.readClipboardText()
    const { text } = resolveSegments(segments, { clipboardText: clipboardText ?? '', answers })
    recordUsage(memo)
    if (copyOnly) {
      const ok = await platform.copyText(text)
      toast(ok ? t('toasts.copied') : t('toasts.pasteFailed'), { kind: ok ? 'success' : 'error' })
      return
    }
    const outcome = await platform.pasteText(text, { restoreClipboard: state.settings.restoreClipboard })
    reportPasteOutcome(outcome)
  }

  function confirmPendingPaste(answers: Record<string, string>): void {
    const pending = state.pendingPaste
    if (!pending) return
    state.pendingPaste = null
    void executePaste(pending.memo, pending.segments, answers, pending.copyOnly)
  }

  function cancelPendingPaste(): void {
    state.pendingPaste = null
  }

  function recordUsage(memo: Memo): void {
    if (!state.settings.recordUsage) return
    const target = state.memos.find((m) => m.id === memo.id)
    if (!target) return
    target.useCount += 1
    target.lastUsedAt = Date.now()
    persistQuiet(target)
  }

  async function pasteSelected(shift: boolean): Promise<void> {
    const memo = selectedMemo.value ?? visibleMemos.value[0]
    if (!memo) return
    const copyOnly = shift ? state.settings.enterAction === 'paste' : state.settings.enterAction === 'copy'
    await pasteMemo(memo, { copyOnly })
  }

  async function quickPaste(index: number): Promise<boolean> {
    const memo = visibleMemos.value[index]
    if (!memo) return false
    await pasteMemo(memo)
    return true
  }

  // ---------- 编辑器 ----------

  /**
   * 校验并暂存一张待保存的图片像素（新增/换图共用）：分配图片槽 ID、把 dataURL 留在内存，
   * 保存时随正文标记落盘；非法/超限/超量时提示并返回 null。
   */
  function editorStageImage(dataUrl: string): string | null {
    const parsed = parseDataUrl(dataUrl)
    if (!parsed) {
      toast(t('toasts.imageInvalid'), { kind: 'error' })
      return null
    }
    if (exceedsImageLimit(dataUrlBytes(dataUrl))) {
      toast(t('toasts.imageTooLarge', { mb: Math.round(IMAGE_MAX_BYTES / 1024 / 1024) }), { kind: 'error' })
      return null
    }
    const known = new Set([...uniqueImageIds(state.editor?.content ?? ''), ...Object.keys(state.editorImages)])
    if (known.size >= MAX_MEMO_IMAGES) {
      toast(t('toasts.imageCountLimit', { max: MAX_MEMO_IMAGES }), { kind: 'error' })
      return null
    }
    const slot = newMemoId()
    state.editorImages = { ...state.editorImages, [slot]: dataUrl }
    return slot
  }

  function openEditor(
    form: Partial<EditorForm> & { mode: 'new' | 'edit' } & { initialImages?: string[] }
  ): void {
    state.editorImages = {}
    let content = form.content ?? ''
    // 剪贴板图片/主搜索栏存图入口：图片直接排进正文（图文混排，标记追加在末尾）
    for (const dataUrl of form.initialImages ?? []) {
      const slot = editorStageImage(dataUrl)
      if (slot) content = content ? `${content}\n{img:${slot}}` : `{img:${slot}}`
    }
    state.editor = {
      mode: form.mode,
      memoId: form.memoId ?? null,
      title: form.title ?? '',
      content,
      groupId: form.groupId ?? null,
      tagsText: form.tagsText ?? '',
      keyword: form.keyword ?? '',
      pinned: form.pinned ?? false,
      sensitive: form.sensitive ?? false
    }
    state.editorMeta = null
    switchView('editor')
  }

  function editMemo(id: string): void {
    const memo = state.memos.find((m) => m.id === id)
    if (!memo) return
    openEditor({
      mode: 'edit',
      memoId: memo.id,
      title: memo.title,
      // 正文原样载入（含图片标记）：编辑器把标记渲染为行内图片，保存时按标记对齐像素
      content: memo.content,
      groupId: memo.groupId,
      tagsText: memo.tags.join(', '),
      keyword: memo.keyword ?? '',
      pinned: memo.pinned,
      sensitive: memo.sensitive
    })
  }

  function findDuplicate(content: string, excludeId: string | null, imageHash?: string): Memo | undefined {
    if (imageHash) {
      return state.memos.find(
        (m) =>
          m.id !== excludeId &&
          (m.images?.some((img) => img.hash === imageHash) || m.imageHash === imageHash)
      )
    }
    const key = content.replace(/\r\n/g, '\n').trim()
    return state.memos.find(
      (m) => m.id !== excludeId && m.content.replace(/\r\n/g, '\n').trim() === key && key.length > 0
    )
  }

  /** 编辑器触发词实时冲突检测（排除自身）。 */
  function keywordConflicts(keyword: string, excludeId: string | null): boolean {
    const kw = keyword.trim()
    if (!kw) return false
    return state.memos.some((m) => m.id !== excludeId && m.keyword === kw)
  }

  /** 刚保存的条目应立即可见：被分组/置顶/图片筛选或搜索词隐藏时逐层复位并选中。 */
  function revealAfterSave(saved: Memo): void {
    const matchesFilter =
      state.filter === 'all' ||
      (state.filter === 'pinned' && saved.pinned) ||
      (state.filter === 'recent' && Boolean(saved.lastUsedAt)) ||
      (state.filter === 'images' && hasImages(saved)) ||
      (state.filter.startsWith('group:') && state.filter.slice('group:'.length) === (saved.groupId ?? ''))
    if (!matchesFilter) setFilter('all')
    if (state.query && !visibleMemos.value.some((m) => m.id === saved.id)) {
      state.query = ''
      platform.subInput?.setValue('')
    }
    state.selectionId = saved.id
  }

  /** 校验并保存编辑器表单，成功后返回列表并选中新保存的条目。 */
  function saveEditor(): boolean {
    const form = state.editor
    if (!form) return false
    const now = Date.now()
    const tags = form.tagsText
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8)

    // ---- 图片：正文标记引用的槽与暂存像素对齐；未知标记（无元数据无像素）剥离 ----
    const rawContent = form.content.replace(/\r\n/g, '\n')
    const referenced = uniqueImageIds(rawContent)
    if (referenced.length > MAX_MEMO_IMAGES) {
      toast(t('toasts.imageCountLimit', { max: MAX_MEMO_IMAGES }), { kind: 'error' })
      return false
    }
    const prevMemo = form.mode === 'edit' && form.memoId ? state.memos.find((m) => m.id === form.memoId) : undefined
    const prevImages = prevMemo?.images ?? []
    const nextImages: MemoImage[] = []
    const pixelsToSave: Array<{ slotId: string; dataUrl: string }> = []
    const known = new Set<string>()
    for (const slotId of referenced) {
      const dataUrl = state.editorImages[slotId]
      if (dataUrl) {
        const parsed = parseDataUrl(dataUrl)
        if (!parsed) continue
        const byteSize = dataUrlBytes(dataUrl)
        if (exceedsImageLimit(byteSize)) {
          toast(t('toasts.imageTooLarge', { mb: Math.round(IMAGE_MAX_BYTES / 1024 / 1024) }), { kind: 'error' })
          return false
        }
        // 文件头解析原始像素尺寸（列表尺寸徽标用，不触发像素解码）
        const dims = imageDimensions(base64ToBytes(parsed.base64))
        nextImages.push({
          id: slotId,
          mime: parsed.mime,
          hash: fnv1aHash(dataUrl),
          width: dims?.width ?? 0,
          height: dims?.height ?? 0,
          bytes: byteSize
        })
        pixelsToSave.push({ slotId, dataUrl })
        known.add(slotId)
      } else {
        // 未变的既有图：元数据原样保留（含已识别的 OCR 文本）
        const prev = prevImages.find((img) => img.id === slotId)
        if (prev) {
          nextImages.push(prev)
          known.add(slotId)
        }
      }
    }
    const content = referenced.length > 0 ? pruneUnknownTokens(rawContent, known) : rawContent

    if (new Blob([content]).size > CONTENT_MAX_BYTES) {
      toast(t('toasts.contentTooLarge'), { kind: 'error' })
      return false
    }
    if (nextImages.length === 0 && !stripImageTokens(content).trim()) {
      toast(t('toasts.contentEmpty'), { kind: 'error' })
      return false
    }

    const kind: Memo['kind'] = nextImages.length > 0 && isImageOnlyContent(content) ? 'image' : 'text'
    const ocrText = nextImages.map((img) => img.ocrText ?? '').filter(Boolean).join('\n') || undefined
    let saved: Memo
    if (form.mode === 'edit' && form.memoId) {
      const existing = state.memos.find((m) => m.id === form.memoId)
      if (!existing) return false
      Object.assign(existing, {
        title: form.title.trim(),
        content,
        kind,
        images: nextImages.length > 0 ? nextImages : undefined,
        // v1 单图字段彻底退役（内存对象同步清理，避免再落库）
        mime: undefined,
        imageHash: undefined,
        imageWidth: undefined,
        imageHeight: undefined,
        imageBytes: undefined,
        ocrText,
        groupId: form.groupId,
        tags,
        keyword: form.keyword.trim() || undefined,
        pinned: form.pinned,
        sensitive: form.sensitive,
        updatedAt: now
      })
      saved = existing
      syncKeywordFeature(saved)
    } else {
      saved = {
        id: newMemoId(),
        title: form.title.trim(),
        content,
        kind,
        images: nextImages.length > 0 ? nextImages : undefined,
        ocrText,
        groupId: form.groupId,
        tags,
        keyword: form.keyword.trim() || undefined,
        pinned: form.pinned,
        sensitive: form.sensitive,
        order: minOrder() - 1,
        useCount: 0,
        lastUsedAt: null,
        createdAt: now,
        updatedAt: now
      }
      state.memos.push(saved)
      syncKeywordFeature(saved)
    }
    if (!repo.saveMemo(saved)) {
      toast(t('toasts.saveFailed'), { kind: 'error' })
      return false
    }
    // 新增/换图像素落盘（槽桩文档）；从正文移除的槽清理桩文档与缓存
    for (const item of pixelsToSave) {
      if (!repo.saveImage(item.slotId, item.dataUrl)) {
        toast(t('toasts.saveFailed'), { kind: 'error' })
        return false
      }
      dropImageCache(item.slotId)
      cacheImage(item.slotId, item.dataUrl)
    }
    for (const img of prevImages) {
      if (!known.has(img.id)) {
        repo.removeImageSlot(img.id)
        dropImageCache(img.id)
      }
    }
    state.editorImages = {}
    if (new Blob([content]).size > CONTENT_WARN_BYTES) {
      toast(t('toasts.contentLarge', { kb: Math.round(new Blob([content]).size / 1024) }), { kind: 'info' })
    }
    toast(t('toasts.saved'), { kind: 'success', duration: 1400 })
    repo.clearDraft()
    // OCR 开启时保存含图条目后自动识别（异步，不阻塞保存反馈；只识别还没有文字的图）
    if (saved.images && saved.images.length > 0 && state.settings.imageOcrEnabled) {
      void runOcr(saved.id, { onlyMissing: true })
    }
    state.editor = null
    switchView('list')
    revealAfterSave(saved)
    return true
  }

  /** 剥离正文中没有对应图片数据的标记（引用缺失槽的标记保存时丢弃，不残留坏图）。 */
  function pruneUnknownTokens(content: string, known: Set<string>): string {
    return content.replace(IMG_TOKEN_RE, (token, id: string) => (known.has(id) ? token : ''))
  }

  function minOrder(): number {
    return state.memos.reduce((min, m) => Math.min(min, m.order), 0)
  }

  /** 关闭编辑器；脏表单先走应用内确认（原生 confirm 在宿主 WebView 可能被禁用）。 */
  function closeEditor(force = false): void {
    const form = state.editor
    if (!force && form && isFormDirty(form)) {
      requestConfirm(t('editor.confirmDiscard'), () => closeEditor(true))
      return
    }
    repo.clearDraft()
    state.editorImages = {}
    state.editorMeta = null
    state.editor = null
    switchView('list')
  }

  function isFormDirty(form: EditorForm): boolean {
    if (form.mode === 'new') {
      return form.title.trim() !== '' || form.content.trim() !== '' || Object.keys(state.editorImages).length > 0
    }
    const memo = state.memos.find((m) => m.id === form.memoId)
    if (!memo) return false
    return (
      memo.title !== form.title.trim() ||
      memo.content !== form.content ||
      memo.tags.join(', ') !== form.tagsText ||
      (memo.keyword ?? '') !== form.keyword.trim() ||
      memo.pinned !== form.pinned ||
      memo.sensitive !== form.sensitive ||
      (memo.groupId ?? '') !== (form.groupId ?? '')
    )
  }

  /** 保存编辑草稿；图片像素不进草稿（体积大），引用暂存像素的标记一并剥离（恢复后不残留坏图）。 */
  function saveDraft(): void {
    const form = state.editor
    if (!form || !isFormDirty(form)) return
    // 既有图的标记保留（像素在库里）；仅本次新增又未保存的图剥离
    const ephemeral = new Set(Object.keys(state.editorImages))
    const keep = new Set(uniqueImageIds(form.content).filter((id) => !ephemeral.has(id)))
    repo.saveDraft({ ...form, content: pruneUnknownTokens(form.content, keep), savedAt: Date.now() })
  }

  function tryRestoreDraft(): void {
    const draft = repo.getDraft<EditorForm & { savedAt: number }>()
    if (!draft || Date.now() - (draft.savedAt ?? 0) > DRAFT_MAX_AGE_MS) {
      repo.clearDraft()
      return
    }
    openEditor({ ...draft, mode: draft.mode })
    toast(t('toasts.restoredDraftNoImage'), { kind: 'info' })
  }

  // ---------- 删除 / 批量 ----------

  /**
   * 物理删除一条备忘：删除前自动快照；为撤销保留全部图片像素（按图片槽），
   * 撤销窗口内可完整恢复（含触发词与使用统计）。
   */
  function deleteMemo(id: string): void {
    const idx = state.memos.findIndex((m) => m.id === id)
    if (idx === -1) return
    const memo = state.memos[idx]!
    snapshotBeforeBulk('delete-one')
    const pixels = collectMemoPixels(memo)
    repo.removeMemo(memo.id)
    for (const slot of allImageSlots(memo)) dropImageCache(slot)
    state.memos.splice(idx, 1)
    removeKeywordFeature(memo)
    state.batchSelection.delete(memo.id)
    if (state.selectionId === id) {
      state.selectionId = visibleMemos.value[Math.min(idx, visibleMemos.value.length - 1)]?.id ?? null
    }
    toast(t('toasts.deleted'), {
      kind: 'info',
      actionLabel: t('toasts.undo'),
      onAction: () => {
        state.memos.push(memo)
        if (repo.saveMemo(memo)) restoreMemoPixels(pixels)
        syncKeywordFeature(memo)
        state.selectionId = memo.id
        toast(t('toasts.restored'), { kind: 'success' })
      }
    })
  }

  /** 物理删除并彻底清理一条备忘（无撤销路径；仅批量/内部使用）。 */
  function purgeMemo(id: string): void {
    const idx = state.memos.findIndex((m) => m.id === id)
    if (idx === -1) return
    const [memo] = state.memos.splice(idx, 1)
    repo.removeMemo(memo.id)
    for (const slot of allImageSlots(memo)) dropImageCache(slot)
    removeKeywordFeature(memo)
    if (state.selectionId === id) state.selectionId = visibleMemos.value[0]?.id ?? null
  }

  /** 取一条备忘全部图片的像素（槽 ID → dataURL；撤销/副本恢复用，读不到的槽跳过）。 */
  function collectMemoPixels(memo: Memo): Record<string, string> {
    const pixels: Record<string, string> = {}
    for (const slot of allImageSlots(memo)) {
      const url = memoImage(slot)
      if (url) pixels[slot] = url
    }
    return pixels
  }

  /** 把暂存的像素写回各图片槽并预热缓存（撤销删除/批量恢复共用）。 */
  function restoreMemoPixels(pixels: Record<string, string>): void {
    for (const [slot, dataUrl] of Object.entries(pixels)) {
      if (repo.saveImage(slot, dataUrl)) cacheImage(slot, dataUrl)
    }
  }

  function togglePinned(id: string): void {
    const memo = state.memos.find((m) => m.id === id)
    if (!memo) return
    memo.pinned = !memo.pinned
    persistQuiet(memo)
  }

  function duplicateMemo(id: string): void {
    const memo = state.memos.find((m) => m.id === id)
    if (!memo) return
    const now = Date.now()
    // 副本的图片槽全部换新 ID 并改写正文标记：与原图独立，删除/换图互不影响
    const slotMapping = new Map<string, string>()
    let images = memo.images
    let content = memo.content
    if (memo.images && memo.images.length > 0) {
      images = memo.images.map((img) => {
        const nextId = newMemoId()
        slotMapping.set(img.id, nextId)
        return { ...img, id: nextId }
      })
      content = replaceImageTokenIds(content, slotMapping)
    }
    const copy: Memo = {
      ...memo,
      id: newMemoId(),
      title: memo.title || '',
      images,
      content,
      order: minOrder() - 1,
      useCount: 0,
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now,
      keyword: undefined
    }
    state.memos.push(copy)
    repo.saveMemo(copy)
    // 复制像素数据到新槽，否则副本加载不到图
    for (const [oldId, newId] of slotMapping) {
      const url = memoImage(oldId)
      if (url) {
        repo.saveImage(newId, url)
        cacheImage(newId, url)
      }
    }
    state.selectionId = copy.id
    toast(t('toasts.saved'), { kind: 'success', duration: 1200 })
  }

  function moveToGroup(ids: string[], groupId: string | null): void {
    for (const id of ids) {
      const memo = state.memos.find((m) => m.id === id)
      if (!memo) continue
      memo.groupId = groupId
      memo.updatedAt = Date.now()
      persistQuiet(memo)
    }
  }

  function addTags(ids: string[], tag: string): void {
    const clean = tag.trim()
    if (!clean) return
    for (const id of ids) {
      const memo = state.memos.find((m) => m.id === id)
      if (!memo || memo.tags.includes(clean)) continue
      memo.tags = [...memo.tags, clean].slice(0, 8)
      persistQuiet(memo)
    }
  }

  /** 批量物理删除（多选模式）；快照 + 撤销（图片数据尽量随撤销还原）。 */
  function batchDelete(ids: string[]): void {
    const targets = ids
      .map((id) => state.memos.find((m) => m.id === id))
      .filter((m): m is Memo => m !== undefined)
    if (targets.length === 0) return
    snapshotBeforeBulk('batch-delete')
    const pixels: Record<string, string> = {}
    for (const memo of targets) {
      Object.assign(pixels, collectMemoPixels(memo))
      const idx = state.memos.indexOf(memo)
      state.memos.splice(idx, 1)
      repo.removeMemo(memo.id)
      for (const slot of allImageSlots(memo)) dropImageCache(slot)
      removeKeywordFeature(memo)
    }
    state.batchSelection.clear()
    if (state.selectionId && !state.memos.some((m) => m.id === state.selectionId)) {
      state.selectionId = visibleMemos.value[0]?.id ?? null
    }
    toast(t('toasts.batchDeleted', { count: targets.length }), {
      kind: 'info',
      actionLabel: t('toasts.undo'),
      onAction: () => {
        for (const memo of targets) {
          state.memos.push(memo)
          if (repo.saveMemo(memo)) restoreMemoPixels(pixels)
          syncKeywordFeature(memo)
        }
        state.selectionId = targets[0]?.id ?? null
        toast(t('toasts.restored'), { kind: 'success' })
      }
    })
  }

  // ---------- 批量多选 ----------

  /** 进入/退出多选模式（Mod+A 或工具栏按钮）；退出时清空选中集合。 */
  function toggleBatchMode(force?: boolean): void {
    state.batchMode = force ?? !state.batchMode
    if (!state.batchMode) {
      state.batchSelection.clear()
      state.batchAnchor = null
    }
  }

  /** 切换一条的多选状态；extend=true 时从锚点范围选择（Shift+点击）。 */
  function toggleBatchSelection(id: string, extend = false): void {
    if (extend && state.batchAnchor) {
      const vis = visibleMemos.value
      const from = vis.findIndex((m) => m.id === state.batchAnchor)
      const to = vis.findIndex((m) => m.id === id)
      if (from >= 0 && to >= 0) {
        const [lo, hi] = from < to ? [from, to] : [to, from]
        for (let i = lo; i <= hi; i++) state.batchSelection.add(vis[i]!.id)
        return
      }
    }
    if (state.batchSelection.has(id)) state.batchSelection.delete(id)
    else state.batchSelection.add(id)
    state.batchAnchor = id
  }

  /** 全选/清空当前可见列表的多选集合。 */
  function selectAllBatch(): void {
    const vis = visibleMemos.value
    if (state.batchSelection.size >= vis.length) state.batchSelection.clear()
    else for (const m of vis) state.batchSelection.add(m.id)
  }

  /** 批量移动到分组后退出多选。 */
  function batchMoveToGroup(groupId: string | null): void {
    const ids = [...state.batchSelection]
    if (ids.length === 0) return
    snapshotBeforeBulk('batch-move')
    moveToGroup(ids, groupId)
    toggleBatchMode(false)
    toast(t('toasts.saved'), { kind: 'success', duration: 1200 })
  }

  /** 批量加标签后保持多选（可连续加多个标签）。 */
  function batchAddTags(tag: string): void {
    const ids = [...state.batchSelection]
    if (ids.length === 0 || !tag.trim()) return
    addTags(ids, tag.trim())
    toast(t('toasts.saved'), { kind: 'success', duration: 1200 })
  }

  /** 批量删除（带确认与撤销）。 */
  function batchDeleteSelected(): void {
    const ids = [...state.batchSelection]
    if (ids.length === 0) return
    requestConfirm(t('toasts.batchDeleted', { count: ids.length }), () => {
      batchDelete(ids)
      toggleBatchMode(false)
    }, { danger: true })
  }

  function reorderMemo(id: string, targetIndex: number): void {
    // 手动排序：以可见顺序重建 order 字段
    const list = visibleMemos.value.filter((m) => m.id !== id)
    const memo = state.memos.find((m) => m.id === id)
    if (!memo) return
    const idx = Math.max(0, Math.min(targetIndex, list.length))
    const ordered = [...list.slice(0, idx), memo, ...list.slice(idx)]
    ordered.forEach((m, i) => {
      if (m.order !== i) {
        m.order = i
        m.updatedAt = Date.now()
        persistQuiet(m)
      }
    })
  }

  function nudgeOrder(id: string, delta: -1 | 1): void {
    const vis = visibleMemos.value
    const idx = vis.findIndex((m) => m.id === id)
    if (idx === -1) return
    state.selectionMoveDir = delta
    reorderMemo(id, idx + delta)
    state.selectionId = id
  }

  // ---------- 分组 ----------

  function createGroup(name: string, color?: string): Group | null {
    const clean = name.trim()
    if (!clean) return null
    const group: Group = { id: newGroupId(), name: clean.slice(0, 30), color, order: state.groups.length + 1 }
    state.groups.push(group)
    repo.saveGroups(state.groups)
    return group
  }

  function renameGroup(id: string, name: string): void {
    const group = state.groups.find((g) => g.id === id)
    if (!group || !name.trim()) return
    group.name = name.trim().slice(0, 30)
    repo.saveGroups(state.groups)
  }

  function setGroupColor(id: string, color: string | undefined): void {
    const group = state.groups.find((g) => g.id === id)
    if (!group) return
    group.color = color
    repo.saveGroups(state.groups)
  }

  /** 删除分组：deleteMemos=true 时组内条目一并删除（物理，先快照），否则移到未分组。 */
  function deleteGroup(id: string, deleteMemosFlag: boolean): void {
    const idx = state.groups.findIndex((g) => g.id === id)
    if (idx === -1) return
    snapshotBeforeBulk('delete-group')
    if (deleteMemosFlag) {
      for (const memo of state.memos.filter((m) => m.groupId === id)) {
        purgeMemo(memo.id)
      }
    } else {
      for (const memo of state.memos.filter((m) => m.groupId === id)) {
        memo.groupId = null
        persistQuiet(memo)
      }
    }
    state.groups.splice(idx, 1)
    repo.saveGroups(state.groups)
    if (state.filter === `group:${id}`) setFilter('all')
  }

  function reorderGroup(id: string, targetIndex: number): void {
    const idx = state.groups.findIndex((g) => g.id === id)
    if (idx === -1) return
    const [group] = state.groups.splice(idx, 1)
    state.groups.splice(Math.max(0, Math.min(targetIndex, state.groups.length)), 0, group)
    state.groups.forEach((g, i) => {
      g.order = i + 1
    })
    repo.saveGroups(state.groups)
  }

  /** 分组管理弹窗开关（状态在 store，供全局键盘路由判断 Esc 优先级）。 */
  function setGroupManagerOpen(open: boolean): void {
    state.showGroupManager = open
  }

  // ---------- 设置 ----------

  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
    state.settings = { ...state.settings, [key]: value }
    repo.saveSettings(state.settings)
    if (key === 'showPreviewPane') state.previewMode = value ? 'split' : 'hidden'
    if (key === 'themeMode') applyTheme()
    // 切换列表展示模式时清空条目级展开开关：模式切换是全局重置，
    // 避免旧开关在 XOR 语义下把刚展开的条目又收起来
    if (key === 'listMode') state.expandedItems.clear()
  }

  function clearUsage(): void {
    for (const memo of state.memos) {
      if (memo.useCount !== 0 || memo.lastUsedAt !== null) {
        memo.useCount = 0
        memo.lastUsedAt = null
        persistQuiet(memo)
      }
    }
    toast(t('toasts.usageCleared'), { kind: 'success' })
  }

  // ---------- 敏感遮罩 ----------

  function toggleReveal(id: string): void {
    if (state.revealSensitive.has(id)) state.revealSensitive.delete(id)
    else state.revealSensitive.add(id)
  }

  // ---------- 列表内联展开 ----------

  /** 切换条目内联展开；生效状态与 listMode='full' 取反叠加（组件负责 XOR）。 */
  function toggleExpanded(id: string): void {
    if (state.expandedItems.has(id)) state.expandedItems.delete(id)
    else state.expandedItems.add(id)
  }

  /**
   * 键盘 Space：等价于鼠标单击选中条目——切换内联展开（展开↔收起），
   * 并拉出收起的预览面板（与条目单击同语义：面板只会被拉出、不会被 Space 收起；
   * 设置停用面板时 expandPreviewPane 为无操作）。列表为空时无操作。
   */
  function activateSelection(): void {
    const memo = selectedMemo.value
    if (!memo) return
    if (state.previewMode === 'hidden') expandPreviewPane()
    toggleExpanded(memo.id)
  }

  // ---------- 条目右键菜单 ----------

  /** 打开条目右键菜单（顺带选中该条目，预览面板同步跟随）。 */
  function openContextMenu(x: number, y: number, memoId: string): void {
    state.contextMenu = { x, y, memoId }
    state.selectionId = memoId
  }

  function closeContextMenu(): void {
    state.contextMenu = null
  }

  // ---------- 预览面板：显隐切换（面板头部收起 / 收起态右缘拉出）与行内编辑 ----------

  /**
   * 预览面板显隐切换（Space 与 ⌘/Ctrl+P 共用）：可见（分栏）→ 收起；收起 → 显示。
   * 设置停用面板（showPreviewPane=false）时为无操作。条目点击不走这里（只会拉出面板）。
   * 完整编辑（原「全屏编辑」态）统一走编辑器视图（editMemo），不再有第二套全屏编辑样式。
   */
  function togglePreviewPane(): void {
    if (!state.settings.showPreviewPane) return
    applyPreviewMode(state.previewMode === 'hidden' ? 'split' : 'hidden')
  }

  /** 显示预览面板（收起后单击折叠条目拉出；已显示或设置停用时保持）。 */
  function expandPreviewPane(): void {
    if (!state.settings.showPreviewPane) return
    applyPreviewMode('split')
  }

  /** 面板头部 ► 按钮：收起面板（收起态保持）。 */
  function collapsePreviewPane(): void {
    applyPreviewMode('hidden')
  }

  /** 统一落地模式切换：离开可见态先自动保存行内编辑（视同失焦）。 */
  function applyPreviewMode(mode: PreviewMode): void {
    if (mode !== state.previewMode && state.previewMode !== 'hidden') commitPreviewEdit()
    state.previewMode = mode
  }

  /**
   * 进入预览面板行内编辑：以当前选中文本条目为草稿。
   * 仅纯文本条目可编辑（含图条目走完整编辑器，避免行内文本域暴露图片标记）；
   * 敏感遮罩的拦截由组件负责（需先点眼睛揭示）。
   */
  function beginPreviewEdit(): void {
    const memo = selectedMemo.value
    if (!memo || (memo.images?.length ?? 0) > 0) return
    state.previewEdit = { memoId: memo.id, title: memo.title, content: memo.content }
  }

  /** 更新行内编辑草稿（组件经此写入，避免直接改 state）。 */
  function patchPreviewEdit(patch: Partial<Pick<PreviewEditDraft, 'title' | 'content'>>): void {
    if (state.previewEdit) state.previewEdit = { ...state.previewEdit, ...patch }
  }

  /**
   * 结束行内编辑并自动保存；失焦 / Esc / Mod+Enter / 收起面板 / 插件重入共用。
   * 内容超限时提示并保留草稿（保持编辑态让用户修改）；无改动或草稿已失效则静默清除。
   */
  function commitPreviewEdit(): void {
    const draft = state.previewEdit
    if (!draft) return
    const memo = state.memos.find((m) => m.id === draft.memoId)
    if (!memo) {
      state.previewEdit = null
      return
    }
    const content = draft.content.replace(/\r\n/g, '\n')
    if (new Blob([content]).size > CONTENT_MAX_BYTES) {
      toast(t('toasts.contentTooLarge'), { kind: 'error' })
      return
    }
    state.previewEdit = null
    if (memo.title === draft.title.trim() && memo.content === content) return
    const before = { title: memo.title, content: memo.content }
    Object.assign(memo, { title: draft.title.trim(), content, updatedAt: Date.now() })
    if (!repo.saveMemo(memo)) {
      toast(t('toasts.saveFailed'), { kind: 'error' })
      return
    }
    syncKeywordFeature(memo)
    // 行内编辑也可撤销：误触失焦导致的无意修改可回退
    toast(t('toasts.saved'), {
      kind: 'success',
      duration: 1400,
      actionLabel: t('toasts.undo'),
      onAction: () => {
        Object.assign(memo, { ...before, updatedAt: Date.now() })
        if (repo.saveMemo(memo)) syncKeywordFeature(memo)
      }
    })
  }

  /**
   * 放弃行内编辑草稿并回到预览（Esc）：不落盘、不提示；
   * 保存路径仍是失焦 / Mod+Enter（commitPreviewEdit）。
   */
  function cancelPreviewEdit(): void {
    state.previewEdit = null
  }

  // ---------- 图片全屏与系统查看器 ----------

  /** 打开图片全屏浮层（插件窗口内最大展示）；按 memoId+imageId 记录，支持 ←/→ 翻页。 */
  function openLightboxForMemo(memoId: string, imageId?: string): void {
    const memo = state.memos.find((m) => m.id === memoId)
    if (!memo) return
    const slot = imageId ?? firstImageSlot(memo)
    if (!slot) return
    state.lightbox = { memoId, imageId: slot }
    memoImageDisplay(slot) // 预热展示 URL，打开即有图
  }

  /** 全屏浮层翻页：在当前可见列表的全部图片（跨条目、含混排行内图）间循环切换。 */
  function stepLightbox(delta: 1 | -1): void {
    const current = state.lightbox
    if (!current) return
    const ids = visibleMemos.value.flatMap((m) => allImageSlots(m).map((imageId) => ({ memoId: m.id, imageId })))
    if (ids.length === 0) return
    const idx = ids.findIndex((x) => x.imageId === current.imageId)
    const next = ids[(idx === -1 ? 0 : idx + delta + ids.length) % ids.length]!
    state.lightbox = next
    memoImageDisplay(next.imageId)
  }

  function closeLightbox(): void {
    state.lightbox = null
  }

  /** 把图片外开/悬浮窗的失败原因转为可操作提示（宿主内可据此定位环境缺哪一环）。 */
  function toastImageViewFailure(fail: ImageViewOutcome, apiName: string): void {
    switch (fail.reason) {
      case 'no-preload':
        toast(t('toasts.imageViewNoPreload'), { kind: 'error' })
        break
      case 'no-host-api':
        toast(t('toasts.imageViewNoApi', { api: apiName }), { kind: 'error' })
        break
      case 'write-failed':
        toast(t('toasts.imageViewWriteFailed', { detail: fail.detail ?? '' }), { kind: 'error' })
        break
      case 'host-call-failed':
        toast(t('toasts.imageViewCallFailed', { api: apiName, detail: fail.detail ?? '' }), { kind: 'error' })
        break
    }
  }

  /** 用系统默认看图软件打开图片（dataURL → 临时文件 → 宿主 shellOpenPath）。 */
  async function openMemoImageExternal(slotId: string): Promise<void> {
    const dataUrl = memoImage(slotId)
    if (!dataUrl) {
      toast(t('toasts.imageMissing'), { kind: 'error' })
      return
    }
    const out = await platform.openImageExternal(dataUrl)
    if (!out.ok) toastImageViewFailure(out, 'shellOpenPath')
  }

  /**
   * 独立悬浮窗查看图片：把图片原始像素尺寸交给平台层，
   * 由实现层查询所在屏幕适配初始窗口（≤工作区 80%，最小 360×280，可手动拖大）；不可用时提示。
   */
  async function openImageFloat(slotId: string): Promise<void> {
    const dataUrl = memoImage(slotId)
    if (!dataUrl) {
      toast(t('toasts.imageMissing'), { kind: 'error' })
      return
    }
    const meta = state.memos.flatMap((m) => m.images ?? []).find((img) => img.id === slotId)
    const out = await platform.openImageFloat(dataUrl, { width: meta?.width ?? 0, height: meta?.height ?? 0 })
    if (!out.ok) toastImageViewFailure(out, 'createBrowserWindow')
  }

  // ---------- 图片 OCR ----------

  /**
   * 识别图片文字：走 ZTools「提供商」的默认 OCR 提供商（ztools.ocr），
   * 逐张识别条目内的图片，结果写入 images[].ocrText（合并视图在 memo.ocrText）参与检索。
   * onlyMissing=true 时跳过已有识别结果的图（保存后自动识别不重复计费）。
   * 未启用/无提供商时给出对应提示。
   */
  async function runOcr(memoId: string, opts: { onlyMissing?: boolean } = {}): Promise<void> {
    const memo = state.memos.find((m) => m.id === memoId)
    if (!memo || (memo.images?.length ?? 0) === 0) return
    if (!state.settings.imageOcrEnabled) {
      toast(t('toasts.ocrDisabled'), { kind: 'info' })
      return
    }
    const ocr = platform.ocr
    if (!ocr) {
      toast(t('toasts.ocrUnavailable'), { kind: 'error' })
      return
    }
    if (state.ocrRunning.has(memoId)) return
    const targets = memo.images!.filter((img) => !(opts.onlyMissing && img.ocrText))
    if (targets.length === 0) return
    state.ocrRunning.add(memoId)
    try {
      let succeeded = 0
      let failed = 0
      for (const image of targets) {
        const dataUrl = memoImage(image.id)
        if (!dataUrl) {
          failed += 1
          continue
        }
        const text = await ocr.recognize(dataUrl)
        if (text === null) {
          failed += 1
          continue
        }
        image.ocrText = text || undefined
        succeeded += 1
      }
      if (succeeded === 0) {
        toast(t('toasts.ocrFailed'), { kind: 'error' })
        return
      }
      memo.ocrText = memo.images!.map((img) => img.ocrText ?? '').filter(Boolean).join('\n') || undefined
      memo.updatedAt = Date.now()
      persistQuiet(memo)
      toast(t('toasts.ocrDone'), { kind: 'success', duration: 1600 })
      if (failed > 0) toast(t('toasts.ocrPartialFailed', { count: failed }), { kind: 'info' })
    } finally {
      state.ocrRunning.delete(memoId)
    }
  }

  /** 快捷复制：条目一键复制（图片复制图片，文本复制文本），不粘贴。 */
  async function copyMemo(memo: Memo): Promise<void> {
    await pasteMemo(memo, { copyOnly: true })
  }

  // ---------- 导入导出 ----------

  function snapshotBeforeBulk(reason: string): void {
    void reason
    if (repo.saveBackup(state.memos, state.groups)) {
      state.backupAt = Date.now()
    }
  }

  async function exportData(kind: 'json' | 'json-group' | 'markdown' | 'csv'): Promise<void> {
    const now = new Date()
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    let name = `snap-memo-${stamp}`
    let content: string
    if (kind === 'markdown') {
      content = toMarkdown(activeMemos.value, state.groups)
      name += '.md'
    } else if (kind === 'csv') {
      // BOM 让 Excel 正确识别 UTF-8
      content = '\uFEFF' + toCsv(activeMemos.value, state.groups)
      name += '.csv'
    } else {
      const memos = kind === 'json-group' ? activeMemos.value : state.memos
      const groups = kind === 'json-group' ? state.groups.filter((g) => g.id === currentGroupId()) : state.groups
      // 全部图片的像素数据一并导出（图片槽 ID → dataURL，与 memos[].images 对齐）
      const images: Record<string, string> = {}
      for (const m of memos) {
        for (const slot of allImageSlots(m)) {
          const url = memoImage(slot)
          if (url) images[slot] = url
        }
      }
      content = JSON.stringify(buildExportPayload(memos, groups, Date.now(), images, state.settings), null, 2)
      name += '.json'
    }
    const result = await platform.files.pickSaveAndWrite(name, content)
    if (result === 'saved') toast(t('toasts.exported'), { kind: 'success' })
    else if (result === 'error') toast(t('toasts.exportFailed'), { kind: 'error' })
  }

  function currentGroupId(): string | null {
    return state.filter.startsWith('group:') ? state.filter.slice('group:'.length) : null
  }

  async function importFromFile(kind: 'json' | 'text'): Promise<void> {
    const file = await platform.files.pickAndReadText(
      kind === 'json' ? ['json'] : ['txt', 'md', 'csv', 'yml', 'yaml']
    )
    if (!file) return
    if (kind === 'text') {
      const entries = parseTextImport(file.text)
      if (entries.length === 0) {
        toast(t('toasts.importFailed', { reason: file.name }), { kind: 'error' })
        return
      }
      applyTextImport(entries)
      return
    }
    const parsed = parseImportPayload(file.text)
    if (!parsed.ok) {
      toast(t('toasts.importFailed', { reason: parsed.error }), { kind: 'error' })
      return
    }
    lastImportPayload.value = parsed.payload
    importPlan.value = planImport(state.memos, state.groups, parsed.payload, 'merge', () => newMemoId())
  }

  /** 备忘快贴插件在宿主数据库中的命名空间名。 */
  const MQP_PLUGIN_NAME = 'memo-quick-paste'

  /**
   * 从备忘快贴（memo-quick-paste）导入：preload 只读提取宿主数据库里该插件的
   * 文档与附件 → 转换为导入载荷 → 走与 JSON 导入相同的预览/合并管线。
   * 只读操作，不改动备忘快贴的数据；提取失败（非安装宿主等）按原因提示。
   */
  function importFromMemoQuickPaste(): void {
    if (!platform.hostData) {
      console.warn('[snap-memo] platform.hostData 不可用（preload 缺少 readHostPluginData），无法跨插件导入')
      toast(t('toasts.mqpNoHost'), { kind: 'error' })
      return
    }
    let dump
    try {
      dump = platform.hostData.readPlugin(MQP_PLUGIN_NAME)
    } catch (e) {
      // 完整错误对象（含 preload 侧诊断日志线索）打进控制台，便于排查；toast 仅显示 message
      console.error('[snap-memo] 读取备忘快贴宿主数据失败', e)
      toast(t('toasts.mqpReadFail', { reason: e instanceof Error ? e.message : String(e) }), { kind: 'error' })
      return
    }
    console.info('[snap-memo] 宿主数据提取成功:', {
      account: dump?.account,
      docs: dump?.docs?.length ?? 0,
      attachments: dump?.attachments?.length ?? 0,
      truncated: dump?.truncated
    })
    const result = convertMemoQuickPaste(dump, { newMemoId })
    if (result.payload.memos.length === 0) {
      toast(t('toasts.mqpEmpty'), { kind: 'error' })
      return
    }
    lastImportPayload.value = result.payload
    importPlan.value = planImport(state.memos, state.groups, result.payload, 'merge', () => newMemoId())
    if (result.missingImages > 0 || result.skippedDocs > 0) {
      toast(
        t('toasts.mqpPartial', { images: result.missingImages, skipped: result.skippedDocs }),
        { kind: 'info', duration: 6000 }
      )
    }
  }

  /** 文本导入：分组按名复用/新建，标签与触发词一并带入；重复内容跳过。 */
  function applyTextImport(entries: TextImportEntry[]): void {
    snapshotBeforeBulk('import-text')
    const nameToId = new Map<string, string>()
    const now = Date.now()
    const created: Memo[] = []
    let added = 0
    for (const entry of entries) {
      if (findDuplicate(entry.content, null)) continue
      let groupId: string | null = null
      if (entry.groupName) {
        let gid: string | null = nameToId.get(entry.groupName) ?? null
        if (!gid) {
          gid = state.groups.find((g) => g.name === entry.groupName)?.id ?? createGroup(entry.groupName)?.id ?? null
        }
        if (gid) nameToId.set(entry.groupName, gid)
        groupId = gid
      }
      const memo: Memo = {
        id: newMemoId(),
        title: entry.title,
        content: entry.content,
        groupId,
        tags: entry.tags,
        keyword: entry.keyword,
        pinned: false,
        sensitive: false,
        order: minOrder() - 1,
        useCount: 0,
        lastUsedAt: null,
        createdAt: now,
        updatedAt: now
      }
      state.memos.push(memo)
      created.push(memo)
      added += 1
    }
    for (const memo of created) repo.saveMemo(memo)
    reconcileKeywordFeatures()
    toast(t('toasts.imported', { add: added, update: 0, skip: entries.length - added }), { kind: 'success' })
  }

  function setImportStrategy(strategy: 'merge' | 'overwrite'): void {
    const payload = lastImportPayload.value
    if (!payload) return
    importPlan.value = planImport(state.memos, state.groups, payload, strategy, () => newMemoId())
  }

  function applyImport(): void {
    const plan = importPlan.value
    if (!plan) return
    snapshotBeforeBulk('import')
    if (plan.strategy === 'overwrite') {
      // 覆盖 = 真正替换：本地文档先全部删除（快照已留底）
      for (const memo of state.memos) repo.removeMemo(memo.id)
      state.memos = []
      state.groups = []
      for (const id of Object.keys(state.imageUrls)) dropImageCache(id)
    }
    state.groups = [...state.groups, ...plan.groupsToAdd]
    repo.saveGroups(state.groups)
    // 导入图片的尺寸元数据先解析好（纯文件头读取），随条目一并落库
    const incomingDims = new Map<string, { width: number; height: number; bytes: number }>()
    for (const item of plan.imagesToSave) {
      if (incomingDims.has(item.slotId)) continue
      const parsed = parseDataUrl(item.dataUrl)
      if (!parsed) continue
      const bytes = base64ToBytes(parsed.base64)
      const dims = imageDimensions(bytes)
      if (dims) incomingDims.set(item.slotId, { ...dims, bytes: bytes.length })
    }
    const incoming = [...plan.memosToAdd, ...plan.memosToUpdate]
    for (const memo of incoming) {
      for (const image of memo.images ?? []) {
        if (image.width && image.height && image.bytes) continue
        const dims = incomingDims.get(image.id)
        if (dims) {
          image.width = dims.width
          image.height = dims.height
          image.bytes = dims.bytes
        }
      }
      const idx = state.memos.findIndex((m) => m.id === memo.id)
      if (idx >= 0) state.memos[idx] = memo
      else state.memos.push(memo)
      repo.saveMemo(memo)
    }
    // 恢复图片像素数据（槽 ID 已按计划重分配，与正文标记对齐）
    for (const item of plan.imagesToSave) {
      if (repo.saveImage(item.slotId, item.dataUrl)) cacheImage(item.slotId, item.dataUrl)
    }
    // 导入文件携带设置时套用（偏好随数据迁移）
    if (plan.settingsToApply) {
      state.settings = { ...plan.settingsToApply }
      repo.saveSettings(state.settings)
      applyTheme()
      state.previewMode = state.settings.showPreviewPane ? 'split' : 'hidden'
    }
    toast(
      t('toasts.imported', { add: plan.memosToAdd.length, update: plan.memosToUpdate.length, skip: plan.memosUnchanged.length }),
      { kind: 'success' }
    )
    importPlan.value = null
    lastImportPayload.value = null
    reconcileKeywordFeatures()
  }

  function cancelImport(): void {
    importPlan.value = null
    lastImportPayload.value = null
  }

  /**
   * 恢复自动备份（安全语义）：
   * - 不先物理删除——把备份条目整体写回（覆盖当前值），附件随文档存活，图片通常无损；
   * - 备份里没有、且创建时间早于快照的本地条目被移除（即快照后那次批量操作的结果）；
   * - 快照之后新建的条目（createdAt > savedAt）保留，不被回滚波及。
   * 恢复前已再次快照（恢复本身也可通过再恢复撤销）。
   */
  function restoreBackup(): void {
    const backup = repo.loadBackup()
    if (!backup || backup.memos.length === 0) return
    snapshotBeforeBulk('restore-backup')
    const backupIds = new Set(backup.memos.map((m) => m.id))
    const keptNew = state.memos.filter((m) => !backupIds.has(m.id) && m.createdAt > backup.savedAt)
    for (const memo of [...state.memos]) {
      if (!backupIds.has(memo.id) && memo.createdAt <= backup.savedAt) {
        const idx = state.memos.indexOf(memo)
        state.memos.splice(idx, 1)
        repo.removeMemo(memo.id)
        for (const slot of allImageSlots(memo)) dropImageCache(slot)
        removeKeywordFeature(memo)
      }
    }
    state.memos = [...backup.memos.map((m) => ({ ...m })), ...keptNew]
    state.groups = backup.groups.map((g) => ({ ...g }))
    repo.saveGroups(state.groups)
    for (const memo of state.memos) repo.saveMemo(memo)
    reconcileKeywordFeatures()
    state.selectionId = state.memos[0]?.id ?? null
    toast(t('toasts.backupRestored', { count: backup.memos.length }), { kind: 'success' })
  }

  /** 当前备份是否被截断过（UI 提示用）；依赖 backupAt 以便每次快照后重新求值。 */
  const backupTruncated = computed(() => {
    void state.backupAt
    return repo.loadBackup()?.truncated ?? false
  })

  // ---------- 动态触发词 ----------

  function keywordCode(memo: Memo): string {
    return `smkw/${memo.id}`
  }

  function syncKeywordFeature(memo: Memo): void {
    const features = platform.features
    if (!features) return
    if (!memo.keyword) {
      features.remove(keywordCode(memo))
      return
    }
    const conflict = state.memos.find((m) => m.id !== memo.id && m.keyword === memo.keyword)
    if (conflict) {
      // 触发词冲突：不注册（后写覆盖先写的行为不确定），保留先注册的一方
      toast(t('toasts.keywordConflict', { keyword: memo.keyword }), { kind: 'info' })
      return
    }
    features.set({
      code: keywordCode(memo),
      explain: `粘贴：${memo.title || memo.content.slice(0, 20)}`,
      cmds: [memo.keyword]
    })
  }

  function removeKeywordFeature(memo: Memo): void {
    platform.features?.remove(keywordCode(memo))
  }

  /** 启动与导入后：按当前数据重建全部触发词，清理孤儿 Feature。 */
  function reconcileKeywordFeatures(): void {
    const features = platform.features
    if (!features) return
    const wanted = new Set(
      state.memos
        .filter((m) => m.keyword)
        .map((m) => keywordCode(m))
    )
    for (const f of features.list()) {
      if (f.code.startsWith('smkw/') && !wanted.has(f.code)) features.remove(f.code)
    }
    for (const memo of state.memos) {
      if (memo.keyword) syncKeywordFeature(memo)
    }
  }

  // ---------- 入口路由 ----------

  /** 新建备忘：优先取剪贴板图片（直接排进正文），其次剪贴板文本（重复内容仍会提示）。 */
  async function createNewFromClipboard(): Promise<void> {
    const image = await platform.readClipboardImage()
    if (image) {
      openEditor({ mode: 'new', initialImages: [image] })
      return
    }
    const clip = await platform.readClipboardText()
    const dup = clip ? findDuplicate(clip, null) : undefined
    if (dup) toast(t('toasts.duplicateFound', { title: dup.title || dup.content.slice(0, 20) }), { kind: 'info' })
    openEditor({ mode: 'new', content: clip ?? '', title: '' })
  }

  function handleEnter(action: { code: string; type: string; payload: unknown }): void {
    state.enterCount += 1
    // 插件隐藏期间行内编辑可能未触发失焦（宿主不派发 blur），重入时兜底自动保存
    commitPreviewEdit()
    reload()
    if (action.code.startsWith('smkw/')) {
      const id = action.code.slice('smkw/'.length)
      const memo = state.memos.find((m) => m.id === id)
      if (memo) {
        // 触发词路径按文字粘贴（图片标记剥离；纯图条目在 executePaste 内走图片路径）
        const segments = parsePlaceholders(stripImageTokens(memo.content))
        if (hasInputPlaceholder(segments)) {
          platform.showMainWindow()
          state.pendingPaste = { memo, segments, prompts: resolveSegments(segments, {}).prompts, answers: {}, copyOnly: false }
        } else {
          void pasteMemo(memo)
        }
      }
      return
    }
    // 常驻后台再次进入：重置搜索与选中，聚焦输入
    state.query = ''
    state.selectionId = visibleMemos.value[0]?.id ?? null
    state.revealSensitive.clear()
    state.contextMenu = null
    state.batchMode = false
    state.batchSelection.clear()
    // 图片拖拽/粘贴入口：载荷为 base64 或 dataURL
    if (action.code === 'snap-memo-save-img') {
      const dataUrl = normalizeImagePayload(action.payload)
      if (dataUrl) {
        const hash = fnv1aHash(dataUrl)
        const dup = state.memos.find(
          (m) => m.images?.some((img) => img.hash === hash) || m.imageHash === hash
        )
        if (dup) toast(t('toasts.duplicateFound', { title: dup.title || t('imageMemo') }), { kind: 'info' })
        openEditor({ mode: 'new', initialImages: [dataUrl] })
      } else {
        openEditor({ mode: 'new' })
      }
      return
    }
    if (action.code === 'snap-memo-save-regex' && typeof action.payload === 'string') {
      // regex 入口：主搜索栏命中 URL/邮箱/手机号等模式时“存为备忘”
      const text = action.payload
      const dup = text ? findDuplicate(text, null) : undefined
      if (dup) toast(t('toasts.duplicateFound', { title: dup.title || dup.content.slice(0, 20) }), { kind: 'info', duration: 4000 })
      openEditor({ mode: 'new', content: text, title: '', groupId: null })
      return
    }
    if (action.code === 'snap-memo-save' && (action.type === 'over' || typeof action.payload === 'string')) {
      const text = typeof action.payload === 'string' ? action.payload : ''
      const dup = text ? findDuplicate(text, null) : undefined
      if (dup) {
        toast(t('toasts.duplicateFound', { title: dup.title || dup.content.slice(0, 20) }), { kind: 'info', duration: 4000 })
      }
      openEditor({ mode: 'new', content: text, title: '', groupId: null })
      return
    }
    if (action.code === 'snap-memo-new') {
      void createNewFromClipboard()
      return
    }
    // 主入口：若存在近期草稿则恢复
    if (state.enterCount > 1) tryRestoreDraft()
    state.view = 'list'
  }

  /** 插件隐藏/退出：行内编辑落库 + 编辑器草稿保存。 */
  function handleOut(): void {
    commitPreviewEdit()
    saveDraft()
  }

  /** 插件分离到独立窗口：同 handleOut（宿主分离时不触发 onPluginOut）。 */
  function handleDetach(): void {
    commitPreviewEdit()
    saveDraft()
  }

  function exitPlugin(): void {
    platform.outPlugin()
  }

  return {
    state,
    repo,
    computed: {
      results,
      visibleMemos,
      selectedMemo,
      selectionIndex,
      groupNameMap,
      activeMemos,
      batchGroupOptions,
      allTags,
      backupTruncated
    },
    actions: {
      init,
      importSeed,
      toast,
      dismissToast,
      undoLastAction,
      setQuery,
      moveSelection,
      jumpSelection,
      pageSelection,
      selectMemo,
      patchEditor,
      setEditorMeta,
      closeEditorMeta,
      cycleFilter,
      setFilter,
      switchView,
      backToPrevious,
      requestConfirm,
      resolveConfirm,
      toggleHelp,
      pasteMemo,
      pasteSelected,
      quickPaste,
      copyMemo,
      memoImage,
      memoImageDisplay,
      ensureThumb,
      ensureThumbSlot,
      ensureThumbLarge,
      editorStageImage,
      runOcr,
      onDbSync,
      createNewFromClipboard,
      saveDraft,
      confirmPendingPaste,
      cancelPendingPaste,
      openEditor,
      editMemo,
      saveEditor,
      closeEditor,
      findDuplicate,
      keywordConflicts,
      deleteMemo,
      purgeMemo,
      togglePinned,
      duplicateMemo,
      moveToGroup,
      addTags,
      batchDelete,
      toggleBatchMode,
      toggleBatchSelection,
      selectAllBatch,
      batchMoveToGroup,
      batchAddTags,
      batchDeleteSelected,
      reorderMemo,
      nudgeOrder,
      createGroup,
      renameGroup,
      setGroupColor,
      deleteGroup,
      reorderGroup,
      setGroupManagerOpen,
      updateSetting,
      clearUsage,
      toggleReveal,
      toggleExpanded,
      activateSelection,
      openContextMenu,
      closeContextMenu,
      togglePreviewPane,
      expandPreviewPane,
      collapsePreviewPane,
      beginPreviewEdit,
      patchPreviewEdit,
      commitPreviewEdit,
      cancelPreviewEdit,
      applyTheme,
      setSystemDark,
      openLightboxForMemo,
      stepLightbox,
      closeLightbox,
      openMemoImageExternal,
      openImageFloat,
      exportData,
      importFromFile,
      importFromMemoQuickPaste,
      setImportStrategy,
      applyImport,
      cancelImport,
      restoreBackup,
      handleEnter,
      handleOut,
      handleDetach,
      exitPlugin,
      snapshotBeforeBulk
    },
    importPlan,
    lastImportPayload
  }
}

export type AppStore = ReturnType<typeof createAppStore>

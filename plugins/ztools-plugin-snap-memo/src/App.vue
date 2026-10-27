<script setup lang="ts">
/**
 * 应用外壳：生命周期接线（进入/退出/分离/云同步各注册一次）、主题、子输入框、
 * 全局键盘路由（子输入框转发键 + 页面焦点键共用一套处理器）、视图切换与高度管理。
 */
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { platform } from './platform'
import { createAppStore } from './store/appStore'
import GroupBar from './components/GroupBar.vue'
import MemoList from './components/MemoList.vue'
import PreviewPane from './components/PreviewPane.vue'
import SearchFallback from './components/SearchFallback.vue'
import ToastHost from './components/ToastHost.vue'
import HintBar from './components/HintBar.vue'
import FillInDialog from './components/FillInDialog.vue'
import ImageLightbox from './components/ImageLightbox.vue'
import ContextMenu from './components/ContextMenu.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import HelpOverlay from './components/HelpOverlay.vue'
import BatchBar from './components/BatchBar.vue'
import { t } from './i18n/zh-CN'

// 编辑器/设置/数据页懒加载：首屏同步渲染列表，包体按需拆分
const EditorPanel = defineAsyncComponent(() => import('./components/EditorPanel.vue'))
const SettingsPage = defineAsyncComponent(() => import('./components/SettingsPage.vue'))
const DataPage = defineAsyncComponent(() => import('./components/DataPage.vue'))

const store = createAppStore()
const searchFallbackRef = ref<InstanceType<typeof SearchFallback> | null>(null)

const isMac = platform.isMac

// 依赖 enterCount 使 computed 在每次插件进入时重算：宿主子输入框注入晚于首帧时可恢复
const subInput = computed(() => {
  void store.state.enterCount
  return platform.subInput
})

const showFallbackSearch = computed(
  () => store.state.view === 'list' && subInput.value === null
)

// ---- 生命周期 ----

let unwatchDark: (() => void) | null = null

onMounted(() => {
  store.actions.init()
  platform.onPluginEnter((action) => store.actions.handleEnter(action))
  platform.onPluginOut(() => store.actions.handleOut())
  // 分离到独立窗口：宿主不触发 onPluginOut，行内编辑与草稿需要在这里兜底落库
  platform.onPluginDetach(() => store.actions.handleDetach())
  // 云同步数据到达：刷新列表（编辑中不打断，见 store.onDbSync）
  platform.onDbPull(() => store.actions.onDbSync())
  applySubInput()
  // 系统明暗变化交给 store：由设置的主题模式（跟随系统/亮色/暗色）决定最终生效值
  unwatchDark = platform.watchDark((dark) => store.actions.setSystemDark(dark))
  window.addEventListener('keydown', onGlobalKeydown, true)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeydown, true)
  unwatchDark?.()
})

/** 子输入框注册（宿主可用时）；onChange 直接驱动 store.query。 */
function applySubInput(): void {
  const si = subInput.value
  if (!si) return
  si.set(
    (text) => {
      if (store.state.view === 'list') store.actions.setQuery(text)
      else if (text) si.setValue('')
    },
    t('searchPlaceholder'),
    true
  )
}

// ---- 主题与密度 ----

const themeAttrs = computed(() => ({
  'data-theme': store.state.dark ? 'dark' : 'light',
  'data-density': store.state.settings.density
}))

// data-theme 必须同时落在 <html> 上：base.css 的 body 颜色在 :root 作用域解析变量，
// 只挂在 .app 上会让暗色主题继承到亮色文字（标题/输入框等不可读）
watch(
  () => store.state.dark,
  (dark) => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  },
  { immediate: true }
)

// ---- 高度管理：所有视图统一窗口高度（首页/编辑/设置/数据一致，切换不跳动） ----

/** 插件窗口高度（px）；取原各视图最大值，保证编辑器与完整列表模式都放得下。 */
const PLUGIN_HEIGHT = 580

platform.setExpendHeight(PLUGIN_HEIGHT)

// 视图切换过渡（out-in）会延迟新视图挂载，聚焦改在过渡完成后执行
function onViewEntered(): void {
  if (store.state.view === 'list') {
    if (subInput.value) subInput.value.focus()
    else searchFallbackRef.value?.focus()
  }
}

watch(
  () => store.state.view,
  (view) => {
    if (view !== 'list') return
    // 无过渡的直接聚焦兜底：reduced-motion / 过渡被跳过时 after-enter 不触发
    if (subInput.value) subInput.value.focus()
    else searchFallbackRef.value?.focus()
  }
)

// ---- 全局键盘路由 ----

/** IME 组合输入期间不触发任何快捷键。 */
function isComposing(e: KeyboardEvent): boolean {
  return e.isComposing || e.keyCode === 229
}

function isTypingTarget(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null
  if (!el) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
}

/** 焦点已在可交互元素上（按钮/输入/下拉）时不劫持 Tab，保证键盘可遍历 UI。 */
function isInteractiveTarget(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null
  if (!el) return false
  return Boolean(el.closest('button, input, textarea, select, a[href], [tabindex]'))
}

/**
 * 焦点在键盘可达的可激活控件（按钮/输入/链接/tabindex≥0 的控件）上时，
 * Enter/Space/方向键等列表快捷键放行原生行为：否则 Tab 导航到按钮后按回车会误触发粘贴、
 * 空格会误开预览面板。列表行的 tabindex="-1" 是程序化聚焦标记（点击行后仍要回车粘贴），不计入。
 */
function isActivatableTarget(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null
  if (!el) return false
  return Boolean(
    el.closest('button, input, textarea, select, a[href], [contenteditable], [tabindex]:not([tabindex="-1"])')
  )
}

/** 给当前选中条目打开右键菜单（Menu / Shift+F10）：定位到选中行所在屏幕位置。 */
function openMenuForSelection(): void {
  const id = store.state.selectionId
  if (!id) return
  const row = document.querySelector<HTMLElement>(`.row[data-memo-id="${id}"]`)
  const rect = row?.getBoundingClientRect()
  store.actions.openContextMenu(
    rect ? rect.left + Math.min(220, rect.width / 2) : window.innerWidth / 2 - 80,
    rect ? rect.top + 30 : window.innerHeight / 2,
    id
  )
}

function onGlobalKeydown(e: KeyboardEvent): void {
  if (isComposing(e)) return
  const mod = isMac ? e.metaKey : e.ctrlKey
  const key = e.key

  // 自定义下拉浮层（SmSelect）打开时：按键全部交给组件自身（↑↓ 高亮 / Enter 选中 /
  // Esc、Tab 关闭），不触发列表/编辑器级快捷键（否则方向键移动选中、Esc 直接关编辑器）
  if (e.target instanceof Element && e.target.closest('.sm-select[data-open]')) return

  // 编辑器标题行内编辑（下划线态）：Esc 还原修改、Enter 跳正文由输入框自行处理；
  // 其余按键（含 Mod+Enter 保存）照常走全局路由
  if (e.target instanceof Element && e.target.closest('.title-input') && !(mod && key === 'Enter')) return

  // 图片全屏浮层打开：Esc 关闭、←/→ 在图片条目间切换，其余按键不穿透（避免误触发列表操作）
  if (store.state.lightbox) {
    if (key === 'Escape') {
      e.preventDefault()
      store.actions.closeLightbox()
    } else if (key === 'ArrowLeft') {
      e.preventDefault()
      store.actions.stepLightbox(-1)
    } else if (key === 'ArrowRight') {
      e.preventDefault()
      store.actions.stepLightbox(1)
    }
    return
  }

  // 预览面板行内编辑态：Mod+Enter（或失焦）自动保存；Esc 放弃修改退回预览；
  // 其余按键不拦截（正文自由输入），也屏蔽列表快捷键（回车粘贴/方向键选择/Del 删除等）
  if (store.state.previewEdit) {
    if (mod && key === 'Enter') {
      e.preventDefault()
      store.actions.commitPreviewEdit()
    } else if (key === 'Escape') {
      e.preventDefault()
      store.actions.cancelPreviewEdit()
    }
    return
  }

  // 条目右键菜单打开：Esc 关闭；方向键/回车由菜单自身（已聚焦）处理
  if (store.state.contextMenu) {
    if (key === 'Escape') {
      e.preventDefault()
      store.actions.closeContextMenu()
    }
    return
  }

  // 填写框打开：只处理 Esc（框内输入自行处理 Enter/Tab）
  if (store.state.pendingPaste) {
    if (key === 'Escape') {
      e.preventDefault()
      store.actions.cancelPendingPaste()
    }
    return
  }

  // 应用内确认对话框：Enter 确认 / Esc 取消
  if (store.state.confirm) {
    if (key === 'Enter') {
      e.preventDefault()
      store.actions.resolveConfirm(true)
    } else if (key === 'Escape') {
      e.preventDefault()
      store.actions.resolveConfirm(false)
    }
    return
  }

  // 快捷键帮助浮层：Esc / F1 关闭
  if (store.state.helpVisible) {
    if (key === 'Escape' || key === 'F1') {
      e.preventDefault()
      store.actions.toggleHelp(false)
    }
    return
  }

  // 分组管理弹窗打开：只响应 Esc 关闭，其余快捷键不穿透（否则回车会误触发粘贴）
  if (store.state.view === 'list' && store.state.showGroupManager) {
    if (key === 'Escape') {
      e.preventDefault()
      store.actions.setGroupManagerOpen(false)
    }
    return
  }

  // 编辑器字段弹窗（顶栏分组/标签/触发词徽片点开）打开：只响应 Esc 关闭，
  // 其余快捷键不穿透（否则回车会误保存、方向键误触正文编辑器）
  if (store.state.view === 'editor' && store.state.editorMeta) {
    if (key === 'Escape') {
      e.preventDefault()
      store.actions.closeEditorMeta()
    }
    return
  }

  // 编辑器视图：Mod+Enter 保存；Esc 关闭（含未保存确认）
  if (store.state.view === 'editor') {
    if (mod && key === 'Enter') {
      e.preventDefault()
      store.actions.saveEditor()
      return
    }
    if (key === 'Escape') {
      e.preventDefault()
      store.actions.closeEditor()
    }
    return
  }

  // 非列表视图（设置/数据页）：Esc 返回
  if (store.state.view !== 'list') {
    if (key === 'Escape') {
      e.preventDefault()
      if (!store.actions.backToPrevious()) platform.outPlugin()
    }
    return
  }

  // ---- 列表视图 ----

  // 焦点在可激活控件上（Tab 导航后的按钮/下拉触发器等）：激活类按键交还原生行为，
  // 不触发列表快捷键（回车粘贴 / 空格预览开关 / 方向键移动选中 / 删除条目）
  if (
    isActivatableTarget(e) &&
    ['Enter', ' ', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Delete', 'Backspace'].includes(key)
  ) {
    return
  }

  switch (key) {
    case 'ArrowUp':
      e.preventDefault()
      if (e.altKey) {
        nudgeSelected(-1)
      } else {
        store.actions.moveSelection(-1)
      }
      return
    case 'ArrowDown':
      e.preventDefault()
      if (e.altKey) {
        nudgeSelected(1)
      } else {
        store.actions.moveSelection(1)
      }
      return
    case 'Home':
      e.preventDefault()
      store.actions.jumpSelection('first')
      return
    case 'End':
      e.preventDefault()
      store.actions.jumpSelection('last')
      return
    case 'PageUp':
      e.preventDefault()
      store.actions.pageSelection(-1)
      return
    case 'PageDown':
      e.preventDefault()
      store.actions.pageSelection(1)
      return
    case 'Enter':
      e.preventDefault()
      if (store.state.batchMode) {
        const id = store.state.selectionId
        if (id) store.actions.toggleBatchSelection(id)
      } else {
        void store.actions.pasteSelected(e.shiftKey)
      }
      return
    case 'Tab':
      // 焦点在输入框或可交互元素上时放行原生 Tab（键盘可达撤销按钮/工具栏），
      // 仅在“列表背景”上才作为切换分组的快捷键
      if (!isTypingTarget(e) && !isInteractiveTarget(e)) {
        e.preventDefault()
        store.actions.cycleFilter(e.shiftKey ? -1 : 1)
      }
      return
    case 'Escape':
      if (store.state.batchMode) {
        e.preventDefault()
        store.actions.toggleBatchMode(false)
        return
      }
      if (store.state.query) {
        e.preventDefault()
        store.actions.setQuery('')
        subInput.value?.setValue('')
      } else if (store.state.previewMode === 'split' && store.computed.selectedMemo.value) {
        // 预览面板展开中：先收起面板，再按一次 Esc 才退出插件
        e.preventDefault()
        store.actions.collapsePreviewPane()
      } else {
        // 无搜索词且面板已收起：交给宿主分步退出；浏览器开发态自行退出
        platform.outPlugin()
      }
      return
    case ' ':
      // Space = 鼠标单击选中条目的键盘等价（展开/收起 + 拉出收起的预览面板）；多选模式下为切换多选。
      // 焦点须在页面上（输入框内由 isTypingTarget 拦下；宿主子输入框不转发 Space）
      if (!isTypingTarget(e)) {
        e.preventDefault()
        if (store.state.batchMode) {
          const id = store.state.selectionId
          if (id) store.actions.toggleBatchSelection(id)
        } else {
          store.actions.activateSelection()
        }
      }
      return
    case 'Delete':
    case 'Backspace':
      if (!isTypingTarget(e)) {
        if (store.state.batchMode) {
          e.preventDefault()
          store.actions.batchDeleteSelected()
        } else {
          const memo = store.computed.selectedMemo.value
          if (memo) {
            e.preventDefault()
            store.actions.deleteMemo(memo.id)
          }
        }
      }
      return
    case 'ContextMenu':
      e.preventDefault()
      openMenuForSelection()
      return
    default:
      break
  }

  // Shift+F10 等价 Menu 键
  if (e.shiftKey && e.key === 'F10') {
    e.preventDefault()
    openMenuForSelection()
    return
  }

  if (e.altKey && !mod && /^[1-9]$/.test(key)) {
    e.preventDefault()
    void store.actions.quickPaste(Number(key) - 1)
    return
  }

  if (mod && !e.altKey && !e.shiftKey) {
    switch (key.toLowerCase()) {
      case 'n':
        e.preventDefault()
        // 优先取剪贴板图片，其次剪贴板文本
        void store.actions.createNewFromClipboard()
        return
      case 'e': {
        e.preventDefault()
        const memo = store.computed.selectedMemo.value
        if (memo) store.actions.editMemo(memo.id)
        return
      }
      case 'p':
      case 'i':
        e.preventDefault()
        store.actions.togglePreviewPane()
        return
      case 'd': {
        // ZTools 宿主占用 Cmd+D（分离窗口）；浏览器开发态别名，宿主内主绑定 Mod+Shift+D
        e.preventDefault()
        const memo = store.computed.selectedMemo.value
        if (memo) store.actions.duplicateMemo(memo.id)
        return
      }
      case 'f':
      case '/':
        e.preventDefault()
        focusSearch()
        return
      case 'z':
        e.preventDefault()
        store.actions.undoLastAction()
        return
      case 'a': {
        e.preventDefault()
        if (store.state.batchMode && isTypingTarget(e)) return
        store.actions.toggleBatchMode()
        return
      }
      case ',':
        e.preventDefault()
        store.actions.switchView('settings')
        return
      default:
        return
    }
  }

  if (mod && e.shiftKey) {
    const memo = store.computed.selectedMemo.value
    switch (key.toLowerCase()) {
      case 'p':
        e.preventDefault()
        if (memo) store.actions.togglePinned(memo.id)
        return
      case 'd':
        e.preventDefault()
        if (memo) store.actions.duplicateMemo(memo.id)
        return
      default:
        return
    }
  }

  if (key === '/' && !isTypingTarget(e)) {
    e.preventDefault()
    focusSearch()
    return
  }

  // F1 打开帮助：功能键不产生字符，搜索框/输入框聚焦时也不会误输入
  if (key === 'F1') {
    e.preventDefault()
    store.actions.toggleHelp()
  }
}

/** Alt+↑/↓ 手动排序微调：非手动排序下提示而不静默改写 order 数据。 */
function nudgeSelected(delta: -1 | 1): void {
  const id = store.state.selectionId
  if (!id) return
  if (store.state.settings.sortBy !== 'manual') {
    store.actions.toast(t('toasts.manualOnly'), { kind: 'info' })
    return
  }
  store.actions.nudgeOrder(id, delta)
}

function focusSearch(): void {
  if (subInput.value) subInput.value.focus()
  else searchFallbackRef.value?.focus()
}
</script>

<template>
  <div class="app" v-bind="themeAttrs">
    <!-- 视图切换：out-in 交叉淡入淡出（时长/缓动走 base.css 的 fade 预设令牌） -->
    <Transition name="fade" mode="out-in" @after-enter="onViewEntered">
      <div v-if="store.state.view === 'list'" key="view-list" class="view-stack">
        <SearchFallback v-if="showFallbackSearch" ref="searchFallbackRef" :store="store" />
        <GroupBar :store="store" @focus-search="focusSearch" />
        <div class="list-wrap">
          <MemoList :store="store" />
          <!--
            预览面板显隐：面板头部 ► 收起；收起后无常驻拉出按钮，
            单击列表条目重新展开（宽度生长动画），Space / ⌘/Ctrl+P 亦可切换。
          -->
          <!-- 预览面板：贴边宽度生长展开 / 收起（pane 预设）；无选中条目时本来就无 DOM，条件等价 -->
          <Transition name="pane">
            <PreviewPane
              v-if="store.state.previewMode !== 'hidden' && store.computed.selectedMemo.value"
              :store="store"
            />
          </Transition>
        </div>
        <BatchBar :store="store" />
      </div>
      <EditorPanel v-else-if="store.state.view === 'editor'" key="view-editor" :store="store" />
      <SettingsPage v-else-if="store.state.view === 'settings'" key="view-settings" :store="store" />
      <DataPage v-else key="view-data" :store="store" />
    </Transition>
    <HintBar :store="store" />
    <FillInDialog :store="store" />
    <ImageLightbox :store="store" />
    <ContextMenu :store="store" />
    <ConfirmDialog :store="store" />
    <HelpOverlay :store="store" />
    <ToastHost :store="store" />
  </div>
</template>

<style scoped>
.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--sm-bg);
  position: relative;
  overflow: hidden;
}

/* 视图切换过渡的布局容器：接替原列表分支在 .app 中的 flex 位置 */
.view-stack {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.list-wrap {
  flex: 1;
  display: flex;
  min-height: 0;
  position: relative;
}
</style>

<style>
/* 全局：懒加载组件切换时的占位不跳动 */
.async-placeholder {
  flex: 1;
}
</style>

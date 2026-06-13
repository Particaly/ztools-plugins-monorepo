<template>
  <header class="top-bar">
    <div class="top-bar-left">
      <span class="app-title">图标编辑器</span>
      <nav class="top-menu-strip" aria-label="主菜单">
        <ZPopover
          v-for="menu in topMenus"
          :key="menu.id"
          class="top-menu-popover"
          :show="openMenuId === menu.id"
          trigger="click"
          placement="bottom-start"
          :to="false"
          show-arrow
          @update:show="handleTopMenuShowChange(menu.id, $event)"
        >
          <template #trigger>
            <ZButton
              size="small"
              class="top-menu-trigger"
              :class="{ 'is-active': openMenuId === menu.id }"
              :title="`${menu.label}菜单`"
            >
              {{ menu.label }}
            </ZButton>
          </template>
          <div class="top-menu-panel" role="menu">
            <template v-for="entry in menu.items" :key="entry.id">
              <span v-if="entry.type === 'separator'" class="top-menu-separator" role="separator"></span>
              <button
                v-else
                type="button"
                class="top-menu-item"
                :class="{ 'is-active': entry.active }"
                :disabled="entry.disabled"
                :title="entry.title"
                role="menuitem"
                @click="runTopMenuItem(entry)"
              >
                <Icon v-if="entry.icon" class="top-menu-item-icon" :icon="entry.icon" aria-hidden="true" />
                <span class="top-menu-item-label">{{ entry.label }}</span>
                <span v-if="entry.active" class="top-menu-item-state">开</span>
              </button>
            </template>
          </div>
        </ZPopover>
      </nav>
    </div>
    <div class="top-bar-spacer"></div>
    <div class="top-bar-right">
      <span class="zoom-label">{{ Math.round(zoom * 100) }}%</span>
      <ZButton size="small" class="top-bar-icon-btn" title="缩小" @click="$emit('set-zoom', zoom - 0.1)">−</ZButton>
      <ZButton size="small" class="top-bar-icon-btn" title="放大" @click="$emit('set-zoom', zoom + 0.1)">+</ZButton>
      <ZButton size="small" class="top-bar-btn top-bar-reset-btn" title="重置缩放到 100%" @click="$emit('set-zoom', 1)">1:1</ZButton>
    </div>
  </header>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { ZButton, ZPopover } from 'ztools-ui'

type TopMenuId = 'file' | 'edit' | 'view' | 'output'
type TopMenuEvent =
  | 'new-doc'
  | 'open-project'
  | 'save-project'
  | 'import-svg'
  | 'open-paste-svg'
  | 'import-image'
  | 'copy-as-svg'
  | 'copy-as-png'
  | 'open-export'
  | 'toggle-artboard-list'
  | 'undo'
  | 'redo'
  | 'toggle-ruler'
  | 'toggle-pixel-grid'
  | 'toggle-snap-to-pixel-grid'
  | 'toggle-keyline-overlay'
  | 'open-shortcut-drawer'

type TopMenuItem = {
  type: 'item'
  id: string
  label: string
  title: string
  icon: string
  event: TopMenuEvent
  active?: boolean
  disabled?: boolean
}

type TopMenuSeparator = {
  type: 'separator'
  id: string
}

type TopMenu = {
  id: TopMenuId
  label: string
  items: Array<TopMenuItem | TopMenuSeparator>
}

const props = defineProps<{
  canUndo: boolean
  canRedo: boolean
  showRuler: boolean
  showPixelGrid: boolean
  snapToPixelGrid: boolean
  keylineActive: boolean
  shortcutDrawerOpen: boolean
  selectionMode: 'shape' | 'point' | 'segment'
  hasEditablePoints: boolean
  zoom: number
  showArtboardList: boolean
}>()

const emit = defineEmits<{
  (event: 'new-doc'): void
  (event: 'open-project'): void
  (event: 'save-project'): void
  (event: 'import-svg'): void
  (event: 'open-paste-svg'): void
  (event: 'import-image'): void
  (event: 'copy-as-svg'): void
  (event: 'copy-as-png'): void
  (event: 'open-export'): void
  (event: 'toggle-artboard-list'): void
  (event: 'undo'): void
  (event: 'redo'): void
  (event: 'toggle-ruler'): void
  (event: 'toggle-pixel-grid'): void
  (event: 'toggle-snap-to-pixel-grid'): void
  (event: 'toggle-keyline-overlay'): void
  (event: 'open-shortcut-drawer'): void
  (event: 'set-selection-mode', mode: 'shape' | 'point' | 'segment'): void
  (event: 'set-zoom', zoom: number): void
}>()

const openMenuId = ref<TopMenuId | null>(null)

// 菜单配置集中描述顶栏入口，使模板只负责渲染，同时复用现有 props 计算禁用与激活状态。
const topMenus = computed<TopMenu[]>(() => [
  {
    id: 'file',
    label: '文件',
    items: [
      { type: 'item', id: 'new-doc', label: '新建', title: '新建文档', icon: 'mdi:file-plus-outline', event: 'new-doc' },
      { type: 'item', id: 'open-project', label: '打开工程', title: '打开工程文件', icon: 'mdi:folder-open-outline', event: 'open-project' },
      { type: 'item', id: 'save-project', label: '保存工程', title: '保存当前工程', icon: 'mdi:content-save-outline', event: 'save-project' },
      { type: 'separator', id: 'file-import-separator' },
      { type: 'item', id: 'import-svg', label: '导入 SVG', title: '导入 SVG 文件', icon: 'mdi:svg', event: 'import-svg' },
      { type: 'item', id: 'open-paste-svg', label: '粘贴 SVG', title: '粘贴 SVG 或 Path', icon: 'mdi:clipboard-text-outline', event: 'open-paste-svg' },
      { type: 'item', id: 'import-image', label: '导入图片', title: '导入图片', icon: 'mdi:image-plus-outline', event: 'import-image' }
    ]
  },
  {
    id: 'edit',
    label: '编辑',
    items: [
      { type: 'item', id: 'undo', label: '撤销', title: '撤销上一步操作', icon: 'mdi:undo', event: 'undo', disabled: !props.canUndo },
      { type: 'item', id: 'redo', label: '重做', title: '重做上一步操作', icon: 'mdi:redo', event: 'redo', disabled: !props.canRedo }
    ]
  },
  {
    id: 'view',
    label: '视图',
    items: [
      { type: 'item', id: 'toggle-artboard-list', label: '画板', title: '显示或隐藏画板列表', icon: 'mdi:view-dashboard-outline', event: 'toggle-artboard-list', active: props.showArtboardList },
      { type: 'separator', id: 'view-panel-separator' },
      { type: 'item', id: 'toggle-ruler', label: '标尺', title: '显示或隐藏标尺', icon: 'mdi:ruler', event: 'toggle-ruler', active: props.showRuler },
      { type: 'item', id: 'toggle-pixel-grid', label: '网格', title: '显示或隐藏像素网格', icon: 'mdi:grid', event: 'toggle-pixel-grid', active: props.showPixelGrid },
      { type: 'item', id: 'toggle-snap-to-pixel-grid', label: '吸附', title: '切换吸附到像素网格', icon: 'mdi:magnet', event: 'toggle-snap-to-pixel-grid', active: props.snapToPixelGrid },
      { type: 'item', id: 'toggle-keyline-overlay', label: '参考线', title: '显示或隐藏 Keyline 与安全区参考线', icon: 'mdi:vector-square', event: 'toggle-keyline-overlay', active: props.keylineActive },
      { type: 'separator', id: 'view-shortcut-separator' },
      { type: 'item', id: 'open-shortcut-drawer', label: '快捷键', title: '打开快捷键设置', icon: 'mdi:keyboard-outline', event: 'open-shortcut-drawer', active: props.shortcutDrawerOpen }
    ]
  },
  {
    id: 'output',
    label: '输出',
    items: [
      { type: 'item', id: 'copy-as-svg', label: '复制 SVG', title: '复制为 SVG', icon: 'mdi:content-copy', event: 'copy-as-svg' },
      { type: 'item', id: 'copy-as-png', label: '复制 PNG', title: '复制为 PNG', icon: 'mdi:image-multiple-outline', event: 'copy-as-png' },
      { type: 'separator', id: 'output-export-separator' },
      { type: 'item', id: 'open-export', label: '导出', title: '打开导出面板', icon: 'mdi:export-variant', event: 'open-export' }
    ]
  }
])

/**
 * 同步 ZPopover 的显隐状态，保证任一时刻只展开一个顶栏菜单。
 */
function handleTopMenuShowChange(menuId: TopMenuId, show: boolean): void {
  if (show) {
    openMenuId.value = menuId
    return
  }

  if (openMenuId.value === menuId) {
    openMenuId.value = null
  }
}

/**
 * 执行菜单项对应的现有顶栏事件，并在命令触发后收起菜单。
 */
function runTopMenuItem(entry: TopMenuItem): void {
  if (entry.disabled) {
    return
  }

  switch (entry.event) {
    case 'new-doc':
      emit('new-doc')
      break
    case 'open-project':
      emit('open-project')
      break
    case 'save-project':
      emit('save-project')
      break
    case 'import-svg':
      emit('import-svg')
      break
    case 'open-paste-svg':
      emit('open-paste-svg')
      break
    case 'import-image':
      emit('import-image')
      break
    case 'copy-as-svg':
      emit('copy-as-svg')
      break
    case 'copy-as-png':
      emit('copy-as-png')
      break
    case 'open-export':
      emit('open-export')
      break
    case 'toggle-artboard-list':
      emit('toggle-artboard-list')
      break
    case 'undo':
      emit('undo')
      break
    case 'redo':
      emit('redo')
      break
    case 'toggle-ruler':
      emit('toggle-ruler')
      break
    case 'toggle-pixel-grid':
      emit('toggle-pixel-grid')
      break
    case 'toggle-snap-to-pixel-grid':
      emit('toggle-snap-to-pixel-grid')
      break
    case 'toggle-keyline-overlay':
      emit('toggle-keyline-overlay')
      break
    case 'open-shortcut-drawer':
      emit('open-shortcut-drawer')
      break
  }

  openMenuId.value = null
}
</script>

<style lang="scss" scoped>
@use '../styles/tokens' as *;

/* ── 顶栏 ── */
.top-bar {
  display: flex;
  align-items: center;
  height: $topbar-h;
  padding: 0 10px;
  background: $panel-bg;
  border-bottom: $border;
  gap: 8px;
  flex-shrink: 0;
  position: relative;
  overflow: visible;
}
.top-bar-left {
  display: flex;
  align-items: center;
  min-width: 0;

  .app-title {
    font-weight: 700;
    font-size: 14px;
    margin-right: 14px;
    white-space: nowrap;
  }
}
.top-menu-strip {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}
.top-menu-popover {
  :deep(.zt-popover__content) {
    min-width: 176px;
  }

  :deep(.zt-popover__body--card) {
    padding: 6px;
  }
}
.top-menu-trigger {
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  box-shadow: none;
  color: #444;
  white-space: nowrap;

  &:hover:not(:disabled),
  &.is-active {
    background: var(--primary-light-bg);
    border-color: color-mix(in srgb, var(--primary-color), transparent 62%);
    color: var(--primary-color);
  }
}
.top-menu-panel {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.top-menu-item {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 30px;
  padding: 5px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #444;
  font: inherit;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;

  &:hover:not(:disabled) {
    background: rgba(30, 111, 255, 0.08);
    color: #222;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &.is-active {
    background: var(--primary-light-bg);
    color: var(--primary-color);
  }
}
.top-menu-item-icon {
  width: 16px;
  height: 16px;
}
.top-menu-item-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.top-menu-item-state {
  min-width: 18px;
  color: var(--primary-color);
  font-size: 11px;
  text-align: right;
}
.top-menu-separator {
  height: 1px;
  margin: 4px 2px;
  background: rgba(128, 128, 128, 0.18);
}
.top-bar-spacer {
  flex: 1;
  min-width: 8px;
}
.top-bar-right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;

  .zoom-label {
    font-size: 12px;
    min-width: 42px;
    text-align: right;
  }
}
.top-bar-btn,
.top-bar-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  box-sizing: border-box;
  border: 2px solid var(--control-border);
  border-radius: 6px;
  background: #fafafa;
  box-shadow: none;
  color: #555;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, color 0.15s ease, background-color 0.15s ease;

  &:hover:not(:disabled) {
    background: #fafafa;
    border-color: color-mix(in srgb, var(--primary-color), black 15%);
    color: #333;
  }

  &:disabled {
    box-shadow: none;
  }

  &.is-active {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--primary-light-bg);
    color: var(--primary-color);
  }
}
.top-bar-btn {
  min-height: 28px;
  white-space: nowrap;
}
.top-bar-icon-btn {
  width: 28px;
  min-width: 28px;
  height: 28px;
  padding: 0;
  font-size: 14px;

  :deep(svg) {
    width: 14px;
    height: 14px;
  }
}
.top-bar-reset-btn {
  width: auto;
  min-width: 40px;
}
</style>

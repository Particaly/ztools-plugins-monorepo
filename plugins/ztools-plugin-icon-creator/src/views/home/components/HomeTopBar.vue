<template>
  <header class="top-bar">
    <div class="top-bar-left">
      <span class="app-title">图标编辑器</span>
    </div>
    <div class="top-bar-center">
      <ZButton size="small" class="top-bar-btn" title="新建" @click="$emit('new-doc')">新建</ZButton>
      <ZButton size="small" class="top-bar-btn" title="打开工程" @click="$emit('open-project')">打开工程</ZButton>
      <ZButton size="small" class="top-bar-btn" title="保存工程" @click="$emit('save-project')">保存工程</ZButton>
      <ZButton size="small" class="top-bar-btn" title="导入 SVG" @click="$emit('import-svg')">导入 SVG</ZButton>
      <ZButton size="small" class="top-bar-btn" title="粘贴 SVG 或 Path" @click="$emit('open-paste-svg')">粘贴 SVG</ZButton>
      <ZButton size="small" class="top-bar-btn" title="导入图片" @click="$emit('import-image')">导入图片</ZButton>
      <ZButton size="small" class="top-bar-btn" title="复制为 SVG" @click="$emit('copy-as-svg')">复制 SVG</ZButton>
      <ZButton size="small" class="top-bar-btn" title="复制为 PNG" @click="$emit('copy-as-png')">复制 PNG</ZButton>
      <ZButton size="small" class="top-bar-btn" title="导出面板" @click="$emit('open-export')">导出</ZButton>
      <span class="tb-sep"></span>
      <ZButton size="small" class="top-bar-btn" :class="{ 'is-active': showArtboardList }" title="画板列表" @click="$emit('toggle-artboard-list')">画板</ZButton>
      <span class="tb-sep"></span>
      <ZButton size="small" class="top-bar-btn" :disabled="!canUndo" title="撤销" @click="$emit('undo')">撤销</ZButton>
      <ZButton size="small" class="top-bar-btn" :disabled="!canRedo" title="重做" @click="$emit('redo')">重做</ZButton>
      <span class="tb-sep"></span>
      <ZButton size="small" class="top-bar-btn" :class="{ 'is-active': showRuler }" title="标尺" @click="$emit('toggle-ruler')">标尺</ZButton>
      <ZButton size="small" class="top-bar-btn" :class="{ 'is-active': showPixelGrid }" title="像素网格" @click="$emit('toggle-pixel-grid')">网格</ZButton>
      <ZButton size="small" class="top-bar-btn" :class="{ 'is-active': snapToPixelGrid }" title="吸附到网格" @click="$emit('toggle-snap-to-pixel-grid')">吸附</ZButton>
      <ZButton size="small" class="top-bar-btn" :class="{ 'is-active': keylineActive }" title="Keyline 与安全区参考线" @click="$emit('toggle-keyline-overlay')">参考线</ZButton>
      <ZButton size="small" class="top-bar-btn shortcut-topbar-btn" :class="{ 'is-active': shortcutDrawerOpen }" title="快捷键设置" @click="$emit('open-shortcut-drawer')">快捷键</ZButton>
      <span class="tb-sep"></span>
      <ZButton size="small" class="top-bar-icon-btn" :class="{ 'is-active': selectionMode === 'shape' }" title="选择图形" @click="$emit('set-selection-mode', 'shape')">
        <Icon icon="mdi:cursor-default-outline" />
      </ZButton>
      <ZButton size="small" class="top-bar-icon-btn" :class="{ 'is-active': selectionMode === 'point' }" :disabled="!hasEditablePoints" title="选择点位" @click="$emit('set-selection-mode', 'point')">
        <Icon icon="mdi:circle-outline" />
      </ZButton>
      <ZButton size="small" class="top-bar-icon-btn" :class="{ 'is-active': selectionMode === 'segment' }" :disabled="!hasEditablePoints" title="选择线段" @click="$emit('set-selection-mode', 'segment')">
        <Icon icon="mdi:minus" />
      </ZButton>
    </div>
    <div class="top-bar-right">
      <span class="zoom-label">{{ Math.round(zoom * 100) }}%</span>
      <ZButton size="small" class="top-bar-icon-btn" @click="$emit('set-zoom', zoom - 0.1)">−</ZButton>
      <ZButton size="small" class="top-bar-icon-btn" @click="$emit('set-zoom', zoom + 0.1)">+</ZButton>
      <ZButton size="small" class="top-bar-btn top-bar-reset-btn" @click="$emit('set-zoom', 1)">1:1</ZButton>
    </div>
  </header>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ZButton } from 'ztools-ui'

defineProps<{
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

defineEmits<{
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
  gap: 6px;
  flex-shrink: 0;
}
.top-bar-left {
  .app-title {
    font-weight: 700;
    font-size: 14px;
    margin-right: 12px;
  }
}
.top-bar-center {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  justify-content: center;
}
.top-bar-right {
  display: flex;
  align-items: center;
  gap: 4px;
  .zoom-label {
    font-size: 12px;
    min-width: 42px;
    text-align: right;
  }
}
.tb-sep {
  width: 1px;
  height: 20px;
  background: rgba(128, 128, 128, 0.2);
  margin: 0 4px;
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
.shortcut-topbar-btn {
  min-width: 54px;
}
</style>

<template>
  <aside class="home-tool-bar" aria-label="编辑工具栏">
    <div class="tool-group" aria-label="历史">
      <ZButton size="small" class="tool-btn" :disabled="!canUndo" title="撤销" aria-label="撤销" @click="$emit('undo')">
        <Icon icon="mdi:undo" />
      </ZButton>
      <ZButton size="small" class="tool-btn" :disabled="!canRedo" title="重做" aria-label="重做" @click="$emit('redo')">
        <Icon icon="mdi:redo" />
      </ZButton>
    </div>

    <div class="tool-group" aria-label="选择">
      <ZButton
        size="small"
        class="tool-btn"
        :class="{ 'is-active': selectionMode === 'shape' }"
        title="选择图形"
        aria-label="选择图形"
        @click="$emit('set-selection-mode', 'shape')"
      >
        <Icon icon="mdi:cursor-default-outline" />
      </ZButton>
      <ZButton
        size="small"
        class="tool-btn"
        :class="{ 'is-active': selectionMode === 'point' }"
        :disabled="!hasEditablePoints"
        title="选择点位"
        aria-label="选择点位"
        @click="$emit('set-selection-mode', 'point')"
      >
        <Icon icon="mdi:circle-outline" />
      </ZButton>
      <ZButton
        size="small"
        class="tool-btn"
        :class="{ 'is-active': selectionMode === 'segment' }"
        :disabled="!hasEditablePoints"
        title="选择线段"
        aria-label="选择线段"
        @click="$emit('set-selection-mode', 'segment')"
      >
        <Icon icon="mdi:minus" />
      </ZButton>
    </div>

    <div class="tool-group" aria-label="视图">
      <ZButton
        size="small"
        class="tool-btn"
        :class="{ 'is-active': showArtboardList }"
        title="画板列表"
        aria-label="画板列表"
        @click="$emit('toggle-artboard-list')"
      >
        <Icon icon="mdi:view-dashboard-outline" />
      </ZButton>
      <ZButton
        size="small"
        class="tool-btn"
        :class="{ 'is-active': showRuler }"
        title="标尺"
        aria-label="标尺"
        @click="$emit('toggle-ruler')"
      >
        <Icon icon="mdi:ruler" />
      </ZButton>
      <ZButton
        size="small"
        class="tool-btn"
        :class="{ 'is-active': showPixelGrid }"
        title="像素网格"
        aria-label="像素网格"
        @click="$emit('toggle-pixel-grid')"
      >
        <Icon icon="mdi:grid" />
      </ZButton>
      <ZButton
        size="small"
        class="tool-btn"
        :class="{ 'is-active': snapToPixelGrid }"
        title="吸附到像素网格"
        aria-label="吸附到像素网格"
        @click="$emit('toggle-snap-to-pixel-grid')"
      >
        <Icon icon="mdi:magnet" />
      </ZButton>
      <ZPopover
        class="tool-popover"
        trigger="hover"
        placement="right-start"
        :to="false"
        show-arrow
        keep-alive-on-hover
      >
        <template #trigger>
          <ZButton
            size="small"
            class="tool-btn"
            :class="{ 'is-active': keylineActive }"
            title="Keyline 与安全区参考线（悬浮可切换类型）"
            aria-label="Keyline 与安全区参考线"
            @click="$emit('toggle-keyline-overlay')"
          >
            <Icon icon="mdi:vector-square" />
          </ZButton>
        </template>
        <div class="keyline-popover" role="menu" aria-label="参考线模板">
          <button
            v-for="option in keylineTemplateOptions"
            :key="option.value"
            type="button"
            class="keyline-option"
            :class="{ active: option.value === keylineTemplate }"
            role="menuitemradio"
            :aria-checked="option.value === keylineTemplate"
            @click.stop="$emit('set-keyline-template', option.value)"
          >
            <span class="keyline-option-label">{{ option.label }}</span>
            <Icon v-if="option.value === keylineTemplate" class="keyline-option-state" icon="mdi:check" />
          </button>
        </div>
      </ZPopover>
    </div>

    <div class="tool-group tool-group-bottom" aria-label="工作台控制与帮助">
      <ZButton
        size="small"
        class="tool-btn"
        :title="leftPanelCollapsed ? '展开左侧面板' : '收起左侧面板'"
        :aria-label="leftPanelCollapsed ? '展开左侧面板' : '收起左侧面板'"
        @click="$emit('toggle-left-panel')"
      >
        <Icon :icon="leftPanelCollapsed ? 'mdi:chevron-double-right' : 'mdi:chevron-double-left'" />
      </ZButton>
      <ZButton
        size="small"
        class="tool-btn"
        :class="{ 'is-active': shortcutDrawerOpen }"
        title="快捷键设置"
        aria-label="快捷键设置"
        @click="$emit('open-shortcut-drawer')"
      >
        <Icon icon="mdi:keyboard-outline" />
      </ZButton>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ZButton, ZPopover } from 'ztools-ui'
import type { KeylineTemplate } from '../types'

type KeylineTemplateOption = {
  value: KeylineTemplate
  label: string
}

defineProps<{
  canUndo: boolean
  canRedo: boolean
  selectionMode: 'shape' | 'point' | 'segment'
  hasEditablePoints: boolean
  showArtboardList: boolean
  showRuler: boolean
  showPixelGrid: boolean
  snapToPixelGrid: boolean
  keylineActive: boolean
  keylineTemplate: KeylineTemplate
  keylineTemplateOptions: KeylineTemplateOption[]
  shortcutDrawerOpen: boolean
  leftPanelCollapsed: boolean
}>()

defineEmits<{
  (event: 'undo'): void
  (event: 'redo'): void
  (event: 'set-selection-mode', mode: 'shape' | 'point' | 'segment'): void
  (event: 'toggle-artboard-list'): void
  (event: 'toggle-ruler'): void
  (event: 'toggle-pixel-grid'): void
  (event: 'toggle-snap-to-pixel-grid'): void
  (event: 'toggle-keyline-overlay'): void
  (event: 'set-keyline-template', value: KeylineTemplate): void
  (event: 'open-shortcut-drawer'): void
  (event: 'toggle-left-panel'): void
}>()
</script>

<style lang="scss" scoped>
@use '../styles/tokens' as *;

.home-tool-bar {
  width: 44px;
  flex: 0 0 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px 5px;
  background: color-mix(in srgb, $panel-bg, #20242b 4%);
  border-right: $border;
  box-sizing: border-box;
  min-height: 0;
}
.tool-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  width: 100%;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.18);
}
.tool-group-bottom {
  margin-top: auto;
  padding-top: 8px;
  padding-bottom: 0;
  border-top: 1px solid rgba(128, 128, 128, 0.18);
  border-bottom: 0;
}
.tool-popover {
  width: 100%;
  display: flex;
  justify-content: center;

  :deep(.zt-popover__content) {
    min-width: 168px;
  }

  :deep(.zt-popover__body--card) {
    padding: 6px;
  }
}
.tool-btn {
  width: 32px;
  min-width: 32px;
  height: 32px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  box-shadow: none;
  color: #4b5563;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, color 0.15s ease, background-color 0.15s ease;

  :deep(svg) {
    width: 17px;
    height: 17px;
  }

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.85);
    border-color: color-mix(in srgb, var(--primary-color), transparent 62%);
    color: #222;
  }

  &:disabled {
    opacity: 0.38;
    cursor: not-allowed;
    box-shadow: none;
  }

  &.is-active {
    background: var(--primary-light-bg);
    border-color: var(--primary-color);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary-color), transparent 35%);
    color: var(--primary-color);
  }
}
.keyline-popover {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.keyline-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: #374151;
  font-size: 12px;
  text-align: left;
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;

  &:hover {
    background: color-mix(in srgb, var(--primary-color), white 92%);
    border-color: color-mix(in srgb, var(--primary-color), transparent 70%);
    color: var(--primary-color);
  }

  &.active {
    background: var(--primary-light-bg);
    border-color: color-mix(in srgb, var(--primary-color), transparent 58%);
    color: var(--primary-color);
    font-weight: 600;
  }
}
.keyline-option-label {
  min-width: 0;
}
.keyline-option-state {
  flex: 0 0 auto;
  font-size: 14px;
}
</style>

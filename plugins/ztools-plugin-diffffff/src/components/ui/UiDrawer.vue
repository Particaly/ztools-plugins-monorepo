<!--
  UiDrawer：北欧风右侧滑出抽屉（替代 ztools-ui ZDrawer + ZDrawerContent，
  reka-ui DialogRoot 侧边形态）。

  能力对齐：show 双向绑定、Esc / 遮罩点击关闭、焦点圈定（reka 内建）、
  可见标题 + 关闭钮（closable 语义）；固定宽 340px（主面板可能较窄，取窄抽屉）。
  视觉：纸面面板 + 发丝左边线 + 分层轻阴影，滑入 0.16s 短促干净。
  内容由 default 槽自理（消费方 HistoryDrawer 的排版见 main.css history-* 段）。
-->
<script setup lang="ts">
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { VisuallyHidden } from 'reka-ui'
import UiIcon from './UiIcon.vue'

defineProps<{
  show: boolean
  title: string
  /** 可访问名兜底（sr-only 描述，可选） */
  description?: string
}>()

const emit = defineEmits<{ 'update:show': [value: boolean] }>()
</script>

<template>
  <DialogRoot :open="show" @update:open="emit('update:show', $event)">
    <DialogPortal>
      <DialogOverlay class="ui-drawer-overlay" />
      <DialogContent class="ui-drawer-content" :trap-focus="true">
        <!-- 头部：可见标题 + 关闭钮（关闭统一走 update:show 回写） -->
        <header class="ui-drawer-header">
          <DialogTitle class="ui-drawer-title">{{ title }}</DialogTitle>
          <DialogClose class="ui-drawer-close" aria-label="关闭">
            <UiIcon name="x" :size="14" />
          </DialogClose>
        </header>
        <div class="ui-drawer-body">
          <slot />
        </div>
        <!-- a11y：无可见描述文案时兜底 DialogDescription 语义 -->
        <VisuallyHidden>
          <p>{{ description ?? title }}</p>
        </VisuallyHidden>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.ui-drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 22000;
  background-color: color-mix(in srgb, #2a241c 24%, transparent);
  animation: ui-overlay-in 0.15s var(--ease-quiet);
}

/* 面板：右侧纸面抽屉，发丝左边线区分层级 */
.ui-drawer-content {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 22001;
  display: flex;
  flex-direction: column;
  width: 340px;
  max-width: 86vw;
  border-left: 1px solid var(--border-color, #e8e4dc);
  background-color: var(--surface, #ffffff);
  box-shadow: var(--shadow-3);
  animation: ui-drawer-in 0.16s var(--ease-quiet);
}

.ui-drawer-overlay[data-state='closed'],
.ui-drawer-content[data-state='closed'] {
  animation: none;
  opacity: 0;
  transition: opacity 0.1s var(--ease-quiet);
}

@keyframes ui-overlay-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes ui-drawer-in {
  from {
    transform: translateX(24px);
    opacity: 0.4;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ui-drawer-overlay,
  .ui-drawer-content {
    animation: none;
  }
}

.ui-drawer-header {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px 10px 16px;
  border-bottom: 1px solid var(--divider-color, #edeae3);
}

.ui-drawer-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color, #2e2c28);
}

/* 关闭钮：ghost 图标钮（hover 轻洗色） */
.ui-drawer-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: var(--radius-s, 6px);
  background: transparent;
  color: var(--text-secondary, #8a8377);
  cursor: pointer;
  transition: background-color 0.12s var(--ease-quiet), color 0.12s var(--ease-quiet);
}

.ui-drawer-close:hover {
  background-color: var(--hover-bg, #f2f0ea);
  color: var(--text-color, #2e2c28);
}

.ui-drawer-close:focus-visible {
  outline: 1.5px solid var(--primary-color);
  outline-offset: 1px;
}

/* 主体：纵向滚动（内容超出抽屉高度时内滚，不撑破面板） */
.ui-drawer-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 16px 16px;
}
</style>

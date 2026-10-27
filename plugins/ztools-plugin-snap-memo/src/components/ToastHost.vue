<script setup lang="ts">
/**
 * 轻量 Toast 宿主：成功/失败/带撤销动作三种形态，自动消失（撤销类 5 秒）。
 */
import type { AppStore } from '../store/appStore'

const props = defineProps<{ store: AppStore }>()

function dismiss(id: number): void {
  props.store.actions.dismissToast(id)
}
</script>

<template>
  <div class="toast-host" aria-live="polite">
    <TransitionGroup name="slide">
      <div
        v-for="item in store.state.toasts"
        :key="item.id"
        class="toast"
        :class="item.kind"
        role="status"
        @click="dismiss(item.id)"
      >
        <span class="toast-text">{{ item.text }}</span>
        <button v-if="item.actionLabel" class="toast-action" @click.stop="item.onAction?.(); dismiss(item.id)">
          {{ item.actionLabel }}
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-host {
  position: absolute;
  left: 50%;
  bottom: 44px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  z-index: 60;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  border-radius: var(--sm-radius-m);
  background: var(--sm-surface);
  border: 1px solid var(--sm-border);
  box-shadow: var(--sm-shadow-2);
  font-size: var(--sm-font-s);
  cursor: pointer;
  max-width: 460px;
}

.toast.success {
  border-color: color-mix(in srgb, var(--sm-success) 45%, var(--sm-border));
}

.toast.error {
  border-color: color-mix(in srgb, var(--sm-danger) 45%, var(--sm-border));
}

.toast-action {
  border: none;
  background: none;
  color: var(--sm-accent);
  font-weight: 600;
  cursor: pointer;
  padding: 2px 4px;
  flex: none;
}
</style>

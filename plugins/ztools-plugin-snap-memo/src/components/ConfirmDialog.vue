<script setup lang="ts">
/**
 * 应用内确认对话框（替代原生 window.confirm——宿主 WebView 可能禁用原生对话框）。
 * 状态在 store（confirm），键盘路由在 App（Esc 取消 / Enter 确认）；打开时自动聚焦确定按钮。
 */
import { nextTick, onMounted, ref, watch } from 'vue'
import type { AppStore } from '../store/appStore'
import { t } from '../i18n/zh-CN'

const props = defineProps<{ store: AppStore }>()
const okRef = ref<HTMLButtonElement | null>(null)

async function focusOk(): Promise<void> {
  await nextTick()
  okRef.value?.focus()
}

onMounted(() => {
  void focusOk()
})

watch(
  () => props.store.state.confirm,
  (c) => {
    if (c) void focusOk()
  }
)
</script>

<template>
  <div v-if="store.state.confirm" class="modal-mask" @click.self="store.actions.resolveConfirm(false)">
    <div class="modal" role="alertdialog" aria-modal="true" :aria-label="t('confirm.title')">
      <p class="confirm-text">{{ store.state.confirm.text }}</p>
      <div class="modal-foot">
        <span class="spacer" />
        <button class="sm-btn" @click="store.actions.resolveConfirm(false)">{{ t('confirm.cancel') }}</button>
        <button ref="okRef" class="sm-btn" :class="{ danger: store.state.confirm.danger }" @click="store.actions.resolveConfirm(true)">
          {{ t('confirm.ok') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-mask {
  position: absolute;
  inset: 0;
  background: var(--sm-mask);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 58; /* 高于分组管理(50)，低于填写框(55) */
}

.modal {
  width: 360px;
  background: var(--sm-surface);
  border: 1px solid var(--sm-border);
  border-radius: var(--sm-radius-l);
  box-shadow: var(--sm-shadow-2);
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.confirm-text {
  font-size: var(--sm-font-m);
  line-height: 1.6;
  color: var(--sm-text);
  white-space: pre-wrap;
}

.modal-foot {
  display: flex;
  gap: 8px;
}

.spacer {
  flex: 1;
}
</style>

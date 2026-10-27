<script setup lang="ts">
/**
 * 填空变量对话框（{input:标签=默认值}）：
 * Tab 逐项切换、Enter 确认粘贴、Esc 取消；空项聚焦、默认值预填。
 */
import { nextTick, onMounted, ref } from 'vue'
import type { AppStore } from '../store/appStore'
import { t } from '../i18n/zh-CN'

const props = defineProps<{ store: AppStore }>()

const answers = ref<Record<string, string>>({})
const inputRefs = ref<HTMLInputElement[]>([])

const pending = () => props.store.state.pendingPaste

onMounted(async () => {
  const p = pending()
  if (!p) return
  for (const prompt of p.prompts) {
    answers.value[prompt.key] = prompt.defaultValue
  }
  await nextTick()
  const firstEmpty = inputRefs.value.find((el) => el.value === '') ?? inputRefs.value[0]
  firstEmpty?.focus()
})

function confirm(): void {
  props.store.actions.confirmPendingPaste({ ...answers.value })
}

/** 回车确认（IME 组合中的回车是选字，不上屏）。 */
function onInputKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return
  e.preventDefault()
  confirm()
}

function cancel(): void {
  props.store.actions.cancelPendingPaste()
}
</script>

<template>
  <Transition name="pop">
    <div v-if="pending()" class="modal-mask">
      <div class="modal" role="dialog" aria-modal="true" :aria-label="t('fillIn.title')" @keydown.esc.stop.prevent="cancel">
        <header class="modal-head">
          <span>{{ t('fillIn.title') }}</span>
          <span class="hint">{{ t('fillIn.tabHint') }} · Enter {{ t('fillIn.confirm') }} · Esc {{ t('fillIn.cancel') }}</span>
        </header>
        <div class="fields">
          <label v-for="(prompt, i) in pending()!.prompts" :key="prompt.key" class="field">
            <span class="field-label">{{ prompt.label }}</span>
            <input
              :ref="(el) => { if (el) inputRefs[i] = el as HTMLInputElement }"
              v-model="answers[prompt.key]"
              class="sm-input"
              @keydown="onInputKeydown"
            />
          </label>
        </div>
        <footer class="modal-foot">
          <span class="spacer" />
          <button class="sm-btn" @click="cancel">{{ t('fillIn.cancel') }}</button>
          <button class="sm-btn primary" @click="confirm">{{ t('fillIn.confirm') }}</button>
        </footer>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-mask {
  position: absolute;
  inset: 0;
  background: var(--sm-mask);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 55;
}

.modal {
  width: 380px;
  max-height: 70vh;
  overflow: auto;
  background: var(--sm-surface);
  border: 1px solid var(--sm-border);
  border-radius: var(--sm-radius-l);
  box-shadow: var(--sm-shadow-2);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: var(--sm-font-l);
  font-weight: 600;
}

.hint {
  font-size: 11px;
  color: var(--sm-text-3);
  font-weight: 400;
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: var(--sm-font-s);
  color: var(--sm-text-2);
}

.modal-foot {
  display: flex;
  gap: 8px;
}

.spacer {
  flex: 1;
}
</style>

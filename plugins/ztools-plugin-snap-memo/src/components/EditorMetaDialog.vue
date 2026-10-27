<script setup lang="ts">
/**
 * 编辑器字段弹窗：顶栏分组/标签/触发词徽片点开后单独设置对应字段（一次一个）。
 * 修改即时写回编辑器表单（落库仍由编辑器「保存」统一负责，取消编辑即一并丢弃）；
 * 关闭走「完成」、遮罩单击或 Esc（editorMeta 在 store，App 全局键盘路由优先关弹窗而非编辑器）。
 */
import { computed, nextTick, onMounted, ref } from 'vue'
import type { AppStore, EditorMetaField } from '../store/appStore'
import SmSelect from './SmSelect.vue'
import SmTagSelect from './SmTagSelect.vue'
import { platform } from '../platform'
import { t } from '../i18n/zh-CN'

const props = defineProps<{ store: AppStore; field: EditorMetaField }>()

const editor = computed(() => props.store.state.editor)
const keywordAvailable = computed(() => platform.features !== null)

/** 表单控件引用：弹窗打开后把初始焦点落到对应输入控件上。 */
const groupSelectRef = ref<InstanceType<typeof SmSelect> | null>(null)
const tagSelectRef = ref<InstanceType<typeof SmTagSelect> | null>(null)
const keywordInputRef = ref<HTMLInputElement | null>(null)
const doneBtnRef = ref<HTMLButtonElement | null>(null)

/**
 * 弹窗挂载后聚焦表单控件（分组 → 下拉触发器，标签 → 输入框，触发词 → 输入框），打开即可直接输入。
 * 弹窗在 EditorPanel 里按 v-if 整体重挂载、子 Transition 初次挂载不播入场动画，
 * 因此无「动画途中聚焦」的坐标问题；挂载次帧焦点即可落位（与分组管理等弹窗同模式）。
 */
onMounted(() => {
  void nextTick(focusField)
})

function focusField(): void {
  if (props.field === 'group') groupSelectRef.value?.focus()
  else if (props.field === 'tags') tagSelectRef.value?.focus()
  else keywordInputRef.value?.focus()
}

/**
 * 弹窗内方向键焦点导航：↑↓←→ 在表单控件与「完成」按钮间切换（弹窗只有这两个可聚焦控件）。
 * 三类按键不劫持、交还原生/组件行为：文本输入框的 ←/→（移动光标）、
 * 分组下拉关闭态触发器的 ↑/↓（展开弹层）、下拉弹层打开时的全部方向键（弹层内移动高亮）。
 * Esc 关闭语义与原 .esc.stop.prevent 修饰一致（App 全局路由在捕获段已先处理，重复关闭无害）。
 */
function onDialogKeydown(e: KeyboardEvent): void {
  if (e.isComposing || e.keyCode === 229) return
  if (e.key === 'Escape') {
    e.stopPropagation()
    e.preventDefault()
    close()
    return
  }
  if (!e.key.startsWith('Arrow')) return
  const target = e.target as HTMLElement | null
  if (!target) return
  // 下拉弹层打开时：方向键属于弹层高亮移动，不抢
  if (target.closest('.sm-select[data-open]')) return
  const inField = Boolean(target.closest('.field'))
  const inFooter = Boolean(target.closest('.modal-foot'))
  if (!inField && !inFooter) return
  // 文本输入框内 ←/→ 是移动光标
  if (target.tagName === 'INPUT' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return
  if (inField) {
    // 分组触发器关闭态 ↑/↓ 是展开下拉
    if (target.classList.contains('select-trigger') && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) return
    e.preventDefault()
    doneBtnRef.value?.focus()
    return
  }
  e.preventDefault()
  focusField()
}

const titleText = computed(() => {
  if (props.field === 'group') return t('editor.groupTitle')
  if (props.field === 'tags') return t('editor.tagsTitle')
  return t('editor.keywordTitle')
})

/** 分组下拉选项（自定义 SmSelect；null = 未分组）。 */
const groupOptions = computed(() => [
  { value: null, label: t('ungrouped') },
  ...props.store.state.groups.map((g) => ({ value: g.id, label: g.name }))
])

/** 下拉内直接新建分组：创建成功即选中。 */
function onCreateGroup(name: string): void {
  const group = props.store.actions.createGroup(name)
  if (group) props.store.actions.patchEditor({ groupId: group.id })
}

/**
 * 标签读写桥：表单里的逗号分隔文本 ↔ SmTagSelect 的数组；
 * 解析（中英逗号、trim 去空）与拼接（", "）规则与 store.saveEditor 的落库逻辑一致。
 */
const tagList = computed<string[]>({
  get: () => (editor.value ? editor.value.tagsText.split(/[,，]/).map((s) => s.trim()).filter(Boolean) : []),
  set: (tags) => {
    if (editor.value) editor.value.tagsText = tags.join(', ')
  }
})

const keywordConflict = computed(() => {
  const form = editor.value
  if (!form || !form.keyword.trim()) return false
  return props.store.actions.keywordConflicts(form.keyword, form.memoId)
})

function close(): void {
  props.store.actions.closeEditorMeta()
}

/** 触发词输入框回车：非 IME 组合时等同点「完成」。 */
function onKeywordKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return
  e.preventDefault()
  close()
}
</script>

<template>
  <Transition name="pop">
    <div v-if="editor" class="modal-mask" @mousedown.self="close">
      <div class="modal" role="dialog" aria-modal="true" :aria-label="titleText" @keydown="onDialogKeydown">
        <header class="modal-head">
          <span>{{ titleText }}</span>
          <span class="hint">{{ t('editor.metaEscHint') }}</span>
        </header>

        <div v-if="field === 'group'" class="field">
          <SmSelect
            ref="groupSelectRef"
            v-model="editor.groupId"
            creatable
            :options="groupOptions"
            :aria-label="t('editor.group')"
            @create="onCreateGroup"
          />
        </div>

        <div v-else-if="field === 'tags'" class="field">
          <!-- 上限 8 与 store.saveEditor 落库时的 slice 一致 -->
          <SmTagSelect
            ref="tagSelectRef"
            v-model="tagList"
            :options="store.computed.allTags.value"
            :max="8"
            :placeholder="t('editor.tagsPlaceholder')"
            :aria-label="t('editor.tags')"
          />
        </div>

        <div v-else-if="keywordAvailable" class="field">
          <input
            ref="keywordInputRef"
            v-model="editor.keyword"
            class="sm-input"
            :placeholder="t('editor.keywordPlaceholder')"
            maxlength="30"
            @keydown="onKeywordKeydown"
          />
          <span v-if="keywordConflict" class="kw-conflict">{{ t('editor.keywordConflictHint') }}</span>
        </div>

        <footer class="modal-foot">
          <span class="spacer" />
          <button ref="doneBtnRef" class="sm-btn primary" @click="close">{{ t('editor.metaDone') }}</button>
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
  width: 360px;
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

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kw-conflict {
  font-size: 11px;
  color: var(--sm-danger);
}

.modal-foot {
  display: flex;
  gap: 8px;
}

.spacer {
  flex: 1;
}
</style>

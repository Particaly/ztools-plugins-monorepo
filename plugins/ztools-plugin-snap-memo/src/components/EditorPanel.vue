<script setup lang="ts">
/**
 * 新建/编辑面板：顶栏一行放下 标题 + 分组/标签/触发词 徽片；
 * 标题为点击进入编辑的下划线输入（占位标题展示，Enter 跳正文、Esc 还原、失焦提交），
 * 分组/标签/触发词以各自展示形态（色点分组名 / #标签 / 虚线徽标）跟在标题后，
 * 点击分别弹出 EditorMetaDialog 单独设置（修改即时写回表单，落库仍走「保存」）；
 * 正文为图文混排编辑器（MixedEditor）：图片以行内方式与文字混排，工具栏插入图片文件、
 * Ctrl/⌘+V 直接粘贴图片、拖入图片文件即插入光标处，退格整图删除，⌘/Ctrl+Tab 缩进；
 * 触发词冲突在弹窗内实时提示；重复内容提示（文字或图片指纹，可跳转已有条目）；
 * Mod+Enter 保存、Esc 取消（脏状态先确认）。
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { platform } from '../platform'
import type { AppStore } from '../store/appStore'
import { resolveTemplate } from '../core/placeholders'
import { fnv1aHash } from '../core/image'
import { stripImageTokens, uniqueImageIds } from '../core/inlineImage'
import MixedEditor from './MixedEditor.vue'
import EditorMetaDialog from './EditorMetaDialog.vue'
import Icon from './Icon.vue'
import { t } from '../i18n/zh-CN'

const props = defineProps<{ store: AppStore }>()

const modLabel = platform.isMac ? '⌘' : 'Ctrl'

const editorRef = ref<InstanceType<typeof MixedEditor> | null>(null)
const showMono = ref(false)
const keywordAvailable = computed(() => platform.features !== null)

const editor = computed(() => props.store.state.editor)

const duplicate = computed(() => {
  const form = editor.value
  if (!form) return null
  // 有新图先按图片指纹查重（文字部分不影响判断）；否则按正文查重
  const staged = Object.values(props.store.state.editorImages)[0]
  if (staged) {
    const hash = fnv1aHash(staged)
    return props.store.actions.findDuplicate('', form.memoId, hash) ?? null
  }
  if (!form.content.trim()) return null
  return props.store.actions.findDuplicate(form.content, form.memoId) ?? null
})

/** 占位符预览基于纯文字视图（图片标记不参与解析）。 */
const resolvedPreview = computed(() => {
  const form = editor.value
  const text = form ? stripImageTokens(form.content).trim() : ''
  if (!text) return ''
  return resolveTemplate(text, {}).text
})

const hasPlaceholderEffect = computed(() => {
  const form = editor.value
  if (!form) return false
  return resolvedPreview.value !== stripImageTokens(form.content).trim()
})

/** 行内图片的展示 src：暂存像素直接 dataURL，既有图走缩略图管线（小图）。 */
const imageSources = computed<Record<string, string>>(() => {
  const form = editor.value
  const map: Record<string, string> = {}
  if (!form) return map
  for (const id of uniqueImageIds(form.content)) {
    const staged = props.store.state.editorImages[id]
    if (staged) {
      map[id] = staged
      continue
    }
    const thumb = props.store.state.imageThumbs[id]
    if (thumb?.status === 'ready') map[id] = thumb.small
  }
  return map
})

// 正文引用的既有图按需生成缩略图（staged 的直接有 dataURL，无需生成）
watch(
  () => props.store.state.editor?.content,
  (content) => {
    if (!content) return
    for (const id of uniqueImageIds(content)) {
      if (props.store.state.editorImages[id]) continue
      props.store.actions.ensureThumbSlot(id)
    }
  },
  { immediate: true }
)

// ---------- 标题：点击进入编辑的下划线输入 ----------

const titleEditing = ref(false)
const titleInputRef = ref<HTMLInputElement | null>(null)
/** 进入编辑前的标题值（Esc 还原用）。 */
let titleBeforeEdit = ''

/** 点击占位/标题文本进入编辑态：聚焦并全选，便于整体替换。 */
function startTitleEdit(): void {
  const form = editor.value
  if (!form) return
  titleBeforeEdit = form.title
  titleEditing.value = true
  void nextTick(() => {
    const el = titleInputRef.value
    if (!el) return
    el.focus()
    el.select()
  })
}

/** 结束标题编辑并保留当前值（失焦 / Enter 提交）。 */
function commitTitle(): void {
  titleEditing.value = false
}

/** Esc 放弃本次标题修改：还原进入编辑前的值。 */
function cancelTitleEdit(): void {
  const form = editor.value
  titleEditing.value = false
  if (form) form.title = titleBeforeEdit
}

/**
 * 标题编辑键位：Enter 提交并跳正文（录入习惯）；Esc 还原；IME 组合不拦截。
 * Mod+Enter 保存不在本地处理，交回全局路由（App 对标题输入态放行其余按键）。
 */
function onTitleKeydown(e: KeyboardEvent): void {
  if (e.isComposing || e.keyCode === 229) return
  if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
    e.preventDefault()
    commitTitle()
    void nextTick(() => editorRef.value?.focus())
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    cancelTitleEdit()
  }
}

// 表单被整体替换（打开新表单/弹窗内 patch）时退出标题编辑态，避免残留旧输入框
watch(
  () => props.store.state.editor,
  () => {
    titleEditing.value = false
  }
)

// ---------- 顶栏徽片：分组 / 标签 / 触发词 的展示态 ----------

/** 当前选中分组（色点 + 名称展示；未选或分组已删时回落「未分组」）。 */
const groupInfo = computed(() => {
  const gid = editor.value?.groupId
  return gid ? props.store.state.groups.find((g) => g.id === gid) ?? null : null
})

const groupNameLabel = computed(() => groupInfo.value?.name ?? t('ungrouped'))

/** 标签解析规则与 store.saveEditor 落库一致（中英逗号、trim 去空）。 */
const tags = computed(() =>
  editor.value ? editor.value.tagsText.split(/[,，]/).map((s) => s.trim()).filter(Boolean) : []
)

/** 顶栏空间有限：最多展示 2 个标签，剩余折叠为 +N。 */
const visibleTags = computed(() => tags.value.slice(0, 2))
const extraTagCount = computed(() => Math.max(0, tags.value.length - visibleTags.value.length))

function goToDuplicate(): void {
  const dup = duplicate.value
  if (!dup) return
  props.store.actions.closeEditor(true)
  props.store.actions.selectMemo(dup.id)
}

/** 工具栏插入图片文件：暂存像素后在编辑器光标处（失焦则末尾）插入行内图片。 */
async function pickImage(): Promise<void> {
  try {
    const file = await platform.files.pickImage()
    if (!file?.dataUrl) return
    const slot = props.store.actions.editorStageImage(file.dataUrl)
    if (slot) editorRef.value?.insertImage(slot, file.dataUrl)
  } catch (e) {
    props.store.actions.toast(e instanceof Error ? e.message : t('toasts.imageInvalid'), { kind: 'error' })
  }
}

function onStageImage(dataUrl: string): string | null {
  return props.store.actions.editorStageImage(dataUrl)
}

onMounted(() => {
  void nextTick(() => editorRef.value?.focus())
})

// ---------- 方向键焦点导航：顶栏/底行控件用 ←/→ 切换，↓/↑ 与正文编辑器互跳 ----------

const headRef = ref<HTMLElement | null>(null)
const toggleRowRef = ref<HTMLElement | null>(null)
const groupChipRef = ref<HTMLButtonElement | null>(null)
const tagsChipRef = ref<HTMLButtonElement | null>(null)
const keywordChipRef = ref<HTMLButtonElement | null>(null)

/** 取行内按 DOM 顺序排列的可聚焦按钮，并定位当前焦点（徽片内的 span 由 closest 归一到按钮）。 */
function rowFocusables(row: HTMLElement | null, current: HTMLElement | null): { controls: HTMLElement[]; index: number } {
  const controls = [...(row?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])]
  const anchor = (current?.closest('button') as HTMLElement | null) ?? current
  return { controls, index: anchor ? controls.indexOf(anchor) : -1 }
}

/** ←/→ 在一行控件内循环移动焦点；文本光标场景（标题编辑态等）不劫持。 */
function stepRowFocus(e: KeyboardEvent, row: HTMLElement | null): void {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  const target = e.target as HTMLElement | null
  if (!target || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
  const { controls, index } = rowFocusables(row, target)
  if (index < 0 || controls.length < 2) return
  const delta = e.key === 'ArrowRight' ? 1 : -1
  e.preventDefault()
  controls[(index + delta + controls.length) % controls.length].focus()
}

/**
 * 顶栏方向键导航：←/→ 在 标题/分组/标签/触发词/工具按钮 间切换，↓ 进正文编辑器。
 * 标题编辑态（INPUT）的方向键是移动光标，不劫持；↑ 在顶栏无上一行，忽略。
 */
function onHeadKeydown(e: KeyboardEvent): void {
  if (e.isComposing || e.keyCode === 229) return
  if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
  if (e.key === 'ArrowDown') {
    if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return
    e.preventDefault()
    editorRef.value?.focus()
    return
  }
  stepRowFocus(e, headRef.value)
}

/** 底行方向键导航：←/→ 在 置顶/敏感/取消/保存 间切换，↑ 回正文编辑器。 */
function onToggleRowKeydown(e: KeyboardEvent): void {
  if (e.isComposing || e.keyCode === 229) return
  if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    editorRef.value?.focus()
    return
  }
  stepRowFocus(e, toggleRowRef.value)
}

// 字段弹窗关闭：焦点还给打开它的徽片（弹窗整体卸载会让焦点落空到 body，方向键/Tab 动线即断）
watch(
  () => props.store.state.editorMeta,
  (field, prev) => {
    if (field || !prev || props.store.state.view !== 'editor') return
    void nextTick(() => {
      if (props.store.state.view !== 'editor' || props.store.state.editorMeta) return
      const chips = { group: groupChipRef, tags: tagsChipRef, keyword: keywordChipRef } as const
      chips[prev]?.value?.focus()
    })
  }
)

// 内容变化即自动保存草稿（防进程退出丢数据；图片像素不进草稿）
let draftTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () =>
    editor.value
      ? [editor.value.title, editor.value.content, editor.value.tagsText, editor.value.keyword, editor.value.groupId]
      : null,
  () => {
    if (draftTimer) clearTimeout(draftTimer)
    draftTimer = setTimeout(() => {
      if (props.store.state.view === 'editor') props.store.actions.saveDraft()
    }, 600)
  },
  { deep: false }
)
</script>

<template>
  <section v-if="editor" class="editor" aria-label="editor">
    <header ref="headRef" class="editor-head" @keydown="onHeadKeydown">
      <span class="mode-badge">{{ editor.mode === 'new' ? t('editor.badgeNew') : t('editor.badgeEdit') }}</span>

      <!-- 标题：展示态为占位标题，点击进入下划线编辑 -->
      <input
        v-if="titleEditing"
        ref="titleInputRef"
        v-model="editor.title"
        class="title-input"
        :placeholder="t('editor.titlePlaceholder')"
        maxlength="120"
        :aria-label="t('editor.title')"
        @keydown="onTitleKeydown"
        @blur="commitTitle"
      />
      <button
        v-else
        class="title-display selectable"
        :class="{ empty: !editor.title.trim() }"
        :title="t('editor.title')"
        @click="startTitleEdit"
      >{{ editor.title.trim() || t('editor.titlePlaceholder') }}</button>

      <!-- 分组/标签/触发词：展示态徽片，点击分别弹窗设置 -->
      <button ref="groupChipRef" class="meta-chip" :title="t('editor.groupTitle')" @click="store.actions.setEditorMeta('group')">
        <span class="dot" :style="{ background: groupInfo?.color || 'var(--sm-text-3)' }" />
        <span class="chip-text">{{ groupNameLabel }}</span>
      </button>

      <button
        ref="tagsChipRef"
        class="meta-chip"
        :class="{ ghost: tags.length === 0 }"
        :title="t('editor.tagsTitle')"
        @click="store.actions.setEditorMeta('tags')"
      >
        <template v-if="tags.length">
          <span v-for="tag in visibleTags" :key="tag" class="chip-text">#{{ tag }}</span>
          <span v-if="extraTagCount > 0" class="chip-text more">+{{ extraTagCount }}</span>
        </template>
        <template v-else>
          <Icon name="tag" :size="11" />
          <span class="chip-text">{{ t('editor.addTags') }}</span>
        </template>
      </button>

      <button
        v-if="keywordAvailable"
        ref="keywordChipRef"
        class="meta-chip kw"
        :class="{ ghost: !editor.keyword.trim() }"
        :title="t('editor.keywordTitle')"
        @click="store.actions.setEditorMeta('keyword')"
      >
        <span class="chip-text">{{ editor.keyword.trim() || t('editor.addKeyword') }}</span>
      </button>

      <span class="spacer" />
      <button class="sm-icon-btn" :title="t('editor.insertImage')" @click="pickImage">
        <Icon name="image" />
      </button>
      <button class="sm-icon-btn" :title="t('settings')" :class="{ active: showMono }" @click="showMono = !showMono">
        <Icon name="code" />
      </button>
      <button class="sm-icon-btn" :title="t('editor.cancel')" @click="store.actions.closeEditor()">
        <Icon name="close" />
      </button>
    </header>

    <div class="editor-body">
      <div class="field-row grow">
        <div class="content-col" :class="{ mono: showMono }">
          <MixedEditor
            ref="editorRef"
            v-model="editor.content"
            :image-sources="imageSources"
            :stage-image="onStageImage"
            :placeholder="t('editor.contentMixed')"
          />
        </div>
        <!-- 占位符解析预览与重复警告：出现/消失淡入淡出 -->
        <Transition name="fade">
          <div v-if="hasPlaceholderEffect" class="resolve-preview selectable">
            <span class="preview-label">{{ t('editor.previewLabel') }}</span>
            <pre>{{ resolvedPreview }}</pre>
          </div>
        </Transition>
      </div>

      <div class="editor-hint">{{ t('editor.imageHint') }}</div>

      <Transition name="fade">
        <div v-if="duplicate" class="dup-warning">
          <Icon name="shield" :size="13" />
          <span>{{ t('editor.duplicateHint') }}：{{ duplicate.title || duplicate.content.slice(0, 24) }}</span>
          <button class="sm-btn small" @click="goToDuplicate">{{ t('editor.duplicateGoTo') }}</button>
        </div>
      </Transition>

      <div ref="toggleRowRef" class="toggle-row" @keydown="onToggleRowKeydown">
        <label class="toggle">
          <button
            class="sm-switch"
            :class="{ on: editor.pinned }"
            role="switch"
            :aria-checked="editor.pinned"
            @click="editor.pinned = !editor.pinned"
          />
          <span>{{ t('editor.pinned') }}</span>
        </label>
        <label class="toggle">
          <button
            class="sm-switch"
            :class="{ on: editor.sensitive }"
            role="switch"
            :aria-checked="editor.sensitive"
            @click="editor.sensitive = !editor.sensitive"
          />
          <span>{{ t('editor.sensitive') }}</span>
        </label>
        <span class="spacer" />
        <button class="sm-btn" @click="store.actions.closeEditor()">{{ t('editor.cancel') }}</button>
        <button class="sm-btn primary" @click="store.actions.saveEditor()">
          {{ t('editor.save') }}
          <span class="kbd">{{ modLabel }}↵</span>
        </button>
      </div>
    </div>

    <!-- 分组/标签/触发词的独立设置弹窗（一次一个） -->
    <EditorMetaDialog v-if="store.state.editorMeta" :store="store" :field="store.state.editorMeta" />
  </section>
</template>

<style scoped>
.editor {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 10px 14px 12px;
  min-height: 0;
}

.editor-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  min-width: 0;
}

.mode-badge {
  flex: none;
  font-size: 11px;
  color: var(--sm-text-3);
}

/* 标题展示态：占位标题、hover 微亮提示可点 */
.title-display {
  flex: 0 1 auto;
  min-width: 0;
  padding: 2px 6px;
  border: none;
  border-radius: var(--sm-radius-s);
  background: transparent;
  font-size: var(--sm-font-l);
  font-weight: 600;
  color: var(--sm-text);
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: text;
  transition: background var(--sm-dur-fast) var(--sm-ease-out);
}

.title-display:hover {
  background: var(--sm-hover);
}

.title-display.empty {
  color: var(--sm-text-3);
  font-weight: 400;
}

/* 标题编辑态：无边框输入，仅保留底部下划线 */
.title-input {
  flex: 0 1 auto;
  min-width: 120px;
  padding: 0 2px 2px;
  border: none;
  border-bottom: 1.5px solid var(--sm-accent);
  background: transparent;
  font-size: var(--sm-font-l);
  font-weight: 600;
  color: var(--sm-text);
  white-space: nowrap;
  overflow: hidden;
}

.title-input:focus {
  outline: none;
}

.title-input::placeholder {
  color: var(--sm-text-3);
  font-weight: 400;
}

/* 顶栏徽片：分组（色点+名）/ 标签（#名）/ 触发词（虚线徽标），点击弹窗设置 */
.meta-chip {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 120px;
  padding: 2px 8px;
  border: 1px solid var(--sm-border);
  border-radius: 999px;
  background: var(--sm-surface);
  font-size: 11px;
  line-height: 16px;
  color: var(--sm-text-2);
  cursor: pointer;
  transition: border-color var(--sm-dur-fast) var(--sm-ease-out), background var(--sm-dur-fast) var(--sm-ease-out);
}

.meta-chip:hover {
  border-color: var(--sm-accent);
  background: var(--sm-hover);
}

.meta-chip .chip-text {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta-chip .more {
  color: var(--sm-text-3);
}

/* 无值时的「添加」态：虚线弱化，提示可补 */
.meta-chip.ghost {
  border-style: dashed;
  color: var(--sm-text-3);
}

/* 触发词沿用列表 kw-badge 的虚线语言 */
.meta-chip.kw {
  border-style: dashed;
  color: var(--sm-text-3);
}

.dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.spacer {
  flex: 1;
}

.editor-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}

.field-row.grow {
  flex: 1;
  display: flex;
  gap: 10px;
  min-height: 140px;
}

.content-col {
  flex: 1;
  display: flex;
  min-height: 0;
}

/* 等宽模式（代码片段）：编辑器字体切换 */
.content-col.mono :deep(.mxed) {
  font-family: var(--sm-font-mono);
  font-size: 0.92em;
}

.editor-hint {
  font-size: 11px;
  color: var(--sm-text-3);
}

.resolve-preview {
  width: 42%;
  border: 1px dashed var(--sm-border);
  border-radius: var(--sm-radius-s);
  padding: 8px 10px;
  overflow: auto;
  background: var(--sm-surface-2);
}

.preview-label {
  font-size: 11px;
  color: var(--sm-text-3);
  display: block;
  margin-bottom: 4px;
}

.resolve-preview pre {
  font-family: inherit;
  font-size: var(--sm-font-s);
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
}

.dup-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: var(--sm-radius-s);
  background: var(--sm-warning-bg);
  color: var(--sm-warning-text);
  font-size: var(--sm-font-s);
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: var(--sm-font-s);
  color: var(--sm-text-2);
}
</style>

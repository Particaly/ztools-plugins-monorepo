<script setup lang="ts">
/**
 * 新建/编辑面板：标题/正文/分组/标签/触发词/置顶/敏感；实时占位符解析预览；
 * 正文为图文混排编辑器（MixedEditor）：图片以行内方式与文字混排，工具栏插入图片文件、
 * Ctrl/⌘+V 直接粘贴图片、拖入图片文件即插入光标处，退格整图删除；
 * 标签输入带已有标签联想（datalist）；触发词实时冲突提示；
 * 重复内容提示（文字或图片指纹，可跳转已有条目）；Mod+Enter 保存（+Shift 保存并新建）、
 * Esc 取消（脏状态先确认）。
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { platform } from '../platform'
import type { AppStore } from '../store/appStore'
import { resolveTemplate } from '../core/placeholders'
import { fnv1aHash } from '../core/image'
import { stripImageTokens, uniqueImageIds } from '../core/inlineImage'
import MixedEditor from './MixedEditor.vue'
import Icon from './Icon.vue'
import { t } from '../i18n/zh-CN'

const props = defineProps<{ store: AppStore }>()

const modLabel = platform.isMac ? '⌘' : 'Ctrl'

const editorRef = ref<InstanceType<typeof MixedEditor> | null>(null)
const showMono = ref(false)
const newGroupName = ref('')
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

const keywordConflict = computed(() => {
  const form = editor.value
  if (!form || !form.keyword.trim()) return false
  return props.store.actions.keywordConflicts(form.keyword, form.memoId)
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

/** 标签联想 datalist 的 id（同一页面唯一即可）。 */
const TAG_DATALIST = 'sm-tag-suggestions'

function createGroupInline(): void {
  const name = newGroupName.value.trim()
  if (!name) return
  const group = props.store.actions.createGroup(name)
  if (group) props.store.actions.patchEditor({ groupId: group.id })
  newGroupName.value = ''
}

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

/** 标题回车：跳到正文（常见录入习惯）。 */
function onTitleKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return
  e.preventDefault()
  void nextTick(() => editorRef.value?.focus())
}

/** 新建分组输入的回车（IME 组合中的回车不上屏）。 */
function onNewGroupKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return
  e.preventDefault()
  createGroupInline()
}

onMounted(() => {
  void nextTick(() => editorRef.value?.focus())
})

// 内容变化即自动保存草稿（防进程退出丢数据；图片像素不进草稿）
let draftTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => (editor.value ? [editor.value.title, editor.value.content, editor.value.tagsText, editor.value.keyword] : null),
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
    <header class="editor-head">
      <span class="editor-title">{{ editor.mode === 'new' ? t('newMemo') : t('editMemo') }}</span>
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
      <div class="field-row">
        <input
          v-model="editor.title"
          class="sm-input title-input"
          :placeholder="t('editor.title')"
          maxlength="120"
          @keydown="onTitleKeydown"
        />
      </div>

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
        <div v-if="hasPlaceholderEffect" class="resolve-preview selectable">
          <span class="preview-label">{{ t('editor.previewLabel') }}</span>
          <pre>{{ resolvedPreview }}</pre>
        </div>
      </div>

      <div class="editor-hint">{{ t('editor.imageHint') }}</div>

      <div v-if="duplicate" class="dup-warning">
        <Icon name="shield" :size="13" />
        <span>{{ t('editor.duplicateHint') }}：{{ duplicate.title || duplicate.content.slice(0, 24) }}</span>
        <button class="sm-btn small" @click="goToDuplicate">{{ t('editor.duplicateGoTo') }}</button>
      </div>

      <div class="field-grid">
        <div class="sm-field">
          <label>{{ t('editor.group') }}</label>
          <div class="group-select">
            <select v-model="editor.groupId" class="sm-select">
              <option :value="null">{{ t('ungrouped') }}</option>
              <option v-for="g in store.state.groups" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
            <input
              v-model="newGroupName"
              class="sm-input inline-new"
              :placeholder="t('editor.newGroupPlaceholder')"
              maxlength="30"
              @keydown="onNewGroupKeydown"
            />
          </div>
        </div>
        <div class="sm-field">
          <label>{{ t('editor.tags') }}</label>
          <input v-model="editor.tagsText" class="sm-input" :placeholder="t('editor.tagsPlaceholder')" :list="TAG_DATALIST" />
          <datalist :id="TAG_DATALIST">
            <option v-for="tag in store.computed.allTags.value" :key="tag" :value="tag" />
          </datalist>
        </div>
      </div>

      <div v-if="keywordAvailable" class="sm-field">
        <label>{{ t('editor.keyword') }}</label>
        <input v-model="editor.keyword" class="sm-input" :placeholder="t('editor.keywordPlaceholder')" maxlength="30" />
        <span v-if="keywordConflict" class="kw-conflict">{{ t('editor.keywordConflictHint') }}</span>
      </div>

      <div class="toggle-row">
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
        <button class="sm-btn" @click="store.actions.saveEditor(true)">{{ t('editor.saveNew') }}</button>
        <button class="sm-btn primary" @click="store.actions.saveEditor()">
          {{ t('editor.save') }}
          <span class="kbd">{{ modLabel }}↵</span>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.editor {
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
}

.editor-title {
  flex: 1;
  font-size: var(--sm-font-l);
  font-weight: 600;
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
  font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace;
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

.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.group-select {
  display: flex;
  gap: 6px;
}

.inline-new {
  width: 96px;
  flex: none;
}

.kw-conflict {
  font-size: 11px;
  color: var(--sm-danger);
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

.spacer {
  flex: 1;
}
</style>

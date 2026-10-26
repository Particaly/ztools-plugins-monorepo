<script setup lang="ts">
/**
 * 右侧预览面板（预览与行内编辑一体）：
 * 预览态 —— 显示选中备忘的完整内容与占位符解析结果、元信息与快捷操作（置顶/编辑/复制）；
 * 编辑态 —— 点击标题或正文进入（标题输入框 + 正文文本域），右侧本面板即是编辑入口；
 *           失焦（点击面板外或面板上的其他元素）自动保存并回到预览，Esc / ⌘/Ctrl+Enter 同效；
 *           图片条目与未揭示的敏感条目不进入编辑态，完整编辑（分组/标签/图片）走「编辑备忘」；
 * 「收起面板」按钮隐藏面板（列表右上角面板开关或 Space 恢复显示）。
 * 图片条目渲染智能大图（点击切换撑满，悬浮右下角可全屏或用系统看图软件打开）与 OCR 识别区；
 * 行内代码片点击复制；敏感内容遮罩，点击眼睛临时显示；长内容可滚动。
 */
import { computed, nextTick, ref, watch } from 'vue'
import { platform } from '../platform'
import type { AppStore } from '../store/appStore'
import { resolveTemplate } from '../core/placeholders'
import { firstImageSlot, hasImages, stripImageTokens } from '../core/inlineImage'
import RichText from './RichText.vue'
import HoverImage from './HoverImage.vue'
import Icon from './Icon.vue'
import { t } from '../i18n/zh-CN'

const props = defineProps<{ store: AppStore }>()

const modLabel = platform.isMac ? '⌘' : 'Ctrl'

const paneRef = ref<HTMLElement | null>(null)
const titleRef = ref<HTMLInputElement | null>(null)
const contentRef = ref<HTMLTextAreaElement | null>(null)
const bodyRef = ref<HTMLElement | null>(null)

const memo = computed(() => props.store.computed.selectedMemo.value)
const draft = computed(() => props.store.state.previewEdit)

/** 是否处于行内编辑态（草稿存在且属于当前选中条目）。 */
const editing = computed(() => draft.value !== null && draft.value.memoId === memo.value?.id)

const revealed = computed(() => memo.value !== null && props.store.state.revealSensitive.has(memo.value.id))

/** 纯图条目（大图块布局）；含图混排条目走通用正文渲染（行内图片）。 */
const isImage = computed(() => memo.value?.kind === 'image')

const withImages = computed(() => (memo.value ? hasImages(memo.value) : false))

/** 首图槽（纯图条目的大图/尺寸/外部打开入口）。 */
const firstSlot = computed(() => (memo.value ? firstImageSlot(memo.value) : null))

const firstMeta = computed(() => memo.value?.images?.find((img) => img.id === firstSlot.value))

const resolved = computed(() => {
  const m = memo.value
  if (!m) return ''
  return resolveTemplate(m.content, {}).text
})

/** 预览态标题文案：敏感遮罩优先；无标题时回退内容首行文字 / OCR 首行。 */
const titleText = computed(() => {
  const m = memo.value
  if (!m) return ''
  if (m.sensitive && !revealed.value) return '••••••'
  if (!m.title && hasImages(m)) {
    const noteHead = stripImageTokens(m.content)
      .split('\n')
      .find((line) => line.trim())
    if (noteHead?.trim()) return noteHead.trim()
    return (m.ocrText ?? '').split('\n')[0].trim() || t('imageMemo')
  }
  return m.title || stripImageTokens(m.content).split('\n')[0] || t('preview.untitled')
})

/** 预览区图片展示 URL（Blob URL，store 展示缓存）。 */
const imageUrl = computed(() => (firstSlot.value ? props.store.actions.memoImageDisplay(firstSlot.value) : ''))

/** 图片尺寸/体积（保存时记录，老数据由缩略图管线回填）。 */
const imageDims = computed(() => {
  const w = firstMeta.value?.width ?? 0
  const h = firstMeta.value?.height ?? 0
  return w && h ? `${w}×${h}` : ''
})

const ocrRunning = computed(() => memo.value !== null && props.store.state.ocrRunning.has(memo.value.id))

const groupName = computed(() => {
  const m = memo.value
  if (!m?.groupId) return t('ungrouped')
  return props.store.computed.groupNameMap.value.get(m.groupId)?.name ?? t('ungrouped')
})

const metaLine = computed(() => {
  const m = memo.value
  if (!m) return ''
  const parts: string[] = []
  if (m.useCount > 0) parts.push(t('preview.useCount', { count: m.useCount }))
  if (m.lastUsedAt) parts.push(`${t('preview.lastUsed')} ${formatTime(m.lastUsedAt)}`)
  parts.push(`${t('preview.createdAt')} ${formatTime(m.createdAt)}`)
  return parts.join(' · ')
})

// 切换条目时预览滚动位置复位到顶部（否则读完长文下半段，下一条从中间开始）
watch(
  () => memo.value?.id,
  () => {
    const el = bodyRef.value
    if (el) el.scrollTop = 0
  }
)

function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * 进入编辑态并聚焦被点击的位置（标题或正文）。
 * 敏感条目须先点眼睛揭示（防止遮罩态绕过直接改内容）；含图条目由 beginPreviewEdit 拒绝。
 */
async function beginEdit(focus: 'title' | 'content'): Promise<void> {
  const m = memo.value
  if (!m || (m.sensitive && !revealed.value)) return
  props.store.actions.beginPreviewEdit()
  if (props.store.state.previewEdit === null) return
  await nextTick()
  if (focus === 'title') titleRef.value?.focus()
  else contentRef.value?.focus()
}

/** 预览正文点击：纯文本条目进入编辑；含图条目的点击交给图片自身交互（复制/全屏）。 */
function onBodyClick(): void {
  if (withImages.value) return
  void beginEdit('content')
}

/**
 * 编辑输入框失焦：焦点去往面板外的任何位置（列表、面板按钮、面板空白处）都自动保存；
 * 仅标题 ↔ 正文互切焦点时保持编辑态不提交。
 */
function onPaneFocusout(e: FocusEvent): void {
  const next = e.relatedTarget as Node | null
  if (next && (next === titleRef.value || next === contentRef.value)) return
  props.store.actions.commitPreviewEdit()
}

async function copyCurrent(): Promise<void> {
  const m = memo.value
  if (!m) return
  await props.store.actions.pasteMemo(m, { copyOnly: true })
}

async function pasteCurrent(): Promise<void> {
  const m = memo.value
  if (!m) return
  await props.store.actions.pasteMemo(m)
}

/** 纯图条目的备注文字（图片标记剥离后）。 */
function stripNote(content: string): string {
  return stripImageTokens(content).trim()
}

/** 手动触发 / 重跑 OCR。 */
function onOcrClick(): void {
  const m = memo.value
  if (!m) return
  void props.store.actions.runOcr(m.id)
}
</script>

<template>
  <aside v-if="memo" ref="paneRef" class="preview" :aria-label="t('preview.a11yPanel')" @focusout="onPaneFocusout">
    <header class="preview-head">
      <input
        v-if="editing"
        ref="titleRef"
        class="title-edit"
        :value="draft?.title ?? ''"
        :placeholder="t('editor.title')"
        maxlength="120"
        @input="store.actions.patchPreviewEdit({ title: ($event.target as HTMLInputElement).value })"
      />
      <span
        v-else
        class="preview-title selectable"
        :class="{ editable: !withImages && !(memo.sensitive && !revealed) }"
        :title="t('preview.focusEditHint')"
        @click="beginEdit('title')"
      >
        {{ titleText }}
      </span>
      <div class="preview-actions">
        <button
          v-if="memo.sensitive"
          class="sm-icon-btn"
          :title="revealed ? t('a11y.maskSensitive') : t('a11y.revealSensitive')"
          @click="store.actions.toggleReveal(memo.id)"
        >
          <Icon :name="revealed ? 'eye-off' : 'eye'" />
        </button>
        <button
          class="sm-icon-btn"
          :class="{ active: memo.pinned }"
          :title="memo.pinned ? t('menu.unpin') : t('menu.pin')"
          @click="store.actions.togglePinned(memo.id)"
        >
          <Icon name="pin" />
        </button>
        <button class="sm-icon-btn" :title="t('editMemo')" @click="store.actions.editMemo(memo.id)">
          <Icon name="edit" />
        </button>
        <button class="sm-icon-btn" :title="t('a11y.copyItem')" @click="copyCurrent">
          <Icon name="copy" />
        </button>
        <button class="sm-icon-btn" :title="t('preview.collapse')" @click="store.actions.togglePreviewPane()">
          <Icon name="panel" />
        </button>
      </div>
    </header>
    <div class="preview-meta">
      <span class="meta-group">{{ groupName }}</span>
      <span v-for="tag in memo.tags" :key="tag" class="meta-tag">#{{ tag }}</span>
      <span v-if="memo.keyword" class="meta-kw">{{ t('preview.keywordLabel', { keyword: memo.keyword }) }}</span>
    </div>

    <!-- 编辑态：正文文本域（无框贴近预览观感） -->
    <textarea
      v-if="editing"
      ref="contentRef"
      class="content-edit"
      :value="draft?.content ?? ''"
      :placeholder="t('editor.content')"
      spellcheck="false"
      @input="store.actions.patchPreviewEdit({ content: ($event.target as HTMLTextAreaElement).value })"
    />

    <!-- 预览态 -->
    <div
      v-else
      ref="bodyRef"
      class="preview-body selectable"
      :class="{ masked: memo.sensitive && !revealed, editable: !withImages }"
      @click="onBodyClick"
    >
      <template v-if="memo.sensitive && !revealed">{{ t('preview.sensitiveMasked') }}</template>
      <template v-else-if="isImage">
        <HoverImage v-if="imageUrl && firstSlot" :store="store" :memo-id="memo.id" :image-id="firstSlot" />
        <div class="image-hint">{{ imageDims ? `${imageDims} · ` : '' }}{{ t('preview.imageSizeHint') }}</div>
        <div v-if="stripNote(memo.content)" class="image-note">
          <RichText :store="store" :text="stripNote(memo.content)" :query="store.state.query" />
        </div>
        <div v-if="memo.ocrText" class="ocr-block">
          <div class="ocr-label">{{ t('preview.ocrSection') }}</div>
          <RichText :store="store" :text="memo.ocrText" :query="store.state.query" />
        </div>
        <div v-else-if="store.state.settings.imageOcrEnabled" class="ocr-block">
          <button class="sm-btn small" :disabled="ocrRunning" @click="onOcrClick">
            <Icon name="search" :size="12" />
            {{ ocrRunning ? t('preview.ocrRunning') : t('preview.ocrRun') }}
          </button>
        </div>
        <div v-else class="ocr-hint">{{ t('preview.ocrDisabledHint') }}</div>
      </template>
      <template v-else>
        <RichText :store="store" :text="resolved" :query="store.state.query" image-mode="inline" />
        <div v-if="memo.ocrText" class="ocr-block">
          <div class="ocr-label">{{ t('preview.ocrSection') }}</div>
          <RichText :store="store" :text="memo.ocrText" :query="store.state.query" />
        </div>
      </template>
    </div>

    <footer class="preview-foot">
      <span class="meta-line">{{ editing ? t('preview.autoSaveHint', { mod: modLabel }) : metaLine }}</span>
      <div class="foot-actions">
        <button class="sm-btn small" @click="copyCurrent">
          <Icon name="copy" :size="12" />
          {{ t('hints.shiftEnter') }}
        </button>
        <button class="sm-btn small primary" @click="pasteCurrent">
          <Icon name="bolt" :size="12" />
          {{ t('hints.enter') }}
        </button>
      </div>
    </footer>
  </aside>
</template>

<style scoped>
.preview {
  width: 260px;
  flex: none;
  border-left: 1px solid var(--sm-border);
  background: var(--sm-surface);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 10px 6px;
}

.preview-title {
  flex: 1;
  min-width: 0;
  font-size: var(--sm-font-m);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 可编辑区域 hover 提示可点击进入编辑 */
.preview-title.editable,
.preview-body.editable {
  cursor: text;
}

.preview-actions {
  display: flex;
  flex: none;
}

.preview-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 12px 8px;
  font-size: 11px;
  color: var(--sm-text-3);
  border-bottom: 1px solid var(--sm-border);
  padding-bottom: 8px;
}

.meta-kw {
  color: var(--sm-accent);
}

.preview-body {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px;
  font-size: var(--sm-font-s);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--sm-text);
}

/* 行内编辑态：标题输入框贴近预览标题的观感 */
.title-edit {
  flex: 1;
  min-width: 0;
  padding: 3px 8px;
  font-size: var(--sm-font-m);
  font-weight: 600;
  border: 1px solid var(--sm-accent);
  border-radius: var(--sm-radius-s);
  background: var(--sm-surface);
  color: var(--sm-text);
}

.title-edit:focus {
  outline: none;
}

/* 行内编辑态：正文文本域去边框去背景，视觉上仍在原预览位置书写 */
.content-edit {
  flex: 1;
  min-height: 0;
  margin: 10px 12px 8px;
  padding: 0;
  border: none;
  background: transparent;
  resize: none;
  font-family: inherit;
  font-size: var(--sm-font-s);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--sm-text);
}

.content-edit:focus {
  outline: none;
}

.image-hint {
  font-size: 11px;
  color: var(--sm-text-3);
  margin-top: 6px;
  margin-bottom: 8px;
}

.image-note {
  margin-bottom: 8px;
  color: var(--sm-text);
}

.ocr-block {
  border-top: 1px dashed var(--sm-border);
  padding-top: 8px;
  margin-top: 2px;
}

.ocr-label {
  font-size: 11px;
  color: var(--sm-text-3);
  margin-bottom: 4px;
}

.ocr-hint {
  font-size: 11px;
  color: var(--sm-text-3);
  border-top: 1px dashed var(--sm-border);
  padding-top: 8px;
}

.preview-foot {
  border-top: 1px solid var(--sm-border);
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.meta-line {
  font-size: 11px;
  color: var(--sm-text-3);
}

.foot-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>

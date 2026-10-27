<script setup lang="ts">
/**
 * 右侧预览面板（预览与行内编辑一体）：
 * 预览态 —— 显示选中备忘的完整内容与占位符解析结果、元信息与快捷操作（遮罩/置顶/编辑），
 *           操作行下方为日期行（最后编辑与创建，两端对齐）；
 * 编辑态 —— 点击标题仅标题变输入框，点击正文仅正文变文本域（互不连带，各改各的）；
 *           失焦（点击面板外或面板上的其他元素）与 ⌘/Ctrl+Enter 自动保存并回到预览，
 *           Esc 放弃修改退回预览（主路由在 App）；预览态按 Esc 收起面板；
 *           图片条目与未揭示的敏感条目不进入编辑态，完整编辑（分组/标签/图片）走「编辑备忘」；
 * 头部标题右侧 ► 收起面板；收起后无常驻入口，单击列表条目重新展开（宽度生长动画，见样式尾部）。
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

/** 行内编辑目标：点击标题只变标题输入框，点击正文只变正文文本域。 */
const editField = ref<'title' | 'content'>('content')

const editingTitle = computed(() => editing.value && editField.value === 'title')

const editingContent = computed(() => editing.value && editField.value === 'content')

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

/** 预览态标题文案（占位符解析后的预览效果，与列表一致）：敏感遮罩优先；无标题时回退内容首行文字 / OCR 首行。 */
const titleText = computed(() => {
  const m = memo.value
  if (!m) return ''
  if (m.sensitive && !revealed.value) return '••••••'
  if (!m.title && hasImages(m)) {
    const noteHead = stripImageTokens(m.content)
      .split('\n')
      .find((line) => line.trim())
    if (noteHead?.trim()) return resolveTemplate(noteHead, {}).text.trim()
    return (m.ocrText ?? '').split('\n')[0].trim() || t('imageMemo')
  }
  return resolveTemplate(m.title || stripImageTokens(m.content).split('\n')[0], {}).text || t('preview.untitled')
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

// 切换条目时预览滚动位置复位到顶部（否则读完长文下半段，下一条从中间开始）；
// 内容已整体替换，须瞬时定位——显式 instant 覆盖全局 scroll-behavior: smooth
watch(
  () => memo.value?.id,
  () => {
    const el = bodyRef.value
    if (el) el.scrollTo({ top: 0, behavior: 'instant' })
  }
)

function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * 进入编辑态并聚焦被点击的位置（标题或正文）。
 * 已在编辑中则只切换目标字段（草稿延续，不丢未保存内容）；
 * 敏感条目须先点眼睛揭示（防止遮罩态绕过直接改内容）；含图条目由 beginPreviewEdit 拒绝。
 */
async function beginEdit(field: 'title' | 'content'): Promise<void> {
  const m = memo.value
  if (!m || (m.sensitive && !revealed.value)) return
  if (!editing.value) {
    props.store.actions.beginPreviewEdit()
    if (props.store.state.previewEdit === null) return
  }
  editField.value = field
  await nextTick()
  if (field === 'title') titleRef.value?.focus()
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
        v-if="editingTitle"
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
      <button
        class="sm-icon-btn"
        :title="t('preview.collapse')"
        :aria-label="t('preview.collapse')"
        @click="store.actions.collapsePreviewPane()"
      >
        <Icon name="chevron-right" />
      </button>
    </header>
    <div class="preview-meta">
      <span class="meta-group">{{ groupName }}</span>
      <span v-for="tag in memo.tags" :key="tag" class="meta-tag">#{{ tag }}</span>
      <span v-if="memo.keyword" class="meta-kw">{{ t('preview.keywordLabel', { keyword: memo.keyword }) }}</span>
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
      </div>
    </div>
    <!-- 日期行：最后编辑与创建时间，两端对齐（使用次数不展示） -->
    <div class="preview-dates">
      <span>{{ t('preview.updatedAt') }} {{ formatTime(memo.updatedAt) }}</span>
      <span>{{ t('preview.createdAt') }} {{ formatTime(memo.createdAt) }}</span>
    </div>

    <!-- 编辑正文：文本域（无框贴近预览观感）；点击标题行仅切换标题编辑 -->
    <textarea
      v-if="editingContent"
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
      <span v-if="editing" class="meta-line">{{ t('preview.autoSaveHint', { mod: modLabel }) }}</span>
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
  padding: 10px 10px 4px;
}

/* 标题与编辑输入框共用同一套字号/行高，切换编辑态时文本位置与行高完全一致，不跳变 */
.preview-title {
  flex: 1;
  min-width: 0;
  font-size: var(--sm-font-m);
  font-weight: 600;
  line-height: 20px;
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
  margin-left: auto;
}

.preview-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 0 12px 4px;
  font-size: 11px;
  color: var(--sm-text-3);
}

/* 日期行：最后编辑靠左、创建时间靠右，两端对齐；作为正文区上方的分隔线载体 */
.preview-dates {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 0 12px 8px;
  font-size: 11px;
  color: var(--sm-text-3);
  border-bottom: 1px solid var(--sm-border);
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

/*
 * 行内编辑态：标题输入框与预览标题同尺寸（无内边距无边框，字号/行高一致），
 * 编辑态标识用 outline（不占布局），切换时文本与行高零位移、不跳变。
 */
.title-edit {
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: var(--sm-radius-s);
  background: transparent;
  font-family: inherit;
  font-size: var(--sm-font-m);
  font-weight: 600;
  line-height: 20px;
  color: var(--sm-text);
}

.title-edit:focus {
  outline: 1px solid var(--sm-accent);
  outline-offset: 2px;
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

/*
 * 展开 / 收起动画（pane 预设）：宽度 0 ↔ 260px 平滑生长，列表随之让位 / 收回，不再跳变；
 * 内容行固定面板全宽，动画中文字不回流（正文 textarea 仅编辑态存在，不参与入场动画）。
 * 本组规则需压过上方 .preview 的固定宽度：同特异性（类 + scoped 属性）、靠后声明生效。
 */
.pane-enter-from,
.pane-leave-to {
  width: 0;
}

.preview-head,
.preview-meta,
.preview-dates,
.preview-body,
.preview-foot {
  width: 260px;
}
</style>

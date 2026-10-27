<script setup lang="ts">
/**
 * 备忘条目（卡片式）：标题（或首行文字/OCR 首行）+ 摘要 + 分组/标签/置顶标识；
 * 标题与摘要按占位符引擎解析后展示（与预览面板一致，看到的是粘贴效果而非 {time} 原文）；
 * 折叠态左侧展示首图缩略图（摘要文字不含图片徽标——图片一律看缩略图，纯图条目无备注时放大），
 * 摘要两行截断，完整模式（listMode='full'）或条目展开后平铺全部内容——
 * 混排条目的行内图片与纯图条目展开区大图（HoverImage）均按原图尺寸展示（最大不超过列宽，单击全屏查看）；
 * 悬浮缩略图约 0.3s 弹出快览浮层（复制/全屏/系统打开）；单击折叠条目展开、已选中的展开条目收起
 * （点击未选中的展开条目仅选中），面板收起时随点击拉出、条目点击不会收起面板；
 * 敏感条目内容与图片模糊显示；图片尺寸/体积徽标显示在元信息行；
 * 行内代码片点击复制；前 9 条显示 Alt+数字 序号；
 * 条目操作（复制/编辑/删除等）走右键菜单；多选模式下左侧出现复选框，点击条目即切换选中。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { AppStore } from '../store/appStore'
import type { Memo } from '../core/types'
import { formatImageBytes } from '../core/image'
import { firstImageSlot, hasImages, stripImageTokens } from '../core/inlineImage'
import { resolveTemplate } from '../core/placeholders'
import { highlightRanges } from '../core/search'
import RichText from './RichText.vue'
import HoverImage from './HoverImage.vue'
import Icon from './Icon.vue'
import { t } from '../i18n/zh-CN'

const props = defineProps<{
  store: AppStore
  memo: Memo
  index: number
  selected: boolean
  query: string
  dragEnabled: boolean
}>()

const emit = defineEmits<{ (e: 'dragstart', ev: PointerEvent): void }>()

/** 展开正文的最大字符数：防止超长条目（上限 256KB）在列表里一次渲染拖垮滚动。 */
const EXPAND_MAX_CHARS = 2000

/** 悬浮快览：悬停多少毫秒后弹出（避免扫过时闪现）。 */
const PEEK_OPEN_DELAY = 300
/** 悬浮快览：离开后多少毫秒关闭（给移进浮层点按钮留时间）。 */
const PEEK_CLOSE_DELAY = 180

const batchMode = computed(() => props.store.state.batchMode)
const batchChecked = computed(() => props.store.state.batchSelection.has(props.memo.id))

const revealed = computed(() => props.store.state.revealSensitive.has(props.memo.id))

const masked = computed(() => props.memo.sensitive && !revealed.value)

/** 纯图条目（正文除图片外无文字）：折叠行/展开区用大图布局。 */
const isImage = computed(() => props.memo.kind === 'image')

/** 条目首图（列表缩略图/尺寸徽标用）；混排条目同样有首图。 */
const firstSlot = computed(() => firstImageSlot(props.memo))
const firstMeta = computed(() => props.memo.images?.find((img) => img.id === firstSlot.value))

/** 条目是否处于展开态：完整模式下默认展开，自身开关在此基础上取反。 */
const expanded = computed(() => {
  const fullMode = props.store.state.settings.listMode === 'full'
  const toggled = props.store.state.expandedItems.has(props.memo.id)
  return fullMode !== toggled
})

/** 是否存在值得展开的内容：图片、多行正文或较长单行（展开后按宽度换行可看全）。 */
const hasMore = computed(() => {
  if (firstSlot.value) return true
  const content = props.memo.content
  if (!content) return false
  const firstLine = content.split('\n')[0]
  if (content.length > firstLine.length && content.slice(firstLine.length).trim()) return true
  return content.length > 90
})

/** 条目标题（解析占位符后的预览效果）：无标题时回退内容首行文字 / OCR 首行。 */
const displayTitle = computed(() => {
  if (props.memo.title) return resolveTemplate(props.memo.title, {}).text
  if (hasImages(props.memo)) {
    const noteHead = stripImageTokens(props.memo.content)
      .split('\n')
      .find((line) => line.trim())
    if (noteHead?.trim()) return resolveTemplate(noteHead, {}).text.trim()
    const ocrHead = (props.memo.ocrText ?? '').split('\n')[0].trim()
    return ocrHead || t('imageMemo')
  }
  return resolveTemplate(props.memo.content.split('\n')[0], {}).text || t('item.emptyContent')
})

/**
 * 摘要行文本（解析占位符后的预览效果；不含图片标记——图片由左侧缩略图承担，
 * 摘要里不再渲染徽标，避免同一张图出现两次）。
 */
const previewText = computed(() => {
  if (masked.value) return t('item.sensitiveMask')
  if (isImage.value) {
    // 纯图条目：备注文字优先，其次 OCR 文本
    const note = stripImageTokens(props.memo.content).replace(/\n+/g, ' ').trim()
    if (note) return resolveTemplate(note, {}).text
    return (props.memo.ocrText ?? '').replace(/\n+/g, ' ')
  }
  const content = props.memo.content
  const flat = props.memo.title ? content.replace(/\n+/g, ' ') : content.split('\n').slice(1).join(' ')
  // 图片标记在解析后剥离（解析器对其原样保留），摘要只留文字
  return clampText(stripImageTokens(resolveTemplate(flat || '', {}).text), 160)
})

/** 纯文本截断（摘要行已无图片标记，无需标记保护）。 */
function clampText(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text
}

/** 纯图片条目（无备注无 OCR）：折叠态缩略图放大显示，图片本身就是内容。 */
const imageOnly = computed(() => isImage.value && !previewText.value)

/**
 * 展开区正文：完整模式下展示全部内容（超长截断并标记省略，截断不拆图片标记），
 * 再按占位符解析为预览效果；无标题条目的首行已作为标题展示，正文跳过首行避免重复。
 */
const expandedText = computed(() => {
  let content = props.memo.content
  if (!props.memo.title) content = content.split('\n').slice(1).join('\n')
  if (!content) return ''
  const clipped =
    content.length > EXPAND_MAX_CHARS
      ? content.slice(0, EXPAND_MAX_CHARS).replace(/\{img:[A-Za-z0-9_-]*$/, '') + ' …'
      : content
  return resolveTemplate(clipped, {}).text
})

// ---- 缩略图（store 缩略图管线；生成中渲染占位块，缺失渲染丢失占位） ----

const thumbEntry = computed(() => (firstSlot.value ? props.store.state.imageThumbs[firstSlot.value] : undefined))
const thumbSrc = computed(() => (thumbEntry.value?.status === 'ready' ? thumbEntry.value.small : ''))
const thumbPending = computed(() => thumbEntry.value?.status === 'pending')
const thumbFailed = computed(() => thumbEntry.value?.status === 'failed')

/** 缩略图淡入：解码完成才显示（缓存命中时 load 事件同样会触发）。 */
const thumbLoaded = ref(false)

watch(
  () => props.memo.id,
  () => {
    thumbLoaded.value = false
    closePeek()
  }
)

/** 占位块宽度：已知宽高比时按显示高度等比估算，未知时给默认小方框。 */
const skeletonWidth = computed(() => {
  const w = firstMeta.value?.width ?? thumbEntry.value?.width ?? 0
  const h = firstMeta.value?.height ?? thumbEntry.value?.height ?? 0
  const height = imageOnly.value ? 64 : 44
  if (w > 0 && h > 0) return Math.max(24, Math.min(imageOnly.value ? 140 : 96, Math.round((height * w) / h)))
  return 44
})

/** 元信息行的尺寸/体积徽标：多图时前缀张数；旧数据在缩略图生成后由 store 回填。 */
const imageMetaText = computed(() => {
  if (!firstSlot.value) return ''
  const count = props.memo.images?.length ?? 1
  const w = firstMeta.value?.width ?? thumbEntry.value?.width ?? 0
  const h = firstMeta.value?.height ?? thumbEntry.value?.height ?? 0
  const size = formatImageBytes(firstMeta.value?.bytes ?? 0)
  const dims = w && h ? `${w}×${h}` : ''
  const parts = [count > 1 ? t('item.imageCount', { count }) : '', dims, size].filter(Boolean)
  return parts.join(' · ')
})

// ---- 悬浮快览：悬停缩略图弹大图浮层（复制/全屏/系统打开），不动条目状态 ----

const thumbEl = ref<HTMLImageElement | null>(null)
const peekVisible = ref(false)
const peekPos = ref({ x: 0, y: 0 })
let peekOpenTimer: ReturnType<typeof setTimeout> | null = null
let peekCloseTimer: ReturnType<typeof setTimeout> | null = null

/** 快览图源：优先大图（按需生成），未就绪时回退小图。 */
const peekSrc = computed(() => thumbEntry.value?.large || thumbSrc.value)

function clearPeekTimers(): void {
  if (peekOpenTimer !== null) {
    clearTimeout(peekOpenTimer)
    peekOpenTimer = null
  }
  if (peekCloseTimer !== null) {
    clearTimeout(peekCloseTimer)
    peekCloseTimer = null
  }
}

/** 悬停进入缩略图：延迟开快览（敏感遮罩不弹）。 */
function onThumbEnter(): void {
  if (peekCloseTimer !== null) {
    clearTimeout(peekCloseTimer)
    peekCloseTimer = null
  }
  if (masked.value || !thumbSrc.value || peekVisible.value) return
  peekOpenTimer = setTimeout(openPeek, PEEK_OPEN_DELAY)
}

function onThumbLeave(): void {
  if (peekOpenTimer !== null) {
    clearTimeout(peekOpenTimer)
    peekOpenTimer = null
  }
  if (peekVisible.value) peekCloseTimer = setTimeout(closePeek, PEEK_CLOSE_DELAY)
}

/** 打开快览：定位在缩略图右侧（空间不足放左侧），垂直方向夹在视口内。 */
function openPeek(): void {
  const rect = thumbEl.value?.getBoundingClientRect()
  const W = 260
  const H = 280
  let x = rect ? rect.right + 10 : 8
  if (x + W > window.innerWidth - 8) x = rect ? rect.left - W - 10 : 8
  if (x < 8) x = 8
  const y = Math.max(8, Math.min(rect ? rect.top - 16 : 8, window.innerHeight - H - 8))
  peekPos.value = { x, y }
  peekVisible.value = true
  if (firstSlot.value) props.store.actions.ensureThumbLarge(firstSlot.value)
}

function closePeek(): void {
  clearPeekTimers()
  peekVisible.value = false
}

/** 点击快览图：展开条目查看大图（与点缩略图同语义）。 */
function onPeekImageClick(): void {
  closePeek()
  props.store.actions.toggleExpanded(props.memo.id)
}

/** 快览浮层内的复制：图片条目复制图片本体。 */
async function copyFromPeek(): Promise<void> {
  await props.store.actions.copyMemo(props.memo)
}

/** 首图独立悬浮窗查看（宿主 createBrowserWindow 置顶小窗）；缩略图操作条与快览浮层共用。 */
function openFloat(): void {
  if (firstSlot.value) void props.store.actions.openImageFloat(firstSlot.value)
}

/** 首图用系统默认看图软件打开；缩略图操作条与快览浮层共用。 */
function openSystem(): void {
  if (firstSlot.value) void props.store.actions.openMemoImageExternal(firstSlot.value)
}

// 列表滚动时缩略图会移位，快览浮层固定定位会脱节：捕获期监听任意滚动立即关闭
function onAnyScroll(): void {
  if (peekVisible.value) closePeek()
}

watch(peekVisible, (visible) => {
  if (visible) window.addEventListener('scroll', onAnyScroll, { capture: true, passive: true })
  else window.removeEventListener('scroll', onAnyScroll, true)
})

onBeforeUnmount(() => {
  clearPeekTimers()
  window.removeEventListener('scroll', onAnyScroll, true)
})

const groupName = computed(() => {
  const gid = props.memo.groupId
  if (!gid) return ''
  return props.store.computed.groupNameMap.value.get(gid)?.name ?? ''
})

const groupColorValue = computed(() => {
  const gid = props.memo.groupId
  return gid ? (props.store.computed.groupNameMap.value.get(gid)?.color ?? '') : ''
})

const titlePieces = computed(() => splitByHighlight(displayTitle.value.slice(0, 120)))

/** 按命中区间把文本拆为普通/命中片段，供模板渲染 <span class="hl">。 */
function splitByHighlight(text: string): Piece[] {
  const ranges = highlightRanges(text, props.query)
  if (ranges.length === 0) return [{ text, hit: false }]
  const pieces: Piece[] = []
  let cursor = 0
  for (const [start, end] of ranges) {
    if (start > cursor) pieces.push({ text: text.slice(cursor, start), hit: false })
    pieces.push({ text: text.slice(start, end), hit: true })
    cursor = end
  }
  if (cursor < text.length) pieces.push({ text: text.slice(cursor), hit: false })
  return pieces
}

interface Piece {
  text: string
  hit: boolean
}

/** 右键打开条目操作菜单（复制/编辑/置顶/删除等），并选中该条目。 */
function onContextMenu(e: MouseEvent): void {
  e.preventDefault()
  props.store.actions.openContextMenu(e.clientX, e.clientY, props.memo.id)
}

/** 点击展开按钮：条目内平铺/收起完整内容，不必打开右侧详情。 */
function onExpandClick(e: MouseEvent): void {
  e.stopPropagation()
  closePeek()
  props.store.actions.toggleExpanded(props.memo.id)
}

/** 点击缩略图：展开条目查看大图（复制走右键菜单或悬浮快览）。 */
function onThumbClick(): void {
  closePeek()
  props.store.actions.toggleExpanded(props.memo.id)
}

// ---- 展开/收起的高度过渡（fold 预设）：CSS 过渡不了 auto 高度，起止值在钩子里量取后内联写入 ----

/** 进入动画起点：高度置 0（.fold-enter-active 的高度过渡从这里长出）。 */
function onFoldBeforeEnter(el: Element): void {
  ;(el as HTMLElement).style.height = '0'
}

/** 进入动画终点：量取目标高度写入；先强制回流提交 height:0 起始态，否则过渡不触发。 */
function onFoldEnter(el: Element): void {
  const node = el as HTMLElement
  void node.offsetHeight
  node.style.height = `${node.scrollHeight}px`
}

/** 进入结束：清掉内联高度还原 auto（此后内容高度变化——如图片加载——不受动画约束）。 */
function onFoldAfterEnter(el: Element): void {
  ;(el as HTMLElement).style.height = ''
}

/** 离开动画起点：把 auto 高度钉成固定值（同值写入，无视觉跳变），过渡才有可动画的起点。 */
function onFoldBeforeLeave(el: Element): void {
  ;(el as HTMLElement).style.height = `${(el as HTMLElement).offsetHeight}px`
}

/** 离开动画终点：高度收合到 0。 */
function onFoldLeave(el: Element): void {
  const node = el as HTMLElement
  void node.offsetHeight
  node.style.height = '0'
}

/** 离开结束：清理内联高度（元素即将移除，兜底防残留）。 */
function onFoldAfterLeave(el: Element): void {
  ;(el as HTMLElement).style.height = ''
}

/** 点击条目：多选模式下切换选中；普通模式选中条目，展开动作按点击前状态决定——
 * 折叠项（无论此前是否选中）点击即展开；已选中的展开项点击收起；
 * 未选中的展开项点击仅选中、保持展开（浏览时不会把别的展开条目点收起）。
 * 预览面板收起时随点击拉出（条目点击只会展示面板，收起只走 Space / ⌘/Ctrl+P / 面板头部按钮 / Esc；
 * 设置停用面板时 expandPreviewPane 在 store 内为无操作）。 */
function onClick(e: MouseEvent): void {
  const wasSelected = props.store.state.selectionId === props.memo.id
  const wasExpanded = expanded.value
  props.store.actions.selectMemo(props.memo.id)
  if (batchMode.value) {
    props.store.actions.toggleBatchSelection(props.memo.id, e.shiftKey)
    return
  }
  if (props.store.state.previewMode === 'hidden') props.store.actions.expandPreviewPane()
  if (wasSelected || !wasExpanded) props.store.actions.toggleExpanded(props.memo.id)
}

function onBatchToggle(e: MouseEvent): void {
  e.stopPropagation()
  props.store.actions.selectMemo(props.memo.id)
  props.store.actions.toggleBatchSelection(props.memo.id, e.shiftKey)
}
</script>

<template>
  <div
    class="memo-item"
    :class="{ selected, open: expanded, sensitive: masked, checked: batchMode && batchChecked }"
    role="option"
    :aria-selected="selected"
    :data-index="index"
    @click="onClick"
    @contextmenu="onContextMenu"
  >
    <button
      v-if="batchMode"
      class="batch-check"
      :class="{ checked: batchChecked }"
      role="checkbox"
      :aria-checked="batchChecked"
      :aria-label="t('a11y.batchCheckbox')"
      tabindex="-1"
      @click.stop="onBatchToggle"
    >
      <Icon v-if="batchChecked" name="check" :size="10" />
    </button>
    <span v-if="dragEnabled && !batchMode" class="grip" :title="t('item.dragHandle')" @pointerdown="(e) => emit('dragstart', e)">
      <Icon name="grip" :size="13" />
    </span>
    <div class="body">
      <div class="line-main">
        <span v-if="index < 9 && !batchMode" class="num-badge">{{ index + 1 }}</span>
        <Icon v-if="memo.pinned" name="pin" :size="12" class="pin-mark" />
        <span class="title selectable">
          <template v-if="masked">••••••</template>
          <template v-else>
            <span v-for="(p, i) in titlePieces" :key="i" :class="{ hl: p.hit }">{{ p.text }}</span>
          </template>
        </span>
        <span v-if="memo.keyword" class="kw-badge" :title="t('item.keywordChip', { keyword: memo.keyword })">{{ memo.keyword }}</span>
        <button
          v-if="hasMore"
          class="exp-btn"
          :title="expanded ? t('item.collapse') : t('item.expand')"
          @click.stop="onExpandClick"
        >
          <Icon name="chevron" :size="14" class="exp-icon" :class="{ rot: expanded }" />
        </button>
      </div>
      <!--
        折叠摘要行 ↔ 展开区：fold 高度过渡（CSS 过渡不了 auto 高度，起止值由 JS 钩子量取内联写入）。
        两分支同缓动同时长同时动画，行内总高度恰为旧值到新值的连续插值；展开区不渲染时仅单侧动画。
      -->
      <Transition
        name="fold"
        @before-enter="onFoldBeforeEnter"
        @enter="onFoldEnter"
        @after-enter="onFoldAfterEnter"
        @before-leave="onFoldBeforeLeave"
        @leave="onFoldLeave"
        @after-leave="onFoldAfterLeave"
      >
        <!-- 折叠态：左侧首图缩略图（纯图无备注时放大），右侧纯文字摘要（无图片徽标） -->
        <div v-if="!expanded && (previewText || firstSlot)" key="preview" class="line-preview selectable">
          <template v-if="firstSlot">
            <div v-if="thumbSrc" class="thumb-wrap" @mouseenter="onThumbEnter" @mouseleave="onThumbLeave">
              <img
                ref="thumbEl"
                class="thumb"
                :class="{ solo: imageOnly, masked, loaded: thumbLoaded }"
                :src="thumbSrc"
                :title="t('item.expand')"
                alt=""
                draggable="false"
                @load="thumbLoaded = true"
                @click.stop="onThumbClick"
              />
              <!-- 悬浮操作条：独立悬浮窗查看 / 系统看图软件打开；敏感遮罩下不提供 -->
              <div v-if="!masked" class="thumb-bar" @click.stop>
                <button class="thumb-btn" :title="t('image.floatWindow')" :aria-label="t('image.floatWindow')" @click.stop="openFloat">
                  <Icon name="pip" :size="14" />
                </button>
                <button class="thumb-btn" :title="t('image.openSystem')" :aria-label="t('image.openSystem')" @click.stop="openSystem">
                  <Icon name="external" :size="14" />
                </button>
              </div>
            </div>
            <div
              v-else-if="thumbPending"
              class="thumb-skeleton"
              :class="{ solo: imageOnly }"
              :style="{ width: `${skeletonWidth}px` }"
            />
            <span v-else-if="thumbFailed" class="thumb-missing">{{ t('item.imageMissing') }}</span>
          </template>
          <div v-if="previewText" class="preview-clamp">
            <RichText :store="store" :text="previewText" :query="query" />
          </div>
        </div>
        <!-- 展开态：平铺全部内容/大图 -->
        <div v-else-if="expanded && !masked && (isImage || expandedText)" key="expanded" class="expand-area selectable">
          <template v-if="isImage">
            <HoverImage
              v-if="thumbSrc && firstSlot"
              :store="store"
              :memo-id="memo.id"
              :image-id="firstSlot"
              click-action="fullscreen"
            />
            <div v-if="memo.ocrText" class="expand-ocr">
              <RichText :store="store" :text="memo.ocrText" :query="query" />
            </div>
          </template>
          <RichText v-if="expandedText" :store="store" :text="expandedText" :query="query" image-mode="inline" />
        </div>
      </Transition>
      <div class="line-meta">
        <span v-if="groupName" class="meta-group">
          <span class="dot" :style="{ background: groupColorValue || 'var(--sm-text-3)' }" />
          {{ groupName }}
        </span>
        <span v-for="tag in memo.tags" :key="tag" class="meta-tag">#{{ tag }}</span>
        <span v-if="imageMetaText" class="meta-dims">{{ imageMetaText }}</span>
        <span v-if="memo.useCount > 0" class="meta-use">{{ memo.useCount }} 次</span>
      </div>
    </div>
    <!-- 悬浮快览浮层：固定定位跟随缩略图位置，含复制/全屏/系统打开快捷操作；缩放淡入淡出 -->
    <Transition name="scale">
      <div
        v-if="peekVisible"
        class="thumb-peek"
        :style="{ left: `${peekPos.x}px`, top: `${peekPos.y}px` }"
        @mouseenter="onThumbEnter"
        @mouseleave="onThumbLeave"
      >
        <img class="peek-img" :src="peekSrc" :title="t('image.peekExpand')" alt="" draggable="false" @click.stop="onPeekImageClick" />
        <div class="peek-bar" @click.stop>
          <button class="peek-btn" :title="t('image.floatWindow')" :aria-label="t('image.floatWindow')" @click.stop="openFloat">
            <Icon name="pip" :size="13" />
          </button>
          <button class="peek-btn" :title="t('a11y.copyImage')" :aria-label="t('a11y.copyImage')" @click.stop="copyFromPeek">
            <Icon name="copy" :size="13" />
          </button>
          <button
            class="peek-btn"
            :title="t('image.fullscreen')"
            :aria-label="t('image.fullscreen')"
            @click.stop="store.actions.openLightboxForMemo(memo.id)"
          >
            <Icon name="maximize" :size="13" />
          </button>
          <button class="peek-btn" :title="t('image.openSystem')" :aria-label="t('image.openSystem')" @click.stop="openSystem">
            <Icon name="external" :size="13" />
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.memo-item {
  display: flex;
  align-items: center;
  gap: 8px;
  /* 左侧 28px 为序号徽标让位、右侧 30px 为展开按钮让位（二者锚定标题行，见 .num-badge / .exp-btn） */
  padding: 9px 30px 9px 28px;
  border-radius: var(--sm-radius-m);
  cursor: default;
  position: relative;
  background: var(--sm-surface);
  border: 1px solid var(--sm-border);
  box-shadow: var(--sm-shadow-1);
  transition: background var(--sm-dur-fast) var(--sm-ease-out), border-color var(--sm-dur-fast) var(--sm-ease-out);
}

.memo-item:hover {
  border-color: var(--sm-border-strong);
}

.memo-item.selected {
  background: var(--sm-selected);
  border-color: var(--sm-accent);
}

.memo-item.checked {
  border-color: var(--sm-accent);
  background: color-mix(in srgb, var(--sm-accent) 10%, var(--sm-surface));
}

/* 展开态条目内容偏多，徽标与操作按钮改为顶部对齐 */
.memo-item.open {
  align-items: flex-start;
}

.grip {
  cursor: grab;
  color: var(--sm-text-3);
  display: inline-flex;
  padding: 4px 2px;
  flex: none;
  touch-action: none;
}

/* 多选复选框 */
.batch-check {
  flex: none;
  width: 16px;
  height: 16px;
  margin-left: -6px;
  border: 1.5px solid var(--sm-border-strong);
  border-radius: 4px;
  background: var(--sm-surface);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  padding: 0;
}

.batch-check.checked {
  background: var(--sm-accent);
  border-color: var(--sm-accent);
}

/* 序号徽标锚定标题行、与其垂直居中；负 left 把徽标推回卡片左上角预留区（左内边距 28px） */
.num-badge {
  position: absolute;
  top: 50%;
  left: -22px;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background: var(--sm-surface-2);
  color: var(--sm-text-3);
  font-size: 10px;
  line-height: 16px;
  text-align: center;
}

.body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.line-main {
  position: relative; /* 序号徽标与展开按钮的定位锚点 */
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.pin-mark {
  color: var(--sm-accent);
  flex: none;
}

.title {
  font-size: var(--sm-font-m);
  font-weight: 550;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

[data-density='compact'] .line-preview {
  display: none;
}

.kw-badge {
  flex: none;
  font-size: 10px;
  padding: 0 5px;
  border: 1px dashed var(--sm-border-strong);
  border-radius: 4px;
  color: var(--sm-text-3);
  line-height: 16px;
}

.line-preview {
  color: var(--sm-text-2);
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 简洁模式摘要：两行截断（紧凑密度隐藏整行） */
.preview-clamp {
  flex: 1;
  min-width: 0;
  font-size: var(--sm-font-s);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-word;
}

/*
 * 缩略图：顶部裁切（截图标题栏通常在顶部）、解码完成后淡入；
 * 纯图条目（solo）放大显示，敏感条目模糊而非隐藏（保留“有图”的感知）。
 */
.thumb {
  flex: none;
  height: 44px;
  max-width: 96px;
  object-fit: cover;
  object-position: top;
  border-radius: 5px;
  border: 1px solid var(--sm-border);
  cursor: zoom-in;
  display: block;
  opacity: 0;
  transition: opacity var(--sm-dur-base) var(--sm-ease-out);
}

.thumb.loaded {
  opacity: 1;
}

.thumb.solo {
  height: 64px;
  max-width: 140px;
}

.thumb.masked {
  filter: blur(9px) saturate(0.7);
}

/* 折叠缩略图悬浮操作条：右下角两枚按钮（独立悬浮窗 / 系统打开），
   深色半透明保证任意底图可读；触屏（pointer: coarse）无 hover，常显保证可达 */
.thumb-wrap {
  position: relative;
  flex: none;
}

.thumb-bar {
  position: absolute;
  right: 3px;
  bottom: 3px;
  display: flex;
  gap: 3px;
  opacity: 0;
  transition: opacity var(--sm-dur-fast) var(--sm-ease-out);
}

.thumb-wrap:hover .thumb-bar,
.thumb-bar:focus-within {
  opacity: 1;
}

@media (pointer: coarse) {
  .thumb-bar {
    opacity: 1;
  }
}

.thumb-btn {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 5px;
  background: rgba(15, 19, 28, 0.86);
  color: #fff;
  cursor: pointer;
  transition: background var(--sm-dur-fast) var(--sm-ease-out);
}

.thumb-btn:hover {
  background: rgba(15, 19, 28, 0.97);
}

/* 生成中的占位块：与缩略图同尺寸，呼吸动画（sm-pulse）提示加载中 */
.thumb-skeleton {
  flex: none;
  height: 44px;
  border-radius: 5px;
  border: 1px solid var(--sm-border);
  background: var(--sm-surface-2);
  animation: sm-pulse var(--sm-dur-pulse) var(--sm-ease-in-out) infinite;
}

.thumb-skeleton.solo {
  height: 64px;
}

/* 附件缺失：虚线占位 chip，明确告知而不是无声消失 */
.thumb-missing {
  flex: none;
  font-size: 11px;
  line-height: 1;
  padding: 6px 8px;
  border: 1px dashed var(--sm-border-strong);
  border-radius: 5px;
  color: var(--sm-text-3);
}

/* 悬浮快览浮层：固定定位（不随卡片裁切），窄宽卡片式 */
.thumb-peek {
  position: fixed;
  z-index: 200; /* 高于列表与预览面板，低于全屏浮层(220) */
  width: 260px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--sm-surface);
  border: 1px solid var(--sm-border-strong);
  border-radius: var(--sm-radius-m);
  box-shadow: var(--sm-shadow-2);
}

.peek-img {
  width: 100%;
  max-height: 210px;
  object-fit: contain;
  border-radius: var(--sm-radius-s);
  cursor: zoom-in;
  display: block;
}

.peek-bar {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.peek-btn {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--sm-border);
  border-radius: var(--sm-radius-s);
  background: var(--sm-surface);
  color: var(--sm-text-2);
  cursor: pointer;
  transition: background var(--sm-dur-fast) var(--sm-ease-out), color var(--sm-dur-fast) var(--sm-ease-out);
}

.peek-btn:hover {
  background: var(--sm-hover);
  color: var(--sm-text);
}

/* 展开区：平铺全部内容/大图 */
.expand-area {
  color: var(--sm-text);
  font-size: var(--sm-font-s);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 展开区图片按原图尺寸展示：仅受列宽约束（HoverImage / 行内图自带 max-width:100% 兜底），
   此处放开预览面板共用的限高小图策略（预览面板仍限高 + 撑满互切） */
.expand-area :deep(.himg-img),
.expand-area :deep(.inline-img) {
  max-height: none;
}

.expand-ocr {
  padding-top: 6px;
  border-top: 1px dashed var(--sm-border);
  color: var(--sm-text-2);
}

.line-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--sm-text-3);
  white-space: nowrap;
  overflow: hidden;
}

.meta-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

/* 图片尺寸/体积徽标 */
.meta-dims {
  color: var(--sm-text-3);
  font-variant-numeric: tabular-nums;
}

.meta-use {
  margin-left: auto;
}

/* 展开按钮：锚定标题行、与其垂直居中；负 right 把按钮推回卡片右上角预留区（右内边距 30px） */
.exp-btn {
  position: absolute;
  top: 50%;
  right: -24px;
  transform: translateY(-50%);
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--sm-radius-s);
  background: transparent;
  color: var(--sm-text-3);
  cursor: pointer;
  transition: background var(--sm-dur-fast) var(--sm-ease-out), color var(--sm-dur-fast) var(--sm-ease-out);
}

.exp-btn:hover {
  background: var(--sm-hover);
  color: var(--sm-text);
}

.exp-icon {
  transition: transform var(--sm-dur-fast) var(--sm-ease-out);
}

.exp-icon.rot {
  transform: rotate(180deg);
}
</style>

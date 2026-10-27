<script setup lang="ts">
/**
 * 富文本片段渲染：把正文拆为普通文字、行内代码片（`code`）与行内图片标记（{img:}），
 * 普通文字应用搜索命中高亮；代码片渲染为 chip，鼠标点击即复制其内容；
 * 行内图片两种模式——chip：小徽标（摘要行用，点击复制图片）；inline：全尺寸行内图
 * （展开区/预览用，单击全屏查看；列表展开区经父级样式放开限高，仅受列宽约束）。
 * 父容器负责 white-space 与换行。
 */
import { computed } from 'vue'
import { platform } from '../platform'
import type { AppStore } from '../store/appStore'
import { parseCodeSpans } from '../core/codespan'
import { splitByImageTokens } from '../core/inlineImage'
import { highlightRanges } from '../core/search'
import Icon from './Icon.vue'
import { t } from '../i18n/zh-CN'

const props = defineProps<{
  store: AppStore
  text: string
  query: string
  /** 行内图片渲染模式：chip 摘要徽标（默认）/ inline 限高缩略图。 */
  imageMode?: 'chip' | 'inline'
}>()

interface Piece {
  text: string
  hit: boolean
}

type Node = { kind: 'text'; text: string; code: boolean } | { kind: 'image'; id: string }

/** 正文 → 文字/代码/图片节点序列（先按图片标记切分，文字段内再解析代码片）。 */
const nodes = computed<Node[]>(() => {
  const out: Node[] = []
  for (const seg of splitByImageTokens(props.text)) {
    if (seg.type === 'image') {
      out.push({ kind: 'image', id: seg.id })
      continue
    }
    for (const cs of parseCodeSpans(seg.text)) out.push({ kind: 'text', text: cs.text, code: cs.code })
  }
  return out
})

/** 代码片内的命中也参与高亮（复制时仍是代码原文，不含高亮影响）。 */
function highlightPieces(text: string): Piece[] {
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

/** 行内图片源：全尺寸展示 URL（Blob URL，store 内 LRU 缓存）；附件缺失返回空串，渲染丢失占位。 */
function inlineSrc(id: string): string {
  return props.store.actions.memoImageDisplay(id)
}

/** 点击代码片：复制代码内容（不含反引号）并提示。 */
async function onCodeClick(code: string): Promise<void> {
  const ok = await platform.copyText(code)
  props.store.actions.toast(ok ? t('toasts.copiedCode') : t('toasts.pasteFailed'), {
    kind: ok ? 'success' : 'error',
    duration: 1400
  })
}

/** 点击行内图片：复制图片本体（摘要徽标模式；混排条目回车只贴文字，图片按张取用）。 */
async function copyImage(id: string): Promise<void> {
  const dataUrl = props.store.actions.memoImage(id)
  if (!dataUrl) {
    props.store.actions.toast(t('toasts.imageMissing'), { kind: 'error' })
    return
  }
  const ok = await platform.copyImage(dataUrl)
  props.store.actions.toast(ok ? t('toasts.imageCopied') : t('toasts.pasteFailed'), {
    kind: ok ? 'success' : 'error',
    duration: 1400
  })
}

/** 点击行内图片：进入全屏查看（←/→ 在全部图片间翻页）。 */
function openLightbox(id: string): void {
  const memo = props.store.state.memos.find((m) => m.images?.some((img) => img.id === id))
  if (memo) props.store.actions.openLightboxForMemo(memo.id, id)
}
</script>

<template>
  <span class="rich-text">
    <template v-for="(node, i) in nodes" :key="i">
      <code
        v-if="node.kind === 'text' && node.code"
        class="code-chip"
        :title="t('richText.copyCode')"
        role="button"
        tabindex="0"
        @click.stop="onCodeClick(node.text)"
        @keydown.enter.prevent="onCodeClick(node.text)"
        @keydown.space.prevent="onCodeClick(node.text)"
      >
        <span v-for="(p, j) in highlightPieces(node.text)" :key="j" :class="{ hl: p.hit }">{{ p.text }}</span>
      </code>
      <template v-else-if="node.kind === 'text'">
        <span v-for="(p, j) in highlightPieces(node.text)" :key="`${i}-${j}`" :class="{ hl: p.hit }">{{ p.text }}</span>
      </template>
      <!-- 摘要模式：图片徽标（点击复制图片本体） -->
      <button
        v-else-if="imageMode !== 'inline'"
        class="img-chip"
        :title="t('richText.copyImage')"
        role="button"
        tabindex="0"
        @click.stop="copyImage(node.id)"
        @keydown.enter.prevent="copyImage(node.id)"
      >
        <Icon name="image" :size="11" />
      </button>
      <!-- 展开模式：全尺寸行内图（单击全屏查看），悬浮右下角出现悬浮窗/系统打开按钮 -->
      <template v-else>
        <span v-if="inlineSrc(node.id)" class="inline-wrap">
          <img
            class="inline-img"
            :src="inlineSrc(node.id)"
            :title="t('image.fullscreen')"
            alt=""
            draggable="false"
            @click.stop="openLightbox(node.id)"
          />
          <span class="inline-bar" @click.stop>
            <button
              class="inline-btn"
              :title="t('image.floatWindow')"
              :aria-label="t('image.floatWindow')"
              @click.stop="store.actions.openImageFloat(node.id)"
            >
              <Icon name="pip" :size="13" />
            </button>
            <button
              class="inline-btn"
              :title="t('image.openSystem')"
              :aria-label="t('image.openSystem')"
              @click.stop="store.actions.openMemoImageExternal(node.id)"
            >
              <Icon name="external" :size="13" />
            </button>
          </span>
        </span>
        <span v-else class="inline-img-missing">{{ t('item.imageMissing') }}</span>
      </template>
    </template>
  </span>
</template>

<style scoped>
.rich-text {
  white-space: inherit;
}

.code-chip {
  display: inline;
  font-family: var(--sm-font-mono);
  font-size: 0.92em;
  padding: 1px 6px;
  margin: 0 1px;
  border-radius: 5px;
  background: var(--sm-surface-2);
  border: 1px solid var(--sm-border);
  color: var(--sm-text);
  cursor: copy;
  transition: border-color var(--sm-dur-fast) var(--sm-ease-out), background var(--sm-dur-fast) var(--sm-ease-out);
  word-break: break-all;
}

.code-chip:hover,
.code-chip:focus-visible {
  border-color: var(--sm-accent);
  background: var(--sm-hover);
  outline: none;
}

.code-chip:active {
  transform: translateY(0.5px);
}

/* 摘要行图片徽标：与文字等高的小胶囊，提示此处有图、点击即复制 */
.img-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 16px;
  margin: 0 1px;
  padding: 0;
  vertical-align: -3px;
  border: 1px solid var(--sm-border);
  border-radius: 4px;
  background: var(--sm-surface-2);
  color: var(--sm-text-3);
  cursor: copy;
  transition: border-color var(--sm-dur-fast) var(--sm-ease-out), color var(--sm-dur-fast) var(--sm-ease-out);
}

.img-chip:hover,
.img-chip:focus-visible {
  border-color: var(--sm-accent);
  color: var(--sm-text);
  outline: none;
}

/* 展开区行内图片：随文字流排版；此处限高服务预览面板（列表展开区由 MemoItem 放开），
   外层包定位容器承载悬浮操作条 */
.inline-wrap {
  position: relative;
  display: inline-block;
  vertical-align: text-bottom;
}

.inline-img {
  display: inline-block;
  vertical-align: text-bottom;
  max-height: 260px;
  max-width: 100%;
  margin: 2px 2px;
  border-radius: 5px;
  border: 1px solid var(--sm-border);
  cursor: pointer;
}

/* 行内图悬浮操作条：右下角（独立悬浮窗 / 系统打开），触屏常显 */
.inline-bar {
  position: absolute;
  right: 5px;
  bottom: 5px;
  display: flex;
  gap: 3px;
  opacity: 0;
  transition: opacity var(--sm-dur-fast) var(--sm-ease-out);
}

.inline-wrap:hover .inline-bar,
.inline-bar:focus-within {
  opacity: 1;
}

@media (pointer: coarse) {
  .inline-bar {
    opacity: 1;
  }
}

.inline-btn {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 5px;
  background: rgba(15, 19, 28, 0.86);
  color: #fff;
  cursor: pointer;
  padding: 0;
  transition: background var(--sm-dur-fast) var(--sm-ease-out);
}

.inline-btn:hover {
  background: rgba(15, 19, 28, 0.97);
}

.inline-img-missing {
  display: inline-block;
  font-size: 11px;
  line-height: 1;
  padding: 5px 8px;
  margin: 0 2px;
  border: 1px dashed var(--sm-border-strong);
  border-radius: 5px;
  color: var(--sm-text-3);
}
</style>

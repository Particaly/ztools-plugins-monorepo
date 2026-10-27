<script setup lang="ts">
/**
 * 图文混排正文编辑器（contenteditable 自研，无 UI 库依赖）：
 * 正文里的 {img:<slotId>} 标记渲染为行内图片，文字与图片原地混排、随光标编辑；
 * 粘贴图片文件/拖入图片文件在光标处插入（槽分配经 stageImage 回调交给 store），
 * 文本粘贴强制纯文本（拦截富文本 HTML），Enter 沿用 textarea 语义（换行）；
 * 裸 Tab 不拦截：保持浏览器默认的焦点切换（⇧+Tab 反向），保证键盘可达性；
 * ⌘/Ctrl+Tab 在光标处插入两空格缩进（代码片段缩进入口）。
 *
 * DOM 与数据流：
 * - 只在挂载与外部（程序化）modelValue 变化时整体重建 DOM；用户输入只单向序列化上抛
 *   （IME 组合期间不上抛），避免 Vue 重渲染打断光标；
 * - 序列化：文本节点原样（\n 经 pre-wrap 呈现）、<br> 记换行、<img data-slot> 记标记、
 *   防御性处理浏览器意外产生的块级元素（DIV/P 之间补换行），零宽锚点字符剥除；
 * - 图片 src 由父级响应式提供（暂存像素直接 dataURL，既有图走缩略图管线），src 就绪后原地补上。
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { splitByImageTokens } from '../core/inlineImage'
import { t } from '../i18n/zh-CN'

const props = defineProps<{
  modelValue: string
  /** 图片槽 ID → 展示 src（父级响应式；未就绪的槽可缺省，就绪后自动补上）。 */
  imageSources: Record<string, string>
  /** 暂存一张待保存的图片像素（dataURL → 槽 ID）；非法/超量时由 store 提示并返回 null。 */
  stageImage: (dataUrl: string) => string | null
  placeholder?: string
}>()

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const rootRef = ref<HTMLDivElement | null>(null)

/** 最近一次上抛（或渲染）的值：外部 modelValue 与其一致时绝不重建 DOM，保护光标。 */
let lastSynced = ''
let composing = false

// ---- DOM 构建 ----

function buildImageNode(slotId: string, src: string): HTMLImageElement {
  const img = document.createElement('img')
  img.className = 'mxed-img'
  if (!src) img.classList.add('missing')
  img.dataset.slot = slotId
  img.src = src
  img.alt = ''
  img.title = t('mixedEditor.imageHint')
  img.draggable = false
  // 原子节点：整体选中/删除，不进入图片内部的光标模型
  img.setAttribute('contenteditable', 'false')
  return img
}

/** 按模型重建全部内容（挂载与外部变更时）。 */
function renderFromModel(): void {
  const el = rootRef.value
  if (!el) return
  el.textContent = ''
  for (const seg of splitByImageTokens(props.modelValue)) {
    if (seg.type === 'text') el.append(seg.text)
    else el.appendChild(buildImageNode(seg.id, props.imageSources[seg.id] ?? ''))
  }
  lastSynced = props.modelValue
}

// ---- 序列化 ----

const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'PRE'])

function serialize(): string {
  const el = rootRef.value
  if (!el) return ''
  let out = ''
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.nodeValue ?? ''
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const elm = node as HTMLElement
    if (elm.tagName === 'BR') {
      out += '\n'
      return
    }
    if (elm.tagName === 'IMG') {
      const slot = elm.dataset.slot ?? ''
      if (slot) out += `{img:${slot}}`
      return
    }
    const isBlock = BLOCK_TAGS.has(elm.tagName)
    if (isBlock && out.length > 0 && !out.endsWith('\n')) out += '\n'
    elm.childNodes.forEach(walk)
  }
  el.childNodes.forEach(walk)
  // 零宽锚点只服务光标定位，不进入数据
  return out.replace(/\u200B/g, '')
}

function emitUpdate(): void {
  const value = serialize()
  if (value === lastSynced) return
  lastSynced = value
  emit('update:modelValue', value)
}

// ---- 光标与插入 ----

function currentRange(): Range | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  const el = rootRef.value
  return el && el.contains(range.startContainer) ? range.cloneRange() : null
}

function placeCaretAtEnd(): void {
  const el = rootRef.value
  const sel = window.getSelection()
  if (!el || !sel) return
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
}

/** 在光标处插入文本（Enter 换行 / 纯文本粘贴共用）。 */
function insertTextAtCaret(text: string): void {
  const el = rootRef.value
  const sel = window.getSelection()
  if (!el || !sel) return
  let range = currentRange()
  if (!range) {
    placeCaretAtEnd()
    range = currentRange()
    if (!range) return
  }
  range.deleteContents()
  const node = document.createTextNode(text)
  range.insertNode(node)
  range.setStartAfter(node)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
  emitUpdate()
}

/**
 * 在指定位置插入图片：图片后跟一个零宽锚点文本节点
 *（Chromium 在 contenteditable=false 元素后无法直接落光标）。
 */
function insertImageNode(slotId: string, src: string, at?: Range | null): void {
  const el = rootRef.value
  const sel = window.getSelection()
  if (!el || !sel) return
  let range = at && el.contains(at.startContainer) ? at : currentRange()
  if (!range) {
    placeCaretAtEnd()
    range = currentRange()
    if (!range) return
  }
  range.deleteContents()
  const img = buildImageNode(slotId, src)
  const anchor = document.createTextNode('​')
  range.insertNode(img)
  img.after(anchor)
  const caret = document.createRange()
  caret.setStart(anchor, 1)
  caret.collapse(true)
  sel.removeAllRanges()
  sel.addRange(caret)
  emitUpdate()
}

/** 供工具栏「插入图片」等外部入口调用：聚焦后在光标处（失焦则末尾）插入。 */
function insertImage(slotId: string, src: string): void {
  const el = rootRef.value
  if (!el) return
  if (document.activeElement !== el) {
    el.focus({ preventScroll: true })
    placeCaretAtEnd()
  }
  insertImageNode(slotId, src)
}

function focus(): void {
  rootRef.value?.focus({ preventScroll: true })
}

defineExpose({ insertImage, focus })

// ---- 剪贴板与拖放 ----

function readImageFile(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? '').startsWith('data:image/') ? String(reader.result) : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

/** 图片项落位：读取 → 槽分配（store 校验体积/数量）→ 光标处插入。 */
async function placeImageFile(file: File, at?: Range | null): Promise<void> {
  const dataUrl = await readImageFile(file)
  if (!dataUrl) return
  const slot = props.stageImage(dataUrl)
  if (slot) insertImageNode(slot, dataUrl, at)
}

function onPaste(e: ClipboardEvent): void {
  const items = e.clipboardData?.items
  if (items) {
    for (const item of items) {
      if (!item.type.startsWith('image/')) continue
      const file = item.getAsFile()
      if (!file) continue
      e.preventDefault()
      const range = currentRange()
      void placeImageFile(file, range)
      return
    }
  }
  // 文本粘贴：只取纯文本（contenteditable 默认会带入富文本 HTML 样式）
  e.preventDefault()
  const text = e.clipboardData?.getData('text/plain') ?? ''
  if (text) insertTextAtCaret(text)
}

function firstImageFile(dt: DataTransfer | null): File | null {
  if (!dt) return null
  for (const file of dt.files) {
    if (file.type.startsWith('image/')) return file
  }
  return null
}

function onDragOver(e: DragEvent): void {
  if (firstImageFile(e.dataTransfer)) {
    e.preventDefault()
    e.dataTransfer!.dropEffect = 'copy'
  }
}

function onDrop(e: DragEvent): void {
  const file = firstImageFile(e.dataTransfer)
  if (!file) return
  e.preventDefault()
  // 落点即插入点（caretRangeFromPoint 由浏览器提供；取不到则用当前光标）
  const el = rootRef.value
  let range: Range | null = null
  if (el) {
    const doc = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null }
    range = doc.caretRangeFromPoint?.(e.clientX, e.clientY) ?? null
  }
  void placeImageFile(file, range)
}

// ---- 键盘：Enter 换行；⌘/Ctrl+Tab 缩进；裸 Tab 不拦截（交还浏览器焦点切换） ----

function onKeydown(e: KeyboardEvent): void {
  const mod = e.metaKey || e.ctrlKey
  if (e.key === 'Tab' && mod && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    insertTextAtCaret('  ')
    return
  }
  if ((e.key === 'Enter' || (e.key === 'n' && e.ctrlKey)) && !e.isComposing) {
    e.preventDefault()
    insertTextAtCaret('\n')
  }
}

function onInput(): void {
  if (composing) return
  emitUpdate()
}

function onCompositionStart(): void {
  composing = true
}

function onCompositionEnd(): void {
  composing = false
  emitUpdate()
}

function onBlur(): void {
  composing = false
  emitUpdate()
}

// ---- 外部同步 ----

watch(
  () => props.modelValue,
  (value) => {
    if (value !== lastSynced) renderFromModel()
  }
)

/** 图片 src 就绪（缩略图生成完/暂存像素登记）后原地补上，不动文字与光标。 */
watch(
  () => props.imageSources,
  (sources) => {
    const el = rootRef.value
    if (!el) return
    for (const img of el.querySelectorAll<HTMLImageElement>('img[data-slot]')) {
      const src = sources[img.dataset.slot ?? ''] ?? ''
      if (src && img.getAttribute('src') !== src) {
        img.src = src
        img.classList.remove('missing')
      }
    }
  },
  { deep: true }
)

onMounted(renderFromModel)

onBeforeUnmount(() => {
  emitUpdate()
})
</script>

<template>
  <div
    ref="rootRef"
    class="mxed"
    contenteditable="true"
    spellcheck="false"
    role="textbox"
    aria-multiline="true"
    :data-placeholder="placeholder ?? ''"
    @input="onInput"
    @keydown="onKeydown"
    @paste="onPaste"
    @dragover="onDragOver"
    @drop="onDrop"
    @compositionstart="onCompositionStart"
    @compositionend="onCompositionEnd"
    @blur="onBlur"
  />
</template>

<style scoped>
.mxed {
  flex: 1;
  min-height: 100px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: var(--sm-font-s);
  line-height: 1.55;
  color: var(--sm-text);
  background: var(--sm-surface);
  border: 1px solid var(--sm-border);
  border-radius: var(--sm-radius-s);
  padding: 8px 10px;
  outline: none;
}

.mxed:focus {
  border-color: var(--sm-accent);
}

.mxed:empty::before {
  content: attr(data-placeholder);
  color: var(--sm-text-3);
  pointer-events: none;
}

/* 行内图片：限高等比、与文字同行排版；缺失像素时占位框提示 */
.mxed-img {
  display: inline-block;
  vertical-align: text-bottom;
  max-height: 96px;
  max-width: 100%;
  border-radius: 5px;
  border: 1px solid var(--sm-border);
  margin: 0 2px;
  cursor: default;
  user-select: all; /* 整体选中，退格一次删除 */
}

.mxed-img.missing {
  width: 64px;
  height: 40px;
  background: var(--sm-surface-2);
  border: 1px dashed var(--sm-border-strong);
}
</style>

<script setup lang="ts">
/**
 * 标签式多选下拉框：已选值以 chip 呈现（× 可删），框内直接输入 ——
 * 输入过滤已有选项（自动排除已选），无精确匹配时出现「添加」行，回车/点击即新增；
 * 退格在空输入时删除最后一个 chip；↑↓ 移动高亮、Esc 清空输入并收起、Tab 关闭走人
 * （未回车的输入一并丢弃，与 SmSelect 的「不吞 Tab」约定一致）。
 * 弹层交互与 SmSelect 同语言：贴下方展开、空间不足上翻、打开时根节点带 data-open
 * 供 App 全局键盘路由放行按键。blur 不隐式提交（避免残句被误存为标签）。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Icon from './Icon.vue'
import { computePopupPlacement } from '../core/popupPosition'
import { t } from '../i18n/zh-CN'

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    /** 可选的已有标签（联想来源）；选中的项不再出现在弹层里。 */
    options?: string[]
    placeholder?: string
    /** 数量上限（达上限后不可再添加，占位文案给出提示）。 */
    max?: number
    ariaLabel?: string
  }>(),
  { options: () => [], placeholder: '', max: 0, ariaLabel: '' }
)

const emit = defineEmits<{ (e: 'update:modelValue', tags: string[]): void }>()

/** 弹层最大高度（与下方样式 max-height 保持一致，用于翻转判断与定位）。 */
const POPUP_MAX_HEIGHT = 176

const rootRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLElement | null>(null)

/** 同页多实例时 aria 关联 id 需唯一。 */
const popupId = `sm-tag-select-${Math.random().toString(36).slice(2, 8)}`

const open = ref(false)
const query = ref('')
/** 键盘/悬浮高亮的下标（相对 filteredOptions；== filteredOptions.length 表示「添加」行）。 */
const activeIndex = ref(-1)
/** 弹层向上翻转（下方空间不足）。 */
const flipUp = ref(false)
/** 弹层 fixed 定位（视口坐标）：父容器常带 overflow 裁切，absolute 会被裁掉并与周边控件重叠。 */
const popupStyle = ref<{ left: string; top: string; width: string } | null>(null)

const atMax = computed(() => props.max > 0 && props.modelValue.length >= props.max)

/** 弹层候选：已有标签去掉已选；再按输入包含匹配过滤。 */
const filteredOptions = computed(() => {
  const base = props.options.filter((o) => !props.modelValue.includes(o))
  const q = query.value.trim().toLowerCase()
  if (!q) return base
  return base.filter((o) => o.toLowerCase().includes(q))
})

/** 「添加」行可见性：有输入、未达上限、不是已选标签、也没有与已有选项同名（防建重）。 */
const canAdd = computed(() => {
  const name = query.value.trim()
  return (
    Boolean(name) &&
    !atMax.value &&
    !props.modelValue.includes(name) &&
    !props.options.some((o) => o === name)
  )
})

const activeCount = computed(() => filteredOptions.value.length + (canAdd.value ? 1 : 0))

/** 输入占位：无已选标签时给示例/上限提示，有标签时留空（chip 自说明）。 */
const inputPlaceholder = computed(() => {
  if (props.modelValue.length) return ''
  return atMax.value ? t('select.tagLimit', { max: props.max }) : props.placeholder
})

// 输入变化时高亮回到首个候选，保持「回车 = 第一个匹配/添加」的直觉
watch(query, () => {
  activeIndex.value = 0
})

/** 开关弹层：打开时高亮回到首项，并按剩余空间决定翻转。 */
async function setOpen(next: boolean): Promise<void> {
  if (open.value === next) return
  open.value = next
  if (!next) {
    activeIndex.value = -1
    return
  }
  activeIndex.value = filteredOptions.value.length ? 0 : canAdd.value ? filteredOptions.value.length : -1
  flipUp.value = false
  await nextTick()
  placePopup()
}

/** 量取触发器与弹层高度，把弹层以 fixed 坐标贴到触发器旁（下放不下则上翻）。 */
function placePopup(): void {
  const el = rootRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const popupHeight = Math.min(listRef.value?.scrollHeight ?? POPUP_MAX_HEIGHT, POPUP_MAX_HEIGHT)
  const placement = computePopupPlacement(
    { left: rect.left, top: rect.top, bottom: rect.bottom, width: rect.width },
    popupHeight,
    window.innerHeight
  )
  flipUp.value = placement.flip
  popupStyle.value = {
    left: `${Math.round(placement.left)}px`,
    top: `${Math.round(placement.top)}px`,
    width: `${Math.round(rect.width)}px`
  }
}

function close(): void {
  void setOpen(false)
}

/** 聚焦标签输入框：供父组件（字段弹窗打开时）把焦点落到表单控件上；聚焦即展开联想弹层。 */
function focus(): void {
  inputRef.value?.focus()
}

defineExpose({ focus })

function scrollToActive(): void {
  if (activeIndex.value < 0) return
  const nodes = listRef.value?.querySelectorAll<HTMLElement>('.select-option, .select-add')
  nodes?.[activeIndex.value]?.scrollIntoView({ block: 'nearest' })
}

function stepActive(delta: 1 | -1): void {
  const count = activeCount.value
  if (!count) return
  activeIndex.value = (activeIndex.value + delta + count) % count
  scrollToActive()
}

/** 添加标签：trim 去重、上限截停；成功后清空输入继续录下一个。 */
function add(raw: string): void {
  const tag = raw.trim()
  if (!tag || atMax.value || props.modelValue.includes(tag)) return
  emit('update:modelValue', [...props.modelValue, tag])
  query.value = ''
  activeIndex.value = 0
}

function removeTag(tag: string): void {
  emit(
    'update:modelValue',
    props.modelValue.filter((t) => t !== tag)
  )
}

/** 空输入时退格删最后一个 chip。 */
function removeLast(): void {
  if (props.modelValue.length) removeTag(props.modelValue[props.modelValue.length - 1])
}

function commitActive(): void {
  if (activeIndex.value >= filteredOptions.value.length) {
    add(query.value)
    return
  }
  const opt = filteredOptions.value[activeIndex.value]
  if (opt) add(opt)
}

function onKeydown(e: KeyboardEvent): void {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      stepActive(1)
      return
    case 'ArrowUp':
      e.preventDefault()
      stepActive(-1)
      return
    case 'Enter':
      // IME 组合中的回车是候选确认，不是提交
      if (e.isComposing || e.keyCode === 229) return
      e.preventDefault()
      commitActive()
      return
    case 'Backspace':
      if (!query.value) {
        e.preventDefault()
        removeLast()
      }
      return
    case 'Escape':
      if (open.value) {
        e.preventDefault()
        query.value = ''
        close()
      }
      return
    case 'Tab':
      // 不吞 Tab：收起弹层并丢弃未提交输入，焦点照常走到下一个控件
      query.value = ''
      close()
      return
    default:
      return
  }
}

/** 点击组件外部任意处收起（未回车的输入一并丢弃）。 */
function onDocMousedown(e: MouseEvent): void {
  if (!open.value) return
  if (rootRef.value?.contains(e.target as Node)) return
  query.value = ''
  close()
}

onMounted(() => {
  window.addEventListener('mousedown', onDocMousedown, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousedown', onDocMousedown, true)
})
</script>

<template>
  <div ref="rootRef" class="sm-select sm-tag-select" :class="{ flip: flipUp }" :data-open="open ? '' : undefined">
    <div class="tag-box" :aria-label="ariaLabel || undefined">
      <span v-for="tag in modelValue" :key="tag" class="tag-chip">
        <span class="chip-label">{{ tag }}</span>
        <button type="button" class="chip-remove" :aria-label="t('select.removeTag', { name: tag })" @click="removeTag(tag)">
          <Icon name="close" :size="10" />
        </button>
      </span>
      <input
        ref="inputRef"
        v-model="query"
        class="tag-input"
        :placeholder="inputPlaceholder"
        :aria-label="ariaLabel || undefined"
        @focus="setOpen(true)"
        @input="setOpen(true)"
        @keydown="onKeydown"
      />
    </div>
    <!-- 弹层开合：缩放淡入淡出（scale 预设）；fixed 坐标由 placePopup 量取写入 -->
    <Transition name="scale">
      <div
        v-if="open"
        :id="popupId"
        ref="listRef"
        class="select-popup"
        role="listbox"
        :style="popupStyle"
        :aria-label="ariaLabel || undefined"
      >
        <div
          v-for="(opt, i) in filteredOptions"
          :id="`${popupId}-opt-${i}`"
          :key="opt"
          class="select-option"
          role="option"
          :class="{ active: i === activeIndex }"
          :aria-selected="false"
          @mouseenter="activeIndex = i"
          @click="add(opt)"
        >
          <span class="option-label">{{ opt }}</span>
        </div>
        <div
          v-if="canAdd"
          :id="`${popupId}-opt-${filteredOptions.length}`"
          class="select-add"
          role="option"
          :class="{ active: activeIndex === filteredOptions.length }"
          :aria-selected="false"
          @mouseenter="activeIndex = filteredOptions.length"
          @click="add(query)"
        >
          <Icon name="plus" :size="13" />
          <span class="option-label">{{ t('select.addTag', { name: query.trim() }) }}</span>
        </div>
        <div v-if="!activeCount" class="select-empty">
          {{ atMax ? t('select.tagLimit', { max }) : t('select.noOptions') }}
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* 触发框：与 .sm-input 同观感，chips 与输入框混排 */
.tag-box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  width: 100%;
  min-height: 32px;
  padding: 3px 6px;
  border: 1px solid var(--sm-border);
  border-radius: var(--sm-radius-s);
  background: var(--sm-surface);
  cursor: text;
  transition: border-color var(--sm-dur-fast) var(--sm-ease-out);
}

.sm-select:focus-within .tag-box {
  border-color: var(--sm-accent);
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  max-width: 100%;
  padding: 1px 4px 1px 8px;
  border-radius: 11px;
  background: var(--sm-accent-soft);
  color: var(--sm-accent);
  font-size: var(--sm-font-s);
  line-height: 18px;
}

.chip-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
  transition: background var(--sm-dur-fast) var(--sm-ease-out), opacity var(--sm-dur-fast) var(--sm-ease-out);
}

.chip-remove:hover,
.chip-remove:focus-visible {
  opacity: 1;
  background: var(--sm-hover);
}

.tag-input {
  flex: 1;
  min-width: 72px;
  border: none;
  background: transparent;
  font-size: var(--sm-font-s);
  color: var(--sm-text);
}

.tag-input::placeholder {
  color: var(--sm-text-3);
}

.tag-input:focus {
  outline: none;
}

/* 弹层：与 SmSelect 同观感（浮层卡片）；fixed 贴触发器定位，避免被弹窗等 overflow 容器裁切 */
.select-popup {
  position: fixed;
  z-index: 70;
  max-height: 176px;
  overflow-y: auto;
  padding: 4px;
  background: var(--sm-surface);
  border: 1px solid var(--sm-border);
  border-radius: var(--sm-radius-m);
  box-shadow: var(--sm-shadow-2);
  transform-origin: top center;
}

.sm-select.flip .select-popup {
  transform-origin: bottom center;
}

.select-option,
.select-add {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: var(--sm-radius-s);
  font-size: var(--sm-font-s);
  color: var(--sm-text);
  cursor: pointer;
  transition: background var(--sm-dur-fast) var(--sm-ease-out);
}

.select-option.active,
.select-add.active {
  background: var(--sm-hover);
}

.select-add {
  color: var(--sm-text-2);
}

.option-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.select-empty {
  padding: 6px 10px;
  font-size: var(--sm-font-s);
  color: var(--sm-text-3);
}
</style>

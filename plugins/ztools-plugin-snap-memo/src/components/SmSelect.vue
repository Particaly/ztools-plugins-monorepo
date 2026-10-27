<script setup lang="ts">
/**
 * 自定义下拉选择框：替代原生 <select> 的统一样式（原生下拉的弹层无法定制）。
 * 触发器为按钮态（与输入框同观感），弹层贴触发器下方展开、下方空间不足时向上翻转；
 * 键盘可用：↑/↓ 移动高亮、Home/End 跳首尾、Enter/Space 选中、Esc/Tab/点击外部关闭 ——
 * Tab 只关浮层不吞键，焦点照常走到下一个控件。打开期间焦点保持在触发器（或筛选输入框）上，
 * 高亮项经 aria-activedescendant 标注；打开时根节点带 data-open，
 * App 全局键盘路由据此放行全部按键，避免方向键/Esc 误触列表与视图级快捷键。
 * creatable 模式：弹层顶部出现筛选输入框，输入可过滤选项；无精确匹配时出现「新建」行，
 * 回车或点击后上抛 create 事件（由父级创建数据并更新 modelValue），用于分组下拉内直接新建分组。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Icon from './Icon.vue'
import { computePopupPlacement } from '../core/popupPosition'
import { t } from '../i18n/zh-CN'

interface SmSelectOption {
  /** 提交值；null 表示「未分组」这类可选择的空值。 */
  value: string | null
  label: string
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    /** 当前值；省略即为纯占位态（配合 select 事件做「选完即执行」的一次性选择器）。 */
    modelValue?: string | null
    options: SmSelectOption[]
    /** 值没有匹配选项时触发器上展示的占位文案（弱化显示，如批量栏的「移到分组」）。 */
    placeholder?: string
    /** 弹层顶部提供筛选输入框并支持「新建」行（输入不匹配时）。 */
    creatable?: boolean
    /** 紧凑尺寸（浮条等窄空间）。 */
    dense?: boolean
    disabled?: boolean
    ariaLabel?: string
  }>(),
  { modelValue: null, placeholder: '', creatable: false, dense: false, disabled: false, ariaLabel: '' }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | null): void
  /** 每次选定即上抛（与值是否变化无关），供「选完即执行」的一次性场景（批量移动分组）使用。 */
  (e: 'select', option: SmSelectOption): void
  /** creatable 模式下确认「新建」行：上抛输入文案，父级负责创建并选中。 */
  (e: 'create', name: string): void
}>()

/** 弹层最大高度（与下方样式 max-height 保持一致，用于翻转判断）。 */
const POPUP_MAX_HEIGHT = 216

const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const filterRef = ref<HTMLInputElement | null>(null)

/** 同页多实例时 aria 关联 id 需唯一。 */
const popupId = `sm-select-${Math.random().toString(36).slice(2, 8)}`

const open = ref(false)
/** creatable 模式的筛选输入；关闭即清空。 */
const query = ref('')
/** 键盘/悬浮高亮的选项下标（相对 filteredOptions；== filteredOptions.length 表示「新建」行）。 */
const activeIndex = ref(-1)
/** 弹层向上翻转（触发器下方空间不足且上方更宽裕）。 */
const flipUp = ref(false)
/** 弹层 fixed 定位（视口坐标）：父容器常带 overflow 裁切，absolute 会被裁掉并与周边控件重叠。 */
const popupStyle = ref<{ left: string; top: string; width: string } | null>(null)

const selected = computed(() => props.options.find((o) => o.value === props.modelValue) ?? null)

/** 触发器文案：选中项 label；无匹配（值为 null 且选项里没有 null 项）时显示占位文案。 */
const triggerText = computed(() => selected.value?.label ?? props.placeholder)
const showPlaceholder = computed(() => selected.value === null && Boolean(props.placeholder))

/** 按筛选输入过滤后的选项（大小写不敏感的包含匹配；非 creatable 时恒等于全部选项）。 */
const filteredOptions = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!props.creatable || !q) return props.options
  return props.options.filter((o) => o.label.toLowerCase().includes(q))
})

/** 「新建」行可见性：有输入且没有精确同名选项（避免建重）。 */
const canCreate = computed(
  () => props.creatable && Boolean(query.value.trim()) && !props.options.some((o) => o.label === query.value.trim())
)

/** 高亮候选总数：过滤后选项 + 可选的「新建」行。 */
const activeCount = computed(() => filteredOptions.value.length + (canCreate.value ? 1 : 0))

// 输入变化时高亮回到首个候选，保持「回车 = 第一个匹配/新建」的直觉
watch(query, () => {
  activeIndex.value = 0
})

/** 开关弹层：打开时清空筛选、高亮定位到当前选中项（无选中则首个可用项），并按剩余空间决定翻转。 */
async function setOpen(next: boolean): Promise<void> {
  if (open.value === next) return
  open.value = next
  if (!next) {
    // 焦点在弹层内（筛选输入框）时收起：还到触发器，避免弹层卸载后焦点落空到 body
    const active = document.activeElement
    if (active instanceof HTMLElement && listRef.value?.contains(active)) triggerRef.value?.focus()
    query.value = ''
    activeIndex.value = -1
    return
  }
  query.value = ''
  const selectedIndex = props.options.findIndex((o) => o.value === props.modelValue)
  activeIndex.value = selectedIndex >= 0 ? selectedIndex : props.options.findIndex((o) => !o.disabled)
  flipUp.value = false
  await nextTick()
  if (props.creatable) filterRef.value?.focus()
  placePopup()
  await nextTick()
  scrollToActive()
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

/** 聚焦触发器：供父组件（字段弹窗打开时）把焦点落到表单控件上；关闭态 ↑/↓/Enter 即展开弹层。 */
function focus(): void {
  triggerRef.value?.focus()
}

defineExpose({ focus })

function toggle(): void {
  if (props.disabled) return
  void setOpen(!open.value)
}

function scrollToActive(): void {
  if (activeIndex.value < 0) return
  const nodes = listRef.value?.querySelectorAll<HTMLElement>('.select-option, .select-create')
  nodes?.[activeIndex.value]?.scrollIntoView({ block: 'nearest' })
}

/** 高亮移动一格（循环；选项跳过禁用项，「新建」行恒可选）。 */
function stepActive(delta: 1 | -1): void {
  const count = activeCount.value
  if (!count) return
  let idx = activeIndex.value
  for (let i = 0; i < count; i += 1) {
    idx = (idx + delta + count) % count
    if (idx >= filteredOptions.value.length || !filteredOptions.value[idx].disabled) break
  }
  activeIndex.value = idx
  scrollToActive()
}

function firstEnabled(): number {
  return filteredOptions.value.findIndex((o) => !o.disabled)
}

function lastEnabled(): number {
  for (let i = filteredOptions.value.length - 1; i >= 0; i -= 1) {
    if (!filteredOptions.value[i].disabled) return i
  }
  return canCreate.value ? filteredOptions.value.length : -1
}

function commitActive(): void {
  if (activeIndex.value >= filteredOptions.value.length) {
    createFromQuery()
    return
  }
  const opt = filteredOptions.value[activeIndex.value]
  if (opt) select(opt)
}

function select(option: SmSelectOption): void {
  if (option.disabled) return
  emit('update:modelValue', option.value)
  emit('select', option)
  close()
}

/** 确认「新建」行：上抛输入文案；父级创建并更新 modelValue（组件保持受控）。 */
function createFromQuery(): void {
  const name = query.value.trim()
  if (!name) return
  emit('create', name)
  close()
  triggerRef.value?.focus()
}

/** 触发器键盘：关闭态 ↑/↓/Enter/Space 打开；打开态 ↑↓ 移动、Home/End 跳首尾、Enter 选中、Esc/Tab 关闭。 */
function onTriggerKeydown(e: KeyboardEvent): void {
  if (props.disabled) return
  switch (e.key) {
    case 'ArrowDown':
    case 'ArrowUp':
      e.preventDefault()
      if (open.value) stepActive(e.key === 'ArrowDown' ? 1 : -1)
      else void setOpen(true)
      return
    case 'Enter':
    case ' ':
      e.preventDefault()
      if (open.value) commitActive()
      else void setOpen(true)
      return
    case 'Escape':
      if (open.value) {
        e.preventDefault()
        close()
      }
      return
    case 'Tab':
      // 不吞 Tab：只关浮层，放行默认行为让焦点走到下一个控件
      close()
      return
    case 'Home':
      e.preventDefault()
      activeIndex.value = firstEnabled()
      scrollToActive()
      return
    case 'End':
      e.preventDefault()
      activeIndex.value = lastEnabled()
      scrollToActive()
      return
    default:
      return
  }
}

/** 筛选输入框键盘：↑↓ 移动高亮、Enter 选中/新建、Esc 关闭并把焦点还给触发器；
 * Home/End 不劫持（保留输入框内移动光标的原生语义）。 */
function onFilterKeydown(e: KeyboardEvent): void {
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
      e.preventDefault()
      commitActive()
      return
    case 'Escape':
      e.preventDefault()
      close()
      triggerRef.value?.focus()
      return
    case 'Tab':
      // 不吞 Tab：只关浮层，放行默认行为让焦点走到下一个控件
      close()
      return
    default:
      return
  }
}

/** 点击组件外部任意处关闭（捕获阶段，先于外部元素的点击行为）。 */
function onDocMousedown(e: MouseEvent): void {
  if (!open.value) return
  if (rootRef.value?.contains(e.target as Node)) return
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
  <div ref="rootRef" class="sm-select" :class="{ dense, disabled, flip: flipUp }" :data-open="open ? '' : undefined">
    <button
      ref="triggerRef"
      type="button"
      class="select-trigger"
      :disabled="disabled"
      role="combobox"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :aria-label="ariaLabel || undefined"
      :aria-activedescendant="open && activeIndex >= 0 ? `${popupId}-opt-${activeIndex}` : undefined"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span class="select-value" :class="{ placeholder: showPlaceholder }">{{ triggerText }}</span>
      <Icon name="chevron" :size="13" class="select-arrow" />
    </button>
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
        <div v-if="creatable" class="select-filter">
          <input
            ref="filterRef"
            v-model="query"
            class="filter-input"
            :placeholder="t('select.filterPlaceholder')"
            @keydown="onFilterKeydown"
          />
        </div>
        <div
          v-for="(opt, i) in filteredOptions"
          :id="`${popupId}-opt-${i}`"
          :key="opt.value ?? '__none__'"
          class="select-option"
          role="option"
          :class="{ active: i === activeIndex, selected: opt.value === modelValue, disabled: opt.disabled }"
          :aria-selected="opt.value === modelValue"
          :aria-disabled="opt.disabled || undefined"
          @mouseenter="activeIndex = i"
          @click="select(opt)"
        >
          <span class="option-label">{{ opt.label }}</span>
          <Icon v-if="opt.value === modelValue" name="check" :size="13" class="option-check" />
        </div>
        <div
          v-if="canCreate"
          :id="`${popupId}-opt-${filteredOptions.length}`"
          class="select-create"
          role="option"
          :class="{ active: activeIndex === filteredOptions.length }"
          :aria-selected="false"
          @mouseenter="activeIndex = filteredOptions.length"
          @click="createFromQuery"
        >
          <Icon name="plus" :size="13" />
          <span class="option-label">{{ t('select.create', { name: query.trim() }) }}</span>
        </div>
        <div v-if="!activeCount" class="select-empty">{{ t('select.noOptions') }}</div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.sm-select {
  position: relative;
  width: 100%;
  min-width: 0;
}

/* 触发器：与 .sm-input 同观感的按钮态 */
.select-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--sm-border);
  border-radius: var(--sm-radius-s);
  background: var(--sm-surface);
  color: var(--sm-text);
  text-align: left;
  cursor: pointer;
  transition: border-color var(--sm-dur-fast) var(--sm-ease-out);
}

.select-trigger:hover:not(:disabled) {
  border-color: var(--sm-border-strong);
}

/* 焦点态与输入框一致：描边点亮而非外圈 outline */
.select-trigger:focus-visible {
  outline: none;
  border-color: var(--sm-accent);
}

.sm-select.open .select-trigger {
  border-color: var(--sm-accent);
}

.select-trigger:disabled {
  opacity: 0.55;
  cursor: default;
}

.select-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.select-value.placeholder {
  color: var(--sm-text-3);
}

.select-arrow {
  flex: none;
  color: var(--sm-text-3);
  transition: transform var(--sm-dur-base) var(--sm-ease-out);
}

.sm-select.open .select-arrow {
  transform: rotate(180deg);
}

/* 选项弹层：与右键菜单同观感（浮层卡片）；fixed 贴触发器定位，避免被弹窗等 overflow 容器裁切 */
.select-popup {
  position: fixed;
  z-index: 70;
  max-height: 216px;
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

/* creatable 模式：弹层顶部筛选输入（随弹层滚动钉在流内顶部即可，条目量小无需 sticky） */
.select-filter {
  padding: 2px 2px 6px;
  border-bottom: 1px solid var(--sm-border);
  margin-bottom: 4px;
}

.filter-input {
  width: 100%;
  padding: 5px 8px;
  border: 1px solid var(--sm-border);
  border-radius: var(--sm-radius-s);
  background: var(--sm-surface-2);
  font-size: var(--sm-font-s);
  color: var(--sm-text);
}

.filter-input:focus {
  outline: none;
  border-color: var(--sm-accent);
}

.select-option,
.select-create {
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
.select-create.active {
  background: var(--sm-hover);
}

.select-option.selected {
  color: var(--sm-accent);
  font-weight: 600;
}

.select-option.disabled {
  color: var(--sm-text-3);
  cursor: default;
}

.select-create {
  color: var(--sm-text-2);
}

.option-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.option-check {
  flex: none;
}

.select-empty {
  padding: 6px 10px;
  font-size: var(--sm-font-s);
  color: var(--sm-text-3);
}

/* 紧凑尺寸：浮条等窄空间 */
.sm-select.dense .select-trigger {
  padding: 3px 8px;
  font-size: var(--sm-font-s);
}

.sm-select.dense .select-option {
  padding: 5px 9px;
}
</style>

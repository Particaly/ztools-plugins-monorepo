<script setup lang="ts">
/**
 * 条目右键菜单：跟随右键位置弹出，自动避开视口边缘。
 * 常规条目：复制 / 编辑 / 置顶(取消置顶) / 创建副本 / 删除，敏感条目附显示/隐藏敏感内容。
 * 键盘可用：打开后聚焦第一项，↑↓ 移动、回车执行（Menu / ⇧+F10 可从选中条目唤起）；
 * 点击外部、滚轮或 Esc 关闭（Esc 由 App 全局路由处理）。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { AppStore } from '../store/appStore'
import Icon from './Icon.vue'
import { t } from '../i18n/zh-CN'

const props = defineProps<{ store: AppStore }>()

/** 菜单可用图标（与 Icon.vue 内置名称对应；.vue 模块 shim 无命名导出，故本地声明）。 */
type MenuIcon = 'copy' | 'edit' | 'pin' | 'copy-plus' | 'trash' | 'eye' | 'eye-off'

interface MenuItem {
  key: string
  label: string
  icon: MenuIcon
  danger?: boolean
  run: () => void
}

const cm = computed(() => props.store.state.contextMenu)

const memo = computed(() => {
  const target = cm.value
  if (!target) return null
  return props.store.state.memos.find((m) => m.id === target.memoId) ?? null
})

const revealed = computed(() => (memo.value ? props.store.state.revealSensitive.has(memo.value.id) : false))

const items = computed<MenuItem[]>(() => {
  const m = memo.value
  if (!m) return []
  const list: MenuItem[] = [
    { key: 'copy', label: t('menu.copy'), icon: 'copy', run: () => void props.store.actions.copyMemo(m) },
    { key: 'edit', label: t('menu.edit'), icon: 'edit', run: () => props.store.actions.editMemo(m.id) },
    {
      key: 'pin',
      label: m.pinned ? t('menu.unpin') : t('menu.pin'),
      icon: 'pin',
      run: () => props.store.actions.togglePinned(m.id)
    },
    { key: 'duplicate', label: t('menu.duplicate'), icon: 'copy-plus', run: () => props.store.actions.duplicateMemo(m.id) }
  ]
  if (m.sensitive) {
    list.push({
      key: 'reveal',
      label: revealed.value ? t('menu.mask') : t('menu.reveal'),
      icon: revealed.value ? 'eye-off' : 'eye',
      run: () => props.store.actions.toggleReveal(m.id)
    })
  }
  list.push({ key: 'delete', label: t('menu.delete'), icon: 'trash', danger: true, run: () => props.store.actions.deleteMemo(m.id) })
  return list
})

const rootRef = ref<HTMLElement | null>(null)
const pos = ref({ x: 0, y: 0 })

/** 菜单显示在指针处，但整体夹在视口内（边缘留 6px）。 */
function clampToViewport(x: number, y: number, w: number, h: number): { x: number; y: number } {
  return {
    x: Math.max(4, Math.min(x, window.innerWidth - w - 6)),
    y: Math.max(4, Math.min(y, window.innerHeight - h - 6))
  }
}

watch(cm, async (v) => {
  if (!v) return
  // 先按估算尺寸定位（条目数 × 行高），渲染后按实测尺寸修正，避免首帧闪到视口外
  pos.value = clampToViewport(v.x, v.y, 160, items.value.length * 30 + 8)
  await nextTick()
  const el = rootRef.value
  if (!el) return
  pos.value = clampToViewport(v.x, v.y, el.offsetWidth, el.offsetHeight)
  el.focus()
})

function run(item: MenuItem): void {
  props.store.actions.closeContextMenu()
  item.run()
}

/** 菜单内键盘导航：↑↓ 在菜单项间移动（浏览器焦点随动），回车/空格执行。 */
function onMenuKeydown(e: KeyboardEvent): void {
  const el = rootRef.value
  if (!el) return
  const buttons = [...el.querySelectorAll<HTMLButtonElement>('.ctx-item')]
  const idx = buttons.findIndex((b) => b === document.activeElement)
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    e.stopPropagation()
    const next = e.key === 'ArrowDown' ? (idx + 1) % buttons.length : (idx - 1 + buttons.length) % buttons.length
    buttons[next]?.focus()
  }
}

function onDocMousedown(e: MouseEvent): void {
  if (!props.store.state.contextMenu) return
  if (rootRef.value?.contains(e.target as Node)) return
  props.store.actions.closeContextMenu()
}

function onDocWheel(): void {
  if (props.store.state.contextMenu) props.store.actions.closeContextMenu()
}

onMounted(() => {
  window.addEventListener('mousedown', onDocMousedown, true)
  window.addEventListener('wheel', onDocWheel, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('mousedown', onDocMousedown, true)
  window.removeEventListener('wheel', onDocWheel)
})
</script>

<template>
  <div
    v-if="cm && memo && items.length"
    ref="rootRef"
    class="ctx-menu"
    :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
    role="menu"
    tabindex="-1"
    @contextmenu.prevent
    @keydown="onMenuKeydown"
  >
    <button
      v-for="item in items"
      :key="item.key"
      class="ctx-item"
      :class="{ danger: item.danger }"
      role="menuitem"
      @click="run(item)"
    >
      <Icon :name="item.icon" :size="14" />
      <span>{{ item.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.ctx-menu {
  position: fixed;
  z-index: 1000;
  min-width: 150px;
  padding: 4px;
  background: var(--sm-surface);
  border: 1px solid var(--sm-border);
  border-radius: var(--sm-radius-m);
  box-shadow: var(--sm-shadow-2);
  display: flex;
  flex-direction: column;
  outline: none;
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: none;
  border-radius: var(--sm-radius-s);
  background: transparent;
  color: var(--sm-text);
  font-size: var(--sm-font-s);
  cursor: pointer;
  white-space: nowrap;
  text-align: left;
}

.ctx-item:hover,
.ctx-item:focus-visible {
  background: var(--sm-hover);
}

.ctx-item.danger {
  color: var(--sm-danger);
}
</style>

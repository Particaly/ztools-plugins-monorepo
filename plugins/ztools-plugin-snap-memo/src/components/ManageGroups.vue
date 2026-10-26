<script setup lang="ts">
/**
 * 分组管理弹窗：新建、重命名、颜色、排序（上移/下移，键盘可用）、删除（选择条目去向）。
 * 所有修改即时生效并持久化；文案全部走 i18n 字典。
 */
import { nextTick, onMounted, ref } from 'vue'
import type { AppStore } from '../store/appStore'
import type { Group } from '../core/types'
import Icon from './Icon.vue'
import { t } from '../i18n/zh-CN'

const props = defineProps<{ store: AppStore }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const newName = ref('')
const newNameRef = ref<HTMLInputElement | null>(null)
const deleting = ref<Group | null>(null)

const PALETTE = ['#4f6ef7', '#2f9e68', '#e0603c', '#c25bd0', '#e6a23c', '#3aa9c2', '#8a8f9c']

onMounted(() => {
  void nextTick(() => newNameRef.value?.focus())
})

function createGroup(): void {
  if (!newName.value.trim()) return
  const group = props.store.actions.createGroup(newName.value.trim(), PALETTE[props.store.state.groups.length % PALETTE.length])
  if (group) newName.value = ''
}

/** 回车新建（IME 组合中的回车不上屏）。 */
function onNewNameKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return
  e.preventDefault()
  createGroup()
}

function moveUp(group: Group): void {
  const idx = props.store.state.groups.findIndex((g) => g.id === group.id)
  if (idx > 0) props.store.actions.reorderGroup(group.id, idx - 1)
}

function moveDown(group: Group): void {
  const idx = props.store.state.groups.findIndex((g) => g.id === group.id)
  if (idx >= 0 && idx < props.store.state.groups.length - 1) {
    props.store.actions.reorderGroup(group.id, idx + 1)
  }
}

function countOf(id: string): number {
  return props.store.state.memos.filter((m) => m.groupId === id).length
}

function deleteGroup(mode: 'keep' | 'delete'): void {
  const group = deleting.value
  if (!group) return
  props.store.actions.deleteGroup(group.id, mode === 'delete')
  deleting.value = null
}
</script>

<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="modal" role="dialog" aria-modal="true" :aria-label="t('groups.title')">
      <header class="modal-head">
        <span>{{ t('groups.title') }}</span>
        <button class="sm-icon-btn" :aria-label="t('help.close')" @click="emit('close')"><Icon name="close" /></button>
      </header>
      <div class="new-row">
        <input
          ref="newNameRef"
          v-model="newName"
          class="sm-input"
          :placeholder="t('groups.namePlaceholder')"
          maxlength="30"
          @keydown="onNewNameKeydown"
        />
        <button class="sm-btn primary small" @click="createGroup">{{ t('groups.create') }}</button>
      </div>
      <ul class="group-list">
        <li v-for="(g, i) in store.state.groups" :key="g.id" class="group-row">
          <div class="ops">
            <button class="sm-icon-btn" :disabled="i === 0" :aria-label="t('groups.moveUp')" :title="t('groups.moveUp')" @click="moveUp(g)">
              <Icon name="chevron" style="transform: rotate(180deg)" :size="13" />
            </button>
            <button
              class="sm-icon-btn"
              :disabled="i === store.state.groups.length - 1"
              :aria-label="t('groups.moveDown')"
              :title="t('groups.moveDown')"
              @click="moveDown(g)"
            >
              <Icon name="chevron" :size="13" />
            </button>
          </div>
          <span class="dot" :style="{ background: g.color ?? 'var(--sm-text-3)' }" />
          <input
            class="sm-input rename"
            :value="g.name"
            maxlength="30"
            :aria-label="g.name"
            @change="(e) => store.actions.renameGroup(g.id, (e.target as HTMLInputElement).value)"
          />
          <div class="palette">
            <button
              v-for="c in PALETTE"
              :key="c"
              class="color-dot"
              :class="{ active: g.color === c }"
              :style="{ background: c }"
              :aria-label="t('groups.colorLabel', { color: c })"
              @click="store.actions.setGroupColor(g.id, c)"
            />
          </div>
          <span class="count">{{ t('groups.countSuffix', { count: countOf(g.id) }) }}</span>
          <button class="sm-icon-btn" :title="t('groups.remove')" @click="deleting = g">
            <Icon name="trash" />
          </button>
        </li>
      </ul>
      <div v-if="deleting" class="confirm-row">
        <span>{{ t('groups.deleteQuestion', { name: deleting.name }) }}</span>
        <button class="sm-btn small" @click="deleteGroup('keep')">{{ t('groups.deleteMove') }}</button>
        <button class="sm-btn small danger" @click="deleteGroup('delete')">{{ t('groups.deleteWith') }}</button>
        <button class="sm-btn small" @click="deleting = null">{{ t('groups.cancel') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-mask {
  position: absolute;
  inset: 0;
  background: var(--sm-mask);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.modal {
  width: 480px;
  max-height: 80vh;
  overflow: auto;
  background: var(--sm-surface);
  border: 1px solid var(--sm-border);
  border-radius: var(--sm-radius-l);
  box-shadow: var(--sm-shadow-2);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--sm-font-l);
  font-weight: 600;
}

.new-row {
  display: flex;
  gap: 8px;
}

.group-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.group-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ops {
  display: flex;
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex: none;
}

.rename {
  flex: 1;
  padding: 4px 8px;
}

.palette {
  display: flex;
  gap: 4px;
}

.color-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}

.color-dot.active {
  border-color: var(--sm-text);
}

.count {
  font-size: 11px;
  color: var(--sm-text-3);
  width: 44px;
  text-align: right;
  flex: none;
  white-space: nowrap;
}

.confirm-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--sm-radius-s);
  background: var(--sm-warning-bg);
  color: var(--sm-warning-text);
  font-size: var(--sm-font-s);
  flex-wrap: wrap;
  position: sticky;
  bottom: 0;
}
</style>

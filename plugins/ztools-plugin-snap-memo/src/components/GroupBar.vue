<script setup lang="ts">
/**
 * 分组筛选栏：全部 / 置顶 / 最近 / 各分组 + 新建 / 多选 / 帮助 / 管理与设置入口。
 * 计数实时更新；分组 chips 横向滚动（垂直滚轮映射为横向滚动，两端渐隐提示可继续滚动）。
 */
import { computed, ref } from 'vue'
import type { AppStore } from '../store/appStore'
import type { GroupFilter } from '../core/types'
import { hasImages } from '../core/inlineImage'
import Icon from './Icon.vue'
import ManageGroups from './ManageGroups.vue'
import { t } from '../i18n/zh-CN'

const props = defineProps<{ store: AppStore }>()
const emit = defineEmits<{ (e: 'focusSearch'): void }>()

// 弹窗开关放 store：全局键盘路由需要感知（Esc 先关弹窗而不是退出插件）
const showManage = computed(() => props.store.state.showGroupManager)

const barRef = ref<HTMLElement | null>(null)
const scrollTick = ref(0)
const scrollState = computed(() => {
  void scrollTick.value
  const el = barRef.value
  if (!el) return { start: true, end: true }
  return { start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 }
})

function onScroll(): void {
  scrollTick.value += 1
}

/** 垂直滚轮在分组栏上时映射为横向滚动（触控板/鼠标都能翻看更多分组）。 */
function onWheel(e: WheelEvent): void {
  const el = barRef.value
  if (!el || e.deltaY === 0) return
  const canScroll = e.deltaY > 0 ? !scrollState.value.end : !scrollState.value.start
  if (canScroll) {
    e.preventDefault()
    el.scrollLeft += e.deltaY
    scrollTick.value += 1
  }
}

function toggleManage(open: boolean): void {
  props.store.actions.setGroupManagerOpen(open)
}

const counts = computed(() => {
  let all = 0
  let pinned = 0
  let images = 0
  const groups = new Map<string, number>()
  for (const m of props.store.state.memos) {
    all += 1
    if (m.pinned) pinned += 1
    if (hasImages(m)) images += 1
    const gid = m.groupId ?? ''
    groups.set(gid, (groups.get(gid) ?? 0) + 1)
  }
  return { all, pinned, images, groups }
})

function select(filter: GroupFilter): void {
  props.store.actions.setFilter(filter)
  emit('focusSearch')
}

/** 列表展示模式切换：简洁（标题+两行摘要）↔ 完整（条目内平铺全部内容）。 */
function toggleListMode(): void {
  const next = props.store.state.settings.listMode === 'full' ? 'brief' : 'full'
  props.store.actions.updateSetting('listMode', next)
}

/** 「图片」筛选下的网格墙开关（持久化设置；多选模式自动回落列表行）。 */
function toggleGridView(): void {
  props.store.actions.updateSetting('imageGridView', !props.store.state.settings.imageGridView)
}
</script>

<template>
  <div ref="barRef" class="group-bar" :class="{ 'at-start': scrollState.start, 'at-end': scrollState.end }" role="tablist" :aria-label="t('groups.manageA11y')" @scroll.passive="onScroll" @wheel="onWheel">
    <button
      class="sm-chip"
      :class="{ active: store.state.filter === 'all' }"
      role="tab"
      :aria-selected="store.state.filter === 'all'"
      @click="select('all')"
    >
      {{ t('groupAll') }}
      <span class="count">{{ counts.all }}</span>
    </button>
    <button
      class="sm-chip"
      :class="{ active: store.state.filter === 'pinned' }"
      role="tab"
      :aria-selected="store.state.filter === 'pinned'"
      @click="select('pinned')"
    >
      <Icon name="pin" :size="11" />
      {{ t('groupPinned') }}
    </button>
    <button
      class="sm-chip"
      :class="{ active: store.state.filter === 'recent' }"
      role="tab"
      :aria-selected="store.state.filter === 'recent'"
      @click="select('recent')"
    >
      <Icon name="clock" :size="11" />
      {{ t('groupRecent') }}
    </button>
    <button
      class="sm-chip"
      :class="{ active: store.state.filter === 'images' }"
      role="tab"
      :aria-selected="store.state.filter === 'images'"
      @click="select('images')"
    >
      <Icon name="image" :size="11" />
      {{ t('groupImages') }}
      <span class="count">{{ counts.images }}</span>
    </button>
    <button
      v-for="g in store.state.groups"
      :key="g.id"
      class="sm-chip"
      :class="{ active: store.state.filter === `group:${g.id}` }"
      role="tab"
      :aria-selected="store.state.filter === `group:${g.id}`"
      @click="select(`group:${g.id}`)"
    >
      <span class="dot" :style="{ background: g.color ?? 'var(--sm-text-3)' }" />
      {{ g.name }}
      <span class="count">{{ counts.groups.get(g.id) ?? 0 }}</span>
    </button>
    <span class="spacer" />
    <button
      class="sm-icon-btn"
      :class="{ active: store.state.batchMode }"
      :title="store.state.batchMode ? t('batch.exit') : t('batch.enter')"
      @click="store.actions.toggleBatchMode()"
    >
      <Icon name="layers" :size="13" />
    </button>
    <button
      class="sm-icon-btn"
      :class="{ active: store.state.settings.listMode === 'full' }"
      :title="store.state.settings.listMode === 'full' ? t('listModeFullTitle') : t('listModeBriefTitle')"
      @click="toggleListMode"
    >
      <Icon :name="store.state.settings.listMode === 'full' ? 'article' : 'rows'" />
    </button>
    <button
      v-if="store.state.filter === 'images'"
      class="sm-icon-btn"
      :class="{ active: store.state.settings.imageGridView }"
      :title="store.state.settings.imageGridView ? t('image.gridOff') : t('image.gridOn')"
      @click="toggleGridView"
    >
      <Icon name="grid" :size="13" />
    </button>
    <button class="sm-icon-btn" :title="t('help.title')" @click="store.actions.toggleHelp(true)">
      <span class="help-mark">?</span>
    </button>
    <button class="sm-icon-btn" :title="t('newMemo')" @click="store.actions.openEditor({ mode: 'new' })">
      <Icon name="plus" />
    </button>
    <button class="sm-icon-btn" :title="t('dataPage.title')" @click="store.actions.switchView('data')">
      <Icon name="download" :size="13" />
    </button>
    <button class="sm-icon-btn" :title="t('settings')" @click="store.actions.switchView('settings')">
      <Icon name="settings" />
    </button>
    <button class="sm-icon-btn" :title="t('groups.manage')" @click="toggleManage(true)">
      <Icon name="folder" />
    </button>
  </div>
  <!-- 分组管理弹窗：挂载点驱动开合过渡（遮罩淡入淡出 + 弹窗缩放入场） -->
  <Transition name="pop">
    <ManageGroups v-if="showManage" :store="store" @close="toggleManage(false)" />
  </Transition>
</template>

<style scoped>
.group-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  overflow-x: auto;
  flex: none;
  scrollbar-width: none;
  --edge-fade: 18px;
  mask-image: linear-gradient(to right, transparent 0, #000 var(--edge-fade), #000 calc(100% - var(--edge-fade)), transparent 100%);
  -webkit-mask-image: linear-gradient(to right, transparent 0, #000 var(--edge-fade), #000 calc(100% - var(--edge-fade)), transparent 100%);
}

/* 两端都滚到头时去掉渐隐（避免常态下两端发虚） */
.group-bar.at-start.at-end {
  mask-image: none;
  -webkit-mask-image: none;
}

.group-bar::-webkit-scrollbar {
  display: none;
}

.spacer {
  flex: 1;
  min-width: 8px;
}

.help-mark {
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
}
</style>

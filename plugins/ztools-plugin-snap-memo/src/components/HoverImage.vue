<script setup lang="ts">
/**
 * 智能图片块：默认小图（限高展示），点击切换为宽度撑满、高度按原像素比例的展示；
 * 悬浮时图片右下角出现「独立悬浮窗查看」「全屏查看」「用系统看图软件打开」三个按钮。
 * 列表条目展开区与右侧预览面板共用；父容器负责外边距；
 * 列表展开区经父级样式（MemoItem 的 :deep）放开限高——按原图尺寸展示、仅受列宽约束，
 * 预览面板保持「限高小图 ↔ 撑满」互切。
 * 单击行为可选：默认小图/撑满互切（预览面板），click-action="fullscreen" 时单击直接全屏（列表展开区）。
 * 图源走 store 的全尺寸展示缓存（Blob URL），按图片槽 ID 寻址（memoId 供全屏翻页归属）。
 */
import { computed, ref, watch } from 'vue'
import type { AppStore } from '../store/appStore'
import Icon from './Icon.vue'
import { t } from '../i18n/zh-CN'

const props = defineProps<{
  store: AppStore
  memoId: string
  imageId: string
  /** 单击图片的行为：toggle 切换撑满（默认）/ fullscreen 直接全屏查看。 */
  clickAction?: 'toggle' | 'fullscreen'
}>()

/** 全尺寸展示 URL（Blob URL，store 内 LRU 缓存）。 */
const url = computed(() => props.store.actions.memoImageDisplay(props.imageId))

/** 是否已切换为撑满展示（false = 限高小图）。 */
const big = ref(false)

/** 图片解码完成淡入。 */
const loaded = ref(false)

watch(
  () => props.imageId,
  () => {
    big.value = false
    loaded.value = false
  }
)

/** 点击图片：默认小图 ↔ 撑满互切；fullscreen 模式直接全屏查看。 */
function onImgClick(): void {
  if (props.clickAction === 'fullscreen') openFullscreen()
  else big.value = !big.value
}

/** 图片悬浮提示跟随单击行为。 */
const clickTitle = computed(() => (props.clickAction === 'fullscreen' ? t('image.fullscreen') : t('image.toggleSize')))

/** 全屏查看：打开插件窗口内全屏浮层（←/→ 可在全部图片间切换）。 */
function openFullscreen(): void {
  props.store.actions.openLightboxForMemo(props.memoId, props.imageId)
}

/** 独立悬浮窗查看：宿主 createBrowserWindow 创建置顶小窗，主窗口隐藏后仍停留。 */
function openFloat(): void {
  void props.store.actions.openImageFloat(props.imageId)
}

/** 用系统默认看图软件打开（失败由 store 统一提示）。 */
async function openSystem(): Promise<void> {
  await props.store.actions.openMemoImageExternal(props.imageId)
}
</script>

<template>
  <div class="himg" :class="{ big }">
    <img
      class="himg-img"
      :class="{ loaded }"
      :src="url"
      :title="clickTitle"
      alt=""
      draggable="false"
      @load="loaded = true"
      @click.stop="onImgClick"
    />
    <div class="himg-bar" @click.stop>
      <button class="himg-btn" :title="t('image.floatWindow')" :aria-label="t('image.floatWindow')" @click.stop="openFloat">
        <Icon name="pip" :size="14" />
      </button>
      <button class="himg-btn" :title="t('image.fullscreen')" :aria-label="t('image.fullscreen')" @click.stop="openFullscreen">
        <Icon name="maximize" :size="14" />
      </button>
      <button class="himg-btn" :title="t('image.openSystem')" :aria-label="t('image.openSystem')" @click.stop="openSystem">
        <Icon name="external" :size="14" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.himg {
  position: relative;
  display: inline-block;
  max-width: 100%;
}

/* 撑满态：宽度吃满父容器，高度按原图比例（img 自然排版） */
.himg.big {
  display: block;
  width: 100%;
}

.himg-img {
  display: block;
  max-width: 100%;
  max-height: 320px;
  border-radius: var(--sm-radius-s);
  border: 1px solid var(--sm-border);
  cursor: zoom-in;
  opacity: 0;
  transition: opacity var(--sm-dur-base) var(--sm-ease-out);
}

.himg-img.loaded {
  opacity: 1;
}

.himg.big .himg-img {
  width: 100%;
  height: auto;
  max-height: none;
  cursor: zoom-out;
}

/* 悬浮操作条：图片右下角，深色半透明保证任意底图可读；
   触屏设备（pointer: coarse）没有 hover，常显操作条保证可达 */
.himg-bar {
  position: absolute;
  right: 6px;
  bottom: 6px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity var(--sm-dur-fast) var(--sm-ease-out);
}

.himg:hover .himg-bar,
.himg-bar:focus-within {
  opacity: 1;
}

@media (pointer: coarse) {
  .himg-bar {
    opacity: 1;
  }
}

.himg-btn {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 6px;
  background: rgba(15, 19, 28, 0.86);
  color: #fff;
  cursor: pointer;
  transition: background var(--sm-dur-fast) var(--sm-ease-out);
}

.himg-btn:hover {
  background: rgba(15, 19, 28, 0.97);
}
</style>

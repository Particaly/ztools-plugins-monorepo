<script setup lang="ts">
/**
 * 内联 SVG 图标集：统一 24×24 网格、1.8 描边、currentColor。
 * 不使用 emoji 作 UI 图标；新增图标在此登记即可。
 */
import { computed } from 'vue'

const props = withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 15 })

const ICONS: Record<IconName, string> = {
  pin: '<path d="M9 4h6l-1 6 3.5 3.5H13v6l-1 1.5L11 19.5v-6H6.5L10 10z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L20 8l-4-4L4 16v4z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="M4 4l16 16M9.9 5.9A9.9 9.9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17.6 17.6 0 0 1-3 3.8M6.2 8.1A16 16 0 0 0 2.5 12S6 18.5 12 18.5a9.6 9.6 0 0 0 3.4-.6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 13l4 4L19 7"/>',
  folder: '<path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4l2 2.5h8A1.5 1.5 0 0 1 20.5 9v9A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18z"/>',
  tag: '<path d="M4 4h7l9 9-7 7-9-9z"/><circle cx="8.5" cy="8.5" r="1.4"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  download: '<path d="M12 4v11M7 10.5L12 15.5l5-5M4.5 19.5h15"/>',
  upload: '<path d="M12 15V4M7 8.5L12 3.5l5 5M4.5 19.5h15"/>',
  undo: '<path d="M8 5L3.5 9.5 8 14"/><path d="M3.5 9.5H15a5.5 5.5 0 0 1 0 11h-3"/>',
  bolt: '<path d="M13 2.5L5 13.5h5l-1 8 8-11h-5z"/>',
  grip: '<circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
  layers: '<path d="M12 3.5L3.5 8l8.5 4.5L20.5 8z"/><path d="M3.5 12.5L12 17l8.5-4.5"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  restore: '<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4"/>',
  shield: '<path d="M12 3l7 2.8v5.4c0 4.5-3 8.1-7 9.8-4-1.7-7-5.3-7-9.8V5.8z"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4.5 17.5l4.5-4.5 3 3 3.5-3.5 4 4"/>',
  maximize: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
  external: '<path d="M14 4h6v6M20 4l-8.5 8.5"/><path d="M20 14.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19V5.5A1.5 1.5 0 0 1 5.5 4H10"/>',
  rows: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  article: '<path d="M4 6h16M4 11h16M4 16h16M4 21h9"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  'chevron-left': '<path d="M15 6l-6 6 6 6"/>',
  'chevron-right': '<path d="M9 6l6 6-6 6"/>',
  panel: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M14.5 4.5v15"/>',
  minimize: '<path d="M10 14l-7 7M10 14v6M10 14H4M14 10l7-7M14 10V4M14 10h6"/>',
  'copy-plus': '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/><path d="M14.5 12v5M12 14.5h5"/>',
  code: '<path d="M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5"/>'
}

export type IconName =
  | 'pin' | 'search' | 'plus' | 'edit' | 'trash' | 'copy' | 'eye' | 'eye-off'
  | 'close' | 'check' | 'folder' | 'tag' | 'settings' | 'download' | 'upload'
  | 'undo' | 'bolt' | 'grip' | 'clock' | 'layers' | 'chevron' | 'more' | 'restore' | 'shield'
  | 'image' | 'maximize' | 'external' | 'rows' | 'article' | 'grid' | 'chevron-left' | 'chevron-right'
  | 'panel' | 'minimize' | 'copy-plus' | 'code'

const path = computed(() => ICONS[props.name] ?? '')
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="path"
  />
</template>

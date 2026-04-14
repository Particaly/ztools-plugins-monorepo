<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import ace from 'ace-builds/src-noconflict/ace'
import 'ace-builds/src-noconflict/mode-sh'
import 'ace-builds/src-noconflict/theme-github'
import 'ace-builds/src-noconflict/theme-one_dark'
import 'ace-builds/src-noconflict/ext-language_tools'

const modelValue = defineModel<string>({ required: true })

const editorRef = ref<HTMLDivElement | null>(null)
const isDark = computed(() => document.documentElement.classList.contains('dark'))

let editor: ace.Ace.Editor | null = null
let isInternalChange = false

onMounted(() => {
  if (!editorRef.value) return

  editor = ace.edit(editorRef.value, {
    mode: 'ace/mode/sh',
    theme: isDark.value ? 'ace/theme/one_dark' : 'ace/theme/github',
    value: modelValue.value,
    fontSize: 12,
    fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
    showPrintMargin: false,
    wrap: true,
    tabSize: 2,
    useSoftTabs: true,
    highlightActiveLine: true,
    showGutter: true,
    enableBasicAutocompletion: true,
  })

  editor.on('change', () => {
    if (isInternalChange) return
    isInternalChange = true
    modelValue.value = editor!.getValue()
    isInternalChange = false
  })
})

watch(modelValue, (val) => {
  if (!editor || isInternalChange) return
  isInternalChange = true
  const cursor = editor.getCursorPosition()
  editor.setValue(val ?? '', -1)
  editor.moveCursorToPosition(cursor)
  isInternalChange = false
})

watch(isDark, (dark) => {
  editor?.setTheme(dark ? 'ace/theme/one_dark' : 'ace/theme/github')
})

onBeforeUnmount(() => {
  editor?.destroy()
  editor = null
})
</script>

<template>
  <div ref="editorRef" class="source-editor"></div>
</template>

<style scoped>
.source-editor {
  flex: 1;
  min-height: 0;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 4px;
  overflow: hidden;
}
</style>
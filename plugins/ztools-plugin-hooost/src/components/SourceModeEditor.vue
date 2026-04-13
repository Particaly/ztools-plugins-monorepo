<script setup lang="ts">
const modelValue = defineModel<string>({ required: true })
</script>

<template>
  <div class="source-editor">
    <textarea
      class="source-textarea"
      :value="modelValue"
      placeholder="# 输入 hosts 格式内容&#10;# 例如: 127.0.0.1  example.com&#10;# 注释行以 # 开头"
      spellcheck="false"
      @input="(e) => modelValue = (e.target as HTMLTextAreaElement).value"
    />
  </div>
</template>

<style scoped>
.source-editor {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.source-textarea {
  flex: 1;
  min-height: 0;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.5;
  padding: 8px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 4px;
  background: transparent;
  color: inherit;
  resize: none;
  outline: none;
}
.source-textarea:focus {
  border-color: #58a4f6;
}
</style>

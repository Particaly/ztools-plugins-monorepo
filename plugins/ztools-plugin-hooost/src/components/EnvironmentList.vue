<script setup lang="ts">
import { ref, computed } from "vue";
import type { Environment } from "@/types/hosts";
import ContextMenu from "./ContextMenu.vue";
import type { ContextMenuItem } from "./ContextMenu.vue";

const props = defineProps<{
  environments: Environment[];
  activeEnvironmentIds: string[];
  selectedEnvironmentId: string | null;
}>();

const emit = defineEmits<{
  select: [id: string];
  apply: [id: string];
  deactivate: [id: string];
  delete: [id: string];
}>();

// Context menu state
const contextMenuVisible = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const contextMenuEnv = ref<Environment | null>(null);

const publicEnvironments = computed(() =>
  props.environments.filter((env) => env.type === "public"),
);
const customEnvironments = computed(() =>
  props.environments.filter((env) => env.type !== "public"),
);

const contextMenuItems = computed<ContextMenuItem[]>(() => {
  const env = contextMenuEnv.value;
  if (!env || env.type === "public") return [];
  const items: ContextMenuItem[] = [];
  if (props.activeEnvironmentIds.includes(env.id)) {
    items.push({ label: "停用此环境", value: "deactivate" });
  } else {
    items.push({ label: "启用此环境", value: "apply" });
  }
  items.push({ label: "删除此环境", value: "delete", danger: true });
  return items;
});

function onItemDoubleClick(env: Environment) {
  if (env.type === "public") return;
  if (props.activeEnvironmentIds.includes(env.id)) {
    emit("deactivate", env.id);
    return;
  }
  emit("apply", env.id);
}

function onContextMenu(event: MouseEvent, env: Environment) {
  if (env.type === "public") return;
  contextMenuX.value = event.clientX;
  contextMenuY.value = event.clientY;
  contextMenuEnv.value = env;
  contextMenuVisible.value = true;
}

function onContextMenuSelect(value: string) {
  contextMenuVisible.value = false;
  const env = contextMenuEnv.value;
  if (!env) return;
  if (value === "apply") emit("apply", env.id);
  else if (value === "deactivate") emit("deactivate", env.id);
  else if (value === "delete") emit("delete", env.id);
}

function onContextMenuClose() {
  contextMenuVisible.value = false;
}
</script>

<template>
  <aside class="env-list">
    <div class="env-list-header">实际环境</div>
    <div v-for="env in publicEnvironments" :key="env.id" class="env-item" :class="[
      { 'env-item--selected': env.id === selectedEnvironmentId },
      { 'env-item--active': activeEnvironmentIds.includes(env.id) },
    ]" @click="emit('select', env.id)" @dblclick="onItemDoubleClick(env)"
      @contextmenu.prevent="onContextMenu($event, env)">
      <span class="env-item-status"></span>
      <span class="env-item-name">{{ env.name }}</span>
      <span v-if="env.type === 'public' && env.editMode === 'source'" class="env-item-badge">源码</span>
      <span v-else class="env-item-count">{{
        env.lines.filter((l) => l.type === "host" && l.enabled).length
      }}</span>
    </div>

    <div class="env-list-header env-list-header--section">自定义</div>
    <div v-for="env in customEnvironments" :key="env.id" class="env-item" :class="[
      { 'env-item--selected': env.id === selectedEnvironmentId },
      { 'env-item--active': activeEnvironmentIds.includes(env.id) },
    ]" @click="emit('select', env.id)" @dblclick="onItemDoubleClick(env)"
      @contextmenu.prevent="onContextMenu($event, env)">
      <span class="env-item-status"></span>
      <span class="env-item-name">{{ env.name }}</span>
      <span v-if="env.type === 'public' && env.editMode === 'source'" class="env-item-badge">源码</span>
      <span v-else class="env-item-count">{{
        env.lines.filter((l) => l.type === "host" && l.enabled).length
      }}</span>
    </div>
    <ContextMenu :visible="contextMenuVisible" :x="contextMenuX" :y="contextMenuY" :items="contextMenuItems"
      @close="onContextMenuClose" @select="onContextMenuSelect" />
  </aside>
</template>

<style scoped>
.env-list {
  width: 200px;
  border-right: 1px solid var(--divider-color);
  padding: 12px 8px;
  overflow-y: auto;
  height: 100%;
  flex-shrink: 0;
}

.env-list-header {
  padding: 0 12px 10px;
  font-weight: 600;
  font-size: 12px;
  color: var(--text-color-secondary, #888);
}

.env-list-header--section {
  padding-top: 10px;
}

.env-list-items {
  list-style: none;
  margin: 0;
  padding: 0;
}

.env-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  gap: 10px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-color);
  border-radius: 8px;
}

.env-item:last-child {
  margin-bottom: 0;
}

.env-item:hover {
  background: var(--hover-bg);
}

.env-item--selected {
  background: var(--active-bg);
  color: var(--primary-color);
  font-weight: 500;
}

.env-item-status {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: transparent;
  box-shadow: none;
  flex-shrink: 0;
}

.env-item--active .env-item-status {
  background-color: var(--primary-color);
  box-shadow: 0 0 6px var(--primary-color);
}

.env-item-info {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.env-item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.env-item-count,
.env-item-badge {
  font-size: 11px;
  font-weight: 500;
  color: inherit;
  flex-shrink: 0;
}

.env-item-badge {
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--bg-color-secondary, #f0f0f0);
}

.env-item--selected .env-item-badge {
  background: color-mix(in srgb, var(--primary-color) 12%, transparent);
}
</style>

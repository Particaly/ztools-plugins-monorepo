<script setup lang="ts">
  import { ref, computed } from 'vue'
  import type { Environment } from '@/types/hosts'
  import ContextMenu from './ContextMenu.vue'
  import type { ContextMenuItem } from './ContextMenu.vue'
  
  const props = defineProps<{
    environments: Environment[]
    activeEnvironmentId: string | null
    selectedEnvironmentId: string | null
  }>()
  
  const emit = defineEmits<{
    select: [id: string]
    apply: [id: string]
    deactivate: []
    delete: [id: string]
  }>()
  
  const typeIcons: Record<string, string> = {
    public: '🌐',
    dev: '🔧',
    test: '🧪',
    prod: '🚀',
  }
  
  // Context menu state
  const contextMenuVisible = ref(false)
  const contextMenuX = ref(0)
  const contextMenuY = ref(0)
  const contextMenuEnv = ref<Environment | null>(null)
  
  const contextMenuItems = computed<ContextMenuItem[]>(() => {
    const env = contextMenuEnv.value
    if (!env || env.type === 'public') return []
    const items: ContextMenuItem[] = []
    if (env.id === props.activeEnvironmentId) {
      items.push({ label: '停用此环境', value: 'deactivate', icon: '⏹', danger: true })
    } else {
      items.push({ label: '应用此环境', value: 'apply', icon: '✅' })
      items.push({ label: '删除此环境', value: 'delete', icon: '🗑', danger: true })
    }
    return items
  })
  
  function onContextMenu(event: MouseEvent, env: Environment) {
    if (env.type === 'public') return
    contextMenuX.value = event.clientX
    contextMenuY.value = event.clientY
    contextMenuEnv.value = env
    contextMenuVisible.value = true
  }
  
  function onContextMenuSelect(value: string) {
    contextMenuVisible.value = false
    const env = contextMenuEnv.value
    if (!env) return
    if (value === 'apply') emit('apply', env.id)
    else if (value === 'deactivate') emit('deactivate')
    else if (value === 'delete') emit('delete', env.id)
  }
  
  function onContextMenuClose() {
    contextMenuVisible.value = false
  }
  </script>
  
  <template>
    <aside class="env-list">
      <div class="env-list-header">环境列表</div>
      <div
        v-for="env in environments"
        :key="env.id"
        class="env-item"
        :class="[
          { 'env-item--selected': env.id === selectedEnvironmentId },
          { 'env-item--active': env.id === activeEnvironmentId },
        ]"
        @click="emit('select', env.id)"
        @dblclick="env.type !== 'public' && emit('apply', env.id)"
        @contextmenu.prevent="onContextMenu($event, env)"
      >
        <span class="env-item-name">{{ env.name }}</span>
        <span v-if="env.type === 'public' && env.editMode === 'source'" class="env-item-badge">源码</span>
        <span v-else class="env-item-count">{{ env.lines.filter(l => l.type === 'host' && l.enabled).length }}</span>
      </div>
      <ContextMenu
        :visible="contextMenuVisible"
        :x="contextMenuX"
        :y="contextMenuY"
        :items="contextMenuItems"
        @close="onContextMenuClose"
        @select="onContextMenuSelect"
      />
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
  .env-item:last-child { margin-bottom: 0; }
  .env-item:hover { background: var(--hover-bg); }
  .env-item--selected {
    background: var(--active-bg);
    color: var(--primary-color);
    font-weight: 500;
  }
  .env-item--active::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--success-color, #10b981);
    box-shadow: 0 0 4px var(--success-color, #10b981);
    flex-shrink: 0;
  }
  .env-item-info {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }
  .env-item-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .env-item-count { font-size: 11px; color: var(--text-color-secondary, #888); flex-shrink: 0; }
  .env-item-badge {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 3px;
    background: var(--bg-color-secondary, #f0f0f0);
    color: var(--text-color-secondary, #888);
    flex-shrink: 0;
  }
  </style>
  
<script setup lang="ts">
/**
 * 导入导出页：JSON（全部/当前分组）、Markdown、CSV 导出；JSON / 文本（CSV·MD·Espanso）导入
 * （带合并/覆盖策略与数量预览，覆盖导入需二次确认）；自动备份的查看与恢复
 * （备份被截断时先警示再恢复）。
 */
import { computed } from 'vue'
import type { AppStore } from '../store/appStore'
import Icon from './Icon.vue'
import { t } from '../i18n/zh-CN'

const props = defineProps<{ store: AppStore }>()

const plan = computed(() => props.store.importPlan.value)

const backupTimeText = computed(() => {
  const ts = props.store.state.backupAt
  if (!ts) return t('dataPage.backupNone')
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return t('dataPage.backupAt', {
    time: `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  })
})

const backupTruncated = computed(() => props.store.computed.backupTruncated.value)

const groupFiltered = computed(() => props.store.state.filter.startsWith('group:'))

function exportAs(kind: 'json' | 'json-group' | 'markdown' | 'csv'): void {
  void props.store.actions.exportData(kind)
}

function importAs(kind: 'json' | 'text'): void {
  void props.store.actions.importFromFile(kind)
}

/** 从备忘快贴导入：只读提取宿主数据库里该插件的数据，走下方预览管线。 */
function importFromMqp(): void {
  props.store.actions.importFromMemoQuickPaste()
}

/** 覆盖导入：替换全部数据，必须经应用内确认。 */
function applyImport(): void {
  if (plan.value?.strategy === 'overwrite') {
    props.store.actions.requestConfirm(t('dataPage.importOverwriteConfirm'), () => props.store.actions.applyImport(), {
      danger: true
    })
    return
  }
  props.store.actions.applyImport()
}

/** 恢复备份：备份被截断过时先警示。 */
function restoreBackup(): void {
  const doRestore = () => props.store.actions.restoreBackup()
  if (backupTruncated.value) {
    props.store.actions.requestConfirm(
      `${t('dataPage.backupTruncatedWarn')}\n${t('dataPage.backupImagesLostWarn')}`,
      doRestore,
      { danger: true }
    )
    return
  }
  doRestore()
}
</script>

<template>
  <section class="data" :aria-label="t('dataPage.title')">
    <h2 class="page-title">{{ t('dataPage.title') }}</h2>

    <div class="block">
      <h3>{{ t('dataPage.exportTitle') }}</h3>
      <div class="btn-grid">
        <button class="sm-btn" @click="exportAs('json')">
          <Icon name="download" :size="13" />
          {{ t('dataPage.exportJson') }}
        </button>
        <button
          class="sm-btn"
          :disabled="!groupFiltered"
          :title="groupFiltered ? '' : t('dataPage.selectGroupFirst')"
          @click="exportAs('json-group')"
        >
          {{ t('dataPage.exportJsonGroup') }}
        </button>
        <button class="sm-btn" @click="exportAs('markdown')">{{ t('dataPage.exportMarkdown') }}</button>
        <button class="sm-btn" @click="exportAs('csv')">{{ t('dataPage.exportCsv') }}</button>
      </div>
    </div>

    <div class="block">
      <h3>{{ t('dataPage.importTitle') }}</h3>
      <div class="btn-grid">
        <button class="sm-btn" @click="importAs('json')">
          <Icon name="upload" :size="13" />
          {{ t('dataPage.importJson') }}
        </button>
        <button class="sm-btn" @click="importAs('text')">{{ t('dataPage.importText') }}</button>
        <button class="sm-btn" @click="importFromMqp">{{ t('dataPage.importMqp') }}</button>
      </div>
      <p class="hint-text">{{ t('dataPage.importTextHint') }}</p>
      <p class="hint-text">{{ t('dataPage.importMqpHint') }}</p>

      <div v-if="plan" class="import-preview">
        <p class="preview-title">{{ t('dataPage.importPreviewTitle') }}</p>
        <p class="plan-text">
          {{ t('dataPage.planSummary', {
            add: plan.memosToAdd.length,
            update: plan.memosToUpdate.length,
            skip: plan.memosUnchanged.length,
            groups: plan.groupsToAdd.length
          }) }}
          <template v-if="plan.groupRenameCount > 0">（{{ t('dataPage.groupRenamed', { count: plan.groupRenameCount }) }}）</template>
        </p>
        <div class="sm-seg">
          <button :class="{ active: plan.strategy === 'merge' }" @click="store.actions.setImportStrategy('merge')">
            {{ t('dataPage.importMerge') }}
          </button>
          <button :class="{ active: plan.strategy === 'overwrite' }" @click="store.actions.setImportStrategy('overwrite')">
            {{ t('dataPage.importOverwrite') }}
          </button>
        </div>
        <div class="preview-actions">
          <button class="sm-btn" @click="store.actions.cancelImport()">{{ t('dataPage.importCancel') }}</button>
          <button class="sm-btn primary" @click="applyImport">
            {{ t('dataPage.importApply') }}
          </button>
        </div>
      </div>
    </div>

    <div class="block">
      <h3>{{ t('dataPage.backupTitle') }}</h3>
      <p class="hint-text">
        {{ t('dataPage.backupHint') }} · {{ backupTimeText }}
        <template v-if="backupTruncated">
          <br />
          <span class="warn-text">{{ t('dataPage.backupTruncatedWarn') }}</span>
        </template>
      </p>
      <button class="sm-btn" @click="restoreBackup">{{ t('dataPage.backupRestore') }}</button>
    </div>
  </section>
</template>

<style scoped>
.data {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.page-title {
  font-size: var(--sm-font-l);
}

.block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.block h3 {
  font-size: var(--sm-font-m);
  color: var(--sm-text-2);
  font-weight: 600;
}

.btn-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.import-preview {
  border: 1px solid var(--sm-border);
  border-radius: var(--sm-radius-m);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--sm-surface);
}

.preview-title {
  font-size: var(--sm-font-m);
  font-weight: 600;
}

.plan-text {
  font-size: var(--sm-font-s);
  color: var(--sm-text-2);
}

.preview-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.hint-text {
  font-size: 11px;
  color: var(--sm-text-3);
}

.warn-text {
  color: var(--sm-warning-text);
}
</style>

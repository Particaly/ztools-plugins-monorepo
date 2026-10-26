<script setup lang="ts">
/**
 * 设置页：每项一句话说明，修改即时生效（store 内直接持久化）。
 * 图片 OCR：开关。识别走 ZTools「提供商」中设为默认的 OCR 提供商（宿主 ztools.ocr）。
 */
import { platform } from '../platform'
import type { AppStore } from '../store/appStore'
import { t } from '../i18n/zh-CN'

defineProps<{ store: AppStore }>()

const ocrAvailable = platform.ocr !== null
</script>

<template>
  <section class="settings" :aria-label="t('settingsPage.title')">
    <h2 class="page-title">{{ t('settingsPage.title') }}</h2>

    <div class="row">
      <div class="row-text">
        <span class="row-label">{{ t('settingsPage.theme') }}</span>
      </div>
      <div class="sm-seg">
        <button
          v-for="opt in ['system', 'light', 'dark'] as const"
          :key="opt"
          :class="{ active: store.state.settings.themeMode === opt }"
          @click="store.actions.updateSetting('themeMode', opt)"
        >
          {{
            opt === 'system'
              ? t('settingsPage.themeSystem')
              : opt === 'light'
                ? t('settingsPage.themeLight')
                : t('settingsPage.themeDark')
          }}
        </button>
      </div>
    </div>

    <div class="row">
      <div class="row-text">
        <span class="row-label">{{ t('settingsPage.enterAction') }}</span>
        <span class="row-hint">{{ t('hints.shiftEnter') }} 为反向动作</span>
      </div>
      <div class="sm-seg">
        <button
          :class="{ active: store.state.settings.enterAction === 'paste' }"
          @click="store.actions.updateSetting('enterAction', 'paste')"
        >
          {{ t('settingsPage.enterActionPaste') }}
        </button>
        <button
          :class="{ active: store.state.settings.enterAction === 'copy' }"
          @click="store.actions.updateSetting('enterAction', 'copy')"
        >
          {{ t('settingsPage.enterActionCopy') }}
        </button>
      </div>
    </div>

    <div class="row">
      <div class="row-text">
        <span class="row-label">{{ t('settingsPage.sortBy') }}</span>
      </div>
      <div class="sm-seg">
        <button
          v-for="opt in ['smart', 'manual', 'updated', 'created'] as const"
          :key="opt"
          :class="{ active: store.state.settings.sortBy === opt }"
          @click="store.actions.updateSetting('sortBy', opt)"
        >
        {{
          opt === 'smart'
            ? t('settingsPage.sortBySmart')
            : opt === 'manual'
              ? t('settingsPage.sortByManual')
              : opt === 'updated'
                ? t('settingsPage.sortByUpdated')
                : t('settingsPage.sortByCreated')
        }}
      </button>
      </div>
    </div>

    <div class="row">
      <div class="row-text">
        <span class="row-label">{{ t('settingsPage.density') }}</span>
      </div>
      <div class="sm-seg">
        <button
          :class="{ active: store.state.settings.density === 'comfortable' }"
          @click="store.actions.updateSetting('density', 'comfortable')"
        >
          {{ t('settingsPage.densityComfortable') }}
        </button>
        <button
          :class="{ active: store.state.settings.density === 'compact' }"
          @click="store.actions.updateSetting('density', 'compact')"
        >
          {{ t('settingsPage.densityCompact') }}
        </button>
      </div>
    </div>

    <div class="row">
      <div class="row-text">
        <span class="row-label">{{ t('settingsPage.listMode') }}</span>
        <span class="row-hint">{{ t('settingsPage.listModeHint') }}</span>
      </div>
      <div class="sm-seg">
        <button
          :class="{ active: store.state.settings.listMode === 'brief' }"
          @click="store.actions.updateSetting('listMode', 'brief')"
        >
          {{ t('settingsPage.listModeBrief') }}
        </button>
        <button
          :class="{ active: store.state.settings.listMode === 'full' }"
          @click="store.actions.updateSetting('listMode', 'full')"
        >
          {{ t('settingsPage.listModeFull') }}
        </button>
      </div>
    </div>

    <div class="row">
      <div class="row-text">
        <span class="row-label">{{ t('settingsPage.showPreviewPane') }}</span>
        <span class="row-hint">{{ t('settingsPage.showPreviewPaneHint') }}</span>
      </div>
      <button
        class="sm-switch"
        :class="{ on: store.state.settings.showPreviewPane }"
        role="switch"
        :aria-checked="store.state.settings.showPreviewPane"
        :aria-label="t('settingsPage.showPreviewPane')"
        @click="store.actions.updateSetting('showPreviewPane', !store.state.settings.showPreviewPane)"
      />
    </div>

    <div class="row">
      <div class="row-text">
        <span class="row-label">{{ t('settingsPage.restoreClipboard') }}</span>
        <span class="row-hint">{{ t('settingsPage.restoreClipboardHint') }}</span>
      </div>
      <button
        class="sm-switch"
        :class="{ on: store.state.settings.restoreClipboard }"
        role="switch"
        :aria-checked="store.state.settings.restoreClipboard"
        :aria-label="t('settingsPage.restoreClipboard')"
        @click="store.actions.updateSetting('restoreClipboard', !store.state.settings.restoreClipboard)"
      />
    </div>

    <div class="row">
      <div class="row-text">
        <span class="row-label">{{ t('settingsPage.recordUsage') }}</span>
        <span class="row-hint">{{ t('settingsPage.recordUsageHint') }}</span>
      </div>
      <div class="row-control">
        <button class="sm-btn small" :disabled="!store.state.memos.some((m) => m.useCount > 0)" @click="store.actions.clearUsage()">
          {{ t('settingsPage.clearUsage') }}
        </button>
        <button
          class="sm-switch"
          :class="{ on: store.state.settings.recordUsage }"
          role="switch"
          :aria-checked="store.state.settings.recordUsage"
          :aria-label="t('settingsPage.recordUsage')"
          @click="store.actions.updateSetting('recordUsage', !store.state.settings.recordUsage)"
        />
      </div>
    </div>

    <div class="row">
      <div class="row-text">
        <span class="row-label">{{ t('settingsPage.imageOcr') }}</span>
        <span class="row-hint">{{ ocrAvailable ? t('settingsPage.imageOcrHint') : t('settingsPage.ocrUnavailable') }}</span>
      </div>
      <button
        class="sm-switch"
        :class="{ on: store.state.settings.imageOcrEnabled }"
        role="switch"
        :aria-checked="store.state.settings.imageOcrEnabled"
        :aria-label="t('settingsPage.imageOcr')"
        :disabled="!ocrAvailable"
        @click="store.actions.updateSetting('imageOcrEnabled', !store.state.settings.imageOcrEnabled)"
      />
    </div>
  </section>
</template>

<style scoped>
.settings {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.page-title {
  font-size: var(--sm-font-l);
  margin-bottom: 8px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px solid var(--sm-border);
}

.row-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.row-label {
  font-size: var(--sm-font-m);
}

.row-hint {
  font-size: 11px;
  color: var(--sm-text-3);
}

.row-control {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>

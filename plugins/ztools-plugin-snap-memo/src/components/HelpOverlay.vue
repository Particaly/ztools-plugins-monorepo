<script setup lang="ts">
/**
 * 快捷键帮助浮层（? 键或分组栏按钮打开）：集中展示全部快捷键与触发词说明。
 * Esc / ? / 点击背景关闭；Esc 主路由在 App，这里处理按钮点击与自身按键。
 */
import { computed } from 'vue'
import { platform } from '../platform'
import type { AppStore } from '../store/appStore'
import { t } from '../i18n/zh-CN'

const props = defineProps<{ store: AppStore }>()

const mod = platform.isMac ? '⌘' : 'Ctrl'

interface HelpRow {
  keys: string
  desc: string
}

const sections = computed(() => {
  const sub = (s: string) => s.replaceAll('{mod}', mod)
  return [
    {
      title: t('help.sectionList'),
      rows: [
        { keys: t('help.rowNav'), desc: t('help.rowNavDesc') },
        { keys: t('help.rowHomeEnd'), desc: t('help.rowHomeEndDesc') },
        { keys: t('help.rowPage'), desc: t('help.rowPageDesc') },
        { keys: t('help.rowEnter'), desc: t('help.rowEnterDesc') },
        { keys: t('help.rowAltNum'), desc: t('help.rowAltNumDesc') },
        { keys: t('help.rowTab'), desc: t('help.rowTabDesc') },
        { keys: t('help.rowSpace'), desc: t('help.rowSpaceDesc') },
        { keys: t('help.rowDelete'), desc: t('help.rowDeleteDesc') },
        { keys: t('help.rowAltArrow'), desc: t('help.rowAltArrowDesc') },
        { keys: t('help.rowMenu'), desc: t('help.rowMenuDesc') }
      ] as HelpRow[],
      showKeysAsKbd: false
    },
    {
      title: t('help.sectionEdit'),
      rows: [
        { keys: sub(t('help.rowNew')), desc: t('help.rowNewDesc') },
        { keys: sub(t('help.rowEdit')), desc: t('help.rowEditDesc') },
        { keys: sub(t('help.rowCopy')), desc: t('help.rowCopyDesc') },
        { keys: sub(t('help.rowPin')), desc: t('help.rowPinDesc') },
        { keys: sub(t('help.rowSave')), desc: t('help.rowSaveDesc') }
      ] as HelpRow[],
      showKeysAsKbd: true
    },
    {
      title: t('help.sectionGlobal'),
      rows: [
        { keys: sub(t('help.rowUndo')), desc: t('help.rowUndoDesc') },
        { keys: sub(t('help.rowBatch')), desc: t('help.rowBatchDesc') },
        { keys: t('help.rowHelp'), desc: t('help.rowHelpDesc') },
        { keys: sub(t('help.rowSettings')), desc: t('help.rowSettingsDesc') },
        { keys: sub(t('help.rowFocusSearch')), desc: t('help.rowFocusSearchDesc') },
        { keys: t('help.rowEsc'), desc: t('help.rowEscDesc') }
      ] as HelpRow[],
      showKeysAsKbd: false
    }
  ]
})
</script>

<template>
  <div v-if="props.store.state.helpVisible" class="help-mask" @click.self="store.actions.toggleHelp(false)">
    <div class="help" role="dialog" aria-modal="true" :aria-label="t('help.title')">
      <header class="help-head">
        <span>{{ t('help.title') }}</span>
        <button class="sm-icon-btn" :aria-label="t('help.close')" @click="store.actions.toggleHelp(false)">
          ✕
        </button>
      </header>
      <div class="help-body">
        <section v-for="group in sections" :key="group.title" class="help-section">
          <h4>{{ group.title }}</h4>
          <div v-for="row in group.rows" :key="row.keys" class="help-row">
            <span class="help-keys">{{ row.keys }}</span>
            <span class="help-desc">{{ row.desc }}</span>
          </div>
        </section>
        <p class="help-tip">{{ t('help.triggerWordHint') }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.help-mask {
  position: absolute;
  inset: 0;
  background: var(--sm-mask);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 52;
}

.help {
  width: 440px;
  max-height: 82vh;
  background: var(--sm-surface);
  border: 1px solid var(--sm-border);
  border-radius: var(--sm-radius-l);
  box-shadow: var(--sm-shadow-2);
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.help-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--sm-font-l);
  font-weight: 600;
}

.help-body {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.help-section h4 {
  font-size: var(--sm-font-s);
  color: var(--sm-text-3);
  font-weight: 600;
  margin-bottom: 4px;
}

.help-row {
  display: flex;
  gap: 12px;
  padding: 3px 0;
  font-size: var(--sm-font-s);
}

.help-keys {
  flex: none;
  width: 128px;
  color: var(--sm-text-2);
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 11px;
}

.help-desc {
  color: var(--sm-text);
}

.help-tip {
  font-size: 11px;
  color: var(--sm-text-3);
  border-top: 1px dashed var(--sm-border);
  padding-top: 8px;
  line-height: 1.6;
}
</style>

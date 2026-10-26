/**
 * schemaVersion 迁移机制（纯函数、可单测）。
 *
 * 约定：
 * - db 中每个文档都带 schemaVersion（缺省视为 0，即最早结构）。
 * - 迁移步骤注册在 STEPS：键 N 表示“把 vN 文档升级到 vN+1”的纯变换。
 * - 迁移后交给 sanitize 归一化；保存时统一写 CURRENT_SCHEMA_VERSION。
 * - 读到比当前更高的版本（用户降级安装）时按当前结构尽力读取，不抛错。
 */
import type { Group, Memo, Settings } from './types'
import { sanitizeGroup, sanitizeMemo, sanitizeSettings } from './sanitize'

export const CURRENT_SCHEMA_VERSION = 1

type RawDoc = Record<string, unknown>
type MigrationStep = (doc: RawDoc) => RawDoc

/**
 * v0 → v1：早期结构里的 `tag`（单数字符串）收敛为 `tags` 数组；
 * `category` 字符串分组废弃为未分组（v1 起分组用 groupId 引用分组文档）。
 */
const stepMemo0to1: MigrationStep = (doc) => {
  const next = { ...doc }
  if (typeof next.tag === 'string' && next.tag.trim()) {
    next.tags = [next.tag.trim()]
  }
  delete next.tag
  delete next.category
  return next
}

/** v0 → v1：设置里的 enterBehavior 更名 enterAction。 */
const stepSettings0to1: MigrationStep = (doc) => {
  const next = { ...doc }
  if (next.enterBehavior === 'copy' || next.enterBehavior === 'paste') {
    next.enterAction = next.enterBehavior
  }
  delete next.enterBehavior
  return next
}

const MEMO_STEPS: Record<number, MigrationStep> = { 0: stepMemo0to1 }
const SETTINGS_STEPS: Record<number, MigrationStep> = { 0: stepSettings0to1 }
const GROUP_STEPS: Record<number, MigrationStep> = {}

function runSteps(doc: RawDoc, steps: Record<number, MigrationStep>): RawDoc {
  let version = typeof doc.schemaVersion === 'number' ? Math.trunc(doc.schemaVersion) : 0
  let current = doc
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = steps[version]
    if (!step) {
      // 版本链出现缺口（理论上不该发生）：记日志而非静默跳过，避免字段丢失无从排查
      console.warn(`[snap-memo] migration step v${version} missing, document kept as-is`)
      break
    }
    current = step(current)
    version += 1
  }
  return current
}

/** 迁移并归一化一条备忘；隔离坏数据（null）。 */
export function migrateMemo(raw: unknown): Memo | null {
  if (!raw || typeof raw !== 'object') return null
  const migrated = runSteps(raw as RawDoc, MEMO_STEPS)
  const memo = sanitizeMemo(migrated)
  return memo
}

/** 迁移并归一化设置（永不返回 null）。 */
export function migrateSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object') return sanitizeSettings(null)
  return sanitizeSettings(runSteps(raw as RawDoc, SETTINGS_STEPS))
}

/** 迁移并归一化分组列表。 */
export function migrateGroups(raw: unknown): Group[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((g) => (g && typeof g === 'object' ? sanitizeGroup(runSteps(g as RawDoc, GROUP_STEPS)) : null))
    .filter((g): g is Group => g !== null)
}

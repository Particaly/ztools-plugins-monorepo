/**
 * 存储仓库：把领域对象映射到平台 db 文档（宿主 ztools.db / 浏览器 localStorage）。
 * 文档划分见 docs/PLAN.md 第 3 节；读取全部走容错迁移，写入带 schemaVersion。
 * 图片像素按「槽」存储：每张图一个仅挂附件的桩文档 sm/att/<slotId>（宿主）或
 * kv 键 sm/img/<slotId>（浏览器开发态）；正文用 {img:<slotId>} 标记引用（图文混排）。
 * 旧版单图结构（附件挂在 memo 文档上）读取时回退兼容，并在 loadAll 里物理迁移到桩文档。
 */
import type { PlatformApi } from '../platform'
import {
  CONTENT_MAX_BYTES,
  DOC_PREFIX,
  KV_KEY,
  type Group,
  type Memo,
  type Settings
} from '../core/types'
import { allImageSlots } from '../core/inlineImage'
import { base64ToBytes, bytesToBase64, normalizeImageMime, parseDataUrl } from '../core/image'
import { CURRENT_SCHEMA_VERSION, migrateGroups, migrateMemo, migrateSettings } from '../core/migration'

/** 快照最多保留的条目数（单文档体积保护，超出部分截断并标记 truncated，恢复时 UI 提示）。 */
export const BACKUP_MAX_MEMOS = 500

/** 图片在 kv 中的键前缀（仅浏览器开发态使用）。 */
const IMG_KV_PREFIX = 'sm/img/'

export interface RepositoryData {
  memos: Memo[]
  groups: Group[]
  settings: Settings
}

export interface BackupData {
  savedAt: number
  groups: Group[]
  memos: Memo[]
  truncated: boolean
}

export interface Repository {
  loadAll(): RepositoryData
  saveMemo(memo: Memo): boolean
  removeMemo(id: string): boolean
  /** 保存一张图片的像素（dataURL）到槽桩文档；调用方需先保存 memo 文档本身。 */
  saveImage(slotId: string, dataUrl: string): boolean
  /** 读取槽图片 dataURL；不存在返回 null（含旧结构 memo 文档附件回退）。 */
  loadImage(slotId: string): string | null
  /** 读取槽图片原始字节与 MIME（展示/缩略图路径用，避免 base64 编解码往返）。 */
  loadImageBytes(slotId: string): { bytes: Uint8Array; mime: string } | null
  /** 删除槽桩文档（图片从条目移除时调用）。 */
  removeImageSlot(slotId: string): boolean
  saveGroups(groups: Group[]): boolean
  saveSettings(settings: Settings): boolean
  saveBackup(memos: Memo[], groups: Group[]): boolean
  loadBackup(): BackupData | null
  getDraft<T = unknown>(): T | null
  saveDraft(draft: unknown): void
  clearDraft(): void
  isSeeded(): boolean
  markSeeded(): void
}

/** UTF-8 字节数（与编辑器侧 new Blob().size 同口径，中文内容不会绕过上限）。 */
function textBytes(text: string): number {
  return new TextEncoder().encode(text).length
}

/** 基于平台 db 构建仓库实例。 */
export function createRepository(platformApi: PlatformApi): Repository {
  const db = platformApi.db
  const kv = platformApi.kv
  const att = platformApi.attachments

  function saveMemoDoc(memo: Memo): boolean {
    if (textBytes(memo.content) > CONTENT_MAX_BYTES) return false
    return db.putDoc(DOC_PREFIX.memo + memo.id, { ...memo, schemaVersion: CURRENT_SCHEMA_VERSION })
  }

  // ---- 图片像素数据（按槽存储） ----
  // 宿主：槽桩文档 sm/att/<slotId> 只挂附件（postAttachment 要求文档已存在）。
  // 浏览器开发态（attachments=null）：dataURL 直接放 kv。

  function saveImage(slotId: string, dataUrl: string): boolean {
    const parsed = parseDataUrl(dataUrl)
    if (!parsed) return false
    if (!att) {
      kv.setItem(IMG_KV_PREFIX + slotId, dataUrl)
      return true
    }
    const docId = DOC_PREFIX.image + slotId
    // 宿主附件不可覆盖：先删桩文档再重建，保证换图（同槽重写）不返回 conflict
    db.removeDoc(docId)
    if (!db.putDoc(docId, { stub: true, schemaVersion: CURRENT_SCHEMA_VERSION })) return false
    return att.put(docId, parsed.mime, base64ToBytes(parsed.base64))
  }

  function loadImageBytes(slotId: string): { bytes: Uint8Array; mime: string } | null {
    if (att) {
      // 新地址优先；旧结构唯一图片挂在 memo 文档附件上（槽 ID 约定等于 memoId）
      const data = att.get(DOC_PREFIX.image + slotId) ?? att.get(DOC_PREFIX.memo + slotId)
      return data
    }
    const dataUrl = kv.getItem<string>(IMG_KV_PREFIX + slotId)
    if (!dataUrl) return null
    const parsed = parseDataUrl(dataUrl)
    return parsed ? { bytes: base64ToBytes(parsed.base64), mime: parsed.mime } : null
  }

  function loadImage(slotId: string): string | null {
    const data = loadImageBytes(slotId)
    if (!data) return null
    // mime 归一：宿主 getAttachmentType 返回值实现不一（可能缺 image/ 前缀），
    // 非 image/* 形式按字节魔数重新嗅探，保证拼出的 dataURL 过得了宿主白名单
    return `data:${normalizeImageMime(data.mime, data.bytes)};base64,${bytesToBase64(data.bytes)}`
  }

  function removeImageSlot(slotId: string): boolean {
    if (att) return db.removeDoc(DOC_PREFIX.image + slotId)
    kv.removeItem(IMG_KV_PREFIX + slotId)
    return true
  }

  /**
   * 旧结构物理迁移：把挂在 memo 文档附件上的唯一图片搬到槽桩文档，
   * 再重写 memo 文档剥掉附件（避免字节双份、缩小同步正文）。幂等：
   * 桩文档已有附件则只做剥离；无旧附件则整体跳过。
   */
  function migrateLegacyAttachment(memo: Memo): void {
    if (!att) return
    // 旧结构的槽 ID 等于 memoId；新结构槽是独立 ID，不存在此形态
    if (!memo.images?.some((img) => img.id === memo.id)) return
    const stubDocId = DOC_PREFIX.image + memo.id
    const memoDocId = DOC_PREFIX.memo + memo.id
    if (!att.get(stubDocId)) {
      const legacy = att.get(memoDocId)
      if (!legacy) return
      if (!db.putDoc(stubDocId, { stub: true, schemaVersion: CURRENT_SCHEMA_VERSION })) return
      if (!att.put(stubDocId, legacy.mime, legacy.bytes)) return
    }
    // 剥离 memo 文档附件：删文档后按原字段重建（putDoc 的冲突重试逻辑照常兜底）
    const doc = db.getDoc<Record<string, unknown>>(memoDocId)
    if (!doc || !doc.value._attachments) return
    const { _attachments, ...rest } = doc.value
    void _attachments
    if (db.removeDoc(memoDocId)) db.putDoc(memoDocId, rest)
  }

  /** 清掉遗留的软删除文档（回收站已移除；升级用户首启时物理清理）与 dev 态图片 kv。 */
  function purgeLegacyTrash(): void {
    for (const doc of db.allDocs(DOC_PREFIX.memo)) {
      const legacyDeleted = (doc.value as { deletedAt?: unknown } | null)?.deletedAt
      if (legacyDeleted) {
        db.removeDoc(doc.id)
        kv.removeItem(IMG_KV_PREFIX + doc.id.slice(DOC_PREFIX.memo.length))
      }
    }
  }

  return {
    loadAll() {
      purgeLegacyTrash()
      const memoDocs = db.allDocs(DOC_PREFIX.memo)
      const memos: Memo[] = []
      for (const doc of memoDocs) {
        const memo = migrateMemo(doc.value)
        if (memo) memos.push(memo)
      }
      // 旧附件物理迁移（宿主；失败不影响加载，读取路径仍有 memo 文档回退）
      for (const memo of memos) migrateLegacyAttachment(memo)
      const groupsDoc = db.getDoc<{ groups?: unknown; schemaVersion?: number }>(DOC_PREFIX.groups)
      const groups = groupsDoc ? migrateGroups(groupsDoc.value?.groups) : []
      const settingsDoc = db.getDoc<unknown>(DOC_PREFIX.settings)
      const settings = settingsDoc ? migrateSettings(settingsDoc.value) : migrateSettings(null)
      return { memos, groups, settings }
    },
    saveMemo(memo) {
      return saveMemoDoc(memo)
    },
    removeMemo(id) {
      // 宿主：删文档连带清附件；槽桩文档一并删除（像素随条目走）
      const memoDoc = db.getDoc<Memo>(DOC_PREFIX.memo + id)
      const slots = memoDoc ? allImageSlots(memoDoc.value) : []
      for (const slot of slots) {
        if (att) db.removeDoc(DOC_PREFIX.image + slot)
        kv.removeItem(IMG_KV_PREFIX + slot)
      }
      // 浏览器开发态：再清 kv 里的旧结构图片数据（槽 ID == memoId 时同键，幂等）
      kv.removeItem(IMG_KV_PREFIX + id)
      return db.removeDoc(DOC_PREFIX.memo + id)
    },
    saveImage,
    loadImage,
    loadImageBytes,
    removeImageSlot,
    saveGroups(groups) {
      return db.putDoc(DOC_PREFIX.groups, { groups, schemaVersion: CURRENT_SCHEMA_VERSION })
    },
    saveSettings(settings) {
      return db.putDoc(DOC_PREFIX.settings, { ...settings, schemaVersion: CURRENT_SCHEMA_VERSION })
    },
    saveBackup(memos, groups) {
      const truncated = memos.length > BACKUP_MAX_MEMOS
      const payload: BackupData = {
        savedAt: Date.now(),
        groups,
        memos: memos.slice(0, BACKUP_MAX_MEMOS),
        truncated
      }
      return db.putDoc(DOC_PREFIX.backup, { ...payload, schemaVersion: CURRENT_SCHEMA_VERSION })
    },
    loadBackup() {
      const doc = db.getDoc<BackupData>(DOC_PREFIX.backup)
      if (!doc || !doc.value || !Array.isArray(doc.value.memos)) return null
      const value = doc.value
      return {
        savedAt: value.savedAt ?? 0,
        truncated: Boolean(value.truncated),
        groups: migrateGroups(value.groups),
        memos: value.memos.map(migrateMemo).filter((m): m is Memo => m !== null)
      }
    },
    getDraft<T>() {
      return kv.getItem<T>(KV_KEY.draft)
    },
    saveDraft(draft) {
      kv.setItem(KV_KEY.draft, draft)
    },
    clearDraft() {
      kv.removeItem(KV_KEY.draft)
    },
    isSeeded() {
      return kv.getItem<boolean>(KV_KEY.seeded) === true
    },
    markSeeded() {
      kv.setItem(KV_KEY.seeded, true)
    }
  }
}

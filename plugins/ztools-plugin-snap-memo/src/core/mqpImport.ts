/**
 * 备忘快贴（memo-quick-paste）数据导入转换（纯函数）。
 * 把跨插件提取出的原始宿主数据（见 preload readHostPluginData）转换为
 * snap-memo 的 ExportPayload，之后完全复用 planImport / applyImport 的
 * 合并去重与图片落库管线。
 *
 * 备忘快贴存储约定（宿主 PLUGIN/memo-quick-paste/ 命名空间）：
 * - collect/<毫秒时间戳>：记录本体。文字记录有 content；图片记录有
 *   image:{digest, contentType} + remark 备注，像素在同命名空间的附件
 *   attachment/<digest>（md5）里；
 * - use_collect/<记录id>：使用统计 {count, useAt}；
 * - tops/<标签>：标签内置顶的记录 id 列表（映射为全局置顶，语义最接近）；
 * - dynamic-features：标签 Feature（code 为 md5 → cmds[0] 为标签名）。
 */
import { CURRENT_SCHEMA_VERSION } from './migration'
import { sanitizeMemo } from './sanitize'
import type { ExportPayload } from './transfer'
import type { Memo } from './types'
import {
  buildDataUrl,
  bytesToBase64,
  dataUrlBytes,
  fnv1aHash,
  imageDimensions,
  normalizeImageMime
} from './image'

/** preload readHostPluginData 返回的原始数据快照（与 platform HostPluginDump 对齐）。 */
export interface MqpDump {
  account: string
  docs: Array<{ id: string; doc: Record<string, unknown> }>
  attachments: Array<{ id: string; mime: string; bytes: Uint8Array }>
  truncated: boolean
}

export interface MqpConvertOptions {
  /** 导入时间（payload.exportedAt 与兜底 createdAt）。 */
  now?: number
  /** 备忘 ID 分配器（appStore 传入 newMemoId 保持可测试性）。 */
  newMemoId?: () => string
}

export interface MqpConvertResult {
  payload: ExportPayload
  /** 文字记录数。 */
  textCount: number
  /** 图片记录数（像素随 payload.images 导入）。 */
  imageCount: number
  /** 图片附件缺字节的记录数（有备注转文字导入，无备注丢弃）。 */
  missingImages: number
  /** 无法解析而跳过的文档数。 */
  skippedDocs: number
}

/** 标签 Feature 文档结构（dynamic-features，data 为双重 JSON 字符串）。 */
interface MqpTagFeature {
  code: string
  explain?: string
  cmds?: unknown[]
}

/** 标签 code → 显示名映射：来自 dynamic-features 文档（explain='标签' 的动态 Feature）。 */
function buildTagLabelMap(docs: Array<{ id: string; doc: Record<string, unknown> }>): Map<string, string> {
  const map = new Map<string, string>()
  const featureDoc = docs.find((d) => d.id === 'dynamic-features')
  if (!featureDoc) return map
  let payload: unknown = (featureDoc.doc as { data?: unknown }).data
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload)
    } catch {
      return map
    }
  }
  const features = (payload as { features?: unknown } | null)?.features
  if (!Array.isArray(features)) return map
  for (const f of features as MqpTagFeature[]) {
    if (!f || typeof f.code !== 'string' || f.explain !== '标签') continue
    const label = Array.isArray(f.cmds) ? f.cmds.find((c): c is string => typeof c === 'string' && c.trim() !== '') : undefined
    if (label) map.set(f.code, label.trim())
  }
  return map
}

/** 使用统计映射：记录 id → {count, useAt}（use_collect/<记录id>；注意 use_ 前缀拼在完整 _id 前，remainder 不含 collect/）。 */
function buildUsageMap(docs: Array<{ id: string; doc: Record<string, unknown> }>): Map<string, { count: number; useAt: number | null }> {
  const map = new Map<string, { count: number; useAt: number | null }>()
  for (const { id, doc } of docs) {
    if (!id.startsWith('use_collect/')) continue
    const recordId = id.slice('use_collect/'.length)
    const count = typeof doc.count === 'number' && doc.count > 0 ? Math.floor(doc.count) : 0
    const useAt = typeof doc.useAt === 'number' && doc.useAt > 0 ? doc.useAt : null
    map.set(recordId, { count, useAt })
  }
  return map
}

/** 置顶集合：tops/<标签> 的 value 列表里的记录 id（标签内置顶 → 全局置顶）。 */
function buildPinnedSet(docs: Array<{ id: string; doc: Record<string, unknown> }>): Set<string> {
  const pinned = new Set<string>()
  for (const { id, doc } of docs) {
    if (!id.startsWith('tops/')) continue
    if (!Array.isArray(doc.value)) continue
    for (const v of doc.value) {
      if (typeof v === 'string' && v) pinned.add(v)
    }
  }
  return pinned
}

/** 附件字节映射：digest → {mime, bytes}（attachment/<md5>）。 */
function buildImageMap(attachments: MqpDump['attachments']): Map<string, { mime: string; bytes: Uint8Array }> {
  const map = new Map<string, { mime: string; bytes: Uint8Array }>()
  for (const att of attachments) {
    if (!att.id.startsWith('attachment/')) continue
    const digest = att.id.slice('attachment/'.length)
    if (digest) map.set(digest, { mime: att.mime, bytes: att.bytes })
  }
  return map
}

/** 读取文档字段里的字符串（缺失/类型不符返回空串）。 */
function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * 把备忘快贴的原始数据转换为 snap-memo 导入载荷。
 * 条目按创建时间升序排列（order 递减赋值，手动排序时新条目在前，与原插件列表一致）；
 * 之后逐条过 sanitizeMemo 归一化（kind 推导、标签截断、图片标记补写都由它兜底）。
 */
export function convertMemoQuickPaste(dump: MqpDump, options: MqpConvertOptions = {}): MqpConvertResult {
  const now = options.now ?? Date.now()
  const newId = options.newMemoId ?? (() => `mqp-${now}-${Math.random().toString(36).slice(2, 12)}`)
  const tagLabels = buildTagLabelMap(dump.docs)
  const usage = buildUsageMap(dump.docs)
  const pinned = buildPinnedSet(dump.docs)
  const images = buildImageMap(dump.attachments)

  const collectDocs = dump.docs
    .filter(({ id }) => /^collect\/\d+$/.test(id))
    .map(({ id, doc }) => ({ ts: Number(id.slice('collect/'.length)), doc }))
    .filter(({ ts }) => Number.isFinite(ts) && ts > 0)
    .sort((a, b) => a.ts - b.ts)

  const memos: Memo[] = []
  const pixels: Record<string, string> = {}
  let textCount = 0
  let imageCount = 0
  let missingImages = 0
  let skippedDocs = 0

  collectDocs.forEach(({ ts, doc }, index) => {
    const rawTags = Array.isArray(doc.tags) ? doc.tags.filter((t): t is string => typeof t === 'string' && t.trim() !== '') : []
    const tags = [...new Set(rawTags.map((code) => tagLabels.get(code) ?? '').filter(Boolean))]
    const usageStat = usage.get(String(ts))
    const base = {
      id: newId(),
      title: '',
      groupId: null,
      tags,
      pinned: pinned.has(`collect/${ts}`),
      sensitive: false,
      order: -(index + 1),
      useCount: usageStat?.count ?? 0,
      lastUsedAt: usageStat?.useAt ?? null,
      createdAt: ts,
      updatedAt: ts
    }

    const imageRef = (doc.image ?? null) as { digest?: unknown; contentType?: unknown } | null
    if (imageRef && typeof imageRef.digest === 'string' && imageRef.digest) {
      const att = images.get(imageRef.digest)
      const remark = asString(doc.remark).replace(/\r\n/g, '\n').trim()
      if (!att || att.bytes.length === 0) {
        // 像素缺失：备注还在就按文字条目导入，否则整条丢弃
        missingImages += 1
        if (!remark) {
          skippedDocs += 1
          return
        }
        memos.push(sanitizeMemo({ ...base, content: remark })!)
        textCount += 1
        return
      }
      const mime = normalizeImageMime(asString(imageRef.contentType) || att.mime || 'image/png', att.bytes)
      const dataUrl = buildDataUrl(mime, bytesToBase64(att.bytes))
      const slotId = newId()
      const dims = imageDimensions(att.bytes)
      memos.push(
        sanitizeMemo({
          ...base,
          content: remark ? `${remark}\n{img:${slotId}}` : `{img:${slotId}}`,
          images: [
            {
              id: slotId,
              mime,
              hash: fnv1aHash(dataUrl),
              width: dims?.width ?? 0,
              height: dims?.height ?? 0,
              bytes: dataUrlBytes(dataUrl)
            }
          ]
        })!
      )
      pixels[slotId] = dataUrl
      imageCount += 1
      return
    }

    const content = asString(doc.content).replace(/\r\n/g, '\n').trim()
    if (!content) {
      skippedDocs += 1
      return
    }
    memos.push(sanitizeMemo({ ...base, content })!)
    textCount += 1
  })

  return {
    payload: {
      app: 'snap-memo',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: now,
      groups: [],
      memos,
      images: pixels
    },
    textCount,
    imageCount,
    missingImages,
    skippedDocs
  }
}

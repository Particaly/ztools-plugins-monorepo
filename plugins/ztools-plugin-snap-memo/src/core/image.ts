/**
 * 图片内容工具（纯函数）：dataURL 解析/构建、字节数估算、base64 编解码、
 * 内容指纹与宿主动态入口载荷归一化。禁止引入 Vue / platform 依赖。
 */
import { IMAGE_MAX_BYTES } from './types'

const DATA_URL_RE = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i

export interface ParsedDataUrl {
  mime: string
  base64: string
}

/** 解析 dataURL；仅接受 base64 编码的 image/*，不合法返回 null。 */
export function parseDataUrl(dataUrl: string): ParsedDataUrl | null {
  const m = DATA_URL_RE.exec(dataUrl.trim())
  if (!m) return null
  return { mime: m[1].toLowerCase(), base64: m[2] }
}

/** 是否为合法的图片 dataURL。 */
export function isImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' && DATA_URL_RE.test(value.trim())
}

/** 按文件头魔数嗅探图片 MIME（宿主附件类型元数据不可信时的兜底；未识别回落 png）。 */
export function sniffImageMime(bytes: Uint8Array): string {
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png'
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 3 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif'
  // RIFF….WEBP：偏移 0-3 为 "RIFF"、8-11 为 "WEBP"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return 'image/bmp'
  return 'image/png'
}

/**
 * 校正附件携带的 MIME：非 `image/…` 形式（宿主 getAttachmentType 实现差异、
 * 旧数据缺失等）一律按字节魔数重新嗅探，保证拼出的 dataURL 能被宿主侧白名单接受。
 */
export function normalizeImageMime(mime: string, bytes: Uint8Array): string {
  return /^image\/[a-z0-9.+-]+$/i.test(mime) ? mime.toLowerCase() : sniffImageMime(bytes)
}

/** 由 MIME 与 base64 构建 dataURL。 */
export function buildDataUrl(mime: string, base64: string): string {
  return `data:${mime};base64,${base64}`
}

/**
 * dataURL 解码后的近似字节数（base64 尾部 padding 已扣除）。
 * 不真正解码，O(1) 开销用于保存前的体积校验。
 */
export function dataUrlBytes(dataUrl: string): number {
  const parsed = parseDataUrl(dataUrl)
  if (!parsed) return 0
  const len = parsed.base64.length
  const padding = parsed.base64.endsWith('==') ? 2 : parsed.base64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((len * 3) / 4) - padding)
}

/** base64 → 字节（宿主附件存储用）；自动忽略空白与 padding，非法字符跳过。 */
export function base64ToBytes(base64: string): Uint8Array {
  // 去掉 padding 与一切非表内字符，得到纯表内串后按 4→3 解码
  const cleaned = base64.replace(/[^a-z0-9+/]/gi, '')
  const len = Math.floor((cleaned.length * 3) / 4)
  const bytes = new Uint8Array(len)
  let b = 0
  for (let i = 0; i + 3 < cleaned.length + 3; i += 4) {
    if (b >= len) break
    const chunk =
      (charCodeOf(cleaned[i]) << 18) |
      (charCodeOf(cleaned[i + 1]) << 12) |
      (charCodeOf(cleaned[i + 2]) << 6) |
      charCodeOf(cleaned[i + 3])
    if (b < len) bytes[b++] = (chunk >> 16) & 0xff
    if (b < len) bytes[b++] = (chunk >> 8) & 0xff
    if (b < len) bytes[b++] = chunk & 0xff
  }
  return bytes
}

/** 字节 → base64（宿主附件读取后转 dataURL 用）。 */
export function bytesToBase64(bytes: Uint8Array): string {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = bytes[i + 1]
    const b2 = bytes[i + 2]
    out += CHARS[b0 >> 2]
    out += CHARS[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)]
    out += b1 === undefined ? '=' : CHARS[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)]
    out += b2 === undefined ? '=' : CHARS[b2 & 63]
  }
  return out
}

function charCodeOf(ch: string | undefined): number {
  if (!ch || ch === '=') return 0
  if (ch >= 'A' && ch <= 'Z') return ch.charCodeAt(0) - 65
  if (ch >= 'a' && ch <= 'z') return ch.charCodeAt(0) - 97 + 26
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - 48 + 52
  if (ch === '+') return 62
  if (ch === '/') return 63
  return 0
}

/**
 * FNV-1a 32 位内容指纹（hex 字符串）。
 * 用于图片重复检测：冲突概率对备忘量级完全够用，且无需引入哈希依赖。
 */
export function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * 归一化宿主动态入口（feature type 'img'）传来的图片载荷。
 * 载荷可能是 dataURL，也可能是裸 base64（宿主默认按 PNG 处理）；其他类型返回 null。
 * 裸 base64 要求通过图片魔数校验（PNG/JPEG/GIF/WEBP），长十六进制串等普通文本不会被误判成图片。
 */
export function normalizeImagePayload(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!value) return null
  // dataURL 直接回传（这里用正则而不是 isImageDataUrl 守卫，避免把 string 收窄成 never）
  if (/^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(value)) return value
  // 裸 base64：宿主剪贴板/拖拽图片约定为 PNG；字符集与长度校验 + 文件头魔数校验
  if (/^[a-z0-9+/=]+$/i.test(value) && value.length > 64) {
    const head = base64ToBytes(value.slice(0, 24))
    if (hasImageMagic(head)) return buildDataUrl('image/png', value)
  }
  return null
}

/** 常见图片格式的文件头魔数（前几个字节足以区分）。 */
function hasImageMagic(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const gif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46
  const webp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
  return png || jpeg || gif || webp
}

/** 图片字节是否超过保存上限。 */
export function exceedsImageLimit(bytes: number): boolean {
  return bytes > IMAGE_MAX_BYTES
}

/** 从图片二进制头解析原始像素尺寸（PNG/GIF/WEBP/JPEG）；不解码像素，纯头部读取。 */
export function imageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 12) return null
  // PNG：IHDR 固定在签名后，宽高各 4 字节大端
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    if (bytes.length < 24) return null
    const width = readU32BE(bytes, 16)
    const height = readU32BE(bytes, 20)
    return width > 0 && height > 0 ? { width, height } : null
  }
  // GIF：宽高各 2 字节小端，紧跟 6 字节签名
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { width: readU16LE(bytes, 6), height: readU16LE(bytes, 8) }
  }
  // WEBP：RIFF 容器，按子块类型分三种布局
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return webpDimensions(bytes)
  }
  // JPEG：FFD8 起，逐段走到 SOFn 读宽高（遇到熵编码段即止）
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return jpegDimensions(bytes)
  }
  return null
}

function readU16LE(b: Uint8Array, at: number): number {
  return b[at]! | (b[at + 1]! << 8)
}

function readU32BE(b: Uint8Array, at: number): number {
  return (b[at]! * 2 ** 24) + ((b[at + 1]! << 16) | (b[at + 2]! << 8) | b[at + 3]!)
}

/** WEBP 尺寸：VP8（有损）/ VP8L（无损）/ VP8X（扩展）三种子块布局各不相同。 */
function webpDimensions(b: Uint8Array): { width: number; height: number } | null {
  // RIFF 头 12 字节后的第一个子块：4 字节 tag + 4 字节长度
  const tag = String.fromCharCode(b[12]!, b[13]!, b[14]!, b[15]!)
  if (tag === 'VP8 ') {
    // 帧标签 3 字节 + 同步码 3 字节，宽高各 2 字节小端（取低 14 位）
    const w = readU16LE(b, 26) & 0x3fff
    const h = readU16LE(b, 28) & 0x3fff
    return w > 0 && h > 0 ? { width: w, height: h } : null
  }
  if (tag === 'VP8L') {
    // 签名 1 字节后 4 字节小端位域：宽 14 位 + 高 14 位（均存的是实际值-1）
    if (b.length < 29) return null
    const bits = b[25]! | (b[26]! << 8) | (b[27]! << 16) | (b[28]! << 24)
    const w = (bits & 0x3fff) + 1
    const h = ((bits >> 14) & 0x3fff) + 1
    return { width: w, height: h }
  }
  if (tag === 'VP8X') {
    // 标志 4 字节后画布宽-1/高-1 各 3 字节小端
    if (b.length < 30) return null
    const w = (b[24]! | (b[25]! << 8) | (b[26]! << 16)) + 1
    const h = (b[27]! | (b[28]! << 8) | (b[29]! << 16)) + 1
    return { width: w, height: h }
  }
  return null
}

/** JPEG 尺寸：跳过段长逐段扫描，SOFn 段内高（2 字节）在宽（2 字节）之前。 */
function jpegDimensions(b: Uint8Array): { width: number; height: number } | null {
  let i = 2
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i += 1
      continue
    }
    const marker = b[i + 1]!
    // SOS（熵编码开始）与 EOI 之后不再有元数据段
    if (marker === 0xda || marker === 0xd9) return null
    const segLen = (b[i + 2]! << 8) | b[i + 3]!
    // SOF0~SOF15，排除 DHT(C4)/JPG(C8)/DAC(CC)
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isSof && i + 9 <= b.length) {
      return { height: (b[i + 5]! << 8) | b[i + 6]!, width: (b[i + 7]! << 8) | b[i + 8]! }
    }
    if (segLen < 2) return null
    i += 2 + segLen
  }
  return null
}

/** 人类可读的图片体积（列表徽标用）；非法输入返回空串。 */
export function formatImageBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  const trim = (s: string) => s.replace(/\.0$/, '')
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024
    return `${trim(kb.toFixed(kb >= 100 ? 0 : 1))} KB`
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

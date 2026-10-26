import { describe, expect, it } from 'vitest'
import {
  base64ToBytes,
  buildDataUrl,
  bytesToBase64,
  dataUrlBytes,
  exceedsImageLimit,
  fnv1aHash,
  formatImageBytes,
  imageDimensions,
  isImageDataUrl,
  normalizeImagePayload,
  parseDataUrl
} from '../src/core/image'

// 1x1 红色像素 PNG 的 base64（标准测试图）
const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const TINY_PNG = `data:image/png;base64,${TINY_PNG_BASE64}`

describe('dataURL 解析与构建', () => {
  it('解析合法 image dataURL', () => {
    const parsed = parseDataUrl(TINY_PNG)
    expect(parsed).toEqual({ mime: 'image/png', base64: TINY_PNG_BASE64 })
    expect(isImageDataUrl(TINY_PNG)).toBe(true)
  })

  it('拒绝非图片 / 非 base64 dataURL 与垃圾输入', () => {
    expect(parseDataUrl('data:text/plain;base64,AAAA')).toBeNull()
    expect(parseDataUrl('data:image/png,notbase64')).toBeNull()
    expect(parseDataUrl('hello')).toBeNull()
    expect(parseDataUrl('')).toBeNull()
    expect(isImageDataUrl(42)).toBe(false)
    expect(isImageDataUrl(null)).toBe(false)
  })

  it('构建 dataURL 可被再次解析', () => {
    const url = buildDataUrl('image/jpeg', 'ABCD')
    expect(parseDataUrl(url)).toEqual({ mime: 'image/jpeg', base64: 'ABCD' })
  })
})

describe('字节数与上限', () => {
  it('dataUrlBytes 与 base64 解码长度一致（扣除 padding）', () => {
    expect(dataUrlBytes(TINY_PNG)).toBe(base64ToBytes(TINY_PNG_BASE64).length)
    expect(dataUrlBytes(TINY_PNG)).toBeGreaterThan(0)
    expect(dataUrlBytes('')).toBe(0)
  })

  it('exceedsImageLimit 按 8MB 上限判断', () => {
    expect(exceedsImageLimit(8 * 1024 * 1024)).toBe(false)
    expect(exceedsImageLimit(8 * 1024 * 1024 + 1)).toBe(true)
  })
})

describe('base64 编解码往返', () => {
  it('bytes → base64 → bytes 无损', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255, 77])
    const b64 = bytesToBase64(bytes)
    expect(base64ToBytes(b64)).toEqual(bytes)
  })

  it('与内置 atob/btoa 结果一致（存在时）', () => {
    const bytes = new Uint8Array([104, 105, 33])
    expect(bytesToBase64(bytes)).toBe(btoa('hi!'))
    expect(Array.from(base64ToBytes(btoa('hi!')))).toEqual([104, 105, 33])
  })

  it('任意长度（含 1/2/3 字节余数）往返稳定', () => {
    for (let n = 1; n <= 10; n++) {
      const bytes = new Uint8Array(n)
      for (let i = 0; i < n; i++) bytes[i] = (i * 37 + n) % 256
      expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes))
    }
  })
})

describe('fnv1aHash 内容指纹', () => {
  it('同内容同哈希，不同内容不同哈希', () => {
    expect(fnv1aHash('abc')).toBe(fnv1aHash('abc'))
    expect(fnv1aHash('abc')).not.toBe(fnv1aHash('abd'))
  })

  it('哈希为 8 位 hex', () => {
    expect(fnv1aHash('')).toMatch(/^[0-9a-f]{8}$/)
    expect(fnv1aHash(TINY_PNG)).toMatch(/^[0-9a-f]{8}$/)
  })
})

describe('normalizeImagePayload 宿主载荷归一化', () => {
  it('dataURL 原样通过', () => {
    expect(normalizeImagePayload(TINY_PNG)).toBe(TINY_PNG)
  })

  it('裸 base64（真实图片字节）包装为 PNG dataURL', () => {
    expect(normalizeImagePayload(TINY_PNG_BASE64)).toBe(TINY_PNG)
  })

  it('长十六进制/字母串不是图片字节，拒绝（不再误判为 PNG）', () => {
    expect(normalizeImagePayload('a'.repeat(100))).toBeNull()
    expect(normalizeImagePayload('A'.repeat(100))).toBeNull()
    expect(normalizeImagePayload('0123456789abcdef'.repeat(10))).toBeNull()
  })

  it('其他类型与短串拒绝', () => {
    expect(normalizeImagePayload(123)).toBeNull()
    expect(normalizeImagePayload('')).toBeNull()
    expect(normalizeImagePayload('short')).toBeNull()
    expect(normalizeImagePayload('not base64!!')).toBeNull()
  })
})

describe('imageDimensions 图片头尺寸解析', () => {
  it('解析真实 PNG 字节（1×1）', () => {
    expect(imageDimensions(base64ToBytes(TINY_PNG_BASE64))).toEqual({ width: 1, height: 1 })
  })

  it('解析大尺寸 PNG（宽高跨字节边界，大端序）', () => {
    const bytes = new Uint8Array(40)
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
    bytes.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8)
    bytes.set([0, 1, 0x38, 0x40], 16) // 宽 0x0001_3840 = 79936
    bytes.set([0, 0, 0x30, 0xd4], 20) // 高 0x0000_30d4 = 12500
    expect(imageDimensions(bytes)).toEqual({ width: 79936, height: 12500 })
  })

  it('解析 GIF（宽高小端序）', () => {
    const bytes = new Uint8Array(13)
    for (let i = 0; i < 6; i++) bytes[i] = 'GIF89a'.charCodeAt(i)
    bytes[6] = 0x58
    bytes[7] = 0x02 // 600
    bytes[8] = 0xf4
    bytes[9] = 0x01 // 500
    expect(imageDimensions(bytes)).toEqual({ width: 600, height: 500 })
  })

  it('解析 JPEG：跳过 APPn 段后命中 SOF0（高在宽之前）', () => {
    const bytes = new Uint8Array(4 + 18 + 19)
    bytes.set([0xff, 0xd8], 0)
    // APP0 段：长度 16（含长度字节自身），内容任意
    bytes[2] = 0xff
    bytes[3] = 0xe0
    bytes.set([0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1], 4)
    // SOF0 段起点
    const sof = 4 + 2 + 16
    bytes[sof] = 0xff
    bytes[sof + 1] = 0xc0
    bytes.set([0, 17, 8, 0x0b, 0xb8, 0x07, 0xd0], sof + 2) // 长 17、精度 8、高 3000、宽 2000
    expect(imageDimensions(bytes)).toEqual({ width: 2000, height: 3000 })
  })

  it('解析 WEBP VP8L（无损，位域存实际值-1）', () => {
    const bytes = new Uint8Array(30)
    bytes.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0], 0)
    bytes.set([0x57, 0x45, 0x42, 0x50], 8)
    bytes.set([0x56, 0x50, 0x38, 0x4c], 12) // 'VP8L'
    bytes[20] = 0x2f // 签名
    const bits = (200 - 1) | ((100 - 1) << 14)
    bytes[25] = bits & 0xff
    bytes[26] = (bits >> 8) & 0xff
    bytes[27] = (bits >> 16) & 0xff
    bytes[28] = (bits >> 24) & 0xff
    expect(imageDimensions(bytes)).toEqual({ width: 200, height: 100 })
  })

  it('解析 WEBP VP8X（扩展，画布宽高-1 三字节小端）', () => {
    const bytes = new Uint8Array(30)
    bytes.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0], 0)
    bytes.set([0x57, 0x45, 0x42, 0x50], 8)
    bytes.set([0x56, 0x50, 0x38, 0x58], 12) // 'VP8X'
    // 宽-1 = 319 (0x13F)、高-1 = 239 (0x0EF)
    bytes.set([0x3f, 0x01, 0x00], 24)
    bytes.set([0xef, 0x00, 0x00], 27)
    expect(imageDimensions(bytes)).toEqual({ width: 320, height: 240 })
  })

  it('非图片字节与过短输入返回 null', () => {
    expect(imageDimensions(new Uint8Array(0))).toBeNull()
    expect(imageDimensions(new TextEncoder().encode('hello world!'))).toBeNull()
    // PNG 签名但长度不足
    expect(imageDimensions(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBeNull()
  })
})

describe('formatImageBytes 体积格式化', () => {
  it('空/非法输入返回空串', () => {
    expect(formatImageBytes(0)).toBe('')
    expect(formatImageBytes(-5)).toBe('')
    expect(formatImageBytes(Number.NaN)).toBe('')
  })

  it('B / KB / MB 分级与整数化', () => {
    expect(formatImageBytes(512)).toBe('512 B')
    expect(formatImageBytes(2048)).toBe('2 KB')
    expect(formatImageBytes(1536)).toBe('1.5 KB')
    expect(formatImageBytes(150 * 1024)).toBe('150 KB')
    expect(formatImageBytes(1.5 * 1024 * 1024)).toBe('1.5 MB')
  })
})

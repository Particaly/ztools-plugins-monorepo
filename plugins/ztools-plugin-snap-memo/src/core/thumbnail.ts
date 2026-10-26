/**
 * 缩略图生成（DOM 运行时模块）：原图字节 → 解码 → canvas 缩小 → dataURL。
 * 只在函数体内使用 Image/canvas，模块顶层不触碰 DOM，保证 node 测试环境可安全导入。
 * 不引入 Vue / platform 依赖。
 */

/** 列表折叠行缩略图的最大边（px）：展示最大约 96px，按 2x 供给保证高分屏清晰。 */
export const THUMB_SMALL_MAX = 192
/** 悬浮快览大图的最大边（px）：展示约 240px，按 2x 供给。 */
export const THUMB_LARGE_MAX = 480

export interface GeneratedThumb {
  /** 缩小后的 dataURL（独立于输入 source，调用方可立即释放 source）。 */
  dataUrl: string
  /** 源图原始像素尺寸（顺带返回，供列表徽标与布局使用）。 */
  width: number
  height: number
}

/**
 * 生成不超过 maxDim 的缩略图 dataURL。
 * 始终经 canvas 重编码为独立 dataURL（源是 Blob URL 也不会被缓存引用，调用方可立即 revoke）；
 * 解码或 canvas 失败（损坏图 / 超大画布）返回 null，由调用方回退或标记失败。
 */
export async function generateThumb(source: string, maxDim: number): Promise<GeneratedThumb | null> {
  try {
    const img = new Image()
    img.decoding = 'async'
    const loaded = new Promise<boolean>((resolve) => {
      img.onload = () => resolve(true)
      img.onerror = () => resolve(false)
    })
    img.src = source
    const ok = await loaded
    if (!ok) return null
    const width = img.naturalWidth
    const height = img.naturalHeight
    if (!width || !height) return null
    const scale = Math.min(1, maxDim / Math.max(width, height))
    const w = Math.max(1, Math.round(width * scale))
    const h = Math.max(1, Math.round(height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, w, h)
    // webp 体积最优；不支持的引擎会静默回退 png，仍是合法图片
    return { dataUrl: canvas.toDataURL('image/webp', 0.85), width, height }
  } catch {
    return null
  }
}

/** 字节 → Blob URL（展示路径用；比 dataURL 字符串省内存，淘汰时 revoke 即释放）。 */
export function bytesToBlobUrl(bytes: Uint8Array, mime: string): string {
  return URL.createObjectURL(new Blob([bytes], { type: mime }))
}

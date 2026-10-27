/**
 * 图片悬浮窗尺寸计算（纯函数）：按原图比例适配窗口。
 * - 最小 360×280：过小的图片也有舒适窗口，不至于小到难以辨认与操作；
 * - 初始尺寸不超过所在屏幕工作区（扣除任务栏）宽高的 80%；
 * - 小图最多放大 2 倍，避免马赛克式铺满；
 * - 80% 只约束程序给出的初始值：窗口不设 max 尺寸约束，用户可手动拖拽超过。
 */

/** 窗口最小宽/高（px）。 */
export const FLOAT_WIN_MIN_W = 360
export const FLOAT_WIN_MIN_H = 280

/** 无图片尺寸信息时的兜底窗口（仍受屏幕 80% 与最小值夹取）。 */
export const FLOAT_WIN_DEFAULT_W = 560
export const FLOAT_WIN_DEFAULT_H = 420

/** 小图相对原图像素的放大上限。 */
export const FLOAT_WIN_MAX_UPSCALE = 2

/** 初始窗口占所在屏幕工作区宽/高的最大比例。 */
export const FLOAT_WIN_MAX_SCREEN_RATIO = 0.8

export interface FloatWinImageSize {
  width: number
  height: number
}

/**
 * 计算悬浮窗初始尺寸：原图比例放进屏幕工作区 80% 内，
 * 再按最小值与放大上限夹取；未知尺寸（≤0）走兜底窗口。
 */
export function fitFloatWindowSize(
  image: FloatWinImageSize,
  workArea: FloatWinImageSize
): { width: number; height: number } {
  const maxW = Math.max(FLOAT_WIN_MIN_W, Math.floor(workArea.width * FLOAT_WIN_MAX_SCREEN_RATIO))
  const maxH = Math.max(FLOAT_WIN_MIN_H, Math.floor(workArea.height * FLOAT_WIN_MAX_SCREEN_RATIO))
  const hasSize = image.width > 0 && image.height > 0
  if (!hasSize) {
    return {
      width: Math.min(maxW, Math.max(FLOAT_WIN_MIN_W, FLOAT_WIN_DEFAULT_W)),
      height: Math.min(maxH, Math.max(FLOAT_WIN_MIN_H, FLOAT_WIN_DEFAULT_H))
    }
  }
  const scale = Math.min(maxW / image.width, maxH / image.height, FLOAT_WIN_MAX_UPSCALE)
  return {
    width: Math.min(maxW, Math.max(FLOAT_WIN_MIN_W, Math.round(image.width * scale))),
    height: Math.min(maxH, Math.max(FLOAT_WIN_MIN_H, Math.round(image.height * scale)))
  }
}

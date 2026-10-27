import { describe, expect, it } from 'vitest'
import { fitFloatWindowSize } from '../src/core/floatWindow'

/** 1920×1080 屏幕（扣除任务栏）的典型工作区。 */
const WORK_1920 = { width: 1920, height: 1040 }

describe('fitFloatWindowSize 悬浮窗初始尺寸', () => {
  it('大图按比例适配，不超过屏幕工作区 80%', () => {
    // 4000×3000 → 高度方向受限：1040*0.8=832 → 1109×832
    const size = fitFloatWindowSize({ width: 4000, height: 3000 }, WORK_1920)
    expect(size.width).toBe(Math.round((4000 * 832) / 3000))
    expect(size.height).toBe(832)
    expect(size.width).toBeLessThanOrEqual(WORK_1920.width * 0.8)
    expect(size.height).toBeLessThanOrEqual(WORK_1920.height * 0.8)
  })

  it('超大横图宽度受限且保持比例', () => {
    const size = fitFloatWindowSize({ width: 5000, height: 1000 }, WORK_1920)
    expect(size.width).toBe(Math.floor(1920 * 0.8))
    expect(size.height).toBe(Math.round((1000 * size.width) / 5000))
  })

  it('小图放大不超过 2 倍且不低于最小窗口', () => {
    // 100×80 → 放大 2 倍 = 200×160 → 不足最小值，抬到 360×280
    const size = fitFloatWindowSize({ width: 100, height: 80 }, WORK_1920)
    expect(size).toEqual({ width: 360, height: 280 })
  })

  it('中等小图放大 2 倍后仍高于最小值时保留放大结果', () => {
    // 200×150 → 2 倍 = 400×300，均高于最小值
    const size = fitFloatWindowSize({ width: 200, height: 150 }, WORK_1920)
    expect(size).toEqual({ width: 400, height: 300 })
  })

  it('未知尺寸走兜底窗口并受 80% 与最小值夹取', () => {
    expect(fitFloatWindowSize({ width: 0, height: 0 }, WORK_1920)).toEqual({ width: 560, height: 420 })
    // 极小屏幕：兜底 560 超过 80% 时被压回
    const tiny = fitFloatWindowSize({ width: 0, height: 0 }, { width: 600, height: 500 })
    expect(tiny.width).toBe(480) // 600*0.8
    expect(tiny.height).toBe(400) // 500*0.8
  })

  it('极小屏幕：最小窗口优先于 80% 比例', () => {
    const size = fitFloatWindowSize({ width: 3000, height: 2000 }, { width: 400, height: 300 })
    expect(size).toEqual({ width: 360, height: 280 })
  })

  it('保持原图宽高比（近似）', () => {
    const size = fitFloatWindowSize({ width: 1920, height: 1080 }, WORK_1920)
    expect(size.width / size.height).toBeCloseTo(1920 / 1080, 2)
  })
})

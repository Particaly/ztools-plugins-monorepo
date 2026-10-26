import { describe, expect, it } from 'vitest'
import { frecencyScore } from '../src/core/frecency'

const NOW = 1_700_000_000_000
const DAY = 24 * 3600_000

describe('frecencyScore', () => {
  it('无任何时间信息返回 0', () => {
    expect(frecencyScore(0, null, NOW)).toBe(0)
    expect(frecencyScore(5, null, NOW)).toBe(0)
  })

  it('从未使用但带 createdAt：按创建时间参与衰减（新条目不沉底）', () => {
    const fresh = frecencyScore(0, null, NOW, NOW - 3600_000)
    expect(fresh).toBeGreaterThan(0)
    // 无 createdAt 时必须为 0（区分未知与新建）
    expect(frecencyScore(0, null, NOW)).toBe(0)
  })

  it('刚创建的条目排在一个月前用过一次的旧条目之前', () => {
    const fresh = frecencyScore(0, null, NOW, NOW - 3600_000)
    const stale = frecencyScore(1, NOW - 40 * DAY, NOW)
    expect(fresh).toBeGreaterThan(stale)
  })

  it('越近使用分越高（同次数）', () => {
    const old = frecencyScore(3, NOW - 60 * DAY, NOW)
    const month = frecencyScore(3, NOW - 10 * DAY, NOW)
    const week = frecencyScore(3, NOW - 2 * DAY, NOW)
    const day = frecencyScore(3, NOW - 1 * 3600_000, NOW)
    expect(day).toBeGreaterThan(week)
    expect(week).toBeGreaterThan(month)
    expect(month).toBeGreaterThan(old)
    expect(old).toBeGreaterThan(0)
  })

  it('次数越多分越高（对数压缩）', () => {
    const low = frecencyScore(1, NOW - 1 * 3600_000, NOW)
    const high = frecencyScore(100, NOW - 1 * 3600_000, NOW)
    expect(high).toBeGreaterThan(low)
    // 对数压缩：100 次不应是 1 次的 100 倍
    expect(high / low).toBeLessThan(10)
  })

  it('从未使用与使用一次在同一天时分值一致（按 1 次计）', () => {
    const t = NOW - 3600_000
    expect(frecencyScore(0, null, NOW, t)).toBe(frecencyScore(1, t, NOW))
  })
})

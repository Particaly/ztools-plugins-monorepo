/**
 * frecency 评分：使用次数（对数压缩）× 最近活跃时间衰减因子。
 * 从未使用的条目以创建时间作为活跃时间参与衰减（权重按使用 1 次计），
 * 保证刚保存的条目不会沉到所有“用过一次”的旧条目之后。
 * 纯函数，便于单测与排序复用。
 */

const HOUR = 3600_000
const DAY = 24 * HOUR

/**
 * 计算一条备忘的 frecency 分。
 * @param useCount 历史使用次数
 * @param lastUsedAt 最近使用时间戳；null 表示从未使用（改用 createdAt 计衰减）
 * @param now 当前时间（默认 Date.now()，测试可注入）
 * @param createdAt 创建时间；lastUsedAt 为 null 时作为活跃时间
 */
export function frecencyScore(
  useCount: number,
  lastUsedAt: number | null,
  now: number = Date.now(),
  createdAt?: number
): number {
  const activeAt = lastUsedAt ?? createdAt ?? null
  if (activeAt === null) return 0
  const age = now - activeAt
  let factor: number
  if (age < DAY) factor = 4
  else if (age < 7 * DAY) factor = 2
  else if (age < 30 * DAY) factor = 1
  else factor = 0.5
  // 从未使用按 1 次计（log2(2)=1），刚创建的条目获得与“今天用过一次”同级的新近度
  const count = Math.max(1, useCount)
  return Math.log2(1 + count) * factor
}

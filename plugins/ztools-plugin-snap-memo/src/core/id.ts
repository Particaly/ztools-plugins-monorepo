import { nanoid } from 'nanoid'

/**
 * 生成备忘 ID：时间戳前缀（前 8 位毫秒十六进制）保证新建条目天然按时间排序，
 * 后接 nanoid(10) 保证同一毫秒内不冲突；整体保持 URL/文档 ID 安全。
 */
export function newMemoId(now: number = Date.now()): string {
  return `${now.toString(36)}${nanoid(10)}`
}

/** 生成分组 ID。 */
export function newGroupId(now: number = Date.now()): string {
  return `g${now.toString(36)}${nanoid(6)}`
}

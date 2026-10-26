import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION, migrateGroups, migrateMemo, migrateSettings } from '../src/core/migration'

describe('migrateMemo', () => {
  it('v0 的 tag/category 迁移到 tags/groupId', () => {
    const memo = migrateMemo({ id: 'a1', content: 'x', tag: '话术', category: '旧分组', schemaVersion: 0 })
    expect(memo).toMatchObject({ id: 'a1', tags: ['话术'], groupId: null })
    expect(memo).not.toHaveProperty('tag')
    expect(memo).not.toHaveProperty('category')
  })

  it('无 schemaVersion 视为 v0 并迁移', () => {
    const memo = migrateMemo({ id: 'b2', content: 'x', tag: 't' })
    expect(memo?.tags).toEqual(['t'])
  })

  it('当前版本直接归一化', () => {
    const memo = migrateMemo({ id: 'c3', content: 'x', tags: ['t'], schemaVersion: CURRENT_SCHEMA_VERSION })
    expect(memo?.tags).toEqual(['t'])
  })

  it('更高版本向前容忍（不抛错）', () => {
    const memo = migrateMemo({ id: 'd4', content: 'x', futureField: { a: 1 }, schemaVersion: CURRENT_SCHEMA_VERSION + 2 })
    expect(memo?.id).toBe('d4')
  })

  it('坏文档隔离', () => {
    expect(migrateMemo({ content: 'no id' })).toBeNull()
  })
})

describe('migrateSettings', () => {
  it('v0 的 enterBehavior 更名 enterAction', () => {
    const s = migrateSettings({ enterBehavior: 'copy', schemaVersion: 0 })
    expect(s.enterAction).toBe('copy')
    expect(s).not.toHaveProperty('enterBehavior')
  })

  it('缺失设置返回默认', () => {
    expect(migrateSettings(null).enterAction).toBe('paste')
    expect(migrateSettings(undefined).sortBy).toBe('smart')
  })
})

describe('migrateGroups', () => {
  it('列表整体容错', () => {
    const groups = migrateGroups([{ id: 'g', name: 'n' }, { id: '' }, 'x', null])
    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBe('n')
  })
})

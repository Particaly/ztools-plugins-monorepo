import { describe, expect, it } from 'vitest'
import { sanitizeGroup, sanitizeGroupList, sanitizeMemo, sanitizeSettings } from '../src/core/sanitize'

describe('sanitizeMemo 脏数据容错', () => {
  it('完整数据原样通过', () => {
    const memo = sanitizeMemo({
      id: 'a1',
      title: '标题',
      content: '内容',
      groupId: 'g1',
      tags: ['t1'],
      pinned: true,
      sensitive: false,
      order: 3,
      useCount: 2,
      lastUsedAt: 100,
      createdAt: 50,
      updatedAt: 60
    })
    expect(memo).not.toBeNull()
    expect(memo).toMatchObject({ id: 'a1', title: '标题', groupId: 'g1', pinned: true, order: 3 })
  })

  it('缺 id 的坏文档被隔离（null）', () => {
    expect(sanitizeMemo({ title: 'x', content: 'y' })).toBeNull()
    expect(sanitizeMemo(null)).toBeNull()
    expect(sanitizeMemo('string')).toBeNull()
    expect(sanitizeMemo(42)).toBeNull()
  })

  it('字段类型错误回退默认值而不丢条目', () => {
    const memo = sanitizeMemo({
      id: 'b2',
      content: 123,
      title: 42,
      tags: ['ok', 5, '  ', null],
      pinned: 'yes',
      order: 'x',
      useCount: -3,
      lastUsedAt: 'bad',
      createdAt: 'bad'
    })
    expect(memo).not.toBeNull()
    expect(memo?.content).toBe('')
    expect(memo?.title).toBe('')
    expect(memo?.tags).toEqual(['ok'])
    expect(memo?.pinned).toBe(false)
    expect(memo?.useCount).toBe(0)
    expect(memo?.lastUsedAt).toBeNull()
    expect(Number.isFinite(memo?.createdAt ?? NaN)).toBe(true)
  })

  it('标签数量与长度收敛', () => {
    const many = Array.from({ length: 12 }, (_, i) => `t${i}xxxxxxxxxxxxxxxxxxxxxxxxx`)
    const memo = sanitizeMemo({ id: 'c3', tags: many })
    expect(memo?.tags).toHaveLength(8)
    expect(memo?.tags[0].length).toBeLessThanOrEqual(24)
  })

  it('keyword 空串收敛为 undefined，超长截断到 60', () => {
    expect(sanitizeMemo({ id: 'd4', keyword: '   ' })?.keyword).toBeUndefined()
    expect(sanitizeMemo({ id: 'd5', keyword: 'addr' })?.keyword).toBe('addr')
    expect(sanitizeMemo({ id: 'd6', keyword: 'k'.repeat(300) })?.keyword).toHaveLength(60)
  })

  it('超长 content/ocrText/title 截断保留（防坏文档拖垮内存与检索）', () => {
    const m = sanitizeMemo({
      id: 'e1',
      title: '标'.repeat(50_000),
      content: '内'.repeat(600_000),
      ocrText: '字'.repeat(100_000)
    })
    expect(m).not.toBeNull()
    expect((m?.content.length ?? 0)).toBeLessThan(600_000)
    expect((m?.ocrText?.length ?? 0)).toBeLessThanOrEqual(32 * 1024 / 3 + 1)
    expect((m?.title.length ?? 0)).toBeLessThan(50_000)
  })

  it('createdAt 缺失时优先借用 updatedAt（保持排序稳定）', () => {
    expect(sanitizeMemo({ id: 'f1', content: 'x', updatedAt: 4242 })?.createdAt).toBe(4242)
  })

  it('旧版软删除字段（deletedAt）被忽略（回收站已移除）', () => {
    const m = sanitizeMemo({ id: 'f2', content: 'x', deletedAt: 123 })
    expect(m).not.toBeNull()
    expect(m).not.toHaveProperty('deletedAt')
  })
})

describe('sanitizeGroup / sanitizeGroupList', () => {
  it('坏分组过滤、合法分组保留', () => {
    const list = sanitizeGroupList([
      { id: 'g1', name: '工作', color: '#4f6ef7' },
      { id: '', name: '坏' },
      { id: 'g2' },
      'junk',
      null
    ])
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id: 'g1', name: '工作', color: '#4f6ef7' })
  })

  it('非法颜色被清除', () => {
    expect(sanitizeGroup({ id: 'g', name: 'n', color: 'red' })?.color).toBeUndefined()
  })
})

describe('sanitizeSettings', () => {
  it('坏设置整体回退默认', () => {
    expect(sanitizeSettings(null)).toMatchObject({ enterAction: 'paste', sortBy: 'smart' })
    expect(sanitizeSettings('junk').density).toBe('comfortable')
  })

  it('非法枚举值回退默认', () => {
    const s = sanitizeSettings({ enterAction: 'hack', sortBy: 'random', density: 'big' })
    expect(s.enterAction).toBe('paste')
    expect(s.sortBy).toBe('smart')
    expect(s.density).toBe('comfortable')
  })

  it('合法值保留', () => {
    const s = sanitizeSettings({ enterAction: 'copy', sortBy: 'manual', density: 'compact', recordUsage: false })
    expect(s).toMatchObject({ enterAction: 'copy', sortBy: 'manual', density: 'compact', recordUsage: false })
  })
})

describe('sanitizeMemo 图片字段（图文混排模型）', () => {
  it('kind=image 与 mime/ocrText/imageHash 合法值保留（旧结构合成为 images[0]）', () => {
    const m = sanitizeMemo({
      id: 'img1',
      content: '',
      kind: 'image',
      mime: 'Image/PNG',
      imageHash: 'ab12cd34',
      ocrText: '识别文字'
    })
    // 旧结构升级：槽 ID 复用 memoId，正文补图片标记，kind 保持纯图
    expect(m).toMatchObject({ kind: 'image', content: '{img:img1}' })
    expect(m?.images?.[0]).toMatchObject({ id: 'img1', mime: 'image/png', hash: 'ab12cd34', ocrText: '识别文字' })
    expect(m?.ocrText).toBe('识别文字')
    // v1 单图字段不再出现在归一化结果里
    expect(m?.imageHash).toBeUndefined()
    expect(m?.mime).toBeUndefined()
  })

  it('图文混排（文字 + 标记）kind 为 text；纯图（只有标记）kind 为 image', () => {
    const mixed = sanitizeMemo({
      id: 'm1',
      content: '看这张\n{img:slotA}',
      images: [{ id: 'slotA', mime: 'image/png', hash: 'h1', width: 10, height: 10, bytes: 5 }]
    })
    expect(mixed?.kind).toBe('text')
    const pure = sanitizeMemo({
      id: 'm2',
      content: '{img:slotB}',
      images: [{ id: 'slotB', mime: 'image/png', hash: 'h2', width: 10, height: 10, bytes: 5 }]
    })
    expect(pure?.kind).toBe('image')
  })

  it('携带图片但正文没有标记时补写首图标记（图片不隐形）', () => {
    const m = sanitizeMemo({
      id: 'm3',
      content: '只有文字',
      images: [{ id: 's', mime: 'image/png', hash: 'h', width: 1, height: 1, bytes: 1 }]
    })
    expect(m?.content.startsWith('{img:s}')).toBe(true)
    expect(m?.content).toContain('只有文字')
  })

  it('多图 ocrText 合并为检索视图', () => {
    const m = sanitizeMemo({
      id: 'm4',
      content: '{img:a}{img:b}',
      images: [
        { id: 'a', mime: 'image/png', hash: 'h1', width: 1, height: 1, bytes: 1, ocrText: '第一张' },
        { id: 'b', mime: 'image/png', hash: 'h2', width: 1, height: 1, bytes: 1, ocrText: '第二张' }
      ]
    })
    expect(m?.ocrText).toBe('第一张\n第二张')
  })

  it('images 数组逐项归一化：坏项丢弃、缺 id 丢弃', () => {
    const m = sanitizeMemo({
      id: 'm5',
      content: '{img:ok}',
      images: [{ id: 'ok', mime: 'image/png', hash: 'h', width: 3, height: 4, bytes: 9 }, { noId: true }, 'junk', null]
    })
    expect(m?.images).toHaveLength(1)
    expect(m?.images?.[0]).toMatchObject({ id: 'ok', width: 3, height: 4, bytes: 9 })
  })

  it('kind 非法值收敛为 text，mime 非图片格式被清除', () => {
    const m = sanitizeMemo({ id: 'x', kind: 'video', mime: 'text/html', ocrText: '   ' })
    expect(m?.kind).toBe('text')
    expect(m?.images).toBeUndefined()
    expect(m?.ocrText).toBeUndefined()
  })

  it('缺省 kind 视为 text', () => {
    expect(sanitizeMemo({ id: 'y', content: 'hi' })?.kind).toBe('text')
  })
})

describe('sanitizeSettings 图片 OCR 配置', () => {
  it('缺省关闭 OCR', () => {
    expect(sanitizeSettings(null)).toMatchObject({ imageOcrEnabled: false })
  })

  it('开关布尔值保留，非法值回退默认（关闭）', () => {
    expect(sanitizeSettings({ imageOcrEnabled: true }).imageOcrEnabled).toBe(true)
    expect(sanitizeSettings({ imageOcrEnabled: 'yes' }).imageOcrEnabled).toBe(false)
  })

  it('旧版遗留字段（如 ocrModel）被忽略不报错', () => {
    const s = sanitizeSettings({ imageOcrEnabled: true, ocrModel: 'legacy-model' })
    expect(s.imageOcrEnabled).toBe(true)
    expect((s as unknown as Record<string, unknown>).ocrModel).toBeUndefined()
  })
})

describe('sanitizeMemo 图片尺寸元数据', () => {
  it('合法宽高与字节数保留（随旧结构进入 images[0]）', () => {
    const m = sanitizeMemo({
      id: 'i1',
      kind: 'image',
      imageHash: 'abcd',
      imageWidth: 3024,
      imageHeight: 4032,
      imageBytes: 1234567
    })
    expect(m?.images?.[0]).toMatchObject({ id: 'i1', width: 3024, height: 4032, bytes: 1234567 })
  })

  it('非正数 / 非数字收敛为 0（缩略图管线实测兜底）', () => {
    const m = sanitizeMemo({
      id: 'i2',
      kind: 'image',
      imageHash: 'abcd',
      imageWidth: 0,
      imageHeight: -3,
      imageBytes: 'big'
    })
    expect(m?.images?.[0]?.width).toBe(0)
    expect(m?.images?.[0]?.height).toBe(0)
    expect(m?.images?.[0]?.bytes).toBe(0)
  })

  it('无 imageHash 的孤儿尺寸字段被丢弃（不合成空图）', () => {
    const m = sanitizeMemo({ id: 'i3', kind: 'image', imageWidth: 3024, imageHeight: 4032 })
    expect(m?.images).toBeUndefined()
    expect(m?.kind).toBe('text')
  })
})

describe('sanitizeSettings 网格视图偏好', () => {
  it('缺省为列表视图（false）', () => {
    expect(sanitizeSettings(null).imageGridView).toBe(false)
  })

  it('布尔值保留，非法值回退默认', () => {
    expect(sanitizeSettings({ imageGridView: true }).imageGridView).toBe(true)
    expect(sanitizeSettings({ imageGridView: 'on' }).imageGridView).toBe(false)
  })
})

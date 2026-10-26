import { beforeEach, describe, expect, it } from 'vitest'
import { clearPinyinCache, getPinyinIndex } from '../src/core/pinyin'
import {
  buildSearchEntry,
  clearSearchEntryCache,
  getCachedSearchEntry,
  highlightRanges,
  parseQuery,
  searchMemos,
  sortNoQuery,
  type SearchEntry
} from '../src/core/search'
import type { Group, Memo } from '../src/core/types'

beforeEach(() => {
  clearPinyinCache()
  clearSearchEntryCache()
})

function makeMemo(partial: Partial<Memo>): Memo {
  return {
    id: partial.id ?? 'm1',
    title: '',
    content: '',
    groupId: null,
    tags: [],
    pinned: false,
    sensitive: false,
    order: 0,
    useCount: 0,
    lastUsedAt: null,
    createdAt: 1,
    updatedAt: 1,
    ...partial
  }
}

const groups: Group[] = [
  { id: 'g1', name: '工作', order: 1 },
  { id: 'g2', name: '日常', order: 2 }
]

const memos: Memo[] = [
  makeMemo({ id: 'm1', title: '会议延期回复', content: '今天的会议延期举行，敬请谅解', groupId: 'g1', tags: ['话术'] }),
  makeMemo({ id: 'm2', title: 'Address', content: 'Hangzhou West Lake', groupId: 'g2', tags: ['地址'] }),
  makeMemo({ id: 'm3', title: '接口文档模板', content: 'GET /api/v1/users', groupId: 'g1' })
]

function entriesOf(list: Memo[], gs: Group[]): SearchEntry[] {
  return list.map((m) => buildSearchEntry(m, gs.find((g) => g.id === m.groupId)?.name ?? ''))
}

describe('拼音索引', () => {
  it('中文生成全拼与声母', () => {
    const idx = getPinyinIndex('会议延期')
    expect(idx.full).toBe('huiyiyanqi')
    expect(idx.initials).toBe('hyyq')
  })

  it('非中文原样小写', () => {
    expect(getPinyinIndex('Hello')).toEqual({ full: 'hello', initials: 'hello' })
  })
})

describe('parseQuery', () => {
  it('空白分词 + #/@ 过滤语法', () => {
    const q = parseQuery('会议 #话术 @工作')
    expect(q.tokens).toEqual(['会议'])
    expect(q.tagFilters).toEqual(['话术'])
    expect(q.groupFilters).toEqual(['工作'])
  })

  it('大小写与全角归一', () => {
    const q = parseQuery('Ａｄｄｒｅｓｓ')
    expect(q.tokens).toEqual(['address'])
  })

  it('排除词与引号短语', () => {
    const q = parseQuery('会议 -延期 " West Lake "')
    expect(q.tokens).toEqual(['会议'])
    expect(q.excludes).toEqual(['延期'])
    expect(q.phrases).toEqual(['west lake'])
  })

  it('未闭合引号不产生短语', () => {
    expect(parseQuery('"abc').phrases).toEqual([])
  })
})

describe('searchMemos', () => {
  it('标题直接命中', () => {
    const rs = searchMemos(memos, entriesOf(memos, groups), '会议')
    expect(rs.map((r) => r.memo.id)).toContain('m1')
  })

  it('中文全拼命中', () => {
    const rs = searchMemos(memos, entriesOf(memos, groups), 'huiyi')
    expect(rs.map((r) => r.memo.id)).toContain('m1')
  })

  it('拼音首字母命中', () => {
    const rs = searchMemos(memos, entriesOf(memos, groups), 'hyyq')
    expect(rs.map((r) => r.memo.id)).toContain('m1')
  })

  it('标签拼音命中', () => {
    const rs = searchMemos(memos, entriesOf(memos, groups), 'huashu')
    expect(rs.map((r) => r.memo.id)).toContain('m1')
  })

  it('内容命中（中英混合）', () => {
    const rs = searchMemos(memos, entriesOf(memos, groups), 'users')
    expect(rs.map((r) => r.memo.id)).toContain('m3')
    const rs2 = searchMemos(memos, entriesOf(memos, groups), 'west lake')
    expect(rs2.map((r) => r.memo.id)).toContain('m2')
  })

  it('长内容第 2000 字之后的关键词仍可命中（字面全文索引）', () => {
    const head = 'a'.repeat(2500)
    const list = [makeMemo({ id: 'long', title: '长文', content: `${head}\n尾部的会议纪要` })]
    const rs = searchMemos(list, entriesOf(list, []), '会议纪要')
    expect(rs.map((r) => r.memo.id)).toEqual(['long'])
  })

  it('#标签 过滤', () => {
    const rs = searchMemos(memos, entriesOf(memos, groups), '#话术')
    expect(rs.map((r) => r.memo.id)).toEqual(['m1'])
  })

  it('@分组 过滤', () => {
    const rs = searchMemos(memos, entriesOf(memos, groups), '@工作')
    expect(rs.map((r) => r.memo.id).sort()).toEqual(['m1', 'm3'])
  })

  it('@分组 支持拼音（与 #标签 行为一致）', () => {
    const rs = searchMemos(memos, entriesOf(memos, groups), '@gongzuo')
    expect(rs.map((r) => r.memo.id).sort()).toEqual(['m1', 'm3'])
  })

  it('多词 AND 语义', () => {
    const rs = searchMemos(memos, entriesOf(memos, groups), '会议 延期')
    expect(rs.map((r) => r.memo.id)).toContain('m1')
    const none = searchMemos(memos, entriesOf(memos, groups), '会议 Hangzhou')
    expect(none).toHaveLength(0)
  })

  it('排除词：命中的条目被剔除', () => {
    const rs = searchMemos(memos, entriesOf(memos, groups), '会议 -延期')
    expect(rs).toHaveLength(0)
    const rs2 = searchMemos(memos, entriesOf(memos, groups), 'api -users')
    expect(rs2).toHaveLength(0)
  })

  it('引号短语：原文需连续包含', () => {
    const rs = searchMemos(memos, entriesOf(memos, groups), '"west lake"')
    expect(rs.map((r) => r.memo.id)).toContain('m2')
    const none = searchMemos(memos, entriesOf(memos, groups), '"lake west"')
    expect(none).toHaveLength(0)
  })

  it('标题命中排序高于内容命中', () => {
    const list = [
      makeMemo({ id: 'a', title: '', content: '采购订单模板' }),
      makeMemo({ id: 'b', title: '采购订单模板', content: '其他' })
    ]
    const rs = searchMemos(list, entriesOf(list, []), '采购')
    expect(rs[0].memo.id).toBe('b')
  })

  it('搜索结果中置顶条目恒优先（与无搜索词时一致）', () => {
    const list = [
      makeMemo({ id: 'a', title: '采购模板', content: 'x', pinned: false }),
      makeMemo({ id: 'b', title: '别的', content: '采购相关内容也很长很长', pinned: true })
    ]
    const rs = searchMemos(list, entriesOf(list, []), '采购')
    expect(rs[0].memo.id).toBe('b')
  })
})

describe('getCachedSearchEntry 条目缓存', () => {
  it('未编辑时跨调用复用同一对象', () => {
    const m = memos[0]!
    const a = getCachedSearchEntry(m, '工作')
    const b = getCachedSearchEntry(m, '工作')
    expect(a).toBe(b)
  })

  it('updatedAt 或分组名变化后重建', () => {
    const m = memos[0]!
    const a = getCachedSearchEntry(m, '工作')
    const edited = { ...m, updatedAt: m.updatedAt + 1 }
    const b = getCachedSearchEntry(edited, '工作')
    expect(a).not.toBe(b)
    const c = getCachedSearchEntry(edited, '日常')
    expect(b).not.toBe(c)
  })
})

describe('sortNoQuery', () => {
  it('置顶恒优先', () => {
    const list = [
      makeMemo({ id: 'a', pinned: false, order: 1 }),
      makeMemo({ id: 'b', pinned: true, order: 9 })
    ]
    expect(sortNoQuery(list, 'manual')[0].id).toBe('b')
    expect(sortNoQuery(list, 'smart')[0].id).toBe('b')
  })

  it('manual 按 order 升序', () => {
    const list = [makeMemo({ id: 'a', order: 5 }), makeMemo({ id: 'b', order: 2 })]
    expect(sortNoQuery(list, 'manual').map((m) => m.id)).toEqual(['b', 'a'])
  })

  it('smart 按 frecency', () => {
    const now = 1_000_000
    const list = [
      makeMemo({ id: 'a', useCount: 1, lastUsedAt: now - 1000 }),
      makeMemo({ id: 'b', useCount: 9, lastUsedAt: now - 100 })
    ]
    expect(sortNoQuery(list, 'smart', now)[0].id).toBe('b')
  })

  it('smart：刚创建未使用的条目不沉底', () => {
    const now = 1_000_000_000
    const list = [
      makeMemo({ id: 'old', useCount: 3, lastUsedAt: now - 40 * 24 * 3600_000 }),
      makeMemo({ id: 'fresh', createdAt: now - 1000 })
    ]
    expect(sortNoQuery(list, 'smart', now)[0].id).toBe('fresh')
  })
})

describe('highlightRanges', () => {
  it('普通词高亮区间（半开、合并重叠）', () => {
    expect(highlightRanges('Hello world, hello!', 'hello')).toEqual([
      [0, 5],
      [13, 18]
    ])
  })

  it('中文词高亮', () => {
    expect(highlightRanges('会议延期了', '延期')).toEqual([[2, 4]])
  })

  it('全角查询命中半角原文时高亮位置正确（NFKC 映射回原文下标）', () => {
    expect(highlightRanges('QQ群 123', 'ｑｑ')).toEqual([[0, 2]])
  })

  it('短语高亮', () => {
    expect(highlightRanges('West Lake Park', '"west lake"')).toEqual([[0, 9]])
  })

  it('无命中返回空', () => {
    expect(highlightRanges('abc', 'zzz')).toEqual([])
  })
})

describe('图片 OCR 文本检索', () => {
  const imageMemos: Memo[] = [
    makeMemo({ id: 'img1', title: '截图', content: '', kind: 'image', ocrText: '会议纪要：下周三评审' }),
    makeMemo({ id: 'img2', title: '合同照片', content: '', kind: 'image', ocrText: 'Invoice No.20260318' }),
    makeMemo({ id: 'txt1', title: '普通文本', content: '会议纪要' })
  ]

  it('OCR 文本可被普通词命中', () => {
    const rs = searchMemos(imageMemos, entriesOf(imageMemos, groups), '评审')
    expect(rs.map((r) => r.memo.id)).toEqual(['img1'])
  })

  it('OCR 文本英文大小写不敏感', () => {
    const rs = searchMemos(imageMemos, entriesOf(imageMemos, groups), 'invoice')
    expect(rs.map((r) => r.memo.id)).toEqual(['img2'])
  })

  it('OCR 拼音首字母可命中中文识别结果', () => {
    const rs = searchMemos(imageMemos, entriesOf(imageMemos, groups), 'hyjy')
    expect(rs.map((r) => r.memo.id)).toContain('img1')
  })

  it('无 OCR 的图片条目不参与 OCR 字段匹配', () => {
    const bare: Memo[] = [makeMemo({ id: 'img3', content: '', kind: 'image' })]
    expect(searchMemos(bare, entriesOf(bare, groups), '评审')).toHaveLength(0)
  })

  it('图片条目的文字备注参与检索（图文混排）', () => {
    const list = [makeMemo({ id: 'img4', content: '报销截图备注', kind: 'image' })]
    const rs = searchMemos(list, entriesOf(list, []), '报销')
    expect(rs.map((r) => r.memo.id)).toEqual(['img4'])
  })
})

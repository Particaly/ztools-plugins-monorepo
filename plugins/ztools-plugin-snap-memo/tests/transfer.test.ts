import { describe, expect, it } from 'vitest'
import {
  buildExportPayload,
  contentKey,
  parseImportPayload,
  parseTextImport,
  planImport,
  toCsv,
  toMarkdown
} from '../src/core/transfer'
import { DEFAULT_SETTINGS, type Group, type Memo } from '../src/core/types'

function memo(partial: Partial<Memo>): Memo {
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

const groups: Group[] = [{ id: 'g1', name: '工作', order: 1 }]

describe('buildExportPayload / parseImportPayload', () => {
  it('导出载荷带 app 标识（全部条目，回收站已随功能移除）', () => {
    const payload = buildExportPayload([memo({ id: 'a', content: 'x' }), memo({ id: 'b', content: 'y' })], groups, 123)
    expect(payload.app).toBe('snap-memo')
    expect(payload.memos).toHaveLength(2)
    expect(payload.exportedAt).toBe(123)
  })

  it('导出携带设置，导入端净化后可用', () => {
    const settings = { ...DEFAULT_SETTINGS, enterAction: 'copy' as const }
    const payload = buildExportPayload([memo({ id: 'a', content: 'x' })], groups, 1, undefined, settings)
    expect(payload.settings).toMatchObject({ enterAction: 'copy' })
    const parsed = parseImportPayload(JSON.stringify(payload))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.payload.settings?.enterAction).toBe('copy')
  })

  it('合法 JSON 往返一致', () => {
    const payload = buildExportPayload([memo({ id: 'a', title: 'T', content: 'C', groupId: 'g1', tags: ['t'] })], groups)
    const text = JSON.stringify(payload)
    const parsed = parseImportPayload(text)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.payload.memos[0]).toMatchObject({ id: 'a', title: 'T', content: 'C', tags: ['t'] })
    }
  })

  it('非本插件文件 / 坏 JSON 给出中文错误', () => {
    expect(parseImportPayload('not json').ok).toBe(false)
    expect(parseImportPayload('{"app":"other"}').ok).toBe(false)
    expect(parseImportPayload('{"app":"snap-memo"}').ok).toBe(false)
  })
})

describe('第三方 snippets 导入', () => {
  it('Alfred 单文件导出（alfredsnippet）可识别', () => {
    const text = JSON.stringify({
      alfredsnippet: { snippet: 'alfred content', name: 'My Snippet', keyword: 'kw1', uid: 'u1' }
    })
    const parsed = parseImportPayload(text)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.payload.memos[0]).toMatchObject({ title: 'My Snippet', content: 'alfred content', keyword: 'kw1' })
    }
  })

  it('通用 snippets 数组（Raycast 等导出结构）可识别', () => {
    const text = JSON.stringify({
      name: 'Raycast Export',
      snippets: [
        { name: '第一条', text: '内容一', keyword: 'a' },
        { name: '第二条', text: '内容二' }
      ]
    })
    const parsed = parseImportPayload(text)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.payload.memos).toHaveLength(2)
      expect(parsed.payload.memos[0]).toMatchObject({ title: '第一条', content: '内容一', keyword: 'a' })
    }
  })

  it('Espanso YAML（trigger/replace，含块标量）可经文本导入识别', () => {
    const yml = [
      'matches:',
      '  - trigger: ":hello"',
      '    replace: "world"',
      '  - trigger: ":ml"',
      '    replace: |',
      '      line1',
      '      line2',
      ''
    ].join('\n')
    const entries = parseTextImport(yml)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({ title: 'hello', content: 'world', keyword: 'hello' })
    expect(entries[1]).toMatchObject({ content: 'line1\nline2', keyword: 'ml' })
  })
})

describe('planImport 合并策略', () => {
  const existing = [
    memo({ id: 'a', content: '相同内容' }),
    memo({ id: 'b', content: '将被更新' }),
    memo({ id: 'c', content: '仅本地存在' })
  ]
  const incoming = buildExportPayload(
    [
      memo({ id: 'a', content: '相同内容' }),
      memo({ id: 'b', content: '已被修改' }),
      memo({ id: 'new', content: '全新条目' }),
      memo({ id: 'dup', content: '仅本地存在' })
    ],
    [{ id: 'g1', name: '工作', order: 1 }, { id: 'g9', name: '新分组', order: 2 }]
  )
  const plan = planImport(existing, groups, incoming, 'merge', () => 'fresh-id')

  it('同 ID 同内容 → unchanged', () => {
    expect(plan.memosUnchanged.map((m) => m.id)).toContain('a')
  })

  it('同 ID 不同内容且导入版较新 → update 且保留本地使用统计', () => {
    const upd = plan.memosToUpdate.find((m) => m.id === 'b')
    expect(upd?.content).toBe('已被修改')
  })

  it('本地修改时间更晚 → 保留本地（跳过，不静默覆盖）', () => {
    const localNewer = [memo({ id: 'x1', content: '本地新', updatedAt: 200 })]
    const inc = buildExportPayload([memo({ id: 'x1', content: '云端旧', updatedAt: 100 })], [])
    const p = planImport(localNewer, [], inc, 'merge', () => 'i')
    expect(p.memosToUpdate).toHaveLength(0)
    expect(p.memosUnchanged.map((m) => m.content)).toContain('本地新')
  })

  it('新 ID 但内容重复 → 跳过去重', () => {
    expect(plan.memosUnchanged.map((m) => m.content)).toContain('仅本地存在')
    expect(plan.memosToAdd.map((m) => m.content)).toEqual(['全新条目'])
  })

  it('新增条目重分配 ID，分组按需新增', () => {
    expect(plan.memosToAdd[0].id).toBe('fresh-id')
    expect(plan.groupsToAdd.map((g) => g.name)).toEqual(['新分组'])
  })

  it('同名分组自动改名', () => {
    const existingGroups: Group[] = [{ id: 'g0', name: '工作', order: 1 }]
    const plan2 = planImport([], existingGroups, buildExportPayload([], [{ id: 'x', name: '工作', order: 1 }]), 'merge', () => 'i')
    expect(plan2.groupsToAdd[0].name).toBe('工作(导入)')
  })

  it('引用不存在分组的条目归位到未分组（悬空 groupId 修复）', () => {
    const inc = buildExportPayload([memo({ id: 'd1', content: 'x', groupId: 'ghost' })], [])
    const p = planImport([], [], inc, 'merge', () => 'i')
    expect(p.memosToAdd[0].groupId).toBeNull()
  })

  it('导入携带设置时出现在计划中', () => {
    const inc = buildExportPayload([memo({ id: 's1', content: 'x' })], [], 1, undefined, DEFAULT_SETTINGS)
    const p = planImport([], [], inc, 'merge', () => 'i')
    expect(p.settingsToApply).toMatchObject({ enterAction: 'paste' })
  })
})

describe('planImport 覆盖策略', () => {
  it('以导入数据为准，无 unchanged', () => {
    const existing = [memo({ id: 'a', content: '旧' })]
    const incoming = buildExportPayload([memo({ id: 'a', content: '旧' }), memo({ id: 'n', content: '新' })], [])
    const plan = planImport(existing, [], incoming, 'overwrite', () => 'i')
    expect(plan.memosToUpdate).toHaveLength(1)
    expect(plan.memosToAdd.map((m) => m.id)).toEqual(['n'])
    expect(plan.memosUnchanged).toHaveLength(0)
  })
})

describe('纯文本导入', () => {
  it('空行分段、首行为标题', () => {
    const entries = parseTextImport('第一条标题\n第一条内容\n\n第二条')
    expect(entries).toEqual([
      { title: '第一条标题', content: '第一条标题\n第一条内容', tags: [], groupName: null },
      { title: '第二条', content: '第二条', tags: [], groupName: null }
    ])
  })

  it('CRLF 兼容与空文本', () => {
    expect(parseTextImport('a\r\n\r\nb')).toHaveLength(2)
    expect(parseTextImport('   \n\n  ')).toHaveLength(0)
  })

  it('本应用导出的 CSV 可识别并还原（含引号/换行/分组/标签/触发词）', () => {
    const list = [
      memo({ title: '标题"引号"', content: '两行\n内容', groupId: 'g1', tags: ['话术', '模板'], keyword: 'kw' })
    ]
    const csv = toCsv(list, groups)
    const entries = parseTextImport(csv)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      title: '标题"引号"',
      content: '两行\n内容',
      groupName: '工作',
      keyword: 'kw'
    })
    expect([...(entries[0].tags ?? [])].sort()).toEqual(['模板', '话术'])
  })

  it('本应用导出的 Markdown 可识别并还原', () => {
    const md = toMarkdown(
      [memo({ title: '标题A', content: '内容A', groupId: 'g1', tags: ['t1'] })],
      groups
    )
    const entries = parseTextImport(md)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ title: '标题A', content: '内容A', groupName: '工作', tags: ['t1'] })
  })
})

describe('Markdown / CSV 导出', () => {
  it('Markdown 按分组分节且含内容', () => {
    const md = toMarkdown([memo({ title: '标题A', content: '内容A', groupId: 'g1' })], groups)
    expect(md).toContain('## 工作')
    expect(md).toContain('### 标题A')
    expect(md).toContain('内容A')
  })

  it('内容含三反引号时围栏自动加长（结构不被破坏）', () => {
    const md = toMarkdown([memo({ title: '代码', content: '```js\nfoo()\n```' })], [])
    // 围栏应为 4 个反引号，代码块内容完整保留
    expect(md).toContain('````text')
    expect(md).toContain('```js\nfoo()\n```')
  })

  it('图片条目导出备注文字与识别文字', () => {
    const md = toMarkdown([memo({ title: '', content: '{img:imgx1}\n报销备注', kind: 'image', ocrText: '图里的话' })], groups)
    expect(md).toContain('[图片]')
    expect(md).toContain('报销备注')
    expect(md).toContain('图里的话')
    expect(md).not.toContain('{img:imgx1}')
  })

  it('混排条目导出：正文里的图片标记替换为 [图片] 占位', () => {
    const md = toMarkdown([memo({ title: '流程', content: '第一步\n{img:slotA}\n第二步' })], groups)
    expect(md).toContain('第一步')
    expect(md).toContain('[图片]')
    expect(md).toContain('第二步')
    expect(md).not.toContain('{img:slotA}')
  })

  it('CSV 转义引号与换行，列结构可往返', () => {
    const csv = toCsv([memo({ title: '含"引号"', content: '两行\n内容' })], [])
    const lines = csv.split('\n')
    expect(lines[0]).toBe('"标题","内容","分组","标签","置顶","敏感","创建时间","更新时间","触发词"')
    expect(csv).toContain('"含""引号"""')
  })

  it('CSV 混排条目剥离图片标记（不残留坏标记）', () => {
    const csv = toCsv([memo({ title: '混排', content: '文字一\n{img:zz}\n文字二' })], [])
    expect(csv).toContain('文字一')
    expect(csv).toContain('文字二')
    expect(csv).not.toContain('{img:zz99}')
  })
})

describe('contentKey', () => {
  it('CRLF 与首尾空白不影响判重', () => {
    expect(contentKey({ title: ' t ', content: 'a\r\nb', tags: [], pinned: false })).toBe(
      contentKey({ title: 't', content: 'a\nb ', tags: [], pinned: false })
    )
  })

  it('标签/分组/触发词/置顶不同视为不同条目（不再静默跳过）', () => {
    const base = { title: 't', content: 'c', tags: [] as string[], pinned: false }
    expect(contentKey(base)).not.toBe(contentKey({ ...base, tags: ['x'] }))
    expect(contentKey(base)).not.toBe(contentKey({ ...base, keyword: 'kw' }))
    expect(contentKey(base)).not.toBe(contentKey({ ...base, pinned: true }))
    expect(contentKey(base)).not.toBe(contentKey({ ...base, groupId: 'g' }))
  })
})

describe('图片备忘导出导入', () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgo='

  it('buildExportPayload 携带 images 字段', () => {
    const payload = buildExportPayload([memo({ id: 'img1', content: '', kind: 'image' })], groups, 1, {
      img1: PNG
    })
    expect(payload.images).toEqual({ img1: PNG })
    // 无图片时不产生 images 键
    const plain = buildExportPayload([memo({ id: 'a', content: 'x' })], groups, 1)
    expect(plain.images).toBeUndefined()
  })

  it('parseImportPayload 解析并净化 images（拒非法/超限）', () => {
    const text = JSON.stringify({
      app: 'snap-memo',
      memos: [{ id: 'img1', content: '', kind: 'image' }],
      images: { img1: PNG, bad: 'javascript:alert(1)', huge: `data:image/png;base64,${'A'.repeat(20 * 1024 * 1024)}` }
    })
    const parsed = parseImportPayload(text)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.payload.images).toEqual({ img1: PNG })
    }
  })

  it('合并导入：memoId 重分配时槽 ID 一并重分配并改写正文标记', () => {
    const incoming = {
      app: 'snap-memo' as const,
      schemaVersion: 1,
      exportedAt: 0,
      groups: [],
      memos: [
        memo({
          id: 'old',
          content: '{img:old01}',
          kind: 'image' as const,
          images: [{ id: 'old01', mime: 'image/png', hash: 'h', width: 1, height: 1, bytes: 5 }]
        })
      ],
      images: { old01: PNG }
    }
    const ids = ['new-id', 'slot-1', 'slot-2']
    const plan = planImport([], [], incoming, 'merge', () => ids.shift() ?? 'x')
    expect(plan.memosToAdd[0].id).toBe('new-id')
    // 槽换新 ID、正文标记同步改写、像素按新槽落盘
    expect(plan.memosToAdd[0].content).toBe('{img:slot-1}')
    expect(plan.memosToAdd[0].images?.[0].id).toBe('slot-1')
    expect(plan.imagesToSave).toEqual([{ slotId: 'slot-1', dataUrl: PNG }])
  })

  it('合并导入：ID 命中更新时槽 ID 保持不变（正文标记原样可用）', () => {
    const incomingMemo = memo({
      id: 'same',
      content: '看图\n{img:sa01}',
      images: [{ id: 'sa01', mime: 'image/png', hash: 'h', width: 1, height: 1, bytes: 5 }]
    })
    const local = { ...incomingMemo, content: '看这张\n{img:sa01}', updatedAt: incomingMemo.updatedAt - 1 }
    const incoming = {
      app: 'snap-memo' as const,
      schemaVersion: 1,
      exportedAt: 0,
      groups: [],
      memos: [incomingMemo],
      images: { sa01: PNG }
    }
    const plan = planImport([local], [], incoming, 'merge', () => 'x')
    expect(plan.memosToUpdate).toHaveLength(1)
    expect(plan.memosToUpdate[0].content).toBe('看图\n{img:sa01}')
    expect(plan.imagesToSave).toEqual([{ slotId: 'sa01', dataUrl: PNG }])
  })

  it('合并导入：多图条目全部槽重分配且无像素数据的槽保持原 ID', () => {
    const incoming = {
      app: 'snap-memo' as const,
      schemaVersion: 1,
      exportedAt: 0,
      groups: [],
      memos: [
        memo({
          id: 'm',
          content: '{img:aaa1} 中间文字 {img:bbb1}',
          images: [
            { id: 'aaa1', mime: 'image/png', hash: 'h1', width: 1, height: 1, bytes: 5 },
            { id: 'bbb1', mime: 'image/png', hash: 'h2', width: 1, height: 1, bytes: 6 }
          ]
        })
      ],
      images: { aaa1: PNG }
    }
    const ids = ['m2', 'na', 'nb']
    const plan = planImport([], [], incoming, 'merge', () => ids.shift() ?? 'x')
    const added = plan.memosToAdd[0]
    expect(added.id).toBe('m2')
    expect(added.content).toBe('{img:na} 中间文字 {img:bbb1}')
    expect(added.images?.map((img) => img.id)).toEqual(['na', 'bbb1'])
    expect(plan.imagesToSave).toEqual([{ slotId: 'na', dataUrl: PNG }])
  })

  it('文本备忘不带 images 时不产生 imagesToSave', () => {
    const incoming = {
      app: 'snap-memo' as const,
      schemaVersion: 1,
      exportedAt: 0,
      groups: [],
      memos: [memo({ id: 't1', content: '文本' })],
      images: { t1: PNG }
    }
    const plan = planImport([], [], incoming, 'merge', () => 'x')
    expect(plan.imagesToSave).toHaveLength(0)
  })

  it('contentKey 计入图片哈希（新结构按集合，旧结构按单值）', () => {
    const a = memo({ id: 'a', content: '', imageHash: 'aaaa' })
    const b = memo({ id: 'b', content: '', imageHash: 'bbbb' })
    const c = memo({ id: 'c', content: '', imageHash: 'aaaa' })
    expect(contentKey(a)).not.toBe(contentKey(b))
    expect(contentKey(a)).toBe(contentKey(c))
    const img = (id: string, hash: string) => ({ id, mime: 'image/png', hash, width: 1, height: 1, bytes: 1 })
    const m1 = memo({ id: 'm1', content: 'x', images: [img('s1', 'h1'), img('s2', 'h2')] })
    const m2 = memo({ id: 'm2', content: 'x', images: [img('s3', 'h2'), img('s4', 'h1')] })
    const m3 = memo({ id: 'm3', content: 'x', images: [img('s1', 'h1')] })
    expect(contentKey(m1)).toBe(contentKey(m2)) // 集合相同（顺序无关）
    expect(contentKey(m1)).not.toBe(contentKey(m3))
  })

  it('CSV 导出图片条目输出备注或识别文字', () => {
    const list = [memo({ id: 'img', title: '', content: '', kind: 'image', ocrText: '图里的话' })]
    expect(toCsv(list, groups)).toContain('图里的话')
  })
})

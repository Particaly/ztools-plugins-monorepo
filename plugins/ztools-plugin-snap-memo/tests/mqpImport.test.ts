import { describe, expect, it } from 'vitest'
import { convertMemoQuickPaste, type MqpDump } from '../src/core/mqpImport'
import { planImport } from '../src/core/transfer'

/** 构造备忘快贴原始数据快照（与 preload readHostPluginData 返回对齐）。 */
function dump(partial: Partial<MqpDump> = {}): MqpDump {
  return {
    account: 'default',
    docs: partial.docs ?? [],
    attachments: partial.attachments ?? [],
    truncated: partial.truncated ?? false
  }
}

// 8x8 红色 PNG 的最小头部不足以过 imageDimensions？——使用真实 PNG 文件头（IHDR 含宽高）
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 8, 0, 0, 0, 8,
  8, 2, 0, 0, 0
])

describe('convertMemoQuickPaste', () => {
  it('文字记录：内容、标签名解析、使用统计、置顶、创建时间都映射', () => {
    const result = convertMemoQuickPaste(
      dump({
        docs: [
          { id: 'dynamic-features', doc: { data: JSON.stringify({ features: [{ code: 't1', explain: '标签', cmds: ['工作'] }] }) } },
          { id: 'use_collect/100', doc: { count: 3, useAt: 555 } },
          { id: 'tops/工作', doc: { value: ['collect/100'] } },
          { id: 'collect/100', doc: { content: 'hello', tags: ['t1', 'gone'] } }
        ]
      }),
      { now: 999 }
    )
    expect(result.textCount).toBe(1)
    expect(result.payload.memos).toHaveLength(1)
    const memo = result.payload.memos[0]!
    expect(memo).toMatchObject({ content: 'hello', tags: ['工作'], pinned: true, useCount: 3, lastUsedAt: 555, createdAt: 100 })
    expect(result.payload.images).toEqual({})
  })

  it('图片记录：附件字节转 dataURL，备注进正文，像素随 images 字段', () => {
    let seq = 0
    const ids = ['memo1', 'slot1']
    const result = convertMemoQuickPaste(
      dump({
        docs: [{ id: 'collect/200', doc: { remark: '账号和密码', image: { digest: 'd1', contentType: 'image/png' } } }],
        attachments: [{ id: 'attachment/d1', mime: 'image/png', bytes: PNG_BYTES }]
      }),
      { now: 999, newMemoId: () => ids[seq++]! }
    )
    expect(result.imageCount).toBe(1)
    const memo = result.payload.memos[0]!
    expect(memo.content).toBe(`账号和密码\n{img:slot1}`)
    // 带备注的图片记录 = 图文混排（text），纯图条目才是 image（见 types.ts kind 语义）
    expect(memo.kind).toBe('text')
    expect(memo.images?.[0]).toMatchObject({ id: 'slot1', mime: 'image/png', width: 8, height: 8 })
    expect(result.payload.images?.['slot1']).toMatch(/^data:image\/png;base64,/)

    // 无备注 → 纯图条目（kind=image，正文只有标记）
    const pure = convertMemoQuickPaste(
      dump({
        docs: [{ id: 'collect/300', doc: { image: { digest: 'd1', contentType: 'image/png' } } }],
        attachments: [{ id: 'attachment/d1', mime: 'image/png', bytes: PNG_BYTES }]
      }),
      { now: 999, newMemoId: () => 'slot2' }
    )
    expect(pure.payload.memos[0]).toMatchObject({ content: '{img:slot2}', kind: 'image' })
  })

  it('图片附件缺失：有备注降级为文字条目并计数，无备注跳过', () => {
    const withRemark = convertMemoQuickPaste(
      dump({ docs: [{ id: 'collect/1', doc: { remark: 'note', image: { digest: 'x' } } }] }),
      { now: 9 }
    )
    expect(withRemark.missingImages).toBe(1)
    expect(withRemark.textCount).toBe(1)
    expect(withRemark.payload.memos[0]?.content).toBe('note')

    const noRemark = convertMemoQuickPaste(
      dump({ docs: [{ id: 'collect/2', doc: { image: { digest: 'x' } } }] }),
      { now: 9 }
    )
    expect(noRemark.missingImages).toBe(1)
    expect(noRemark.skippedDocs).toBe(1)
    expect(noRemark.payload.memos).toHaveLength(0)
  })

  it('坏文档与空内容跳过；attachment 墓碑等非 collect 文档不产生条目', () => {
    const result = convertMemoQuickPaste(
      dump({
        docs: [
          { id: 'attachment/abc', doc: { _attachments: {} } },
          { id: 'collect/3', doc: {} },
          { id: 'collect/4', doc: { content: '   ' } }
        ]
      }),
      { now: 9 }
    )
    expect(result.payload.memos).toHaveLength(0)
    expect(result.skippedDocs).toBe(2)
  })

  it('产物可直接进入 planImport（合并去重管线）', () => {
    const first = convertMemoQuickPaste(
      dump({ docs: [{ id: 'collect/100', doc: { content: 'hello' } }] }),
      { now: 999, newMemoId: () => 'm1' }
    )
    const second = convertMemoQuickPaste(
      dump({ docs: [{ id: 'collect/100', doc: { content: 'hello' } }] }),
      { now: 1000, newMemoId: () => 'm2' }
    )
    const plan = planImport(first.payload.memos, [], second.payload, 'merge', () => 'm3')
    // 内容完全一致 → 识别为重复跳过，不产生第二份
    expect(plan.memosToAdd).toHaveLength(0)
    expect(plan.memosUnchanged).toHaveLength(1)
  })
})

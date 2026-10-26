import { describe, expect, it } from 'vitest'
import { extractOcrText } from '../src/core/ocr'

/** OCR 提供商契约输出：{ text, blocks?, confidence? } */
describe('extractOcrText 提供商输出提取', () => {
  it('text 非空时直接返回（去首尾空白）', () => {
    expect(extractOcrText({ text: '  识别结果  ', blocks: ['识别结果'], confidence: 0.98 })).toBe('识别结果')
    expect(extractOcrText({ text: 'Invoice No.20260318' })).toBe('Invoice No.20260318')
  })

  it('text 为空时回退拼接逐行 blocks', () => {
    expect(extractOcrText({ text: '', blocks: ['第一行', '第二行'] })).toBe('第一行\n第二行')
    expect(extractOcrText({ text: '   ', blocks: ['只有一行'] })).toBe('只有一行')
  })

  it('blocks 元素为 { text } 形状时也兼容', () => {
    expect(extractOcrText({ text: '', blocks: [{ text: '行A' }, { text: '行B' }] as unknown as string[] })).toBe('行A\n行B')
  })

  it('非字符串的 blocks 元素被跳过', () => {
    expect(extractOcrText({ text: '', blocks: [42, null, '有效行'] as unknown as string[] })).toBe('有效行')
  })

  it('空文本 / 缺字段 / 非对象 / null 返回 null', () => {
    expect(extractOcrText({ text: '   ' })).toBeNull()
    expect(extractOcrText({ text: '', blocks: [] })).toBeNull()
    expect(extractOcrText({})).toBeNull()
    expect(extractOcrText(null)).toBeNull()
    expect(extractOcrText(undefined)).toBeNull()
    expect(extractOcrText('junk' as unknown as { text?: unknown })).toBeNull()
  })
})

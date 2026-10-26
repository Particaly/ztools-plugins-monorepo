import { describe, expect, it } from 'vitest'
import {
  IMG_TOKEN_RE,
  firstImageSlot,
  allImageSlots,
  hasImages,
  isImageOnlyContent,
  maskImageTokens,
  parseImageTokens,
  replaceImageTokenIds,
  splitByImageTokens,
  stripImageTokens,
  uniqueImageIds
} from '../src/core/inlineImage'
import type { Memo, MemoImage } from '../src/core/types'

const IMG = (id: string): MemoImage => ({ id, mime: 'image/png', hash: 'h', width: 10, height: 10, bytes: 5 })

describe('parseImageTokens', () => {
  it('识别全部标记并给出原文区间', () => {
    const content = '前{img:abc123}中\n{img:def-456}尾'
    const tokens = parseImageTokens(content)
    expect(tokens.map((t) => t.id)).toEqual(['abc123', 'def-456'])
    for (const token of tokens) {
      expect(content.slice(token.start, token.end)).toBe(`{img:${token.id}}`)
    }
  })

  it('非法形态不被误认（前缀不符 / 花括号不配对 / 空白）', () => {
    expect(parseImageTokens('{img:}')).toHaveLength(0)
    expect(parseImageTokens('{img:ab}')).toHaveLength(0) // 少于 4 位
    expect(parseImageTokens('{image:abcd}')).toHaveLength(0)
    expect(parseImageTokens('img:abcd')).toHaveLength(0)
    expect(parseImageTokens('{ img:abcd }')).toHaveLength(0)
    expect(parseImageTokens('{img:ab cd}')).toHaveLength(0)
  })

  it('普通占位符与未知花括号不受影响', () => {
    expect(parseImageTokens('{date} {clipboard} ${x} {{name}}')).toHaveLength(0)
  })

  it('IMG_TOKEN_RE 全局正则可重复使用（lastIndex 不残留）', () => {
    parseImageTokens('a{img:xxxx1}b')
    parseImageTokens('c{img:xxxx2}d')
    expect(IMG_TOKEN_RE.lastIndex).toBe(0)
  })
})

describe('splitByImageTokens', () => {
  it('文字与图片交替切分，边界完整', () => {
    expect(splitByImageTokens('')).toEqual([])
    expect(splitByImageTokens('纯文字')).toEqual([{ type: 'text', text: '纯文字' }])
    expect(splitByImageTokens('{img:aaaa}')).toEqual([{ type: 'image', id: 'aaaa' }])
    expect(splitByImageTokens('甲{img:bbbb}乙')).toEqual([
      { type: 'text', text: '甲' },
      { type: 'image', id: 'bbbb' },
      { type: 'text', text: '乙' }
    ])
  })

  it('同一槽多次引用保持顺序', () => {
    const segs = splitByImageTokens('{img:slot1} x {img:slot1}')
    expect(segs.filter((s) => s.type === 'image')).toHaveLength(2)
  })
})

describe('strip / mask / replace', () => {
  it('stripImageTokens 移除标记', () => {
    expect(stripImageTokens('甲\n{img:abcd1}\n乙')).toBe('甲\n\n乙')
    expect(stripImageTokens('没有标记')).toBe('没有标记')
  })

  it('maskImageTokens 等长替换为空格（下标保持不变）', () => {
    const content = '甲{img:abcd1}乙'
    const masked = maskImageTokens(content)
    expect(masked).toHaveLength(content.length)
    expect(masked).toBe('甲' + ' '.repeat('{img:abcd1}'.length) + '乙')
  })

  it('replaceImageTokenIds 改写映射内的槽，其余原样', () => {
    const content = '{img:old1} 文字 {img:keep}'
    expect(replaceImageTokenIds(content, new Map([['old1', 'new9']]))).toBe('{img:new9} 文字 {img:keep}')
    expect(replaceImageTokenIds(content, new Map())).toBe(content)
  })
})

describe('uniqueImageIds / isImageOnlyContent', () => {
  it('按出现顺序去重', () => {
    expect(uniqueImageIds('b{img:zzzz}a{img:aaaa}c{img:zzzz}')).toEqual(['zzzz', 'aaaa'])
  })

  it('纯图判定：仅标记与空白', () => {
    expect(isImageOnlyContent('{img:aaaa}')).toBe(true)
    expect(isImageOnlyContent(' \n{img:aaaa}\n ')).toBe(true)
    expect(isImageOnlyContent('{img:aaaa}\n{img:bbbb}')).toBe(true)
    expect(isImageOnlyContent('{img:aaaa} 备注')).toBe(false)
    expect(isImageOnlyContent('')).toBe(false)
  })
})

describe('memo 图片槽取值', () => {
  const base = { id: 'm1', content: '', tags: [], pinned: false } as unknown as Memo

  it('新结构取 images；旧结构退化为 memoId', () => {
    const m: Memo = { ...base, images: [IMG('s1'), IMG('s2')] }
    expect(firstImageSlot(m)).toBe('s1')
    expect(allImageSlots(m)).toEqual(['s1', 's2'])
    const legacy: Memo = { ...base, imageHash: 'h' }
    expect(firstImageSlot(legacy)).toBe('m1')
    expect(allImageSlots(legacy)).toEqual(['m1'])
  })

  it('hasImages 认新旧两种结构', () => {
    expect(hasImages({ images: [IMG('s')], imageHash: undefined } as unknown as Memo)).toBe(true)
    expect(hasImages({ images: undefined, imageHash: 'h' } as unknown as Memo)).toBe(true)
    expect(hasImages({ images: undefined, imageHash: undefined } as unknown as Memo)).toBe(false)
    expect(hasImages({ images: [], imageHash: undefined } as unknown as Memo)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { parseCodeSpans } from '../src/core/codespan'

describe('parseCodeSpans 行内代码解析', () => {
  it('单反引号包裹 → 代码片段', () => {
    expect(parseCodeSpans('运行 `npm run dev` 即可')).toEqual([
      { text: '运行 ', code: false },
      { text: 'npm run dev', code: true },
      { text: ' 即可', code: false }
    ])
  })

  it('双反引号与三反引号同样成对识别', () => {
    expect(parseCodeSpans('``a b`` 与 ```c```')).toEqual([
      { text: 'a b', code: true },
      { text: ' 与 ', code: false },
      { text: 'c', code: true }
    ])
  })

  it('无代码标记时整段为普通文本', () => {
    expect(parseCodeSpans('普通文本')).toEqual([{ text: '普通文本', code: false }])
  })

  it('空串返回空数组', () => {
    expect(parseCodeSpans('')).toEqual([])
  })

  it('未成对的反引号按普通文本保留', () => {
    expect(parseCodeSpans('a ` b')).toEqual([{ text: 'a ` b', code: false }])
    expect(parseCodeSpans('`x` 和 `y')).toEqual([
      { text: 'x', code: true },
      { text: ' 和 `y', code: false }
    ])
  })

  it('多个代码片段按顺序拆分', () => {
    const segs = parseCodeSpans('`a`+`b`')
    expect(segs).toHaveLength(3)
    expect(segs.map((s) => s.code)).toEqual([true, false, true])
    expect(segs[1].text).toBe('+')
  })

  it('代码内容含特殊字符原样保留', () => {
    expect(parseCodeSpans('`{date}` 与 `$var`')).toEqual([
      { text: '{date}', code: true },
      { text: ' 与 ', code: false },
      { text: '$var', code: true }
    ])
  })

  it('双反引号内允许包含单个反引号（Markdown 语义）', () => {
    expect(parseCodeSpans('``a`b``')).toEqual([{ text: 'a`b', code: true }])
    expect(parseCodeSpans('执行 ``git log`1`` 现在')).toEqual([
      { text: '执行 ', code: false },
      { text: 'git log`1', code: true },
      { text: ' 现在', code: false }
    ])
  })
})

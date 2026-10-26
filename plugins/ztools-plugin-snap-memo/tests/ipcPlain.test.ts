import { describe, expect, it } from 'vitest'
import { toIpcPlain } from '../src/platform/ztoolsHost'

/** 模拟 Vue reactive：对象与嵌套数组都是 Proxy，Electron IPC 结构化克隆会拒绝 Proxy。 */
function proxied<T extends object>(value: T): T {
  return new Proxy(value, {})
}

describe('toIpcPlain：IPC 载荷净化', () => {
  it('把 Proxy 文档（含嵌套 Proxy 数组）转成可结构化克隆的普通对象', () => {
    const memo = proxied({
      _id: 'sm/memo/x',
      title: '标题',
      tags: proxied(['a', 'b']),
      pinned: false
    })
    const plain = toIpcPlain(memo)
    // structuredClone 对 Proxy 抛 DataCloneError，对净化结果必须成功
    expect(() => structuredClone(memo)).toThrow()
    expect(() => structuredClone(plain)).not.toThrow()
    expect(plain).toEqual({ _id: 'sm/memo/x', title: '标题', tags: ['a', 'b'], pinned: false })
  })

  it('undefined 原样透传；对象里的 undefined 字段按 JSON 语义丢弃', () => {
    expect(toIpcPlain(undefined)).toBeUndefined()
    const plain = toIpcPlain({ keyword: undefined, content: '' })
    expect('keyword' in plain).toBe(false)
    expect(plain.content).toBe('')
  })
})

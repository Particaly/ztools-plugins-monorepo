import { describe, expect, it } from 'vitest'
import {
  formatDate,
  hasInputPlaceholder,
  parsePlaceholders,
  resolveSegments,
  resolveTemplate
} from '../src/core/placeholders'

const NOW = new Date(2026, 9, 24, 14, 30, 8, 123) // 2026-10-24 14:30:08.123 星期六

describe('parsePlaceholders', () => {
  it('把已知占位符解析为 ph 片段', () => {
    const segs = parsePlaceholders('今天 {date} 开会')
    expect(segs).toHaveLength(3)
    expect(segs[1]).toMatchObject({ type: 'ph', name: 'date' })
  })

  it('未知花括号原样保留（代码模板安全）', () => {
    const { text } = resolveTemplate('const ${x} = {foo}', { now: NOW })
    expect(text).toBe('const ${x} = {foo}')
  })

  it('反斜杠转义保留字面量', () => {
    const { text } = resolveTemplate('\\{date} 不是占位符', { now: NOW })
    expect(text).toBe('{date} 不是占位符')
  })

  it('未闭合花括号按普通文本处理', () => {
    const segs = parsePlaceholders('a { b')
    expect(segs).toHaveLength(1)
    expect(segs[0]).toMatchObject({ type: 'text', text: 'a { b' })
  })

  it('带参数占位符解析 arg', () => {
    const segs = parsePlaceholders('{date:YYYY/MM/DD}')
    expect(segs[0]).toMatchObject({ type: 'ph', name: 'date', arg: 'YYYY/MM/DD' })
  })
})

describe('resolveTemplate', () => {
  it('基础日期时间占位符', () => {
    const { text } = resolveTemplate('{date}|{time}|{datetime}|{weekday}|{timestamp}', { now: NOW })
    expect(text).toBe(`2026-10-24|14:30:08|2026-10-24 14:30:08|星期六|${NOW.getTime()}`)
  })

  it('自定义格式', () => {
    const { text } = resolveTemplate('{date:YYYY年MM月DD日} {time:HH点mm分}', { now: NOW })
    expect(text).toBe('2026年10月24日 14点30分')
  })

  it('clipboard 上下文注入', () => {
    const { text } = resolveTemplate('前置 {clipboard} 后置', { clipboardText: '剪贴板内容' })
    expect(text).toBe('前置 剪贴板内容 后置')
  })

  it('clipboard 不可用时解析为空串', () => {
    const { text } = resolveTemplate('[{clipboard}]', {})
    expect(text).toBe('[]')
  })

  it('uuid 生成合法 UUID', () => {
    const { text } = resolveTemplate('{uuid}', {})
    expect(text).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('多次 {uuid} 生成不同值', () => {
    const { text } = resolveTemplate('{uuid}|{uuid}', {})
    const [a, b] = text.split('|')
    expect(a).not.toBe(b)
  })
})

describe('{input:..} 填空变量', () => {
  it('未作答时收集 prompts 并保留字面量', () => {
    const segs = parsePlaceholders('你好，{input:姓名}！工号 {input:工号=0001}')
    expect(hasInputPlaceholder(segs)).toBe(true)
    const first = resolveSegments(segs, {})
    expect(first.prompts).toEqual([
      { key: 'input:姓名', label: '姓名', defaultValue: '' },
      { key: 'input:工号', label: '工号', defaultValue: '0001' }
    ])
    expect(first.text).toContain('{input:姓名}')
  })

  it('作答后替换为答案', () => {
    const { text } = resolveTemplate('你好，{input:姓名}！工号 {input:工号=0001}', {
      answers: { 'input:姓名': '张三', 'input:工号': '0421' }
    })
    expect(text).toBe('你好，张三！工号 0421')
  })

  it('同名 input 标签去重（回答一次替换全部）', () => {
    const segs = parsePlaceholders('{input:名} 和 {input:名}')
    const first = resolveSegments(segs, {})
    expect(first.prompts).toHaveLength(1)
    const second = resolveSegments(segs, { answers: { 'input:名': 'A' } })
    expect(second.text).toBe('A 和 A')
  })
})

describe('formatDate', () => {
  it('支持 dayjs 子集 token 与字面量混排', () => {
    expect(formatDate(NOW, 'YY-MM-DD HH:mm:ss.SSS')).toBe('26-10-24 14:30:08.123')
    expect(formatDate(NOW, 'MM月/DD日')).toBe('10月/24日')
  })

  it('方括号字面量不参与 token 替换（含 token 字母的字面量安全）', () => {
    expect(formatDate(NOW, '[ADD] YYYY-MM-DD')).toBe(`ADD ${NOW.getFullYear()}-10-24`)
    expect(formatDate(NOW, '[HHmm] HH:mm')).toBe('HHmm 14:30')
  })
})

describe('偏移日期', () => {
  it('{date+1} 明天 / {date-1} 昨天（默认单位天）', () => {
    const { text } = resolveTemplate('{date+1}|{date-1}', { now: NOW })
    const [tomorrow, yesterday] = text.split('|')
    expect(tomorrow).toBe('2026-10-25')
    expect(yesterday).toBe('2026-10-23')
  })

  it('单位 w/m/y：周 / 自然月 / 自然年', () => {
    expect(resolveTemplate('{date+1w}', { now: NOW }).text).toBe('2026-10-31')
    expect(resolveTemplate('{date+1m}', { now: NOW }).text).toBe('2026-11-24')
    expect(resolveTemplate('{date+1y}', { now: NOW }).text).toBe('2027-10-24')
  })

  it('偏移与格式参数可组合；weekday/time/datetime 也支持偏移', () => {
    expect(resolveTemplate('{date+1d:MM月DD日}', { now: NOW }).text).toBe('10月25日')
    expect(resolveTemplate('{weekday+1}', { now: NOW }).text).toBe('星期日')
  })

  it('非法偏移（+0）按未知占位符原样保留', () => {
    expect(resolveTemplate('{date+0}', { now: NOW }).text).toBe('{date+0}')
  })
})

describe('{datetime:格式} 参数生效', () => {
  it('自定义格式（此前后缀参数被忽略的 bug）', () => {
    expect(resolveTemplate('{datetime:YYYY/MM/DD HH:mm}', { now: NOW }).text).toBe('2026/10/24 14:30')
  })

  it('无参数仍为默认格式', () => {
    expect(resolveTemplate('{datetime}', { now: NOW }).text).toBe('2026-10-24 14:30:08')
  })
})

describe('{random} 与 {choice}', () => {
  it('区间随机整数落在闭区间内', () => {
    for (let i = 0; i < 20; i++) {
      const n = Number(resolveTemplate('{random:1-6}', {}).text)
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(6)
    }
  })

  it('倒序区间也可用；n 位数字串长度正确', () => {
    const n = Number(resolveTemplate('{random:6-1}', {}).text)
    expect(n).toBeGreaterThanOrEqual(1)
    expect(n).toBeLessThanOrEqual(6)
    expect(resolveTemplate('{random:8}', {}).text).toMatch(/^\d{8}$/)
  })

  it('choice 按竖线分隔随机取一项', () => {
    const outcomes = new Set<string>()
    for (let i = 0; i < 40; i++) {
      const v = resolveTemplate('{choice:甲|乙|丙}', {}).text
      outcomes.add(v)
    }
    expect(['甲', '乙', '丙']).toContain([...outcomes][0])
    expect(outcomes.size).toBeGreaterThanOrEqual(2)
  })
})

describe('{input:..} 默认值补齐', () => {
  it('同标签多次出现且首个无默认值时，补齐后出现的非空默认值', () => {
    const segs = parsePlaceholders('{input:名} 和 {input:名=张三}')
    const first = resolveSegments(segs, {})
    expect(first.prompts).toEqual([{ key: 'input:名', label: '名', defaultValue: '张三' }])
  })
})

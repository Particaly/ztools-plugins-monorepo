/**
 * INT-006「粘贴并对比」目标侧决策表单测（resolvePasteCompareTarget 纯函数）。
 *
 * 覆盖决策表全部分支（决策表与理由见 useClipboardLoad.ts 文件头注释）：
 *   两侧均空 → 左侧（无确认）／仅左侧空 → 左侧空侧（无确认）／
 *   仅右侧空 → 右侧空侧（无确认）／两侧均非空 → 左侧 + 覆盖确认。
 * 空串即「空侧」语义（与 workbench store 初始值 / clearSides 一致），
 * 非空内容用短字符串代表（决策只看空/非空，与内容无关）。
 */
import { describe, expect, it } from 'vitest'
import { resolvePasteCompareTarget } from '../../src/composables/useClipboardLoad'

describe('resolvePasteCompareTarget（INT-006 目标侧决策表）', () => {
  it('两侧均空 → 左侧，无需覆盖确认', () => {
    expect(resolvePasteCompareTarget('', '')).toEqual({
      side: 'left',
      needOverwriteConfirm: false,
      overwriteSideName: '原始文本',
    })
  })

  it('仅左侧空 → 左侧（空侧），无需覆盖确认', () => {
    const target = resolvePasteCompareTarget('', '右侧已有内容')
    expect(target.side).toBe('left')
    expect(target.needOverwriteConfirm).toBe(false)
    expect(target.overwriteSideName).toBe('原始文本')
  })

  it('仅右侧空 → 右侧（空侧），无需覆盖确认', () => {
    const target = resolvePasteCompareTarget('左侧已有内容', '')
    expect(target.side).toBe('right')
    expect(target.needOverwriteConfirm).toBe(false)
    expect(target.overwriteSideName).toBe('更改后文本')
  })

  it('两侧均非空 → 左侧 + 覆盖确认（将覆盖「原始文本」）', () => {
    expect(resolvePasteCompareTarget('左侧已有内容', '右侧已有内容')).toEqual({
      side: 'left',
      needOverwriteConfirm: true,
      overwriteSideName: '原始文本',
    })
  })
})

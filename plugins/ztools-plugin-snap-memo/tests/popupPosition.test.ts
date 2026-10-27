import { describe, expect, it } from 'vitest'
import { computePopupPlacement, POPUP_GAP, POPUP_MARGIN } from '../src/core/popupPosition'

/** 统一场景：580 高的插件窗口（与宿主窗口一致）。 */
const VH = 580

describe('computePopupPlacement', () => {
  it('默认贴触发器正下方（间距 GAP），left 对齐触发器', () => {
    const p = computePopupPlacement({ left: 30, top: 100, bottom: 132, width: 328 }, 100, VH)
    expect(p).toEqual({ left: 30, top: 132 + POPUP_GAP, flip: false })
  })

  it('下方空间充足时不翻转（弹窗中部场景）', () => {
    // 底部 300 + 弹层 216 + 间距/边距 < 580
    const p = computePopupPlacement({ left: 16, top: 268, bottom: 300, width: 328 }, 216, VH)
    expect(p.flip).toBe(false)
    expect(p.top).toBe(300 + POPUP_GAP)
  })

  it('下方放不下且上方更宽裕时上翻，弹层底边与触发器顶边距 GAP', () => {
    // 底部 540：下方仅剩 40，放不下 216；上方 440 更宽裕 → 上翻
    const p = computePopupPlacement({ left: 16, top: 508, bottom: 540, width: 328 }, 216, VH)
    expect(p.flip).toBe(true)
    expect(p.top).toBe(508 - POPUP_GAP - 216)
  })

  it('下方放不下但上方也不宽裕时仍向下展开', () => {
    // 弹层 380：底部 232 放不下；但触发器靠上（上方 200 不比下方 348 宽裕）→ 保持向下
    const p = computePopupPlacement({ left: 16, top: 200, bottom: 232, width: 328 }, 380, VH)
    expect(p.flip).toBe(false)
    expect(p.top).toBe(232 + POPUP_GAP)
  })

  it('翻转判定含视口边距：距底边仅剩边距余量时也触发上翻', () => {
    // 弹层 100：底部 480 + 4 + 100 = 584 > 580 - 8 → 下方放不下 → 上翻
    const p = computePopupPlacement({ left: 16, top: 448, bottom: 480, width: 328 }, 100, VH)
    expect(p.flip).toBe(true)
    expect(p.top).toBe(448 - POPUP_GAP - 100)
  })

  it('触发器贴近视口顶部时保持向下展开', () => {
    const p = computePopupPlacement({ left: 16, top: 20, bottom: 52, width: 328 }, 216, VH)
    expect(p.flip).toBe(false)
    expect(p.top).toBe(52 + POPUP_GAP)
  })

  it('边距常量为 4px 间距与 8px 视口边距', () => {
    expect(POPUP_GAP).toBe(4)
    expect(POPUP_MARGIN).toBe(8)
  })
})

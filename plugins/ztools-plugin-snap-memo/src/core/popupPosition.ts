/**
 * 下拉弹层的贴视口定位计算（纯函数，供 SmSelect / SmTagSelect 复用）。
 * 弹层用 fixed 定位展开：编辑器字段弹窗等容器带 overflow 裁切，absolute 弹层会被
 * 裁掉并与弹窗按钮重叠；fixed 贴触发器定位即可完整浮在所有容器之上。
 * 默认贴触发器正下方展开（间距 GAP）；下方放不下且上方更宽裕时上翻（与原 CSS 翻转判定一致）。
 */

/** 触发器的视口坐标（getBoundingClientRect 的子集）。 */
export interface TriggerRect {
  left: number
  top: number
  bottom: number
  width: number
}

/** 弹层定位结果：left/top 直接写入弹层内联样式，flip 决定 transform-origin。 */
export interface PopupPlacement {
  left: number
  top: number
  flip: boolean
}

/** 弹层与触发器的间距（px）。 */
export const POPUP_GAP = 4
/** 弹层距视口上下边缘的安全边距（px）。 */
export const POPUP_MARGIN = 8

/**
 * 计算弹层的 fixed 坐标。
 * @param trigger 触发器视口矩形
 * @param popupHeight 弹层实际高度（受 max-height 截断后的值）
 * @param viewportHeight 视口高度（window.innerHeight）
 */
export function computePopupPlacement(
  trigger: TriggerRect,
  popupHeight: number,
  viewportHeight: number
): PopupPlacement {
  // 翻转判定与既有行为一致：下方剩余空间放不下（含边距）且上方更宽裕时上翻
  const flip =
    trigger.bottom + popupHeight + POPUP_GAP > viewportHeight - POPUP_MARGIN &&
    trigger.top - POPUP_MARGIN > viewportHeight - trigger.bottom
  const top = flip ? trigger.top - POPUP_GAP - popupHeight : trigger.bottom + POPUP_GAP
  return { left: trigger.left, top, flip }
}

// 将模板事件值转换为数字，兼容 ZTools 组件可能返回字符串或数字的场景。
export function uiNum(value: string | number): number {
  return Number(value)
}

// 统一清理输入控件提交值，后续数值解析都基于去空白后的字符串。
export function normalizeInputValue(value: string | number) {
  return String(value).trim()
}

// 提交普通数值输入，空值或非法数值会回退到当前值，并先反映到输入框再应用业务更新。
export function commitNumericInput(
  value: string | number,
  fallback: number,
  apply: (next: number) => void,
  reflect: (next: string) => void
) {
  const normalized = normalizeInputValue(value)
  const parsed = Number(normalized)
  const next = normalized === '' || !Number.isFinite(parsed) ? fallback : parsed
  reflect(String(next))
  apply(next)
}

// 仅接受正数输入，适用于宽高等不能为 0 或负数的字段，非法内容统一回退到当前有效值。
export function commitPositiveNumericInput(
  value: string | number,
  fallback: number,
  apply: (next: number) => void,
  reflect: (next: string) => void
) {
  const normalized = normalizeInputValue(value)
  const parsed = Number(normalized)
  const next = normalized === '' || !Number.isFinite(parsed) || parsed <= 0 ? fallback : parsed
  reflect(formatNumericInputValue(next))
  apply(next)
}

// 从原生 input 事件中读取数值，保留给仍使用原生控件的模板或回调复用。
export function evNum(e: Event): number {
  return +(e.target as HTMLInputElement).value
}

// 从原生 checkbox 事件中读取勾选状态，保留给仍使用原生控件的模板或回调复用。
export function evChecked(e: Event): boolean {
  return (e.target as HTMLInputElement).checked
}

// 将编辑器中的数值格式化为最多两位小数，避免输入框展示长浮点尾差。
export function formatNumericInputValue(value: number) {
  return String(Math.round(value * 100) / 100)
}

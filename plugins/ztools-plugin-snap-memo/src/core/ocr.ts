/**
 * 图片文字识别（OCR，纯函数）。
 *
 * 识别能力来自 ZTools 的「提供商」机制（provider，类型 `ocr`，如微信 OCR / AI 识图）。
 * 消费契约（对齐宿主便捷封装 ztools.ocr）：
 *   输入 { image, lang? } —— image 为本地路径 / data URI / http(s) URL
 *   输出 { text, blocks?, confidence? }
 * 本模块只负责从契约输出中提取可检索的纯文本；平台层负责特性检测与调用。
 */

/** OCR 提供商契约输出（字段全部按未知处理，容忍脏数据）。 */
export interface OcrProviderOutputLike {
  text?: unknown
  blocks?: unknown
  confidence?: unknown
}

/**
 * 从 OCR 提供商输出中提取纯文本：
 * 优先取 `text`；`text` 为空时回退拼接逐行 `blocks`（微信 OCR 的行级结果）。
 * 提取不到有效文字（空串/纯空白）返回 null。
 */
export function extractOcrText(output: OcrProviderOutputLike | null | undefined): string | null {
  if (!output || typeof output !== 'object') return null
  const text = typeof output.text === 'string' ? output.text.trim() : ''
  if (text) return text
  if (Array.isArray(output.blocks)) {
    const joined = output.blocks
      .map((line) => (typeof line === 'string' ? line : typeof (line as { text?: unknown })?.text === 'string' ? String((line as { text: string }).text) : ''))
      .join('\n')
      .trim()
    if (joined) return joined
  }
  return null
}

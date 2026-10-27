/// <reference types="vite/client" />
/// <reference types="@ztools-center/ztools-api-types" />

/**
 * 宿主「提供商」消费 API（@ztools-center/ztools-api-types 1.0.3 尚未收录，按
 * f-provider 的 registerProvider 契约与 README 消费示例声明；全部可选，运行时仍做特性检测）。
 * 与类型包中的全局 ZToolsApi 接口同名合并。
 */
interface ZToolsApi {
  /** 便捷 OCR：走用户在宿主「设置 → 提供商」中设为默认的 OCR 提供商。 */
  ocr?(image: string, lang?: string): Promise<{ text?: string; blocks?: string[]; confidence?: number }>
  /** 便捷翻译：走用户设为默认的翻译提供商（本插件暂未使用，预留声明）。 */
  translate?(
    text: string,
    opts?: { from?: string; to?: string }
  ): Promise<{ text: string; detectedFrom?: string }>
  /** 显式调用某个已注册 provider（key 为插件 plugin.json providers 字段的键）。 */
  providers?: {
    invokeProvider(key: string, input: Record<string, unknown>): Promise<unknown>
  }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}

/**
 * preload 受控接口（对应 public/preload/services.cjs）。
 * 全部方法在 ZTools 宿主中由 preload 注入；浏览器开发态不存在，调用方必须先判空。
 * 文件路径约束：非空绝对路径、不经过隐藏目录/文件、扩展名白名单（json/txt/md/csv/yml/yaml）、文本 ≤16MB。
 */
interface SnapMemoPreload {
  /** 读取 UTF-8 文本文件；超限/扩展名不符抛带中文信息的 Error。 */
  readTextFile(path: string): string
  /** 原子写入 UTF-8 文本文件（同目录 tmp + rename）；失败抛带中文信息的 Error。 */
  writeTextFile(path: string, content: string): void
  /** 读取当前剪贴板纯文本；null=剪贴板能力不可用，字符串（可为空串）=可用。 */
  readClipboardText(): string | null
  /** 读取当前剪贴板图片，返回 PNG dataURL；无图片或不可用时返回空字符串。 */
  readClipboardImage(): string
  /** 读取本地图片文件为 dataURL；扩展名白名单，上限 8MB，失败抛带中文信息的 Error。 */
  readImageFile(path: string): string
  /**
   * 把 dataURL 图片写入系统临时目录（snap-memo 子目录），返回绝对路径；
   * MIME/扩展名白名单与 readImageFile 一致，上限 8MB；写入前清理过期临时文件；
   * 失败抛带中文信息的 Error。
   */
  writeTempImage(dataUrl: string): string
  /**
   * 批量确保字体文件存在（合法缓存直接读，缺失时按 sources 顺序下载），返回 base64。
   * 路径约束同上但扩展名白名单为 woff2/woff/ttf/otf；下载内容校验字体魔数。
   * 与 items 对齐返回 [{ ok, base64 } | { ok: false, error }]；items 非法时抛 Error。
   */
  ensureFontFiles(
    items: Array<{
      path: string
      sources: Array<{ kind: 'file'; url: string } | { kind: 'tarball'; url: string; member: string }>
    }>
  ): Promise<Array<{ ok: boolean; base64?: string; error?: string }>>
  /**
   * 只读提取其他插件在宿主数据库里的文档与附件（跨插件导入用，见 core/mqpImport.ts）。
   * 复用宿主自带 lmdb 模块只读打开本地数据文件，读取范围限定指定插件命名空间前缀，
   * 绝不写入；失败（非安装宿主 / 找不到数据目录 / 打开失败）抛带中文信息的 Error。
   * 返回 { account, docs, attachments, truncated }，id 均已去掉插件命名空间前缀。
   */
  readHostPluginData(pluginName: string): {
    account: string
    docs: Array<{ id: string; doc: Record<string, unknown> }>
    attachments: Array<{ id: string; mime: string; bytes: Uint8Array }>
    truncated: boolean
  }
}

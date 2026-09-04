import type { FabricObject } from 'fabric'

/**
 * MCP 网关向编辑器运行时暴露的只读画布信息，
 * 是 tools/call 里所有查询类操作的基础返回结构。
 */
export interface McpCanvasOverview {
  canvasWidth: number
  canvasHeight: number
  canvasBg: string
  zoom: number
  showPixelGrid: boolean
  snapToPixelGrid: boolean
  pixelGridSize: number
  keylineTemplate: string
  activeArtboardId: string
  artboardCount: number
  objectCount: number
  selectionCount: number
  canUndo: boolean
  canRedo: boolean
  historyLength: number
  historyIndex: number
  activeObjectIds: string[]
}

/**
 * 单个画布对象的摘要信息，供 list / 查询操作返回。
 */
export interface McpObjectSummary {
  id: string
  name: string
  type: string
  visible: boolean
  locked: boolean
  left: number
  top: number
  width: number
  height: number
  scaleX: number
  scaleY: number
  angle: number
  opacity: number
  fill: string | null
  stroke: string | null
  strokeWidth: number
  zIndex: number
}

/**
 * 编辑器向 MCP 网关提供的全部能力。
 * 由 useHomeEditorRuntime 在运行时组装，网关只持有引用不做拷贝，
 * 因此页面卸载时置空 gateway 即可同步失效，避免捕获过期闭包。
 */
export interface McpEditorGateway {
  /** 读取画布与文档的整体概览（尺寸、背景、视口、历史状态等）。 */
  getOverview: () => McpCanvasOverview
  /** 读取全部对象摘要，按图层级（与图层面板一致的数组顺序）。 */
  listObjects: () => McpObjectSummary[]
  /** 按 editorObjectId 读取单个对象摘要，未找到返回 null。 */
  getObjectSummary: (objectId: string) => McpObjectSummary | null
  /** 读取当前选中的对象 id 列表。 */
  getSelectionIds: () => string[]
  /** 读取当前选中对象组成的 SVG 片段（未选中时返回整块画布 SVG）。 */
  getSelectionSvg: () => Promise<string>
  /** 读取当前选中对象的属性键值摘要，用于属性面板式查询。 */
  getActiveObjectProps: () => Record<string, unknown> | null
  /** 读取全部画板（含名称、尺寸与对象数）。 */
  listArtboards: () => Array<{ id: string; name: string; width: number; height: number; objectCount: number; active: boolean }>
  /** 读取撤销历史记录（描述与时间戳）。 */
  listHistory: () => Array<{ index: number; description: string; timestamp: number }>

  /** 画布尺寸调整（宽高为可选参数，未传保持不变）。 */
  resizeCanvas: (width?: number, height?: number) => void
  /** 设置画布背景色，支持 hex/rgba/'transparent'。 */
  setCanvasBackground: (color: string) => void
  /** 控制像素网格显示、吸附与网格尺寸。 */
  setPixelGrid: (options: { visible?: boolean; snap?: boolean; size?: number }) => void
  /** 控制参考线模板与边距。 */
  setKeyline: (options: { template?: string; margin?: number }) => void

  /**
   * 添加基础图形。shape 取值见 editorCatalog.basicShapes 的 id；
   * x/y 为画布坐标（未传时以画布中心插入），返回新对象 id。
   */
  addShape: (shape: string, options?: { x?: number; y?: number; width?: number; height?: number }) => string
  /**
   * 添加文本对象。preset 为 textPresets id 或省略时用正文样式；
   * text 为实际文本内容，返回新对象 id。
   */
  addText: (options: { text?: string; preset?: string; x?: number; y?: number; fontSize?: number; fill?: string }) => string
  /**
   * 导入 SVG 内容（完整 <svg> 文档、<path> 片段或 path d 属性均可）。
   * 返回导入后的根对象 id。
   */
  insertSvg: (svg: string, options?: { name?: string; x?: number; y?: number }) => Promise<string>
  /** 从 Iconify 插入图标，iconName 形如 "mdi:home"。 */
  insertIconifyIcon: (iconName: string, options?: { x?: number; y?: number }) => Promise<string>
  /** 插入内置图标模板（iconTemplates id）。 */
  insertIconTemplate: (templateId: string) => Promise<string>
  /** 应用内置图标模板为新文档（替换当前画布）。 */
  applyIconTemplateAsDocument: (templateId: string) => Promise<void>

  /** 按对象 id 数组设置选中（空数组表示清空选中）。 */
  selectObjects: (objectIds: string[], mode?: 'shape' | 'point' | 'segment') => void
  /** 全选画布对象。 */
  selectAll: () => void

  /**
   * 设置对象属性。props 中键名对应 Fabric 属性（left/top/angle/opacity/fill/stroke/
   * strokeWidth/scaleX/scaleY/visible 等），一次可批量设置多个。
   */
  setObjectProps: (objectId: string, props: Record<string, unknown>) => void
  /** 对选中/指定对象做图层移动：up/down/top/bottom。 */
  moveLayer: (objectId: string, direction: 'up' | 'down' | 'top' | 'bottom') => void
  /** 显示/隐藏对象。 */
  setObjectVisible: (objectId: string, visible: boolean) => void
  /** 锁定/解锁对象。 */
  setObjectLocked: (objectId: string, locked: boolean) => void
  /** 复制对象（默认当前选中，可传 id 数组指定），返回新对象 id 列表。 */
  duplicateObjects: (objectIds?: string[]) => Promise<string[]>
  /** 删除对象（默认当前选中，可传 id 数组指定）。 */
  deleteObjects: (objectIds?: string[]) => void
  /** 翻转对象，axis 为 'x'（水平）或 'y'（垂直）。 */
  flipObject: (objectId: string, axis: 'x' | 'y') => void
  /** 把指定对象编组（须至少 2 个）。 */
  groupObjects: (objectIds?: string[]) => void
  /** 解散指定编组对象。 */
  ungroupObject: (objectId?: string) => void

  /** 撤销一步。 */
  undo: () => void
  /** 重做一步。 */
  redo: () => void
  /** 跳转到历史记录指定下标。 */
  jumpToHistory: (index: number) => void

  /** 新建空白文档。 */
  newDocument: () => void
  /** 保存当前工程（已有路径则覆盖，否则返回需用户在界面中选择路径）。 */
  saveProject: () => string
  /** 读取当前工程文件内容（JSON 文本）。 */
  getProjectJson: () => string
  /** 从 JSON 文本加载工程内容到当前画布。 */
  loadProjectJson: (json: string) => Promise<void>

  /** 切换到指定画板。 */
  switchArtboard: (artboardId: string) => Promise<void>
  /** 新建画板并切换过去，返回画板 id。 */
  addArtboard: () => Promise<string>
  /** 删除画板。 */
  deleteArtboard: (artboardId: string) => Promise<void>
  /** 重命名画板。 */
  renameArtboard: (artboardId: string, name: string) => void

  /** 导出优化 SVG 文本（不落盘）。includeBackground 为 true 时包含画布背景。 */
  exportSvgText: (includeBackground?: boolean) => Promise<string>
  /** 导出 PNG dataURL（不落盘）。size 为输出宽度像素。 */
  exportPngDataUrl: (size?: number, transparentBackground?: boolean) => string
  /** 导出 SVG 到下载目录，返回写入的文件路径。 */
  exportSvgFile: (fileName?: string, includeBackground?: boolean) => Promise<string>
  /** 导出 PNG 到下载目录，返回写入的文件路径。 */
  exportPngFile: (size?: number, fileName?: string, transparentBackground?: boolean) => string

  /** 视口缩放；fit=true 时自动适配画布到可视区域。 */
  setViewport: (options: { zoom?: number; fit?: boolean }) => void

  /** 面向调试/兜底的逃生通道：在网关上下文执行自定义回调。 */
  runInEditor: <T>(fn: (editor: McpEditorGatewayInternals) => T | Promise<T>) => Promise<T>
}

/**
 * runInEditor 逃生通道注入的编辑器内部句柄。
 * 仅建议 AI 在标准操作不满足时使用，字段全部来自运行时闭包。
 */
export interface McpEditorGatewayInternals {
  fabricCanvas: import('fabric').Canvas | null
  activeObject: FabricObject | null
}

/**
 * 由 useHomeEditorRuntime 实现、MCP 网关持有的“能力提供者”接口。
 * 网关不做任何业务逻辑，只把 MCP 请求转发给该实现，
 * 因此编辑器内部重构不影响 MCP 协议层。
 */
export type McpEditorGatewayProvider = () => McpEditorGateway | null

/** MCP 网关暴露给页面的生命周期控制。 */
export interface McpGatewayController {
  /** 编辑器就绪后调用，绑定能力实现并尝试注册 MCP 工具。 */
  attach: (gateway: McpEditorGateway) => void
  /** 页面卸载时调用，解绑能力实现（工具注册保持不变，仅返回未就绪错误）。 */
  detach: () => void
  /** 工具是否已成功注册到 ZTools 宿主。 */
  isRegistered: () => boolean
}

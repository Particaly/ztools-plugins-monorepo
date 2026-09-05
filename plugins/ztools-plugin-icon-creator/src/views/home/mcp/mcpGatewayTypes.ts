import type { FabricObject } from 'fabric'
import type {
  ExportIconContainerRequest,
  ExportIconContainerResult,
  ExportSizeSetRequest,
  ExportSizeSetResult
} from '../editor/modules/export-delivery/exportDeliveryTypes'
import type { DocumentStylePresetSummary, DocumentSwatch } from '../documentStyleMeta'

/**
 * 摘要中渐变样式的可读 JSON 形式：coords 单位与 fabric Gradient 一致
 * （percentage 表示 1 = 对象宽度/高度的 100%）。
 */
export type McpGradientSummary = {
  type: 'linear' | 'radial'
  gradientUnits: 'percentage' | 'pixels'
  coords: Record<string, number>
  stops: Array<{ offset: number; color: string }>
}

/** 摘要中阴影样式的可读 JSON 形式。 */
export type McpShadowSummary = {
  color: string
  blur: number
  offsetX: number
  offsetY: number
}

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
 * fill/stroke 为纯色时是颜色字符串，为渐变时是 McpGradientSummary 结构。
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
  fill: string | McpGradientSummary | null
  stroke: string | McpGradientSummary | null
  strokeWidth: number
  /** 圆角半径（仅可编辑路径对象携带；按本体几何重建后的生效值）。 */
  cornerRadius?: number
  shadow: McpShadowSummary | null
  /** 是否设置了 clipPath 蒙版（mask_objects 应用后为 true，unmask_object 后为 false）。 */
  masked: boolean
  zIndex: number
}

/**
 * 批量创建对象的单个条目：shape / svg / text 三选一（同时提供时按 svg > shape > text 优先），
 * 其余字段为可选的位置、尺寸与初始样式设置。
 */
export interface McpCreateObjectItem {
  /** 基础图形短名或 base- 前缀目录 id（同 add_shape 的 shape 参数）。 */
  shape?: string
  /** SVG 文本（完整 <svg> 文档、<path> 片段或 path d 属性均可）。 */
  svg?: string
  /** 文本内容。 */
  text?: string
  /** 画布坐标（省略时使用画布中心）。 */
  x?: number
  y?: number
  /** 目标显示尺寸，仅对 shape 生效（形状按该尺寸生成本体几何）。 */
  width?: number
  height?: number
  /** SVG 缩放倍数（仅对 svg 生效，默认 1）。 */
  scale?: number
  /** 图层名（省略时沿用默认自动命名）。 */
  name?: string
  /** 初始填充色（hex/rgba）。 */
  fill?: string
}

/**
 * 导出类操作的通用选项：指定 artboardId 时临时把该画板设为活动画板完成导出，
 * 结束后自动恢复原画板；省略时导出当前画布。
 */
export interface McpExportArtboardOptions {
  artboardId?: string
}

/** 画布快速预览图（缩略图）选项：size 为输出宽度像素。 */
export interface McpCanvasThumbnailOptions extends McpExportArtboardOptions {
  size?: number
}

/** 画布快速预览图结果：dataUrl 为透明底 PNG，width/height 为实际输出像素。 */
export interface McpCanvasThumbnailResult {
  dataUrl: string
  width: number
  height: number
}

/** SVG 文本导出选项。 */
export interface McpExportSvgTextOptions extends McpExportArtboardOptions {
  includeBackground?: boolean
}

/** PNG/WebP dataURL 导出选项：quality 仅对 webp 生效（0-1，默认 0.92）。 */
export interface McpExportPngDataUrlOptions extends McpExportArtboardOptions {
  size?: number
  transparentBackground?: boolean
  format?: 'png' | 'webp'
  quality?: number
}

/** SVG 文件导出选项：outputDir 为绝对目录（缺省写入下载目录）。 */
export interface McpExportSvgFileOptions extends McpExportArtboardOptions {
  fileName?: string
  includeBackground?: boolean
  outputDir?: string
}

/** PNG/WebP 文件导出选项：outputDir 为绝对目录（缺省写入下载目录）。 */
export interface McpExportPngFileOptions extends McpExportArtboardOptions {
  size?: number
  fileName?: string
  transparentBackground?: boolean
  format?: 'png' | 'webp'
  quality?: number
  outputDir?: string
}

/** 多尺寸 PNG 批量导出选项（继承模块请求结构，另支持按画板导出）。 */
export type McpExportSizeSetOptions = ExportSizeSetRequest & McpExportArtboardOptions
/** 多尺寸 PNG 批量导出结果。 */
export type McpExportSizeSetResult = ExportSizeSetResult
/** 图标容器（ico/icns）导出选项。 */
export type McpExportIconContainerOptions = ExportIconContainerRequest & McpExportArtboardOptions
/** 图标容器导出结果。 */
export type McpExportIconContainerResult = ExportIconContainerResult

/** 命名快照摘要（list_snapshots / delete_snapshot 返回结构）。 */
export interface McpSnapshotSummary {
  name: string
  createdAt: number
  /** 快照画布 JSON 中的顶层对象数量。 */
  objectCount: number
}

/** save_snapshot 的返回结构。 */
export interface McpSnapshotSaveResult {
  name: string
  objectCount: number
  createdAt: number
}

/** restore_snapshot 的返回结构：backupName 为恢复前自动创建的当前画布备份快照名。 */
export interface McpSnapshotRestoreResult {
  name: string
  backupName: string
  objectCount: number
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
   * x/y 为画布坐标（未传时以画布中心插入）；width/height 指定目标尺寸时
   * 形状按该尺寸生成本体几何（scale 保持 1），返回新对象 id。
   */
  addShape: (shape: string, options?: { x?: number; y?: number; width?: number; height?: number }) => string
  /**
   * 添加文本对象。preset 为 textPresets id 或省略时用正文样式；
   * text 为实际文本内容，fill 支持颜色字符串或 "swatch:名字" 色板引用，返回新对象 id。
   */
  addText: (options: { text?: string; preset?: string; x?: number; y?: number; fontSize?: number; fill?: string }) => string
  /**
   * 导入 SVG 内容（完整 <svg> 文档、<path> 片段或 path d 属性均可）。
   * 默认按原始尺寸 1:1 导入；scale 为可选缩放倍数。
   * 导入对象超出画布边界时操作仍成功，返回的 message 字段携带提示信息。
   */
  insertSvg: (svg: string, options?: { name?: string; x?: number; y?: number; scale?: number }) => Promise<{ objectId: string; message?: string }>
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
   * fill/stroke 额外支持 "swatch:名字" 色板引用与渐变 JSON 对象；
   * shadow 支持 { color, blur, offsetX, offsetY }、null（清除）或 "none"；
   * fill/stroke 传 "none" 时回到原纯色（无原色则 transparent）。
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

  /**
   * 对多个对象做整体对齐：以对象集合的公共包围盒为基准，
   * mode 取 left/center/right（水平方向）或 top/middle/bottom（垂直方向）。
   * objectIds 省略时使用当前选中对象；有效对象不足 2 个时抛错。
   * 返回实际参与对齐的对象 id 列表。
   */
  alignObjects: (
    objectIds: string[] | undefined,
    mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
  ) => string[]
  /**
   * 在首尾对象之间等间距分布：axis 取 'x'（水平）或 'y'（垂直），
   * mode 取 'edge'（对象边缘间距相等）或 'center'（对象中心间距相等，默认），
   * 首尾对象位置保持不变。objectIds 省略时使用当前选中对象；有效对象不足 2 个时抛错。
   * 返回实际参与分布的对象 id 列表。
   */
  distributeObjects: (objectIds: string[] | undefined, axis: 'x' | 'y', mode?: 'edge' | 'center') => string[]
  /**
   * 对多个对象应用同一组属性（props 语义与 setObjectProps 一致），
   * 整个批次合并为一条撤销记录，一次 undo 即可整体还原；
   * 返回每个对象应用后的摘要（顺序与 objectIds 一致）。
   */
  batchSetObjectsProps: (objectIds: string[], props: Record<string, unknown>) => McpObjectSummary[]
  /**
   * 按条目顺序批量创建对象（每条目 shape/svg/text 三选一），可选 fill/name 在创建后应用；
   * group 为 true 且创建对象数不少于 2 时把全部新对象编组，groupName 设置组名。
   * 返回全部新对象 id 与可选的组 id。
   */
  createObjects: (
    items: McpCreateObjectItem[],
    options?: { group?: boolean; groupName?: string }
  ) => Promise<{ objectIds: string[]; groupId?: string }>
  /** 设置对象图层名（图层面板与 list_objects 显示的名称）并刷新面板，返回对象摘要；未找到对象返回 null。 */
  setObjectName: (objectId: string, name: string) => McpObjectSummary | null

  /** 添加（或按名称覆盖）文档级命名色板条目，返回更新后的完整色板列表。 */
  addSwatch: (name: string, color: string) => { swatches: DocumentSwatch[] }
  /** 删除指定名称的文档级色板条目，不存在时抛错，返回剩余色板列表。 */
  removeSwatch: (name: string) => { swatches: DocumentSwatch[] }
  /** 列出文档级命名色板。 */
  listSwatches: () => { swatches: DocumentSwatch[] }

  /**
   * 保存文档级自定义样式预设（同名覆盖；与内置预设同名时抛错）。
   * style 键值在应用时才解析（支持 swatch 引用与渐变 JSON），此处仅做结构校验。
   */
  saveStylePreset: (name: string, style: Record<string, unknown>) => { presets: DocumentStylePresetSummary[] }
  /** 删除文档级自定义样式预设；内置预设或未知名称抛错，返回剩余预设列表。 */
  removeStylePreset: (name: string) => { presets: DocumentStylePresetSummary[] }
  /** 列出全部可用样式预设（内置 source='builtin' 在前，自定义 source='custom' 在后）。 */
  listStylePresets: () => { presets: DocumentStylePresetSummary[] }
  /**
   * 把样式预设应用到对象（内部复用 batch_set_props 的应用与撤销合并路径）。
   * objectIds 省略时使用当前选中对象；预设不存在或目标为空时抛错。
   * 返回预设名、来源、实际应用的对象 id 与每对象摘要。
   */
  applyStylePreset: (
    name: string,
    objectIds?: string[]
  ) => { name: string; source: 'builtin' | 'custom'; objectIds: string[]; results: McpObjectSummary[] }

  /**
   * 把文本对象转曲为可编辑路径对象：objectId 省略时使用当前选中对象；
   * 目标不是文本类型时抛错。原文本被移除并由路径对象取代（一条撤销记录内完成），
   * 转曲结果保持选中，返回新路径对象 id。
   */
  outlineText: (objectId?: string) => Promise<{ objectId: string }>

  /**
   * 把蒙版对象设为目标对象的 clipPath 裁切：裁剪区域与蒙版当前在画布上的
   * 视觉位置/尺寸一致（内部换算目标与蒙版之间的旋转/缩放/位移差）。
   * removeMaskObject 为 true 时应用后从画布移除蒙版对象。
   * 整个操作合并为一条撤销记录，返回目标 id 与蒙版来源 id。
   */
  maskObjects: (
    objectId: string,
    maskId: string,
    removeMaskObject?: boolean
  ) => Promise<{ objectId: string; clipPathId?: string }>
  /** 移除目标对象上的 clipPath 蒙版恢复完整显示，返回移除后的对象摘要；对象没有蒙版时抛错。 */
  unmaskObject: (objectId: string) => Promise<McpObjectSummary>

  /**
   * 把当前画布内容（完整序列化 JSON，不含色板/样式预设等文档级元数据）存为命名快照。
   * 同名覆盖；新增条目超出数量上限时抛错。快照随工程 JSON 保存，不进入撤销历史。
   */
  saveSnapshot: (name: string) => McpSnapshotSaveResult
  /**
   * 用命名快照的画布 JSON 整体替换当前画布内容（一条撤销记录，可 undo 回到恢复前）。
   * 恢复前先把当前画布自动备份为 "__backup__" + 时间戳 的快照防丢失，返回该备份名。
   */
  restoreSnapshot: (name: string) => Promise<McpSnapshotRestoreResult>
  /** 列出全部命名快照（name、createdAt、objectCount）。 */
  listSnapshots: () => { snapshots: McpSnapshotSummary[] }
  /** 删除指定名称的命名快照，不存在时抛错，返回剩余快照列表。 */
  deleteSnapshot: (name: string) => { snapshots: McpSnapshotSummary[] }

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

  /** 导出优化 SVG 文本（不落盘）。includeBackground 为 true 时包含画布背景；artboardId 指定按该画板导出。 */
  exportSvgText: (options?: McpExportSvgTextOptions) => Promise<string>
  /** 导出 PNG/WebP dataURL（不落盘）。size 为输出宽度像素，format 默认 png。 */
  exportPngDataUrl: (options?: McpExportPngDataUrlOptions) => Promise<string>
  /**
   * 渲染画布快速预览图（透明底 PNG dataURL，不落盘），语义为“给 AI 看的低成本视觉自检”：
   * 修改布局/样式后先用它确认效果，再决定是否继续精调或正式导出。
   * size 为输出宽度像素（默认 256），artboardId 指定按该画板渲染。
   */
  getCanvasThumbnail: (options?: McpCanvasThumbnailOptions) => Promise<McpCanvasThumbnailResult>
  /** 导出 SVG 到下载目录或 outputDir（绝对目录），返回写入的文件路径。 */
  exportSvgFile: (options?: McpExportSvgFileOptions) => Promise<string>
  /** 导出 PNG/WebP 到下载目录或 outputDir（绝对目录），返回写入的文件路径。 */
  exportPngFile: (options?: McpExportPngFileOptions) => Promise<string>
  /** 按预设或自定义尺寸列表批量导出 PNG 文件，返回各尺寸文件路径与实际输出目录。 */
  exportSizeSet: (options: McpExportSizeSetOptions) => Promise<McpExportSizeSetResult>
  /** 渲染各尺寸 PNG 并打包为 ICO/ICNS 容器落盘，返回文件路径与实际尺寸列表。 */
  exportIconContainer: (options: McpExportIconContainerOptions) => Promise<McpExportIconContainerResult>
  /**
   * 对指定对象执行布尔运算：union/intersect/subtract/xor，subtractDirection 仅对 subtract 生效
   * （forward=按图层顺序 A-B，reverse=B-A）。objectIds 省略时使用当前选中对象；
   * 万花筒实例与布尔预览对象不参与运算，有效对象不足 2 个时抛错。
   * 返回结果对象 id（运算后自动选中）。
   */
  booleanOps: (
    objectIds: string[] | undefined,
    operation: 'union' | 'intersect' | 'subtract' | 'xor',
    subtractDirection?: 'forward' | 'reverse'
  ) => Promise<{ objectId: string; operation: 'union' | 'intersect' | 'subtract' | 'xor' }>

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

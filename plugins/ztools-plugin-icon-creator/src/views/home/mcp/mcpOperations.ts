import type {
  McpCanvasOverview,
  McpEditorGateway,
  McpEditorGatewayProvider
} from './mcpGatewayTypes'

/**
 * MCP 工具调用的统一响应。
 * ok=false 时 message 携带面向 AI 的可读错误说明。
 */
export interface McpToolResponse<T = unknown> {
  ok: boolean
  message?: string
  data?: T
}

/**
 * 单条操作定义。operation 字符串即 MCP 参数中的命令名，
 * handler 从编辑器网关执行具体动作并返回需要回传给 AI 的数据。
 */
type McpOperationHandler = (
  gateway: McpEditorGateway,
  args: Record<string, unknown>
) => unknown | Promise<unknown>

interface McpOperation {
  description: string
  handler: McpOperationHandler
}

/** 读取参数中的可选数字，非法或缺失返回 undefined。 */
function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** 读取参数中的可选布尔，仅接受真实布尔值。 */
function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

/** 读取参数中的可选字符串，空白视为缺失。 */
function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

/** 读取参数中的可选字符串数组，逐项过滤空白。 */
function optionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const list = value
    .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    .map((item) => item.trim())
  return list.length ? list : undefined
}

/** 读取参数中的可选属性对象（值可为任意 JSON 类型）。 */
function optionalRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

/**
 * 全部可用操作。operation 名称是稳定契约，新增能力只增不改，
 * 避免已经编排好的 AI 工作流因改名而失效。
 */
const OPERATIONS: Record<string, McpOperation> = {
  /* ── 查询 ── */
  get_overview: {
    description: '获取画布与文档概览：尺寸、背景、缩放、网格、参考线、对象数、选区、历史状态。',
    handler: (gateway) => gateway.getOverview()
  },
  list_objects: {
    description: '列出全部对象摘要（id、名称、类型、位置、尺寸、层级、样式状态）。',
    handler: (gateway) => ({ objects: gateway.listObjects() })
  },
  get_object: {
    description: '按对象 id 读取单个对象摘要，未找到时 ok=false。',
    handler: (gateway, args) => {
      const id = optionalString(args.objectId ?? args.id)
      if (!id) throw new Error('缺少 objectId 参数')
      const summary = gateway.getObjectSummary(id)
      if (!summary) throw new Error(`未找到对象: ${id}`)
      return summary
    }
  },
  get_selection: {
    description: '读取当前选中对象的 id 列表与属性摘要。',
    handler: (gateway) => ({
      ids: gateway.getSelectionIds(),
      props: gateway.getActiveObjectProps()
    })
  },
  get_selection_svg: {
    description: '导出当前选中对象为 SVG 文本（未选中时导出整块画布）。',
    handler: (gateway) => gateway.getSelectionSvg().then((svg) => ({ svg }))
  },
  list_artboards: {
    description: '列出全部画板（id、名称、尺寸、对象数、是否激活）。',
    handler: (gateway) => ({ artboards: gateway.listArtboards() })
  },
  list_history: {
    description: '列出撤销历史记录（描述与时间戳）。',
    handler: (gateway) => ({ history: gateway.listHistory() })
  },

  /* ── 画布设置 ── */
  resize_canvas: {
    description: '调整画布尺寸（width/height 单位像素，均可选）。',
    handler: (gateway, args) => {
      const width = optionalNumber(args.width)
      const height = optionalNumber(args.height)
      if (width === undefined && height === undefined) throw new Error('至少提供 width 或 height 之一')
      if (width !== undefined && (width < 1 || width > 4096)) throw new Error('width 取值范围 1-4096')
      if (height !== undefined && (height < 1 || height > 4096)) throw new Error('height 取值范围 1-4096')
      gateway.resizeCanvas(width, height)
      return gateway.getOverview()
    }
  },
  set_canvas_background: {
    description: "设置画布背景色，支持 hex/rgb/'transparent'。",
    handler: (gateway, args) => {
      const color = optionalString(args.color)
      if (!color) throw new Error('缺少 color 参数')
      gateway.setCanvasBackground(color)
      return gateway.getOverview()
    }
  },
  set_pixel_grid: {
    description: '配置像素网格：visible 显示开关、snap 吸附开关、size 网格尺寸。',
    handler: (gateway, args) => {
      const visible = optionalBoolean(args.visible)
      const snap = optionalBoolean(args.snap)
      const size = optionalNumber(args.size)
      if (visible === undefined && snap === undefined && size === undefined) {
        throw new Error('至少提供 visible / snap / size 之一')
      }
      gateway.setPixelGrid({ visible, snap, size })
      return gateway.getOverview()
    }
  },
  set_keyline: {
    description: '配置图标参考线：template 取值 none/material/ios/favicon/custom，margin 为安全边距。',
    handler: (gateway, args) => {
      const template = optionalString(args.template)
      const margin = optionalNumber(args.margin)
      if (!template && margin === undefined) throw new Error('至少提供 template 或 margin 之一')
      gateway.setKeyline({ template, margin })
      return gateway.getOverview()
    }
  },

  /* ── 添加对象 ── */
  add_shape: {
    description: '添加基础图形。shape 取值：rectangle/square/circle/line/triangle/inverted-triangle/rhombus/wide-cross/parallelogram/inverted-parallelogram/trapezoid/inverted-trapezoid/doorway/inverted-arch/rotated-right-triangle/half-moon/pentagon/hexagon/octagon/arrow-right/solid-shaft-arrow/double-solid-shaft-arrow/star/heart（可加 base- 前缀）。x/y 为画布坐标（默认画布中心）。',
    handler: (gateway, args) => {
      const shape = optionalString(args.shape)
      if (!shape) throw new Error('缺少 shape 参数')
      const id = gateway.addShape(shape, {
        x: optionalNumber(args.x),
        y: optionalNumber(args.y),
        width: optionalNumber(args.width),
        height: optionalNumber(args.height)
      })
      return { objectId: id }
    }
  },
  add_text: {
    description: '添加文本。text 为内容（默认"文字"），preset 可选 display/title/subtitle/body/body-small/caption/label/button-text，x/y 为画布坐标（默认画布中心），fontSize 与 fill 可覆盖默认样式。',
    handler: (gateway, args) => {
      const text = optionalString(args.text) ?? '文字'
      const id = gateway.addText({
        text,
        preset: optionalString(args.preset),
        x: optionalNumber(args.x),
        y: optionalNumber(args.y),
        fontSize: optionalNumber(args.fontSize),
        fill: optionalString(args.fill)
      })
      return { objectId: id }
    }
  },
  insert_svg: {
    description: '导入 SVG 到画布：svg 传完整 <svg> 文档、<path> 片段或 path d 属性；name 可指定对象名称，x/y 可指定插入位置（默认画布中心）。',
    handler: async (gateway, args) => {
      const svg = optionalString(args.svg)
      if (!svg) throw new Error('缺少 svg 参数')
      const id = await gateway.insertSvg(svg, {
        name: optionalString(args.name),
        x: optionalNumber(args.x),
        y: optionalNumber(args.y)
      })
      return { objectId: id }
    }
  },
  insert_iconify_icon: {
    description: '从 Iconify 在线图标库插入图标，iconName 形如 "mdi:home"，x/y 可指定插入位置。',
    handler: async (gateway, args) => {
      const iconName = optionalString(args.iconName)
      if (!iconName) throw new Error('缺少 iconName 参数')
      const id = await gateway.insertIconifyIcon(iconName, {
        x: optionalNumber(args.x),
        y: optionalNumber(args.y)
      })
      return { objectId: id }
    }
  },
  insert_icon_template: {
    description: '插入内置图标模板到当前画布，templateId 见模板目录（如 app-icon-rounded-square）。',
    handler: async (gateway, args) => {
      const templateId = optionalString(args.templateId)
      if (!templateId) throw new Error('缺少 templateId 参数')
      const id = await gateway.insertIconTemplate(templateId)
      return { objectId: id }
    }
  },
  apply_icon_template: {
    description: '把内置图标模板应用为当前文档（替换画布内容，可撤销恢复）。',
    handler: async (gateway, args) => {
      const templateId = optionalString(args.templateId)
      if (!templateId) throw new Error('缺少 templateId 参数')
      await gateway.applyIconTemplateAsDocument(templateId)
      return gateway.getOverview()
    }
  },

  /* ── 选区 ── */
  select_objects: {
    description: '按 id 数组选中对象（objectIds 空数组清空选中），mode 可选 shape/point/segment。',
    handler: (gateway, args) => {
      const ids = optionalStringArray(args.objectIds) ?? []
      gateway.selectObjects(ids, (optionalString(args.mode) as 'shape' | 'point' | 'segment') ?? 'shape')
      return { selectedIds: gateway.getSelectionIds() }
    }
  },
  select_all: {
    description: '全选画布对象。',
    handler: (gateway) => {
      gateway.selectAll()
      return { selectedIds: gateway.getSelectionIds() }
    }
  },

  /* ── 对象操作 ── */
  set_object_props: {
    description: '批量设置对象属性。props 为键值对象，支持 left/top/width/height/angle/opacity/fill/stroke/strokeWidth/scaleX/scaleY/rotateX/rotateY/visible/cornerRadius 等 Fabric 属性（宽度高度按显示尺寸换算缩放）。',
    handler: (gateway, args) => {
      const objectId = optionalString(args.objectId)
      const props = optionalRecord(args.props)
      if (!objectId) throw new Error('缺少 objectId 参数')
      if (!props || !Object.keys(props).length) throw new Error('缺少 props 参数')
      gateway.setObjectProps(objectId, props)
      return gateway.getObjectSummary(objectId)
    }
  },
  move_layer: {
    description: '调整对象层级：direction 取 up（上移一层）/down（下移一层）/top（置顶）/bottom（置底）。',
    handler: (gateway, args) => {
      const objectId = optionalString(args.objectId)
      const direction = optionalString(args.direction)
      if (!objectId) throw new Error('缺少 objectId 参数')
      if (direction !== 'up' && direction !== 'down' && direction !== 'top' && direction !== 'bottom') {
        throw new Error('direction 必须是 up/down/top/bottom 之一')
      }
      gateway.moveLayer(objectId, direction)
      return { objectId, direction }
    }
  },
  set_object_visible: {
    description: '显示或隐藏对象：visible 布尔值。',
    handler: (gateway, args) => {
      const objectId = optionalString(args.objectId)
      const visible = optionalBoolean(args.visible)
      if (!objectId) throw new Error('缺少 objectId 参数')
      if (visible === undefined) throw new Error('缺少 visible 参数')
      gateway.setObjectVisible(objectId, visible)
      return { objectId, visible }
    }
  },
  set_object_locked: {
    description: '锁定或解锁对象：locked 布尔值。',
    handler: (gateway, args) => {
      const objectId = optionalString(args.objectId)
      const locked = optionalBoolean(args.locked)
      if (!objectId) throw new Error('缺少 objectId 参数')
      if (locked === undefined) throw new Error('缺少 locked 参数')
      gateway.setObjectLocked(objectId, locked)
      return { objectId, locked }
    }
  },
  duplicate_objects: {
    description: '复制对象（objectIds 省略时复制当前选中对象），返回新对象 id 列表。',
    handler: async (gateway, args) => {
      const ids = await gateway.duplicateObjects(optionalStringArray(args.objectIds))
      return { objectIds: ids }
    }
  },
  delete_objects: {
    description: '删除对象（objectIds 省略时删除当前选中对象）。',
    handler: (gateway, args) => {
      gateway.deleteObjects(optionalStringArray(args.objectIds))
      return { objectCount: gateway.listObjects().length }
    }
  },
  flip_object: {
    description: '翻转对象：axis 取 x（水平翻转）或 y（垂直翻转）。',
    handler: (gateway, args) => {
      const objectId = optionalString(args.objectId)
      const axis = optionalString(args.axis)
      if (!objectId) throw new Error('缺少 objectId 参数')
      if (axis !== 'x' && axis !== 'y') throw new Error('axis 必须是 x 或 y')
      gateway.flipObject(objectId, axis)
      return { objectId, axis }
    }
  },
  group_objects: {
    description: '编组对象（objectIds 省略时使用当前选中对象，至少需要 2 个）。',
    handler: (gateway, args) => {
      gateway.groupObjects(optionalStringArray(args.objectIds))
      return { selectedIds: gateway.getSelectionIds() }
    }
  },
  ungroup_object: {
    description: '解散编组（objectId 省略时使用当前选中的编组对象）。',
    handler: (gateway, args) => {
      gateway.ungroupObject(optionalString(args.objectId))
      return { selectedIds: gateway.getSelectionIds() }
    }
  },

  /* ── 历史 ── */
  undo: {
    description: '撤销上一步操作。',
    handler: (gateway) => {
      gateway.undo()
      return gateway.getOverview()
    }
  },
  redo: {
    description: '重做被撤销的操作。',
    handler: (gateway) => {
      gateway.redo()
      return gateway.getOverview()
    }
  },
  jump_to_history: {
    description: '跳转到撤销历史指定下标（先 list_history 查看可用范围）。',
    handler: (gateway, args) => {
      const index = optionalNumber(args.index)
      if (index === undefined || index < 0) throw new Error('缺少有效的 index 参数')
      gateway.jumpToHistory(Math.floor(index))
      return gateway.getOverview()
    }
  },

  /* ── 工程文档 ── */
  new_document: {
    description: '新建空白文档（当前内容可先保存或已进入历史）。',
    handler: (gateway) => {
      gateway.newDocument()
      return gateway.getOverview()
    }
  },
  save_project: {
    description: '保存当前工程。若当前标签尚未保存过，需要用户在界面完成路径选择；返回提示文本。',
    handler: (gateway) => ({ message: gateway.saveProject() })
  },
  get_project_json: {
    description: '读取当前工程的完整 JSON 内容（可用于备份或离线处理）。',
    handler: (gateway) => ({ json: gateway.getProjectJson() })
  },
  load_project_json: {
    description: '从 JSON 内容加载工程到当前画布（整体替换，可撤销恢复）。',
    handler: async (gateway, args) => {
      const json = optionalString(args.json)
      if (!json) throw new Error('缺少 json 参数')
      await gateway.loadProjectJson(json)
      return gateway.getOverview()
    }
  },

  /* ── 画板 ── */
  switch_artboard: {
    description: '切换到指定画板。',
    handler: async (gateway, args) => {
      const artboardId = optionalString(args.artboardId)
      if (!artboardId) throw new Error('缺少 artboardId 参数')
      await gateway.switchArtboard(artboardId)
      return { artboards: gateway.listArtboards() }
    }
  },
  add_artboard: {
    description: '新建画板并切换过去，返回新画板 id。',
    handler: async (gateway) => {
      const id = await gateway.addArtboard()
      return { artboardId: id }
    }
  },
  delete_artboard: {
    description: '删除指定画板（至少保留一个）。',
    handler: async (gateway, args) => {
      const artboardId = optionalString(args.artboardId)
      if (!artboardId) throw new Error('缺少 artboardId 参数')
      await gateway.deleteArtboard(artboardId)
      return { artboards: gateway.listArtboards() }
    }
  },
  rename_artboard: {
    description: '重命名画板。',
    handler: (gateway, args) => {
      const artboardId = optionalString(args.artboardId)
      const name = optionalString(args.name)
      if (!artboardId) throw new Error('缺少 artboardId 参数')
      if (!name) throw new Error('缺少 name 参数')
      gateway.renameArtboard(artboardId, name)
      return { artboards: gateway.listArtboards() }
    }
  },

  /* ── 导出 ── */
  export_svg_text: {
    description: '导出优化 SVG 文本（不写文件）。includeBackground 为 true 时包含画布背景。',
    handler: async (gateway, args) => {
      const svg = await gateway.exportSvgText(optionalBoolean(args.includeBackground) ?? false)
      return { svg }
    }
  },
  export_png_data_url: {
    description: '渲染 PNG 并返回 dataURL（不写文件）。size 为输出宽度像素（默认画布宽），transparentBackground 为 true 时透明背景。',
    handler: (gateway, args) => {
      const size = optionalNumber(args.size)
      const transparent = optionalBoolean(args.transparentBackground) ?? false
      const dataUrl = gateway.exportPngDataUrl(size, transparent)
      if (!dataUrl) throw new Error('PNG 渲染失败')
      return { dataUrl }
    }
  },
  export_svg_file: {
    description: '导出 SVG 到下载目录，返回文件路径。fileName 可选，includeBackground 为 true 时包含背景。',
    handler: async (gateway, args) => {
      const filePath = await gateway.exportSvgFile(
        optionalString(args.fileName),
        optionalBoolean(args.includeBackground) ?? false
      )
      return { filePath }
    }
  },
  export_png_file: {
    description: '导出 PNG 到下载目录，返回文件路径。size 为输出宽度像素，fileName 与 transparentBackground 可选。',
    handler: (gateway, args) => {
      const filePath = gateway.exportPngFile(
        optionalNumber(args.size),
        optionalString(args.fileName),
        optionalBoolean(args.transparentBackground) ?? false
      )
      return { filePath }
    }
  },

  /* ── 视图 ── */
  set_viewport: {
    description: '视口控制：zoom 设置缩放倍数，fit 为 true 时自动适配画布到可视区域。',
    handler: (gateway, args) => {
      const zoom = optionalNumber(args.zoom)
      const fit = optionalBoolean(args.fit)
      if (zoom === undefined && !fit) throw new Error('至少提供 zoom 或 fit=true 之一')
      if (zoom !== undefined && (zoom < 0.05 || zoom > 20)) throw new Error('zoom 取值范围 0.05-20')
      gateway.setViewport({ zoom, fit })
      return gateway.getOverview()
    }
  }
}

/** 暴露给 plugin.json inputSchema 引用的操作名与描述清单（保持与 OPERATIONS 同步）。 */
export function listOperationNames(): Array<{ name: string; description: string }> {
  return Object.entries(OPERATIONS).map(([name, operation]) => ({ name, description: operation.description }))
}

/**
 * 执行一次 MCP 工具调用：解析 operation 与 args，转发给编辑器网关。
 * 编辑器未就绪、操作不存在或执行抛错时返回 ok=false，不向上层抛异常，
 * 保证 MCP 客户端总能拿到结构化错误而不是连接中断。
 */
export async function dispatchMcpOperation(
  provider: McpEditorGatewayProvider,
  input: unknown
): Promise<McpToolResponse> {
  const args = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const operationName = typeof args.operation === 'string' ? args.operation.trim() : ''
  if (!operationName) {
    return { ok: false, message: "缺少 operation 参数。用 operation='get_overview' 查看画布当前状态。" }
  }

  const operation = OPERATIONS[operationName]
  if (!operation) {
    const available = Object.keys(OPERATIONS).join(', ')
    return { ok: false, message: `未知操作: ${operationName}。可用操作：${available}` }
  }

  const gateway = provider()
  if (!gateway) {
    return { ok: false, message: '编辑器尚未就绪，请先在 ZTools 中打开图标创建工具窗口后重试。' }
  }

  try {
    const data = await operation.handler(gateway, args)
    return { ok: true, data }
  } catch (error) {
    return {
      ok: false,
      message: `操作 ${operationName} 失败: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

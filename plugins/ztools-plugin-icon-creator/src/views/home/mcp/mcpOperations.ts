import type {
  McpCanvasOverview,
  McpEditorGateway,
  McpEditorGatewayProvider
} from './mcpGatewayTypes'
import { isSupportedColorString } from '../documentStyleMeta'

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

/** 读取参数中的可选对象数组（条目须为普通对象），供批量创建条目解析使用。 */
function optionalRecordArray(value: unknown): Record<string, unknown>[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter(
    (item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item)
  )
}

/** 读取参数中的可选数字数组（接受数字或纯数字字符串），空数组视为缺失。 */
function optionalNumberArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined
  const list = value
    .map((item) => (typeof item === 'string' && item.trim() !== '' ? Number(item.trim()) : item))
    .filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
  return list.length ? list : undefined
}

/** 校验可选的位图导出格式，仅接受 png/webp，非法值抛错。 */
function optionalImageFormat(value: unknown): 'png' | 'webp' | undefined {
  const format = optionalString(value)
  if (format === undefined) return undefined
  if (format !== 'png' && format !== 'webp') throw new Error('format 必须是 png 或 webp')
  return format
}

/** 校验可选的编码质量（0-1，仅对 webp 生效），缺省返回 undefined。 */
function optionalQuality(value: unknown): number | undefined {
  const quality = optionalNumber(value)
  if (quality === undefined) return undefined
  if (quality < 0 || quality > 1) throw new Error('quality 取值范围 0-1')
  return quality
}

/** 校验可选的输出目录（必须为绝对路径：盘符、UNC 或 POSIX 根），非法值抛错。 */
function optionalOutputDir(value: unknown): string | undefined {
  const dir = optionalString(value)
  if (dir === undefined) return undefined
  if (!/^([a-zA-Z]:[\\/]|\\\\|\/)/.test(dir)) throw new Error(`outputDir 必须是绝对目录路径（如 D:\\exports 或 /Users/me/exports）: ${dir}`)
  return dir
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
  list_swatches: {
    description: '列出文档级命名色板（name/color）。随工程保存与撤销历史持久化；fill/stroke 等样式值可用 "swatch:名字" 引用色板颜色。',
    handler: (gateway) => gateway.listSwatches()
  },
  list_snapshots: {
    description: '列出全部命名画布快照（name、createdAt 毫秒时间戳、objectCount 顶层对象数）。快照保存当前画布完整视觉状态（不含色板/样式预设等文档级元数据），随工程保存持久化；可用 restore_snapshot 恢复、delete_snapshot 删除，数量上限 20 个。',
    handler: (gateway) => gateway.listSnapshots()
  },

  /* ── 色板 ── */
  add_swatch: {
    description: '添加（或按名称覆盖）文档级命名色板：name 必填（非空字符串，与已有同名色板重复时覆盖其颜色），color 必填（hex 如 #ff0000/#ffffffff 或 rgb()/rgba() 表达式，非法报错）。色板随工程保存与撤销历史持久化，fill/stroke 可用 "swatch:名字" 引用。返回更新后的完整色板列表。',
    handler: (gateway, args) => {
      const name = optionalString(args.name)
      const color = optionalString(args.color)
      if (!name) throw new Error('缺少 name 参数')
      if (!color) throw new Error('缺少 color 参数')
      if (!isSupportedColorString(color)) {
        throw new Error(`color 非法: ${color}。支持 hex（如 #f00/#ff0000/#ff000080）或 rgb()/rgba() 表达式`)
      }
      return gateway.addSwatch(name, color)
    }
  },
  remove_swatch: {
    description: '删除指定名称的文档级色板条目：name 必填，不存在时报错。返回剩余色板列表。',
    handler: (gateway, args) => {
      const name = optionalString(args.name)
      if (!name) throw new Error('缺少 name 参数')
      return gateway.removeSwatch(name)
    }
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
    description: '添加基础图形。shape 取值：rectangle/square/circle/line/triangle/inverted-triangle/rhombus/wide-cross/parallelogram/inverted-parallelogram/trapezoid/inverted-trapezoid/doorway/inverted-arch/rotated-right-triangle/half-moon/pentagon/hexagon/octagon/arrow-right/solid-shaft-arrow/double-solid-shaft-arrow/star/heart（可加 base- 前缀）。x/y 为画布坐标（默认画布中心）；width/height 可指定目标尺寸，形状按该尺寸直接生成本体几何（scaleX=scaleY=1，圆角/描边不变形），只传其一时另一维度沿用默认尺寸。',
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
    description: '添加文本。text 为内容（默认"文字"），preset 可选 display/title/subtitle/body/body-small/caption/label/button-text，x/y 为画布坐标（默认画布中心），fontSize 可覆盖默认字号；fill 可覆盖默认填充色，支持 hex/rgba 或 "swatch:名字" 色板引用（色板见 list_swatches）。',
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
    description: '导入 SVG 到画布：svg 传完整 <svg> 文档、<path> 片段或 path d 属性；name 可指定对象名称，x/y 可指定插入位置（默认画布中心）。默认按原始尺寸 1:1 导入不做缩放；scale 为可选缩放倍数（如 0.5）。导入对象超出画布边界时操作仍成功，返回的 message 字段会说明越界情况。',
    handler: async (gateway, args) => {
      const svg = optionalString(args.svg)
      if (!svg) throw new Error('缺少 svg 参数')
      const scale = optionalNumber(args.scale)
      if (scale !== undefined && scale <= 0) throw new Error('scale 必须大于 0')
      const result = await gateway.insertSvg(svg, {
        name: optionalString(args.name),
        x: optionalNumber(args.x),
        y: optionalNumber(args.y),
        scale
      })
      return result
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
  create_objects: {
    description: '按顺序批量创建多个对象。items 为条目数组，每条目 shape/svg/text 三选一（同时提供时按 svg > shape > text 优先）：shape 为基础图形短名（同 add_shape 取值），svg 为 SVG 文本或片段（scale 为可选缩放倍数），text 为文本内容；每条目均可携带 x/y（画布坐标，默认画布中心）、name（图层名）、fill（初始填充色，hex/rgba 或 "swatch:名字" 色板引用），shape 条目另可用 width/height 指定目标尺寸。group 为 true 且创建对象数不少于 2 时自动编组，groupName 指定组名。items 为空或缺小时报错；返回全部新对象 id 与可选 groupId。',
    handler: async (gateway, args) => {
      const items = optionalRecordArray(args.items)
      if (!items || !items.length) throw new Error('缺少 items 参数（非空对象数组）')
      const group = optionalBoolean(args.group) ?? false
      const groupName = optionalString(args.groupName)
      return gateway.createObjects(
        items.map((item) => ({
          shape: optionalString(item.shape),
          svg: optionalString(item.svg),
          text: typeof item.text === 'string' ? item.text : undefined,
          x: optionalNumber(item.x),
          y: optionalNumber(item.y),
          width: optionalNumber(item.width),
          height: optionalNumber(item.height),
          scale: optionalNumber(item.scale),
          name: optionalString(item.name),
          fill: optionalString(item.fill)
        })),
        { group, groupName }
      )
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
    description: '批量设置对象属性。props 为键值对象，支持 left/top/width/height/angle/opacity/fill/stroke/strokeWidth/scaleX/scaleY/rotateX/rotateY/visible/cornerRadius/shadow 等 Fabric 属性（宽度高度按显示尺寸换算缩放；cornerRadius 仅对基础形状等可编辑路径对象生效，会按当前本体几何重建圆角）。样式值扩展：fill/stroke 支持 "swatch:名字" 引用色板颜色（list_swatches 查询，不存在报错），也支持渐变 JSON 对象 { type: \'linear\'|\'radial\', stops: [{ offset: 0-1, color }], x1,y1,x2,y2（linear）或 x2,y2,r2（radial，percentage 坐标 0-1）}；fill/stroke 传 \'none\' 清除渐变回原纯色；shadow 传 { color, blur, offsetX, offsetY }、null（清除）或 \'none\'。原字符串颜色行为不变。',
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
  set_object_name: {
    description: '设置对象图层名（图层面板与 list_objects 显示的名称）。objectId 与 name（非空字符串）均必填；名称与当前一致时不产生变更，设置成功后返回对象摘要。',
    handler: (gateway, args) => {
      const objectId = optionalString(args.objectId)
      const name = optionalString(args.name)
      if (!objectId) throw new Error('缺少 objectId 参数')
      if (!name) throw new Error('缺少 name 参数')
      const summary = gateway.setObjectName(objectId, name)
      if (!summary) throw new Error(`未找到对象: ${objectId}`)
      return summary
    }
  },
  align_objects: {
    description: '对多个对象做整体对齐：以对象集合的公共包围盒为基准。mode 必填，取 left（左对齐）/center（水平居中）/right（右对齐）/top（顶对齐）/middle（垂直居中）/bottom（底对齐）；objectIds 至少 2 个（省略时使用当前选中对象），编组对象作为整体参与。返回实际参与对齐的对象 id。',
    handler: (gateway, args) => {
      const mode = optionalString(args.mode)
      if (
        mode !== 'left' && mode !== 'center' && mode !== 'right'
        && mode !== 'top' && mode !== 'middle' && mode !== 'bottom'
      ) {
        throw new Error('mode 必须是 left/center/right/top/middle/bottom 之一')
      }
      const objectIds = gateway.alignObjects(optionalStringArray(args.objectIds), mode)
      return { objectIds, mode }
    }
  },
  distribute_objects: {
    description: '在首尾对象之间等间距分布对象：axis 必填，取 x（水平）或 y（垂直）；mode 可选，取 edge（对象边缘间距相等）或 center（对象中心间距相等，默认），首尾对象位置保持不变。objectIds 至少 2 个（省略时使用当前选中对象），按分布轴坐标自动排序。返回实际参与分布的对象 id。',
    handler: (gateway, args) => {
      const axis = optionalString(args.axis)
      if (axis !== 'x' && axis !== 'y') throw new Error('axis 必须是 x 或 y')
      const mode = optionalString(args.mode)
      if (mode !== undefined && mode !== 'edge' && mode !== 'center') {
        throw new Error('mode 必须是 edge 或 center')
      }
      const resolvedMode: 'edge' | 'center' = mode === 'edge' ? 'edge' : 'center'
      const objectIds = gateway.distributeObjects(optionalStringArray(args.objectIds), axis, resolvedMode)
      return { objectIds, axis, mode: resolvedMode }
    }
  },
  batch_set_props: {
    description: '对多个对象应用同一组属性，整个批次合并为一条撤销记录（一次 undo 即可整体还原）。objectIds 必填且至少 1 个；props 键值与 set_object_props 相同，支持 left/top/width/height/angle/opacity/fill/stroke/strokeWidth/scaleX/scaleY/visible/cornerRadius/shadow 等（width/height 按显示尺寸换算缩放，cornerRadius 按本体几何重建圆角；fill/stroke 支持 swatch 引用与渐变 JSON，shadow 支持 { color, blur, offsetX, offsetY } 或 null，语义详见 set_object_props）。返回每个对象应用后的摘要（顺序与 objectIds 一致）。',
    handler: (gateway, args) => {
      const objectIds = optionalStringArray(args.objectIds)
      if (!objectIds) throw new Error('缺少 objectIds 参数（非空字符串数组）')
      const props = optionalRecord(args.props)
      if (!props || !Object.keys(props).length) throw new Error('缺少 props 参数')
      const results = gateway.batchSetObjectsProps(objectIds, props)
      return { results }
    }
  },

  /* ── 样式预设 ── */
  save_style_preset: {
    description: '保存文档级自定义样式预设（随工程保存与撤销历史持久化）。name 必填（与内置预设同名报错，与自定义预设同名时覆盖），style 必填且至少包含 fill/stroke/strokeWidth/cornerRadius/shadow/opacity 之一；fill/stroke 支持 "swatch:名字" 引用与渐变 JSON（同 set_object_props 语法，保存原样、应用时解析），shadow 支持 { color, blur, offsetX, offsetY } 或 null。返回全部预设列表（含内置）。',
    handler: (gateway, args) => {
      const name = optionalString(args.name)
      const style = optionalRecord(args.style)
      if (!name) throw new Error('缺少 name 参数')
      if (!style || !Object.keys(style).length) throw new Error('缺少 style 参数（至少包含一个样式键）')
      return gateway.saveStylePreset(name, style)
    }
  },
  remove_style_preset: {
    description: '删除文档级自定义样式预设：name 必填；内置预设不可删除，名称不存在时报错。返回剩余预设列表（含内置）。',
    handler: (gateway, args) => {
      const name = optionalString(args.name)
      if (!name) throw new Error('缺少 name 参数')
      return gateway.removeStylePreset(name)
    }
  },
  list_style_presets: {
    description: '列出全部可用样式预设：内置预设（source=\'builtin\'：flat-fill 纯黑填充无边 / stroke-only 2px #333333 描边无填充 / soft-shadow 黑色25%透明 blur12 offsetY4 阴影 / rounded-card 白色填充圆角24）在前，自定义预设（source=\'custom\'）在后；每项含 name 与 style。预设可经 apply_style_preset 应用到对象。',
    handler: (gateway) => gateway.listStylePresets()
  },
  apply_style_preset: {
    description: '把样式预设应用到对象：name 必填（内置或自定义，未找到报错）；objectIds 可省略（省略时使用当前选中对象）。内部等价于用预设 style 执行 batch_set_props（支持 swatch 引用解析、渐变 JSON、cornerRadius 重建、shadow 应用等全部语义），整个批次合并为一条撤销记录。返回预设名、来源、实际应用的对象 id 列表与每对象摘要。',
    handler: (gateway, args) => {
      const name = optionalString(args.name)
      if (!name) throw new Error('缺少 name 参数')
      return gateway.applyStylePreset(name, optionalStringArray(args.objectIds))
    }
  },

  /* ── 文字转曲 ── */
  outline_text: {
    description: '把文本对象转曲为可编辑路径：objectId 可省略（省略时使用当前选中对象）。目标必须是文本对象（Text/Textbox/IText），否则报错。转曲生成与原文本视觉一致的路径对象（字形固化为矢量路径，不再依赖系统字体，可继续点位编辑/布尔运算/导出），原文本被移除，整体为一条撤销记录，转曲结果自动选中。返回新路径对象 objectId。',
    handler: async (gateway, args) => {
      const objectId = optionalString(args.objectId)
      return gateway.outlineText(objectId)
    }
  },

  /* ── 布尔运算 ── */
  boolean_ops: {
    description: '对 2 个及以上对象执行布尔运算并生成单一结果路径对象：operation 必填，取 union（并集）/intersect（交集）/subtract（差集）/xor（异或）；objectIds 可省略（省略时使用当前选中对象），按图层顺序参与运算，subtract 只取前两个对象；subtractDirection 可选 forward（A-B，默认）或 reverse（B-A），仅对 subtract 生效。万花筒实例与布尔预览对象不参与运算。运算成功后结果对象自动选中，返回 { objectId, operation }。',
    handler: async (gateway, args) => {
      const operation = optionalString(args.operation)
      if (!operation) throw new Error('缺少 operation 参数（union/intersect/subtract/xor）')
      const subtractDirection = optionalString(args.subtractDirection)
      if (subtractDirection !== undefined && subtractDirection !== 'forward' && subtractDirection !== 'reverse') {
        throw new Error('subtractDirection 必须是 forward 或 reverse')
      }
      return gateway.booleanOps(
        optionalStringArray(args.objectIds),
        operation as 'union' | 'intersect' | 'subtract' | 'xor',
        (subtractDirection as 'forward' | 'reverse') ?? 'forward'
      )
    }
  },

  /* ── 蒙版裁切 ── */
  mask_objects: {
    description: '把一个对象设为另一个对象的蒙版（clipPath 裁切）：objectId 为被裁切的目标对象，maskId 为蒙版对象（两者都必须已存在于画布）。裁剪区域与蒙版当前在画布上的视觉位置/尺寸/旋转完全一致（自动换算目标与蒙版之间的位移/缩放/旋转差），蒙版形状之外的部分被隐藏；removeMaskObject 为 true 时应用后从画布移除蒙版对象（默认 false 保留以便继续编辑复用）。整个操作合并为一条撤销记录。返回 { objectId, clipPathId }。',
    handler: async (gateway, args) => {
      const objectId = optionalString(args.objectId)
      const maskId = optionalString(args.maskId)
      if (!objectId) throw new Error('缺少 objectId 参数')
      if (!maskId) throw new Error('缺少 maskId 参数')
      return gateway.maskObjects(objectId, maskId, optionalBoolean(args.removeMaskObject) ?? false)
    }
  },
  unmask_object: {
    description: '移除对象上的蒙版（clipPath）恢复完整显示：objectId 必填，对象当前没有蒙版时报错。返回移除后的对象摘要（masked=false），操作为一条撤销记录。',
    handler: async (gateway, args) => {
      const objectId = optionalString(args.objectId)
      if (!objectId) throw new Error('缺少 objectId 参数')
      return gateway.unmaskObject(objectId)
    }
  },

  /* ── 历史与快照 ── */
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
  save_snapshot: {
    description: '把当前画布完整内容存为命名快照：name 必填（非空字符串，同名覆盖）；快照只含画布视觉状态（对象、层级、背景，不含色板/样式预设），随工程保存持久化、不占撤销历史。新增快照超出 20 个上限时报错提示先删除。返回 { name, objectCount, createdAt }。',
    handler: (gateway, args) => {
      const name = optionalString(args.name)
      if (!name) throw new Error('缺少 name 参数')
      return gateway.saveSnapshot(name)
    }
  },
  restore_snapshot: {
    description: '把画布内容整体替换为指定命名快照：name 必填（不存在报错，可先 list_snapshots 查询）。恢复前会把当前画布自动备份为名为 "__backup__"+时间戳 的快照防丢失；恢复本身是一条撤销记录（undo 可回到恢复前）。返回 { name, backupName, objectCount }。',
    handler: (gateway, args) => {
      const name = optionalString(args.name)
      if (!name) throw new Error('缺少 name 参数')
      return gateway.restoreSnapshot(name)
    }
  },
  delete_snapshot: {
    description: '删除指定名称的命名画布快照：name 必填，不存在时报错（含自动备份快照，名称形如 __backup__+时间戳）。返回剩余快照列表。',
    handler: (gateway, args) => {
      const name = optionalString(args.name)
      if (!name) throw new Error('缺少 name 参数')
      return gateway.deleteSnapshot(name)
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
    description: '导出优化 SVG 文本（不写文件）。includeBackground 为 true 时包含画布背景；artboardId 可选，指定时临时切换到该画板导出并自动恢复原画板（画板 id 见 list_artboards）。',
    handler: async (gateway, args) => {
      const svg = await gateway.exportSvgText({
        includeBackground: optionalBoolean(args.includeBackground) ?? false,
        artboardId: optionalString(args.artboardId)
      })
      return { svg }
    }
  },
  export_png_data_url: {
    description: '渲染位图并返回 dataURL（不写文件）。size 为输出宽度像素（默认画布宽），transparentBackground 为 true 时透明背景；format 可选 png（默认）或 webp，webp 时 quality 可选 0-1（默认 0.92）；artboardId 可选，指定时按该画板渲染。',
    handler: async (gateway, args) => {
      const dataUrl = await gateway.exportPngDataUrl({
        size: optionalNumber(args.size),
        transparentBackground: optionalBoolean(args.transparentBackground) ?? false,
        format: optionalImageFormat(args.format),
        quality: optionalQuality(args.quality),
        artboardId: optionalString(args.artboardId)
      })
      return { dataUrl }
    }
  },
  get_canvas_thumbnail: {
    description: '渲染画布快速预览缩略图（透明底 PNG dataURL，不落盘），语义是"给 AI 看的快速预览"：建议在每次修改布局/配色后调用本操作做视觉自检（低成本、透明底、适合确认整体效果），确认无误后再继续精调或用 export_* 系列正式导出。size 为输出宽度像素（默认 256，范围 32-512，高度按画布宽高比推导）；artboardId 可选，指定时按该画板渲染。返回 { dataUrl, width, height }。',
    handler: async (gateway, args) => {
      const size = optionalNumber(args.size)
      if (size !== undefined && (size < 32 || size > 512)) throw new Error('size 取值范围 32-512')
      return gateway.getCanvasThumbnail({
        size,
        artboardId: optionalString(args.artboardId)
      })
    }
  },
  export_svg_file: {
    description: '导出 SVG 到下载目录，返回文件路径。fileName 可选，includeBackground 为 true 时包含背景；outputDir 可选（绝对目录，同名文件覆盖，缺省写入系统下载目录并自动避让同名文件）；artboardId 可选按该画板导出。',
    handler: async (gateway, args) => {
      const filePath = await gateway.exportSvgFile({
        fileName: optionalString(args.fileName),
        includeBackground: optionalBoolean(args.includeBackground) ?? false,
        outputDir: optionalOutputDir(args.outputDir),
        artboardId: optionalString(args.artboardId)
      })
      return { filePath }
    }
  },
  export_png_file: {
    description: '导出 PNG/WebP 到下载目录，返回文件路径。size 为输出宽度像素（默认画布宽），fileName 与 transparentBackground 可选；format 可选 png（默认）或 webp，webp 时 quality 可选 0-1（默认 0.92）；outputDir 可选（绝对目录，同名文件覆盖，缺省写入系统下载目录）；artboardId 可选按该画板导出。',
    handler: async (gateway, args) => {
      const filePath = await gateway.exportPngFile({
        size: optionalNumber(args.size),
        fileName: optionalString(args.fileName),
        transparentBackground: optionalBoolean(args.transparentBackground) ?? false,
        format: optionalImageFormat(args.format),
        quality: optionalQuality(args.quality),
        outputDir: optionalOutputDir(args.outputDir),
        artboardId: optionalString(args.artboardId)
      })
      return { filePath }
    }
  },
  export_size_set: {
    description: '按预设尺寸集批量导出多尺寸 PNG 文件。preset 取值 favicon/pwa/android/ios/electron/custom：指定预设时 sizes 可省略（使用内置尺寸集，favicon=[16,32,48,64,128,256]、pwa=[72,96,128,144,152,192,384,512]、android=[48,72,96,144,192,512]、ios=[20,29,40,58,60,76,80,87,120,152,167,180,1024]、electron=[16,24,32,48,64,128,256,512,1024]），传 sizes 时覆盖预设尺寸；preset=custom 或省略时 sizes 必填（1-4096 整数，自动去重升序）。fileNamePrefix 默认 icon（文件名形如 icon-256.png），transparentBackground 默认 false；outputDir 可选（绝对目录，同名覆盖，缺省写入系统下载目录）；artboardId 可选按该画板导出。返回 { files: [{ size, filePath }], outputDir }。',
    handler: async (gateway, args) => {
      const preset = optionalString(args.preset)
      if (preset && !['favicon', 'pwa', 'android', 'ios', 'electron', 'custom'].includes(preset)) {
        throw new Error('preset 必须是 favicon/pwa/android/ios/electron/custom 之一')
      }
      const sizes = optionalNumberArray(args.sizes)
      if ((!preset || preset === 'custom') && !sizes) {
        throw new Error('preset=custom 时必须提供 sizes（1-4096 的整数数组）')
      }
      return gateway.exportSizeSet({
        preset: preset as 'favicon' | 'pwa' | 'android' | 'ios' | 'electron' | 'custom' | undefined,
        sizes,
        fileNamePrefix: optionalString(args.fileNamePrefix),
        transparentBackground: optionalBoolean(args.transparentBackground),
        outputDir: optionalOutputDir(args.outputDir),
        artboardId: optionalString(args.artboardId)
      })
    }
  },
  export_icon_container: {
    description: '把当前画布渲染为多尺寸透明 PNG 并打包为图标容器文件落盘：format 必填 ico 或 icns。sizes 可选（ico 默认 [16,24,32,48,64,128,256] 且单帧最大 256px，icns 默认 [16,32,64,128,256,512] 且最大 512px，自动去重升序）；fileName 默认 icon.ico / icon.icns；outputDir 可选（绝对目录，同名覆盖，缺省写入系统下载目录）；artboardId 可选按该画板导出。返回 { filePath, sizes }。',
    handler: async (gateway, args) => {
      const format = optionalString(args.format)
      if (format !== 'ico' && format !== 'icns') throw new Error('缺少 format 参数（必须是 ico 或 icns）')
      return gateway.exportIconContainer({
        format,
        sizes: optionalNumberArray(args.sizes),
        fileName: optionalString(args.fileName),
        outputDir: optionalOutputDir(args.outputDir),
        artboardId: optionalString(args.artboardId)
      })
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

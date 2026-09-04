import type { FabricObject } from 'fabric'
import type { IconCreatorProjectFile, KeylineTemplate } from '../types'
import type { AnyFabricObject } from '../fabric/objectMetadata'
import { EDITOR_OBJECT_ID_PREFIX } from '../fabric/objectMetadata'
import { basicShapes, textPresets, iconTemplates } from '../editorCatalog'
import type { ShapeLibraryItem, TextLibraryItem, IconTemplateItem } from '../editorCatalog'
import { normalizeCanvasBg, normalizeKeylineTemplate, normalizePixelGridSize } from '../canvasSettings'
import { parseProjectFileText, stringifyProjectFile } from '../projectFile'
import type {
  McpCanvasOverview,
  McpEditorGateway,
  McpEditorGatewayInternals,
  McpObjectSummary
} from './mcpGatewayTypes'

/**
 * useHomeEditorRuntime 提供给 MCP 网关的全部依赖句柄。
 * 依赖以 getter/函数形式传入（而非直接捕获 refs），保证网关实现不关心
 * 组合式函数内部的变量顺序，也便于后续模块化迁移时替换来源。
 */
export interface McpEditorGatewayOptions {
  getFabricCanvas: () => import('fabric').Canvas | null
  getActiveObject: () => FabricObject | null
  getObjects: () => FabricObject[]
  getSelection: () => FabricObject[]
  ensureEditorObjectId: (obj: FabricObject | null | undefined) => string
  isBooleanPreviewObject: (obj: FabricObject | null | undefined) => boolean

  // 画布状态 refs
  canvasWidth: () => number
  canvasHeight: () => number
  canvasBg: () => string
  zoom: () => number
  showPixelGrid: () => boolean
  snapToPixelGrid: () => boolean
  pixelGridSize: () => number
  keylineTemplate: () => KeylineTemplate

  // 画布操作
  setCanvasSize: (dim: 'width' | 'height', value: number) => void
  setCanvasBg: (color: string) => void
  setPixelGridVisible: (visible: boolean) => void
  setSnapToPixelGrid: (enabled: boolean) => void
  setPixelGridSize: (value: number) => void
  setKeylineTemplate: (template: KeylineTemplate) => void
  setKeylineMargin: (value: number) => void
  setSelectionMode: (mode: 'shape' | 'point' | 'segment') => void
  setZoom: (value: number) => void
  fitCanvasInView: () => void

  // 对象增删
  addShape: (item: ShapeLibraryItem, scenePoint: { x: number; y: number } | null) => void
  addText: (preset: TextLibraryItem, scenePoint: { x: number; y: number } | null) => void
  setObjProp: (prop: string, value: unknown) => void
  applyActiveObjectsSelection: (objects: FabricObject[]) => void
  selectAllByMode: () => void
  deleteObjects: (objects?: FabricObject[]) => void
  duplicateSelection: () => Promise<boolean>
  flipObject: (axis: 'x' | 'y') => void
  layerUp: () => void
  layerDown: () => void
  layerTop: () => void
  layerBottom: () => void
  lockObject: () => void
  groupObjects: () => void
  ungroupObject: () => void
  scaleObjectToDisplaySize: (obj: FabricObject, width: number, height: number) => void
  importSVGText: (svgText: string, displayName: string) => Promise<void>
  insertIconifyIcon: (iconName: string, scenePoint?: { x: number; y: number } | null) => Promise<void>
  insertIconTemplate: (template: IconTemplateItem, scenePoint?: { x: number; y: number } | null) => Promise<void>
  applyIconTemplateAsDocument: (template: IconTemplateItem) => Promise<void>

  // 图层显示/锁定（来自 layers 模块的批量能力）
  setObjectsVisible: (objects: FabricObject[], visible: boolean) => void
  setObjectsLocked: (objects: FabricObject[], locked: boolean) => void

  // 历史
  undo: () => void
  redo: () => void
  jumpToHistory: (index: number) => void
  undoStack: () => Array<{ json: string; description: string; timestamp: number }>
  historyIndex: () => number

  // 工程文档
  newDoc: () => void
  saveActiveProjectTab: () => void
  hasSavedProjectPath: () => boolean
  createProjectFile: () => IconCreatorProjectFile
  loadProjectFile: (project: IconCreatorProjectFile) => Promise<void>

  // 画板
  artboards: () => Array<{ id: string; name: string; canvas: { width: number; height: number }; fabric: Record<string, unknown>; layerOrder: string[] }>
  activeArtboardId: () => string
  canRedo: () => boolean
  switchArtboard: (artboardId: string) => Promise<void>
  addArtboard: () => Promise<void>
  deleteArtboard: (artboardId: string) => Promise<void>
  renameArtboardDirect: (artboardId: string, name: string) => void

  // 导出
  exportSvgText: (includeBackground?: boolean) => Promise<string>
  exportSvgSelection: () => Promise<string>
  exportPngDataUrl: (size?: number, transparentBackground?: boolean) => string
  exportSvgFile: (fileName?: string, includeBackground?: boolean) => Promise<string>
  exportPngFile: (size?: number, fileName?: string, transparentBackground?: boolean) => string

  // 其他
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

/**
 * 创建 MCP 编辑器网关实现：把编辑器运行时的闭包能力适配为
 * mcpGatewayTypes 声明的稳定接口。所有操作都通过 options 里的句柄
 * 间接访问编辑器状态，因此本文件不 import 任何运行时内部变量。
 */
export function createMcpEditorGateway(options: McpEditorGatewayOptions): McpEditorGateway {
  /** 按 editorObjectId 查找对象（自动过滤布尔预览等内部对象）。 */
  function findObject(objectId: string): FabricObject | null {
    return (
      options
        .getObjects()
        .find((obj) => !options.isBooleanPreviewObject(obj) && ensureId(obj) === objectId) ?? null
    )
  }

  /** 读取（必要时补齐）对象 id。 */
  function ensureId(obj: FabricObject): string {
    return options.ensureEditorObjectId(obj)
  }

  /** 把 Fabric 对象转为 MCP 摘要。 */
  function toSummary(obj: FabricObject, index: number): McpObjectSummary {
    const target = obj as AnyFabricObject
    const width = obj.getScaledWidth?.() ?? Number(obj.width ?? 0)
    const height = obj.getScaledHeight?.() ?? Number(obj.height ?? 0)
    return {
      id: ensureId(obj),
      name: String(target.name ?? obj.type ?? '对象'),
      type: String(obj.type ?? 'unknown'),
      visible: obj.visible !== false,
      locked: !!obj.lockMovementX,
      left: Number(obj.left ?? 0),
      top: Number(obj.top ?? 0),
      width,
      height,
      scaleX: Number(obj.scaleX ?? 1),
      scaleY: Number(obj.scaleY ?? 1),
      angle: Number(obj.angle ?? 0),
      opacity: Number(obj.opacity ?? 1),
      fill: typeof obj.fill === 'string' ? obj.fill : null,
      stroke: typeof obj.stroke === 'string' ? obj.stroke : null,
      strokeWidth: Number(obj.strokeWidth ?? 0),
      zIndex: index
    }
  }

  /** 统一的“按 id 或选中态”目标解析，供复制/编组等操作复用。 */
  function withTargets(objectIds: string[] | undefined): FabricObject[] {
    if (objectIds && objectIds.length) {
      const targets = objectIds
        .map((id) => findObject(id))
        .filter((obj): obj is FabricObject => !!obj)
      if (!targets.length) throw new Error('指定的对象均未找到')
      return targets
    }
    const selection = options.getSelection()
    if (!selection.length) throw new Error('当前没有选中对象')
    return selection
  }

  const gateway: McpEditorGateway = {
    getOverview(): McpCanvasOverview {
      const selection = options.getSelection()
      return {
        canvasWidth: options.canvasWidth(),
        canvasHeight: options.canvasHeight(),
        canvasBg: options.canvasBg(),
        zoom: options.zoom(),
        showPixelGrid: options.showPixelGrid(),
        snapToPixelGrid: options.snapToPixelGrid(),
        pixelGridSize: options.pixelGridSize(),
        keylineTemplate: options.keylineTemplate(),
        activeArtboardId: options.activeArtboardId(),
        artboardCount: options.artboards().length,
        objectCount: options.getObjects().filter((obj) => !options.isBooleanPreviewObject(obj)).length,
        selectionCount: selection.length,
        canUndo: options.undoStack().length > 1,
        canRedo: options.canRedo(),
        historyLength: options.undoStack().length,
        historyIndex: options.historyIndex(),
        activeObjectIds: selection.map(ensureId)
      }
    },

    listObjects(): McpObjectSummary[] {
      return options
        .getObjects()
        .filter((obj) => !options.isBooleanPreviewObject(obj))
        .map(toSummary)
    },

    getObjectSummary(objectId: string): McpObjectSummary | null {
      const objects = options.getObjects().filter((obj) => !options.isBooleanPreviewObject(obj))
      const index = objects.findIndex((obj) => ensureId(obj) === objectId)
      return index >= 0 ? toSummary(objects[index], index) : null
    },

    getSelectionIds(): string[] {
      return options.getSelection().map(ensureId)
    },

    getSelectionSvg(): Promise<string> {
      return options.exportSvgSelection()
    },

    getActiveObjectProps(): Record<string, unknown> | null {
      const selection = options.getSelection()
      const target = selection.length === 1 ? selection[0] : null
      if (!target) {
        if (!selection.length) return null
        return { multiSelection: true, ids: selection.map(ensureId) }
      }
      const typed = target as AnyFabricObject
      return {
        id: ensureId(target),
        name: typed.name,
        type: target.type,
        left: target.left,
        top: target.top,
        width: target.width,
        height: target.height,
        scaleX: target.scaleX,
        scaleY: target.scaleY,
        angle: target.angle,
        opacity: target.opacity,
        fill: typeof target.fill === 'string' ? target.fill : undefined,
        stroke: typeof target.stroke === 'string' ? target.stroke : undefined,
        strokeWidth: target.strokeWidth,
        cornerRadius: typed.cornerRadius,
        editable: typed.editablePath !== undefined
      }
    },

    listArtboards() {
      return options.artboards().map((artboard) => ({
        id: artboard.id,
        name: artboard.name,
        width: artboard.canvas.width,
        height: artboard.canvas.height,
        objectCount: Array.isArray((artboard.fabric as { objects?: unknown[] }).objects)
          ? ((artboard.fabric as { objects: unknown[] }).objects.length)
          : 0,
        active: artboard.id === options.activeArtboardId()
      }))
    },

    listHistory() {
      return options.undoStack().map((item, index) => ({
        index,
        description: item.description,
        timestamp: item.timestamp
      }))
    },

    resizeCanvas(width?: number, height?: number): void {
      if (width !== undefined) options.setCanvasSize('width', Math.round(width))
      if (height !== undefined) options.setCanvasSize('height', Math.round(height))
    },

    setCanvasBackground(color: string): void {
      options.setCanvasBg(color)
    },

    setPixelGrid(settings): void {
      if (settings.visible !== undefined) options.setPixelGridVisible(settings.visible)
      if (settings.snap !== undefined) options.setSnapToPixelGrid(settings.snap)
      if (settings.size !== undefined) options.setPixelGridSize(normalizePixelGridSize(settings.size))
    },

    setKeyline(settings): void {
      if (settings.template) {
        options.setKeylineTemplate(normalizeKeylineTemplate(settings.template))
      }
      if (settings.margin !== undefined) options.setKeylineMargin(settings.margin)
    },

    addShape(shape, settings): string {
      // 允许 AI 传短名（rectangle）或目录全名（base-rectangle）。
      const normalizedId = shape.startsWith('base-') ? shape : `base-${shape}`
      const item = basicShapes.find((candidate) => candidate.id === normalizedId)
      if (!item) {
        throw new Error(`未知图形: ${shape}。可用图形见 list: ${basicShapes.map((s) => s.id).join(', ')}`)
      }
      const scenePoint =
        settings?.x !== undefined || settings?.y !== undefined
          ? { x: settings.x ?? options.canvasWidth() / 2, y: settings.y ?? options.canvasHeight() / 2 }
          : null
      options.addShape(item, scenePoint)
      // addShape 内部会把新对象设为选中，从选中态读取新对象 id。
      const created = options.getSelection()[0]
      if (!created) throw new Error('图形创建后未能读取到新对象')
      const id = ensureId(created)
      if (settings?.width !== undefined || settings?.height !== undefined) {
        options.scaleObjectToDisplaySize(
          created,
          settings.width ?? created.getScaledWidth(),
          settings.height ?? created.getScaledHeight()
        )
      }
      return id
    },

    addText(settings): string {
      const preset =
        (settings.preset && textPresets.find((candidate) => candidate.id === settings.preset)) ||
        textPresets.find((candidate) => candidate.id === 'body')
      if (!preset) throw new Error(`未知文本预设: ${settings.preset}`)
      const scenePoint =
        settings?.x !== undefined || settings?.y !== undefined
          ? { x: settings.x ?? options.canvasWidth() / 2, y: settings.y ?? options.canvasHeight() / 2 }
          : null
      options.addText(preset, scenePoint)
      const created = options.getSelection()[0]
      if (!created) throw new Error('文本创建后未能读取到新对象')
      // 覆盖内容与可选样式：统一走 setObjProp 保持撤销/同步逻辑一致。
      options.setObjProp('text', settings.text)
      if (settings.fontSize !== undefined) options.setObjProp('fontSize', settings.fontSize)
      if (settings.fill !== undefined) options.setObjProp('fill', settings.fill)
      return ensureId(created)
    },

    async insertSvg(svg, settings): Promise<string> {
      await options.importSVGText(svg, settings?.name ?? '导入 SVG')
      const created = options.getSelection()[0]
      if (!created) throw new Error('SVG 导入后未能读取到新对象')
      if (settings?.x !== undefined || settings?.y !== undefined) {
        options.setObjProp('left', settings.x ?? Number(created.left ?? 0))
        options.setObjProp('top', settings.y ?? Number(created.top ?? 0))
      }
      return ensureId(created)
    },

    async insertIconifyIcon(iconName, settings): Promise<string> {
      const hasPoint = settings && (settings.x !== undefined || settings.y !== undefined)
      const scenePoint = hasPoint
        ? { x: settings!.x ?? options.canvasWidth() / 2, y: settings!.y ?? options.canvasHeight() / 2 }
        : null
      await options.insertIconifyIcon(iconName, scenePoint)
      const created = options.getSelection()[0]
      if (!created) throw new Error('图标插入后未能读取到新对象')
      return ensureId(created)
    },

    async insertIconTemplate(templateId): Promise<string> {
      const template = iconTemplates.find((candidate) => candidate.id === templateId)
      if (!template) {
        throw new Error(`未知模板: ${templateId}。可用模板: ${iconTemplates.map((t) => t.id).join(', ')}`)
      }
      await options.insertIconTemplate(template)
      const created = options.getSelection()[0]
      if (!created) throw new Error('模板插入后未能读取到新对象')
      return ensureId(created)
    },

    async applyIconTemplateAsDocument(templateId): Promise<void> {
      const template = iconTemplates.find((candidate) => candidate.id === templateId)
      if (!template) {
        throw new Error(`未知模板: ${templateId}。可用模板: ${iconTemplates.map((t) => t.id).join(', ')}`)
      }
      await options.applyIconTemplateAsDocument(template)
    },

    selectObjects(objectIds, mode = 'shape'): void {
      options.setSelectionMode(mode)
      if (!objectIds.length) {
        options.applyActiveObjectsSelection([])
        return
      }
      const targets = objectIds
        .map((id) => findObject(id))
        .filter((obj): obj is FabricObject => !!obj)
      if (!targets.length) throw new Error('指定的对象均未找到')
      options.applyActiveObjectsSelection(targets)
    },

    selectAll(): void {
      options.selectAllByMode()
    },

    setObjectProps(objectId: string, props: Record<string, unknown>): void {
      const target = findObject(objectId)
      if (!target) throw new Error(`未找到对象: ${objectId}`)
      options.applyActiveObjectsSelection([target])
      // width/height 以显示尺寸语义换算成缩放设置。
      const next = { ...props }
      const width = next.width
      const height = next.height
      delete next.width
      delete next.height
      for (const [prop, value] of Object.entries(next)) {
        options.setObjProp(prop, value)
      }
      if (width !== undefined || height !== undefined) {
        options.scaleObjectToDisplaySize(
          target,
          width !== undefined ? Number(width) : target.getScaledWidth(),
          height !== undefined ? Number(height) : target.getScaledHeight()
        )
      }
    },

    moveLayer(objectId: string, direction: 'up' | 'down' | 'top' | 'bottom'): void {
      const target = findObject(objectId)
      if (!target) throw new Error(`未找到对象: ${objectId}`)
      options.applyActiveObjectsSelection([target])
      if (direction === 'up') options.layerUp()
      else if (direction === 'down') options.layerDown()
      else if (direction === 'top') options.layerTop()
      else options.layerBottom()
    },

    setObjectVisible(objectId: string, visible: boolean): void {
      const target = findObject(objectId)
      if (!target) throw new Error(`未找到对象: ${objectId}`)
      options.setObjectsVisible([target], visible)
    },

    setObjectLocked(objectId: string, locked: boolean): void {
      const target = findObject(objectId)
      if (!target) throw new Error(`未找到对象: ${objectId}`)
      options.setObjectsLocked([target], locked)
    },

    async duplicateObjects(objectIds): Promise<string[]> {
      if (!objectIds || !objectIds.length) {
        const ok = await options.duplicateSelection()
        if (!ok) throw new Error('当前没有可复制的选中对象')
        return options.getSelection().map(ensureId)
      }
      // 指定 id：先按 id 选中再复制，结束后不恢复原选中（复制出的对象保持选中更符合直觉）。
      const targets = objectIds
        .map((id) => findObject(id))
        .filter((obj): obj is FabricObject => !!obj)
      if (!targets.length) throw new Error('指定的对象均未找到')
      options.applyActiveObjectsSelection(targets)
      const ok = await options.duplicateSelection()
      if (!ok) throw new Error('复制操作失败')
      return options.getSelection().map(ensureId)
    },

    deleteObjects(objectIds): void {
      if (!objectIds || !objectIds.length) {
        options.deleteObjects()
        return
      }
      const targets = objectIds
        .map((id) => findObject(id))
        .filter((obj): obj is FabricObject => !!obj)
      if (!targets.length) throw new Error('指定的对象均未找到')
      options.deleteObjects(targets)
    },

    flipObject(objectId: string, axis: 'x' | 'y'): void {
      const target = findObject(objectId)
      if (!target) throw new Error(`未找到对象: ${objectId}`)
      options.applyActiveObjectsSelection([target])
      options.flipObject(axis)
    },

    groupObjects(objectIds): void {
      const targets = withTargets(objectIds)
      if (targets.length < 2) throw new Error('编组至少需要 2 个对象')
      options.applyActiveObjectsSelection(targets)
      options.groupObjects()
    },

    ungroupObject(objectId): void {
      const target = objectId ? findObject(objectId) : options.getSelection()[0]
      if (!target) throw new Error('未找到可解散的编组对象')
      options.applyActiveObjectsSelection([target])
      options.ungroupObject()
    },

    undo(): void {
      options.undo()
    },

    redo(): void {
      options.redo()
    },

    jumpToHistory(index: number): void {
      options.jumpToHistory(index)
    },

    newDocument(): void {
      options.newDoc()
    },

    saveProject(): string {
      if (options.hasSavedProjectPath()) {
        options.saveActiveProjectTab()
        return '工程已保存。'
      }
      options.saveActiveProjectTab()
      return '已触发保存：当前标签尚未记忆文件路径，如弹出了保存对话框请在界面中完成路径选择。'
    },

    getProjectJson(): string {
      return stringifyProjectFile(options.createProjectFile())
    },

    async loadProjectJson(json: string): Promise<void> {
      const { project } = parseProjectFileText(json)
      await options.loadProjectFile(project)
    },

    async switchArtboard(artboardId: string): Promise<void> {
      const exists = options.artboards().some((artboard) => artboard.id === artboardId)
      if (!exists) throw new Error(`未找到画板: ${artboardId}`)
      await options.switchArtboard(artboardId)
    },

    async addArtboard(): Promise<string> {
      await options.addArtboard()
      const activeId = options.activeArtboardId()
      if (!activeId) throw new Error('新建画板后未能读取到画板 id')
      return activeId
    },

    async deleteArtboard(artboardId: string): Promise<void> {
      if (options.artboards().length <= 1) throw new Error('至少需要保留一个画板')
      await options.deleteArtboard(artboardId)
    },

    renameArtboard(artboardId: string, name: string): void {
      options.renameArtboardDirect(artboardId, name)
    },

    async exportSvgText(includeBackground = false): Promise<string> {
      return options.exportSvgText(includeBackground)
    },

    exportPngDataUrl(size, transparentBackground = false): string {
      return options.exportPngDataUrl(size, transparentBackground)
    },

    async exportSvgFile(fileName, includeBackground = false): Promise<string> {
      const filePath = await options.exportSvgFile(fileName, includeBackground)
      if (!filePath) throw new Error('SVG 导出失败')
      return filePath
    },

    exportPngFile(size, fileName, transparentBackground = false): string {
      const filePath = options.exportPngFile(size, fileName, transparentBackground)
      if (!filePath) throw new Error('PNG 导出失败')
      return filePath
    },

    setViewport(settings): void {
      if (settings.fit) options.fitCanvasInView()
      else if (settings.zoom !== undefined) options.setZoom(settings.zoom)
    },

    async runInEditor<T>(fn: (editor: McpEditorGatewayInternals) => T | Promise<T>): Promise<T> {
      const internals: McpEditorGatewayInternals = {
        fabricCanvas: options.getFabricCanvas(),
        activeObject: options.getActiveObject()
      }
      return await fn(internals)
    }
  }

  // 挂一个便于调试的标识：确保 ID 前缀引用不因 tree-shaking 丢失。
  void EDITOR_OBJECT_ID_PREFIX

  return gateway
}

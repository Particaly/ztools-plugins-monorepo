import { DEFAULT_KEYLINE_MARGIN, DEFAULT_KEYLINE_OPACITY, DEFAULT_PIXEL_GRID_SIZE, PROJECT_SCHEMA_VERSION } from './constants'
import { normalizeCanvasBg, normalizeKeylineMargin, normalizeKeylineOpacity, normalizeKeylineTemplate, normalizePixelGridSize } from './canvasSettings'
import type { IconCreatorDraftFile, IconCreatorProjectArtboard, IconCreatorProjectCanvas, IconCreatorProjectFile, ParsedProjectFileResult } from './types'

// 读取工程画布与辅助设置，过滤无效值，避免损坏文件把画布或网格恢复成不可用状态。
export function normalizeProjectCanvasSettings(value: unknown): IconCreatorProjectCanvas {
  const source = value && typeof value === 'object' ? value as Partial<IconCreatorProjectCanvas> : {}
  const width = Number(source.width)
  const height = Number(source.height)
  return {
    width: Number.isFinite(width) && width > 0 ? width : 512,
    height: Number.isFinite(height) && height > 0 ? height : 512,
    background: normalizeCanvasBg(source.background ?? '#ffffff'),
    gridSize: normalizePixelGridSize(source.gridSize ?? DEFAULT_PIXEL_GRID_SIZE),
    showPixelGrid: source.showPixelGrid === true,
    snapToPixelGrid: source.snapToPixelGrid === true,
    keylineTemplate: normalizeKeylineTemplate(source.keylineTemplate),
    keylineMargin: normalizeKeylineMargin(source.keylineMargin ?? DEFAULT_KEYLINE_MARGIN),
    keylineOpacity: normalizeKeylineOpacity(source.keylineOpacity ?? DEFAULT_KEYLINE_OPACITY)
  }
}

// 将工程数据包装成稳定的 JSON 文本，方便后续保存、比对和草稿落盘。
export function stringifyProjectFile(project: IconCreatorProjectFile) {
  return JSON.stringify({
    ...project,
    updatedAt: new Date().toISOString()
  }, null, 2)
}

// 解析手动工程文件或自动草稿，校验应用标识与 schema 版本后再允许恢复。
export function parseProjectFileText(text: string): ParsedProjectFileResult {
  const parsed = JSON.parse(text) as Partial<IconCreatorProjectFile | IconCreatorDraftFile>
  const maybeDraft = parsed as Partial<IconCreatorDraftFile>
  const project = maybeDraft.app === 'icon-creator' && maybeDraft.project
    ? maybeDraft.project
    : parsed as Partial<IconCreatorProjectFile>
  if (project.app !== 'icon-creator') throw new Error('不是 Icon Creator 工程文件')
  if (typeof project.schemaVersion !== 'number' || project.schemaVersion > PROJECT_SCHEMA_VERSION) {
    throw new Error('工程文件版本不兼容')
  }
  if (!project.fabric || typeof project.fabric !== 'object') throw new Error('工程文件缺少画布对象数据')
  const artboards = Array.isArray(project.artboards)
    ? project.artboards
      .filter((artboard): artboard is IconCreatorProjectArtboard => !!artboard && typeof artboard === 'object' && !!artboard.fabric && typeof artboard.fabric === 'object')
      .map((artboard, index) => ({
        id: typeof artboard.id === 'string' && artboard.id.trim() ? artboard.id : `artboard-${index + 1}`,
        name: typeof artboard.name === 'string' && artboard.name.trim() ? artboard.name : `画板 ${index + 1}`,
        canvas: normalizeProjectCanvasSettings(artboard.canvas),
        fabric: artboard.fabric as Record<string, unknown>,
        layerOrder: Array.isArray(artboard.layerOrder) ? artboard.layerOrder.filter((id): id is string => typeof id === 'string') : [],
        thumbnail: typeof artboard.thumbnail === 'string' ? artboard.thumbnail : undefined
      }))
    : undefined
  return {
    project: {
      app: 'icon-creator',
      schemaVersion: project.schemaVersion || PROJECT_SCHEMA_VERSION,
      createdAt: typeof project.createdAt === 'string' ? project.createdAt : new Date().toISOString(),
      updatedAt: typeof project.updatedAt === 'string' ? project.updatedAt : new Date().toISOString(),
      canvas: normalizeProjectCanvasSettings(project.canvas),
      fabric: project.fabric as Record<string, unknown>,
      layerOrder: Array.isArray(project.layerOrder) ? project.layerOrder.filter((id): id is string => typeof id === 'string') : [],
      ...(artboards?.length ? { artboards } : {}),
      activeArtboardId: typeof project.activeArtboardId === 'string' ? project.activeArtboardId : undefined
    },
    source: maybeDraft.project ? 'draft' : 'project'
  }
}

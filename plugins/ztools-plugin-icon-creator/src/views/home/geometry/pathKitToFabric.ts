import { Path } from 'fabric'
import type { FabricBooleanStyleSnapshot } from './fabricToPathKit'
import type { PathKitBounds, PathKitPath } from './pathkit'

export type PathKitToFabricOptions = {
  name?: string
  shapeId?: string
  style: FabricBooleanStyleSnapshot
  preview?: boolean
}

type AnyFabricPath = Path & Record<string, any>

function getPathBounds(path: PathKitPath): PathKitBounds | null {
  const bounds = path.computeTightBounds?.() || path.getBounds()
  if (!bounds) return null
  const values = [bounds.fLeft, bounds.fTop, bounds.fRight, bounds.fBottom]
  return values.every((value) => Number.isFinite(value)) ? bounds : null
}

function translatePath(path: PathKitPath, tx: number, ty: number) {
  path.transform([1, 0, tx, 0, 1, ty, 0, 0, 1])
  return path
}

export function pathKitToFabricPath(path: PathKitPath, options: PathKitToFabricOptions) {
  const bounds = getPathBounds(path)
  if (!bounds) return null

  const normalizedPath = path.copy()
  try {
    translatePath(normalizedPath, -bounds.fLeft, -bounds.fTop)
    const svgPath = normalizedPath.toSVGString()
    if (!svgPath.trim()) return null

    const fillRule = path.getFillTypeString?.() || options.style.fillRule || 'nonzero'
    const result = new Path(svgPath, {
      left: bounds.fLeft,
      top: bounds.fTop,
      originX: 'left',
      originY: 'top',
      fill: (options.style.fill ?? 'transparent') as any,
      stroke: (options.style.stroke ?? 'transparent') as any,
      strokeWidth: Number.isFinite(options.style.strokeWidth) ? options.style.strokeWidth : 0,
      strokeUniform: options.style.strokeUniform,
      fillRule,
      opacity: options.style.opacity ?? 1
    })

    const custom = result as AnyFabricPath
    custom.name = options.preview ? '布尔预览' : (options.name || '')
    custom.lastFill = options.style.lastFill
    custom.lastStroke = options.style.lastStroke
    custom.lastStrokeWidth = options.style.lastStrokeWidth
    custom.shapeId = options.preview ? 'boolean-preview' : (options.shapeId || 'boolean-result')
    custom.booleanEligible = !options.preview
    custom.booleanPreview = !!options.preview
    custom.excludeFromExport = !!options.preview
    result.setCoords()
    return result
  } finally {
    normalizedPath.delete()
  }
}

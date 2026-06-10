import { ref } from 'vue'
import { createEmptyArtboard, generateArtboardId, generateArtboardThumbnail } from '../artboardManager'
import { normalizeKeylineMargin, normalizeKeylineTemplate, normalizePixelGridSize } from '../canvasSettings'
import { normalizeProjectCanvasSettings } from '../projectFile'
import type { IconCreatorProjectArtboard } from '../types'
import type { UseHomeArtboardsOptions, UseHomeArtboardsReturn } from './contracts'

export function useHomeArtboards(options: UseHomeArtboardsOptions): UseHomeArtboardsReturn {
  const {
    artboardIdSeed,
    getFabricCanvas,
    serializeFabricCanvas,
    snapshotGate,
    snapshot,
    canvasState,
    showToast,
    isBooleanPreviewObject,
    ensureEditorObjectId,
    isTransparentCanvasBg,
    clearBooleanPreview,
    clearPointEditing,
    syncPixelGridSizeInput,
    syncKeylineMarginInput,
    syncCanvasSizeInputs,
    syncCanvasInteractionMode,
    applyCanvasBgToFabric,
    syncActiveObject,
    syncAllKaleidoscopes,
    ensureCanvasObjectMetadata,
    applyProjectLayerOrder,
    rehydrateCanvasGradientFills,
    syncAllEndpointAttachments,
    applyCanvasTheme,
    refreshLayers,
    fitCanvasInView,
    markSmallPreviewsDirty
  } = options

  const { canvasWidth, canvasHeight, canvasBg, lastOpaqueCanvasBg, showPixelGrid, snapToPixelGrid, pixelGridSize, keylineTemplate, keylineMargin } = canvasState

  const artboards = ref<IconCreatorProjectArtboard[]>([])
  const activeArtboardId = ref('')
  const showArtboardList = ref(false)

  function createArtboardName(index = artboards.value.length + 1) {
    return `画板 ${index}`
  }

  function captureCurrentArtboard(): IconCreatorProjectArtboard {
    const fabricCanvas = getFabricCanvas()
    if (!fabricCanvas) throw new Error('画布尚未初始化')
    const layerOrder = fabricCanvas.getObjects()
      .filter((obj) => !isBooleanPreviewObject(obj))
      .map((obj) => ensureEditorObjectId(obj))
    return {
      id: activeArtboardId.value || generateArtboardId(artboardIdSeed),
      name: createArtboardName(),
      canvas: {
        width: canvasWidth.value,
        height: canvasHeight.value,
        background: canvasBg.value,
        gridSize: pixelGridSize.value,
        showPixelGrid: showPixelGrid.value,
        snapToPixelGrid: snapToPixelGrid.value,
        keylineTemplate: keylineTemplate.value,
        keylineMargin: keylineMargin.value
      },
      fabric: serializeFabricCanvas(),
      layerOrder,
      thumbnail: generateArtboardThumbnail(fabricCanvas, canvasWidth.value, canvasHeight.value)
    }
  }

  async function loadArtboardContent(artboard: IconCreatorProjectArtboard) {
    const fabricCanvas = getFabricCanvas()
    if (!fabricCanvas) return

    clearBooleanPreview()
    clearPointEditing()

    const settings = normalizeProjectCanvasSettings(artboard.canvas)
    canvasWidth.value = settings.width
    canvasHeight.value = settings.height
    canvasBg.value = settings.background
    pixelGridSize.value = normalizePixelGridSize(settings.gridSize)
    showPixelGrid.value = settings.showPixelGrid === true
    snapToPixelGrid.value = settings.snapToPixelGrid === true
    keylineTemplate.value = normalizeKeylineTemplate(settings.keylineTemplate)
    keylineMargin.value = normalizeKeylineMargin(settings.keylineMargin)

    syncPixelGridSizeInput()
    syncKeylineMarginInput()
    syncCanvasInteractionMode()
    if (!isTransparentCanvasBg(settings.background)) lastOpaqueCanvasBg.value = settings.background
    syncCanvasSizeInputs()

    snapshotGate.set(true)
    try {
      fabricCanvas.clear()
      fabricCanvas.setDimensions({ width: canvasWidth.value, height: canvasHeight.value })
      await fabricCanvas.loadFromJSON(artboard.fabric)
      applyCanvasBgToFabric(canvasBg.value)
      await syncAllKaleidoscopes()
      ensureCanvasObjectMetadata()
      applyProjectLayerOrder(artboard.layerOrder)
      rehydrateCanvasGradientFills()
      syncAllEndpointAttachments()
      applyCanvasTheme()
      syncCanvasInteractionMode()
      fabricCanvas.discardActiveObject()
      syncActiveObject(null)
      fabricCanvas.requestRenderAll()
      refreshLayers()
      fitCanvasInView()
      markSmallPreviewsDirty()
    } finally {
      snapshotGate.set(false)
    }
  }

  async function switchArtboard(artboardId: string) {
    const fabricCanvas = getFabricCanvas()
    if (!fabricCanvas || artboardId === activeArtboardId.value) return
    const target = artboards.value.find((artboard) => artboard.id === artboardId)
    if (!target) return

    if (activeArtboardId.value) {
      const currentIndex = artboards.value.findIndex((artboard) => artboard.id === activeArtboardId.value)
      if (currentIndex >= 0) {
        artboards.value[currentIndex] = captureCurrentArtboard()
      }
    }

    activeArtboardId.value = artboardId
    await loadArtboardContent(target)
    snapshot({ description: `切换到画板: ${target.name}`, autoSave: true })
  }

  async function addArtboard() {
    const newArtboard = createEmptyArtboard(
      generateArtboardId(artboardIdSeed),
      createArtboardName()
    )

    if (activeArtboardId.value && getFabricCanvas()) {
      const currentIndex = artboards.value.findIndex((artboard) => artboard.id === activeArtboardId.value)
      if (currentIndex >= 0) {
        artboards.value[currentIndex] = captureCurrentArtboard()
      }
    }

    artboards.value.push(newArtboard)
    activeArtboardId.value = newArtboard.id
    await loadArtboardContent(newArtboard)
    showToast('新建画板成功', 'success')
    snapshot({ description: '新建画板', autoSave: true })
  }

  function duplicateArtboard(artboardId: string) {
    const source = artboards.value.find((artboard) => artboard.id === artboardId)
    if (!source) return

    const duplicate: IconCreatorProjectArtboard = {
      ...source,
      id: generateArtboardId(artboardIdSeed),
      name: `${source.name} 副本`,
      canvas: { ...source.canvas },
      fabric: JSON.parse(JSON.stringify(source.fabric)) as Record<string, unknown>,
      layerOrder: [...source.layerOrder]
    }

    artboards.value.push(duplicate)
    showToast('复制画板成功', 'success')
  }

  function renameArtboard(artboardId: string) {
    const artboard = artboards.value.find((item) => item.id === artboardId)
    if (!artboard) return

    const newName = window.prompt('请输入新名称:', artboard.name)
    if (newName && newName.trim()) {
      artboard.name = newName.trim()
      showToast('重命名成功', 'success')
    }
  }

  async function deleteArtboard(artboardId: string) {
    if (artboards.value.length <= 1) {
      showToast('至少保留一个画板', 'warning')
      return
    }

    if (!window.confirm('确定删除该画板吗?')) return

    const index = artboards.value.findIndex((artboard) => artboard.id === artboardId)
    if (index < 0) return

    artboards.value.splice(index, 1)

    if (artboardId === activeArtboardId.value && artboards.value.length > 0) {
      await switchArtboard(artboards.value[0].id)
    }

    showToast('删除画板成功', 'success')
  }

  return {
    artboards,
    activeArtboardId,
    showArtboardList,
    captureCurrentArtboard,
    loadArtboardContent,
    switchArtboard,
    addArtboard,
    duplicateArtboard,
    renameArtboard,
    deleteArtboard
  }
}

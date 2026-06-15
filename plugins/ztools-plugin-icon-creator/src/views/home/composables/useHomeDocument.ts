import { ref } from 'vue'
import { DRAFT_SAVE_DELAY, DRAFT_STORAGE_KEY, PROJECT_FILE_EXTENSION, PROJECT_SCHEMA_VERSION } from '../constants'
import { normalizeKeylineMargin, normalizeKeylineOpacity, normalizeKeylineTemplate, normalizePixelGridSize } from '../canvasSettings'
import { normalizeProjectCanvasSettings, parseProjectFileText, stringifyProjectFile } from '../projectFile'
import type { IconCreatorDraftFile, IconCreatorProjectFile, SnapshotOptions } from '../types'
import type { HistorySnapshot, HistoryState, UseHomeDocumentOptions, UseHomeDocumentReturn } from './contracts'

export function useHomeDocument(options: UseHomeDocumentOptions): UseHomeDocumentReturn {
  const {
    getFabricCanvas,
    serializeFabricCanvas,
    snapshotGate,
    canvasState,
    artboardState,
    captureCurrentArtboard,
    loadArtboardContent,
    showToast,
    clearBooleanPreview,
    clearPointEditing,
    syncPixelGridSizeInput,
    syncKeylineMarginInput,
    syncCanvasSizeInputs,
    syncCanvasInteractionMode,
    applyCanvasBgToFabric,
    syncCanvasBgFromFabric,
    syncActiveObject,
    syncAllKaleidoscopes,
    ensureCanvasObjectMetadata,
    applyProjectLayerOrder,
    rehydrateCanvasGradientFills,
    syncAllEndpointAttachments,
    applyCanvasTheme,
    refreshLayers,
    fitCanvasInView,
    markSmallPreviewsDirty,
    isBooleanPreviewObject,
    ensureEditorObjectId,
    isTransparentCanvasBg
  } = options

  const { canvasWidth, canvasHeight, canvasBg, lastOpaqueCanvasBg, showPixelGrid, snapToPixelGrid, pixelGridSize, keylineTemplate, keylineMargin, keylineOpacity } = canvasState
  const { artboards, activeArtboardId, showArtboardList } = artboardState

  const undoStack: HistorySnapshot[] = []
  const redoStack: HistorySnapshot[] = []
  const historyIndex = ref(0)
  const canUndo = ref(false)
  const canRedo = ref(false)

  let draftSaveTimer: ReturnType<typeof window.setTimeout> | null = null
  let draftDirty = false
  let restoringDraftPromptShown = false

  function snapshot(options: SnapshotOptions = {}) {
    const fabricCanvas = getFabricCanvas()
    if (snapshotGate.get() || !fabricCanvas) return
    const description = options.description || '编辑操作'
    undoStack.push({
      json: JSON.stringify(serializeFabricCanvas()),
      description,
      timestamp: Date.now()
    })
    if (undoStack.length > 60) undoStack.shift()
    redoStack.length = 0
    historyIndex.value = undoStack.length - 1
    canUndo.value = undoStack.length > 1
    canRedo.value = false
    markSmallPreviewsDirty()
    if (options.autoSave !== false) scheduleDraftSave()
  }

  function createProjectFile(): IconCreatorProjectFile {
    const fabricCanvas = getFabricCanvas()
    if (!fabricCanvas) throw new Error('画布尚未初始化')
    const now = new Date().toISOString()
    const layerOrder = fabricCanvas.getObjects()
      .filter((obj) => !isBooleanPreviewObject(obj))
      .map((obj) => ensureEditorObjectId(obj))

    const projectFile: IconCreatorProjectFile = {
      app: 'icon-creator',
      schemaVersion: PROJECT_SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      canvas: {
        width: canvasWidth.value,
        height: canvasHeight.value,
        background: canvasBg.value,
        gridSize: pixelGridSize.value,
        showPixelGrid: showPixelGrid.value,
        snapToPixelGrid: snapToPixelGrid.value,
        keylineTemplate: keylineTemplate.value,
        keylineMargin: keylineMargin.value,
        keylineOpacity: keylineOpacity.value
      },
      fabric: serializeFabricCanvas(),
      layerOrder
    }

    if (artboards.value.length > 0) {
      if (activeArtboardId.value) {
        const currentIndex = artboards.value.findIndex((artboard) => artboard.id === activeArtboardId.value)
        if (currentIndex >= 0) {
          artboards.value[currentIndex] = captureCurrentArtboard()
        }
      }
      projectFile.artboards = artboards.value.map((artboard) => ({ ...artboard }))
      projectFile.activeArtboardId = activeArtboardId.value
    }

    return projectFile
  }

  /**
   * 捕获当前文档历史栈的可序列化副本，供项目标签切换时隔离每个项目的撤销 / 重做记录。
   */
  function captureHistoryState(): HistoryState {
    return {
      undoStack: undoStack.map((item) => ({ ...item })),
      redoStack: redoStack.map((item) => ({ ...item })),
      historyIndex: historyIndex.value
    }
  }

  /**
   * 恢复指定项目标签保存的历史状态，并同步撤销 / 重做按钮可用性。
   */
  function restoreHistoryState(state: HistoryState) {
    undoStack.length = 0
    redoStack.length = 0
    undoStack.push(...state.undoStack.map((item) => ({ ...item })))
    redoStack.push(...state.redoStack.map((item) => ({ ...item })))
    historyIndex.value = Math.min(Math.max(0, state.historyIndex), Math.max(0, undoStack.length - 1))
    canUndo.value = undoStack.length > 1
    canRedo.value = redoStack.length > 0
  }

  function resetHistoryToCurrentCanvas() {
    undoStack.length = 0
    redoStack.length = 0
    canUndo.value = false
    canRedo.value = false
    snapshot({ autoSave: false })
  }

  async function restoreSingleProjectCanvas(project: IconCreatorProjectFile) {
    const fabricCanvas = getFabricCanvas()
    if (!fabricCanvas) return

    clearBooleanPreview()
    clearPointEditing()
    const settings = normalizeProjectCanvasSettings(project.canvas)
    canvasWidth.value = settings.width
    canvasHeight.value = settings.height
    canvasBg.value = settings.background
    pixelGridSize.value = normalizePixelGridSize(settings.gridSize)
    showPixelGrid.value = settings.showPixelGrid === true
    snapToPixelGrid.value = settings.snapToPixelGrid === true
    keylineTemplate.value = normalizeKeylineTemplate(settings.keylineTemplate)
    keylineMargin.value = normalizeKeylineMargin(settings.keylineMargin)
    keylineOpacity.value = normalizeKeylineOpacity(settings.keylineOpacity)
    syncPixelGridSizeInput()
    syncKeylineMarginInput()
    syncCanvasInteractionMode()
    if (!isTransparentCanvasBg(settings.background)) lastOpaqueCanvasBg.value = settings.background
    syncCanvasSizeInputs()

    snapshotGate.set(true)
    try {
      fabricCanvas.clear()
      fabricCanvas.setDimensions({ width: canvasWidth.value, height: canvasHeight.value })
      await fabricCanvas.loadFromJSON(project.fabric)
      applyCanvasBgToFabric(canvasBg.value)
      await syncAllKaleidoscopes()
      ensureCanvasObjectMetadata()
      applyProjectLayerOrder(project.layerOrder)
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

  async function loadProjectFile(project: IconCreatorProjectFile, options: { keepDraft?: boolean; resetHistory?: boolean } = {}) {
    const fabricCanvas = getFabricCanvas()
    if (!fabricCanvas) return

    if (project.artboards && project.artboards.length > 0) {
      artboards.value = project.artboards.map((artboard) => ({ ...artboard }))
      activeArtboardId.value = project.activeArtboardId || artboards.value[0].id
      showArtboardList.value = true

      const activeArtboard = artboards.value.find((artboard) => artboard.id === activeArtboardId.value) || artboards.value[0]
      await loadArtboardContent(activeArtboard)
    } else {
      artboards.value = []
      activeArtboardId.value = ''
      showArtboardList.value = false
      await restoreSingleProjectCanvas(project)
    }

    if (options.resetHistory !== false) resetHistoryToCurrentCanvas()
    if (!options.keepDraft) clearStoredDraft()
  }

  function scheduleDraftSave() {
    if (!getFabricCanvas() || typeof window === 'undefined') return
    draftDirty = true
    if (draftSaveTimer != null) window.clearTimeout(draftSaveTimer)
    draftSaveTimer = window.setTimeout(() => {
      draftSaveTimer = null
      saveDraftNow()
    }, DRAFT_SAVE_DELAY)
  }

  function saveDraftNow() {
    if (!getFabricCanvas() || typeof window === 'undefined') return
    try {
      const project = createProjectFile()
      const draft: IconCreatorDraftFile = {
        app: 'icon-creator',
        schemaVersion: PROJECT_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        project
      }
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
      draftDirty = false
    } catch (error) {
      console.warn('保存自动草稿失败', error)
    }
  }

  function clearStoredDraft() {
    if (draftSaveTimer != null) {
      window.clearTimeout(draftSaveTimer)
      draftSaveTimer = null
    }
    draftDirty = false
    try {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY)
    } catch (error) {
      console.warn('清理自动草稿失败', error)
    }
  }

  function flushDraftBeforeDispose() {
    if (draftSaveTimer != null) {
      window.clearTimeout(draftSaveTimer)
      draftSaveTimer = null
    }
    if (draftDirty) saveDraftNow()
  }

  function readStoredDraft() {
    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY)
      if (!raw) return null
      return parseProjectFileText(raw).project
    } catch (error) {
      console.warn('读取自动草稿失败', error)
      clearStoredDraft()
      return null
    }
  }

  async function promptRestoreDraft() {
    if (restoringDraftPromptShown) return
    restoringDraftPromptShown = true
    const draft = readStoredDraft()
    if (!draft) return
    const shouldRestore = window.confirm('检测到上次未保存的自动草稿，是否恢复？')
    if (shouldRestore) {
      await loadProjectFile(draft, { keepDraft: true })
      saveDraftNow()
    } else {
      clearStoredDraft()
    }
  }

  async function restoreHistorySnapshot(json: string) {
    const fabricCanvas = getFabricCanvas()
    if (!fabricCanvas) return

    snapshotGate.set(true)
    try {
      await fabricCanvas.loadFromJSON(json)
      await syncAllKaleidoscopes()
      ensureCanvasObjectMetadata()
      rehydrateCanvasGradientFills()
      syncAllEndpointAttachments()
      fabricCanvas.discardActiveObject()
      syncActiveObject(null)
      syncCanvasBgFromFabric()
      fabricCanvas.requestRenderAll()
      refreshLayers()
      markSmallPreviewsDirty()
    } finally {
      snapshotGate.set(false)
    }
  }

  function undo() {
    if (undoStack.length <= 1 || !getFabricCanvas()) return
    clearPointEditing()
    redoStack.push(undoStack.pop()!)
    canRedo.value = true
    historyIndex.value = undoStack.length - 1
    void restoreHistorySnapshot(undoStack[undoStack.length - 1].json).then(() => {
      canUndo.value = undoStack.length > 1
    })
  }

  function redo() {
    if (!redoStack.length || !getFabricCanvas()) return
    clearPointEditing()
    const historySnapshot = redoStack.pop()!
    undoStack.push(historySnapshot)
    historyIndex.value = undoStack.length - 1
    void restoreHistorySnapshot(historySnapshot.json).then(() => {
      canUndo.value = undoStack.length > 1
      canRedo.value = redoStack.length > 0
    })
  }

  function jumpToHistory(index: number) {
    if (!getFabricCanvas() || index < 0 || index >= undoStack.length) return
    if (index === historyIndex.value) return

    clearPointEditing()

    if (index < historyIndex.value) {
      while (historyIndex.value > index) {
        redoStack.push(undoStack.pop()!)
        historyIndex.value--
      }
    } else {
      while (historyIndex.value < index && redoStack.length > 0) {
        undoStack.push(redoStack.pop()!)
        historyIndex.value++
      }
    }

    void restoreHistorySnapshot(undoStack[undoStack.length - 1].json).then(() => {
      canUndo.value = undoStack.length > 1
      canRedo.value = redoStack.length > 0
    })
  }

  function saveProject() {
    if (!getFabricCanvas()) return
    clearBooleanPreview()
    try {
      const filePath = window.services?.writeTextFile?.(stringifyProjectFile(createProjectFile()), PROJECT_FILE_EXTENSION)
      clearStoredDraft()
      if (filePath) showToast(`工程已保存：${filePath}`, 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '保存工程失败', 'error')
    }
  }

  /**
   * 弹出系统保存对话框选择存储位置与文件名，成功后返回最终路径；用户取消返回空字符串。
   * 首次保存用它收集路径，之后 saveProject 直接覆盖同一文件。
   */
  function pickProjectSavePath(): string {
    const ztools = typeof window !== 'undefined' ? window.ztools : undefined
    const downloads = ztools?.getPath?.('downloads')
    const result = ztools?.showSaveDialog?.({
      title: '保存工程',
      defaultPath: downloads ? `${downloads}/未命名工程.${PROJECT_FILE_EXTENSION}` : `未命名工程.${PROJECT_FILE_EXTENSION}`,
      buttonLabel: '保存',
      nameFieldLabel: '工程名称',
      filters: [{ name: 'Icon Creator 工程文件', extensions: [PROJECT_FILE_EXTENSION] }],
      properties: ['showOverwriteConfirmation', 'createDirectory']
    })
    return typeof result === 'string' ? result : ''
  }

  /**
   * 将当前工程直接写入指定绝对路径并清除自动草稿，覆盖式保存不再次弹框。
   * 同时把更新时间刷新到当前，保证覆盖后的文件元信息与最后一次保存一致。
   */
  function saveProjectToPath(filePath: string): string | undefined {
    if (!getFabricCanvas()) return undefined
    clearBooleanPreview()
    const write = window.services?.writeTextFileToPath
    if (!write) {
      showToast('当前环境不支持覆盖保存，请使用另存为', 'error')
      return undefined
    }
    try {
      write(stringifyProjectFile(createProjectFile()), filePath)
      clearStoredDraft()
      showToast(`工程已保存：${filePath}`, 'success')
      return filePath
    } catch (error) {
      showToast(error instanceof Error ? error.message : '保存工程失败', 'error')
      return undefined
    }
  }

  /**
   * 另存为：每次都弹出系统保存对话框，并把新路径回传回调用于更新项目标签记忆。
   * 不会直接覆盖项目标签记忆，由调用方决定是否更新已保存路径。
   */
  function saveProjectAs(onSaved?: (filePath: string) => void) {
    const filePath = pickProjectSavePath()
    if (!filePath) return
    const savedPath = saveProjectToPath(filePath)
    if (savedPath) onSaved?.(savedPath)
  }

  return {
    undoStack,
    historyIndex,
    canUndo,
    canRedo,
    snapshot,
    createProjectFile,
    captureHistoryState,
    restoreHistoryState,
    resetHistoryToCurrentCanvas,
    loadProjectFile,
    scheduleDraftSave,
    clearStoredDraft,
    promptRestoreDraft,
    flushDraftBeforeDispose,
    saveProject,
    saveProjectAs,
    saveProjectToPath,
    undo,
    redo,
    jumpToHistory
  }
}

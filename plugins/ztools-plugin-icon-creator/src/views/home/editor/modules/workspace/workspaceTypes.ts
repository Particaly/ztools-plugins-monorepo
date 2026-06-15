import type { Ref } from 'vue'
import type { IconCreatorProjectArtboard, IconCreatorProjectFile, ProjectLoadOptions, SnapshotOptions } from '../../../types'
import type { HistorySnapshot, HistoryState, HomeArtboardStateRefs } from '../../../composables/contracts'

export interface HomeWorkspaceState extends HomeArtboardStateRefs {
  artboardRenameDialog: Ref<{ show: boolean; value: string; targetId: string }>
  undoStack: HistorySnapshot[]
  historyIndex: Ref<number>
  canUndo: Ref<boolean>
  canRedo: Ref<boolean>
}

export interface HomeWorkspaceCommands {
  addArtboard: () => Promise<void>
  captureHistoryState: () => HistoryState
  clearStoredDraft: () => void
  deleteArtboard: (artboardId: string) => Promise<void>
  duplicateArtboard: (artboardId: string) => void
  flushDraftBeforeDispose: () => void
  jumpToHistory: (index: number) => void
  loadProjectFile: (project: IconCreatorProjectFile, options?: ProjectLoadOptions) => Promise<void>
  newDoc: () => void
  onProjectFileChosen: (event: Event) => Promise<void>
  openProject: () => void
  promptRestoreDraft: () => Promise<void>
  redo: () => void
  renameArtboard: (artboardId: string) => void
  confirmArtboardRename: () => void
  handleArtboardRenameDialogShowChange: (show: boolean) => void
  resetHistoryToCurrentCanvas: () => void
  restoreHistoryState: (state: HistoryState) => void
  saveProject: () => void
  scheduleDraftSave: () => void
  snapshot: (options?: SnapshotOptions) => void
  switchArtboard: (artboardId: string) => Promise<void>
  undo: () => void
}

export interface HomeWorkspaceHelpers {
  captureCurrentArtboard: () => IconCreatorProjectArtboard
  createProjectFile: () => IconCreatorProjectFile
  loadArtboardContent: (artboard: IconCreatorProjectArtboard) => Promise<void>
}

export interface HomeWorkspaceController {
  state: HomeWorkspaceState
  commands: HomeWorkspaceCommands
  helpers: HomeWorkspaceHelpers
}

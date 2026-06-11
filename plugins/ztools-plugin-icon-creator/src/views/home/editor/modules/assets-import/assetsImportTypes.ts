import type { ComputedRef, Ref } from 'vue'
import type { IconTemplateItem } from '../../../editorCatalog'
import type {
  IconifySearchState,
  PasteSVGDialogState,
  UserAssetDialogState,
  UserAssetItem
} from '../../../types'

export interface HomeAssetsImportState {
  filteredIconifyResults: ComputedRef<string[]>
  iconifyCollectionOptions: ComputedRef<Array<{ label: string; value: string }>>
  iconifySearch: IconifySearchState
  pasteSVGDialog: PasteSVGDialogState
  userAssetDialog: UserAssetDialogState
  userAssets: Ref<UserAssetItem[]>
}

export interface HomeAssetsImportCommands {
  applyIconTemplateAsDocument: (template: IconTemplateItem) => Promise<void>
  confirmPasteSVGImport: () => Promise<void>
  confirmUserAssetDialog: () => Promise<void>
  deleteUserAsset: (asset: UserAssetItem) => void
  handleCanvasDragOver: (event: DragEvent) => void
  handleCanvasDrop: (event: DragEvent) => Promise<void>
  handlePasteSVGDialogShowChange: (show: boolean) => void
  handleUserAssetDialogShowChange: (show: boolean) => void
  handleWindowPaste: (event: ClipboardEvent) => Promise<void>
  importImage: () => void
  importSVG: () => void
  insertIconTemplate: (template: IconTemplateItem) => Promise<void>
  insertIconifyIcon: (iconName: string) => Promise<void>
  insertUserAsset: (asset: UserAssetItem) => Promise<void>
  onImageFileChosen: (event: Event) => Promise<void>
  onSVGFileChosen: (event: Event) => Promise<void>
  openCreateUserAssetDialog: () => void
  openPasteSVGDialog: () => void
  openRenameUserAssetDialog: (asset: UserAssetItem) => void
  readClipboardIntoPasteSVGDialog: () => Promise<void>
  searchIconifyIcons: () => Promise<void>
}

export interface HomeAssetsImportController {
  state: HomeAssetsImportState
  commands: HomeAssetsImportCommands
}

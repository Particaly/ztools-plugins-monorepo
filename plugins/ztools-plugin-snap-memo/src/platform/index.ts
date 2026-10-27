/**
 * 平台检测出口：ZTools 宿主优先，浏览器开发态兜底。
 * UI/store 一律 `import { platform } from '@/platform'`，禁止直接访问 window.ztools。
 */
import { createBrowserPlatform } from './browserMock'
import { createZtoolsPlatform } from './ztoolsHost'
import type { PlatformApi } from './types'

function detect(): PlatformApi {
  if (typeof window !== 'undefined' && typeof window.ztools === 'object' && window.ztools !== null) {
    return createZtoolsPlatform()
  }
  return createBrowserPlatform()
}

export const platform: PlatformApi = detect()
export type { ImageViewOutcome, PlatformApi, PasteOutcome, PluginEnterAction } from './types'

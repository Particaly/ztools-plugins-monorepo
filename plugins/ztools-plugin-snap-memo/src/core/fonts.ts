/**
 * 应用字体：中文「阿里巴巴普惠体 3.0」+ 英文「Maple Mono」。
 * 完整中文字体数十 MB，不打进安装包：安装后首次启动由 preload 从 npmmirror
 * （cnpm 同源）下载字体包 tgz 提取所需字重，缓存到宿主 pluginData；
 * jsDelivr 单文件直链作兜底源。之后每次启动直接读本地缓存，经 FontFace API
 * 注册（不走 CSS @font-face，规避相对路径/CSP/跨域问题）。
 * 任一环节不可用（浏览器开发态 / 宿主缺能力 / 网络失败）都静默回退
 * theme.css 中 --sm-font-ui / --sm-font-mono 的系统回退栈，绝不阻塞首屏。
 */

import type { FontFileRequest, FontSource, PlatformApi } from '../platform/types'

/** UI 家族注册名（与 theme.css 的 --sm-font-ui / --sm-font-mono 字体栈保持一致）。 */
export const FONT_FAMILY_CN = 'Alibaba PuHuiTi 3.0'
export const FONT_FAMILY_EN = 'Maple Mono'

const MAPLE_VERSION = '5.3.0'
const MAPLE_TARBALL_URL = `https://registry.npmmirror.com/@fontsource/maple-mono/-/maple-mono-${MAPLE_VERSION}.tgz`
const MAPLE_FILE_BASE = `https://cdn.jsdelivr.net/npm/@fontsource/maple-mono@${MAPLE_VERSION}/files`

const PUHUITI_VERSION = '0.0.0'
const PUHUITI_TARBALL_URL = `https://registry.npmmirror.com/@fontpkg/alibaba-puhuiti-3-0/-/alibaba-puhuiti-3-0-${PUHUITI_VERSION}.tgz`
const PUHUITI_FILE_BASE = `https://cdn.jsdelivr.net/npm/@fontpkg/alibaba-puhuiti-3-0@${PUHUITI_VERSION}`

/** 单个字体的下载定义：file 同时是本地缓存文件名与 tarball 包内 basename（preload 按 basename 提取）。 */
export interface AppFontDef {
  family: string
  weight: string
  file: string
  sources: FontSource[]
}

/** Maple Mono 静态子集只发布了 latin；其余字符（含中文）由字体栈后面的普体兜底。 */
function mapleMonoDef(weight: string): AppFontDef {
  const file = `maple-mono-latin-${weight}-normal.woff2`
  return {
    family: FONT_FAMILY_EN,
    weight,
    file,
    sources: [
      { kind: 'tarball', url: MAPLE_TARBALL_URL, member: `package/files/${file}` },
      { kind: 'file', url: `${MAPLE_FILE_BASE}/${file}` }
    ]
  }
}

/** 普体 3.0 按字重分文件（55-Regular≈8.5MB / 75-SemiBold≈8MB），npmmirror 整包下载一次提取两个字重。 */
function puHuiTiDef(weight: string, file: string): AppFontDef {
  return {
    family: FONT_FAMILY_CN,
    weight,
    file,
    sources: [
      { kind: 'tarball', url: PUHUITI_TARBALL_URL, member: `package/${file}` },
      { kind: 'file', url: `${PUHUITI_FILE_BASE}/${file}` }
    ]
  }
}

/**
 * 字体清单：Maple（KB 级）在前，Latin 先就位；普体 400→600。
 * UI 字重以 600 为主、另有 700 一处：CSS 字体匹配会让 700/550 就近命中 600 面，无需单独下载 Bold。
 */
export const APP_FONTS: AppFontDef[] = [
  mapleMonoDef('400'),
  mapleMonoDef('600'),
  puHuiTiDef('400', 'AlibabaPuHuiTi-3-55-Regular.ttf'),
  puHuiTiDef('600', 'AlibabaPuHuiTi-3-75-SemiBold.ttf')
]

/** 由数据目录拼出每个字体的缓存请求（preload 侧仍有扩展名/魔数白名单兜底）。 */
export function buildFontRequests(dataDir: string): FontFileRequest[] {
  const dir = dataDir.replace(/[\\/]+$/, '')
  return APP_FONTS.map((def) => ({ path: `${dir}/${def.file}`, sources: def.sources }))
}

let started = false

/**
 * 启动时调用一次：下载/读缓存并注册全部应用字体。
 * 后台执行不阻塞首屏（就绪前 UI 以回退字体渲染）；同一文档重复调用直接跳过。
 */
export async function ensureAppFonts(platform: PlatformApi): Promise<void> {
  if (started) return
  started = true
  try {
    if (typeof document === 'undefined' || !document.fonts) return
    const fonts = platform.fonts
    const dataDir = fonts?.dataDir()
    if (!fonts || !dataDir) return
    const results = await fonts.ensureFiles(buildFontRequests(dataDir))
    if (!results) return
    results.forEach((result, index) => {
      if (result.ok && result.base64) registerFontFace(APP_FONTS[index], result.base64)
    })
  } catch (e) {
    console.warn('[snap-memo] 应用字体加载失败，使用系统回退字体', e)
  }
}

/** base64 → 二进制 → FontFace 注册；宿主缺 FontFace/atob 或解码失败时静默跳过。 */
function registerFontFace(def: AppFontDef, base64: string): void {
  if (typeof FontFace === 'undefined' || typeof atob !== 'function') return
  try {
    const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0))
    document.fonts.add(new FontFace(def.family, bytes, { weight: def.weight }))
  } catch (e) {
    console.warn('[snap-memo] 字体注册失败', def.family, def.weight, e)
  }
}

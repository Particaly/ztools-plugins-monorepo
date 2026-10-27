import { describe, expect, it } from 'vitest'
import { APP_FONTS, buildFontRequests, FONT_FAMILY_CN, FONT_FAMILY_EN } from '../src/core/fonts'

/** 提取 URL / member 路径的最后一段。 */
function basename(p: string): string {
  return p.split('/').pop() ?? p
}

describe('应用字体清单', () => {
  it('覆盖中英两个家族，且每个家族都有 400/600 两个字重', () => {
    const families = new Set(APP_FONTS.map((f) => f.family))
    expect(families).toEqual(new Set([FONT_FAMILY_EN, FONT_FAMILY_CN]))
    for (const family of families) {
      const weights = APP_FONTS.filter((f) => f.family === family).map((f) => f.weight)
      expect(weights).toEqual(['400', '600'])
    }
  })

  it('下载源 npmmirror tarball 优先、jsDelivr 单文件兜底，全部为 https', () => {
    for (const def of APP_FONTS) {
      expect(def.sources.length).toBeGreaterThanOrEqual(2)
      expect(def.sources[0]).toMatchObject({ kind: 'tarball' })
      expect(def.sources[0].url).toMatch(/^https:\/\/registry\.npmmirror\.com\//)
      expect(def.sources[1]).toMatchObject({ kind: 'file' })
      expect(def.sources[1].url).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/npm\//)
      for (const src of def.sources) expect(src.url.startsWith('https://')).toBe(true)
    }
  })

  it('tarball member 的 basename 与本地缓存文件名一致（preload 按 basename 提取）', () => {
    for (const def of APP_FONTS) {
      for (const src of def.sources) {
        if (src.kind === 'tarball') expect(basename(src.member)).toBe(def.file)
        if (src.kind === 'file') expect(basename(src.url)).toBe(def.file)
      }
      expect(def.file).toMatch(/\.(woff2|ttf)$/)
    }
  })

  it('buildFontRequests 以数据目录拼接缓存路径，并与清单对齐', () => {
    const items = buildFontRequests('C:/pluginData/snap-memo-fonts/')
    expect(items).toHaveLength(APP_FONTS.length)
    items.forEach((item, i) => {
      expect(item.path).toBe(`C:/pluginData/snap-memo-fonts/${APP_FONTS[i].file}`)
      expect(item.sources).toEqual(APP_FONTS[i].sources)
    })
  })
})

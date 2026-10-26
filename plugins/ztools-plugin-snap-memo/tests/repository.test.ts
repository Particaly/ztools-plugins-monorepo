import { beforeEach, describe, expect, it } from 'vitest'
import { createRepository, BACKUP_MAX_MEMOS, type Repository } from '../src/store/repository'
import type { PlatformApi } from '../src/platform'
import type { Memo } from '../src/core/types'

/** 纯内存平台实现（kv 图片路径，attachments=null，与浏览器开发态一致）。 */
function fakePlatform(): PlatformApi {
  const docs = new Map<string, unknown>()
  const kv = new Map<string, unknown>()
  const base: Pick<PlatformApi, 'kind' | 'isMac'> = { kind: 'browser', isMac: true }
  return {
    ...base,
    onPluginEnter: () => {},
    onPluginOut: () => {},
    onPluginDetach: () => {},
    onDbPull: () => {},
    outPlugin: () => {},
    showMainWindow: () => {},
    subInput: null,
    setExpendHeight: () => {},
    copyText: async () => false,
    pasteText: async () => 'failed',
    readClipboardText: async () => null,
    copyImage: async () => false,
    pasteImage: async () => 'failed',
    readClipboardImage: async () => null,
    openImageExternal: async () => false,
    ocr: null,
    db: {
      getDoc: <T>(id: string) => {
        const value = docs.get(id)
        return value === undefined ? null : ({ id, value: value as T } as { id: string; value: T })
      },
      putDoc: (id: string, value: unknown) => {
        docs.set(id, value)
        return true
      },
      removeDoc: (id: string) => {
        const had = docs.delete(id)
        return had
      },
      allDocs: (prefix: string) =>
        [...docs.entries()]
          .filter(([id]) => id.startsWith(prefix))
          .map(([id, value]) => ({ id, value }))
    },
    attachments: null,
    kv: {
      getItem: <T>(key: string) => (kv.has(key) ? (kv.get(key) as T) : null),
      setItem: (key: string, value: unknown) => void kv.set(key, value),
      removeItem: (key: string) => void kv.delete(key)
    },
    files: {
      pickAndReadText: async () => null,
      pickSaveAndWrite: async () => 'error',
      pickImage: async () => null
    },
    features: null,
    notify: () => {},
    isDark: () => false,
    watchDark: () => () => {}
  }
}

function memo(id: string, partial: Partial<Memo> = {}): Memo {
  return {
    id,
    title: '',
    content: `content-${id}`,
    groupId: null,
    tags: [],
    pinned: false,
    sensitive: false,
    order: 0,
    useCount: 0,
    lastUsedAt: null,
    createdAt: 1,
    updatedAt: 1,
    ...partial
  }
}

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

let repo: Repository
let platform: PlatformApi

beforeEach(() => {
  platform = fakePlatform()
  repo = createRepository(platform)
})

describe('备份截断', () => {
  it('超过 500 条时截断并标记 truncated', () => {
    const many = Array.from({ length: BACKUP_MAX_MEMOS + 50 }, (_, i) => memo(`m${i}`))
    expect(repo.saveBackup(many, [])).toBe(true)
    const backup = repo.loadBackup()
    expect(backup).not.toBeNull()
    expect(backup?.truncated).toBe(true)
    expect(backup?.memos).toHaveLength(BACKUP_MAX_MEMOS)
  })

  it('未超量时完整保留且不标记', () => {
    repo.saveBackup([memo('a'), memo('b')], [])
    const backup = repo.loadBackup()
    expect(backup?.truncated).toBe(false)
    expect(backup?.memos).toHaveLength(2)
  })

  it('坏备份文档返回 null（不白屏）', () => {
    platform.db.putDoc('sm/backup', { junk: 1 })
    expect(repo.loadBackup()).toBeNull()
  })
})

describe('内容上限（UTF-8 字节口径）', () => {
  it('9 万汉字（270KB 字节、9 万 UTF-16 码元）被拒绝——长度口径会漏放', () => {
    const big = memo('big', { content: '汉'.repeat(90_000) })
    expect(repo.saveMemo(big)).toBe(false)
  })

  it('常规内容正常保存并可读回', () => {
    expect(repo.saveMemo(memo('ok', { content: '普通内容' }))).toBe(true)
    expect(repo.loadAll().memos.map((m) => m.id)).toContain('ok')
  })
})

describe('图片槽 kv 路径（浏览器开发态）', () => {
  it('saveImage / loadImage 按槽往返', () => {
    repo.saveMemo(memo('img1', { kind: 'image', content: '{img:img1}', images: [{ id: 'img1', mime: 'image/png', hash: 'h', width: 1, height: 1, bytes: 100 }] }))
    expect(repo.saveImage('img1', PNG)).toBe(true)
    expect(repo.loadImage('img1')).toBe(PNG)
  })

  it('removeMemo 按 images 清理槽数据（含兜底键）', () => {
    repo.saveMemo(memo('img1', { kind: 'image', content: '{img:img1}', images: [{ id: 'slotA', mime: 'image/png', hash: 'h', width: 1, height: 1, bytes: 1 }] }))
    repo.saveImage('slotA', PNG)
    repo.saveImage('img1', PNG) // 兜底键（旧结构）
    repo.removeMemo('img1')
    expect(repo.loadImage('slotA')).toBeNull()
    expect(repo.loadImage('img1')).toBeNull()
  })

  it('removeImageSlot 清除图片返回 true', () => {
    repo.saveMemo(memo('img1', { content: 'x' }))
    repo.saveImage('slotA', PNG)
    expect(repo.removeImageSlot('slotA')).toBe(true)
    expect(repo.loadImage('slotA')).toBeNull()
  })
})

describe('图片槽桩文档（宿主附件路径）', () => {
  /** 宿主形态：db 文档 + 附件（每 docId 一个附件，文档须先存在）。 */
  function hostPlatform(): PlatformApi {
    const p = fakePlatform()
    const docs = new Map<string, unknown>()
    const atts = new Map<string, { mime: string; bytes: Uint8Array }>()
    return {
      ...p,
      db: {
        getDoc: <T>(id: string) => (docs.has(id) ? ({ id, value: docs.get(id) as T } as { id: string; value: T }) : null),
        putDoc: (id: string, value: unknown) => {
          docs.set(id, value)
          return true
        },
        removeDoc: (id: string) => {
          const had = docs.delete(id)
          atts.delete(id)
          return had
        },
        allDocs: (prefix: string) => [...docs.entries()].filter(([id]) => id.startsWith(prefix)).map(([id, value]) => ({ id, value }))
      },
      attachments: {
        put: (docId: string, mime: string, bytes: Uint8Array) => {
          if (!docs.has(docId)) return false
          atts.set(docId, { mime, bytes })
          return true
        },
        get: (docId: string) => atts.get(docId) ?? null
      }
    }
  }

  it('saveImage 建桩文档挂附件，loadImageBytes 读取', () => {
    const repo2 = createRepository(hostPlatform())
    repo2.saveMemo(memo('m1', { content: '{img:s1}', images: [{ id: 's1', mime: 'image/png', hash: 'h', width: 1, height: 1, bytes: 70 }] }))
    expect(repo2.saveImage('s1', PNG)).toBe(true)
    const data = repo2.loadImageBytes('s1')
    expect(data).not.toBeNull()
    expect(data?.mime).toBe('image/png')
    expect(repo2.loadImage('s1')).toBe(PNG)
  })

  it('同槽重写（换图）不冲突：先删桩再挂新附件', () => {
    const repo2 = createRepository(hostPlatform())
    repo2.saveMemo(memo('m1', { content: '{img:s1}', images: [{ id: 's1', mime: 'image/png', hash: 'h', width: 1, height: 1, bytes: 70 }] }))
    expect(repo2.saveImage('s1', PNG)).toBe(true)
    expect(repo2.saveImage('s1', PNG.replace('AAAANS', 'AAAATA'))).toBe(true)
    expect(repo2.loadImage('s1')).toContain('AAAATA')
  })

  it('旧结构回退：槽 ID 等于 memoId 时读 memo 文档附件', () => {
    const p = hostPlatform()
    const repo2 = createRepository(p)
    // 直接构造旧形态：附件挂在 memo 文档上
    p.db.putDoc('sm/memo/old1', { id: 'old1', kind: 'image', content: '', imageHash: 'h', schemaVersion: 1 })
    p.attachments!.put('sm/memo/old1', 'image/png', new Uint8Array([1, 2, 3]))
    expect(repo2.loadImageBytes('old1')).not.toBeNull()
  })

  it('loadAll 物理迁移旧附件到桩文档并剥离 memo 文档附件', () => {
    const p = hostPlatform()
    const repo2 = createRepository(p)
    p.db.putDoc('sm/memo/old1', { id: 'old1', kind: 'image', content: '', imageHash: 'h', imageWidth: 2, imageHeight: 2, schemaVersion: 1 })
    p.attachments!.put('sm/memo/old1', 'image/png', new Uint8Array([9, 9]))
    const data = repo2.loadAll()
    // 内容升级为图片标记 + images 元数据（槽 ID = memoId）
    const m = data.memos.find((x) => x.id === 'old1')
    expect(m?.content).toBe('{img:old1}')
    expect(m?.images?.[0]?.id).toBe('old1')
    expect(m?.kind).toBe('image')
    // 像素已搬到桩文档，memo 文档附件已剥离
    expect(repo2.loadImageBytes('old1')).not.toBeNull()
    const doc = p.db.getDoc<Record<string, unknown>>('sm/memo/old1')
    expect(doc?.value._attachments).toBeUndefined()
    expect(p.attachments!.get('sm/att/old1')).not.toBeNull()
    // 幂等：再次 loadAll 不报错不丢数据
    const again = repo2.loadAll()
    expect(again.memos.find((x) => x.id === 'old1')?.images?.[0]?.id).toBe('old1')
    expect(repo2.loadImageBytes('old1')).not.toBeNull()
  })

  it('removeMemo 删除条目时连带删除槽桩文档', () => {
    const p = hostPlatform()
    const repo2 = createRepository(p)
    repo2.saveMemo(memo('m1', { content: '{img:s1}', images: [{ id: 's1', mime: 'image/png', hash: 'h', width: 1, height: 1, bytes: 70 }] }))
    repo2.saveImage('s1', PNG)
    repo2.removeMemo('m1')
    expect(repo2.loadImageBytes('s1')).toBeNull()
    expect(p.db.getDoc('sm/att/s1')).toBeNull()
  })
})

describe('遗留软删除清理（回收站移除后的迁移）', () => {
  it('loadAll 物理清除带 deletedAt 的旧文档', () => {
    platform.db.putDoc('sm/memo/legacy1', { id: 'legacy1', content: 'x', deletedAt: 123 })
    platform.db.putDoc('sm/memo/live1', { id: 'live1', content: 'y' })
    const data = repo.loadAll()
    expect(data.memos.map((m) => m.id)).toEqual(['live1'])
    expect(platform.db.getDoc('sm/memo/legacy1')).toBeNull()
  })

  it('坏文档被隔离且不阻塞正常条目', () => {
    platform.db.putDoc('sm/memo/bad', { noId: true })
    platform.db.putDoc('sm/memo/good', { id: 'good', content: 'ok' })
    const data = repo.loadAll()
    expect(data.memos.map((m) => m.id)).toEqual(['good'])
  })
})

describe('draft / seeded kv', () => {
  it('草稿写入读取与清除', () => {
    repo.saveDraft({ mode: 'new', content: 'x' })
    expect(repo.getDraft<{ content: string }>()).toMatchObject({ content: 'x' })
    repo.clearDraft()
    expect(repo.getDraft()).toBeNull()
  })
})

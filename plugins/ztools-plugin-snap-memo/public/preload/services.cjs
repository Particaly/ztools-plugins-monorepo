'use strict'

/**
 * 速贴备忘 preload：向渲染层暴露受约束的文件读写、剪贴板读取与字体缓存（window.snapMemoFs，
 * 见 src/env.d.ts）。约束内容：
 * - 路径必须是非空绝对路径、不含 NUL、不经过隐藏目录/隐藏文件（防 dotfile 与配置文件读写）；
 * - 读写均走扩展名白名单（json/txt/md/csv/yml/yaml），写入为同目录临时文件 + 原子重命名；
 * - 文本读取上限 16MB（防误选大文件阻塞渲染进程）；
 * - 图片读写扩展名白名单 + 8MB 上限；临时图片自动清理（24h 之前或超量）；
 * - 字体缓存：扩展名白名单（woff2/woff/ttf/otf），下载内容校验字体魔数，网络仅访问
 *   渲染层传入的 npmmirror / jsDelivr 字体源（见 src/core/fonts.ts 清单）；
 * - 跨插件数据提取：只读打开宿主本地 LMDB（复用宿主自带 lmdb 模块），读取范围限定
 *   指定插件的命名空间前缀，绝不写入（见下方 readHostPluginData）。
 * 注意：本 preload 不提供「任意文件」能力的承诺边界如上；渲染层被注入脚本攻击时的
 * 纵深防御依赖宿主沙箱（无 nodeIntegration）+ 上述约束。
 */

const fs = require('node:fs')
const http = require('node:http')
const https = require('node:https')
const os = require('node:os')
const path = require('node:path')
const zlib = require('node:zlib')
const nodeCrypto = require('node:crypto')

/** electron 剪贴板在宿主沙箱中不可用时保持 null，readClipboardText 返回 null。 */
let clipboard = null
try {
  clipboard = require('electron').clipboard
} catch (e) {
  clipboard = null
}

/** 允许读写的文本扩展名（导入导出全部在此范围内）。 */
const TEXT_EXT_WHITELIST = new Set(['json', 'txt', 'md', 'csv', 'yml', 'yaml'])

/** 文本文件大小上限：误选超大文件时快速失败，而不是同步读完拖死渲染进程。 */
const TEXT_MAX_BYTES = 16 * 1024 * 1024

/**
 * 校验路径：非空绝对路径字符串、无 NUL、无隐藏段（.开头目录/文件，如 ~/.ssh/id_rsa）。
 * 防相对路径（会在 preload 进程 cwd 下解析）、穿越与敏感文件读写。
 */
function assertValidPath(p) {
  if (typeof p !== 'string' || !p.trim()) {
    throw new Error('文件路径不能为空')
  }
  if (p.includes('\0')) {
    throw new Error('文件路径包含非法字符')
  }
  if (!path.isAbsolute(p)) {
    throw new Error('文件路径必须是绝对路径')
  }
  const segments = p.split(/[\\/]+/).filter(Boolean)
  if (segments.some((seg) => seg.startsWith('.') && seg !== '.' && seg !== '..')) {
    throw new Error('不允许访问隐藏文件或隐藏目录')
  }
}

/** 校验扩展名在白名单内。 */
function assertTextExt(p) {
  const ext = path.extname(p).slice(1).toLowerCase()
  if (!TEXT_EXT_WHITELIST.has(ext)) {
    throw new Error(`不支持的文件类型：${ext || '(无扩展名)'}（仅支持 ${[...TEXT_EXT_WHITELIST].join('/')}）`)
  }
}

/** 读取 UTF-8 文本文件；大小超限或读取失败抛带中文信息的 Error。 */
function readTextFile(filePath) {
  assertValidPath(filePath)
  assertTextExt(filePath)
  let stat
  try {
    stat = fs.statSync(filePath)
  } catch (e) {
    throw new Error(`读取文件失败：${e.message}`)
  }
  if (!stat.isFile()) {
    throw new Error('路径不是文件')
  }
  if (stat.size > TEXT_MAX_BYTES) {
    throw new Error('文件超过 16MB，无法读取')
  }
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch (e) {
    throw new Error(`读取文件失败：${e.message}`)
  }
}

/** 覆盖写入 UTF-8 文本文件（同目录临时文件 + rename 原子替换）；失败抛带中文信息的 Error。 */
function writeTextFile(filePath, content) {
  assertValidPath(filePath)
  assertTextExt(filePath)
  if (typeof content !== 'string') {
    throw new Error('文件内容必须是字符串')
  }
  const tmp = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}`
  )
  try {
    fs.writeFileSync(tmp, content, 'utf8')
    fs.renameSync(tmp, filePath)
  } catch (e) {
    try {
      fs.unlinkSync(tmp)
    } catch (_) {
      /* 清理失败忽略 */
    }
    throw new Error(`写入文件失败：${e.message}`)
  }
}

/**
 * 读取当前剪贴板纯文本。
 * 返回 null 表示剪贴板能力不可用；返回字符串（可能是空串）表示可用。
 */
function readClipboardText() {
  try {
    return clipboard ? clipboard.readText() : null
  } catch (e) {
    return null
  }
}

/** 允许读取的图片扩展名 → MIME 白名单；其余扩展名直接拒绝。 */
const IMAGE_EXT_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp'
}

/** 与渲染层 IMAGE_MAX_BYTES 一致的图片字节上限（渲染层定义为 8MB）。 */
const IMAGE_MAX_BYTES = 8 * 1024 * 1024

/**
 * 读取当前剪贴板图片，返回 PNG dataURL；
 * 无图片或剪贴板不可用返回空字符串（渲染层把空串视为 null）。
 */
function readClipboardImage() {
  try {
    if (!clipboard) return ''
    const img = clipboard.readImage()
    if (!img || img.isEmpty()) return ''
    const png = img.toPNG()
    return 'data:image/png;base64,' + Buffer.from(png).toString('base64')
  } catch (e) {
    return ''
  }
}

/**
 * 读取本地图片文件为 dataURL。
 * 扩展名走白名单，大小上限 8MB；路径校验与文本读取一致，失败抛带中文信息的 Error。
 */
function readImageFile(filePath) {
  assertValidPath(filePath)
  const ext = path.extname(filePath).slice(1).toLowerCase()
  const mime = IMAGE_EXT_MIME[ext]
  if (!mime) {
    throw new Error(`不支持的图片格式：${ext}（仅支持 png/jpg/jpeg/gif/webp/bmp）`)
  }
  let stat
  try {
    stat = fs.statSync(filePath)
  } catch (e) {
    throw new Error(`读取图片失败：${e.message}`)
  }
  if (stat.size > IMAGE_MAX_BYTES) {
    throw new Error('图片超过 8MB，无法保存')
  }
  try {
    const buf = fs.readFileSync(filePath)
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch (e) {
    throw new Error(`读取图片失败：${e.message}`)
  }
}

/** 临时图片目录的保留策略：超过该数量或早于该时限（24h）的文件在写入前清理。 */
const TEMP_MAX_FILES = 60
const TEMP_MAX_AGE_MS = 24 * 3600 * 1000

/** 尽力清理临时目录：失败静默（不影响主流程）。 */
function cleanupTempDir(dir) {
  try {
    const entries = fs.readdirSync(dir)
    const files = []
    const now = Date.now()
    for (const name of entries) {
      const full = path.join(dir, name)
      try {
        const st = fs.statSync(full)
        if (st.isFile()) files.push({ full, mtime: st.mtimeMs })
      } catch (_) {
        /* 单个文件 stat 失败忽略 */
      }
    }
    files.sort((a, b) => a.mtime - b.mtime)
    const expired = (f) => now - f.mtime > TEMP_MAX_AGE_MS
    let excess = files.length - TEMP_MAX_FILES
    for (const f of files) {
      if (expired(f) || excess > 0) {
        try {
          fs.unlinkSync(f.full)
        } catch (_) {
          /* 删除失败忽略 */
        }
        excess -= 1
      }
    }
  } catch (_) {
    /* 目录不存在等情况忽略 */
  }
}

/**
 * 把 dataURL 图片写入系统临时目录的 snap-memo 子目录，返回绝对路径；
 * 供渲染层调用宿主 shellOpenPath 交给系统默认看图软件打开。
 * MIME 走 IMAGE_EXT_MIME 白名单（与 readImageFile 一致），上限 8MB；
 * 文件名完全由本函数生成（时间戳 + 随机数），不接受外部路径输入；
 * 写入前清理过期/超量的历史临时文件。
 */
function writeTempImage(dataUrl) {
  if (typeof dataUrl !== 'string') {
    throw new Error('图片数据无效')
  }
  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(dataUrl.trim())
  if (!match) {
    throw new Error('图片数据无效')
  }
  const mime = match[1].toLowerCase()
  const ext = Object.keys(IMAGE_EXT_MIME).find((key) => IMAGE_EXT_MIME[key] === mime)
  if (!ext) {
    throw new Error(`不支持的图片格式：${mime}（仅支持 png/jpg/jpeg/gif/webp/bmp）`)
  }
  const buf = Buffer.from(match[2], 'base64')
  if (buf.length === 0) {
    throw new Error('图片数据无效')
  }
  if (buf.length > IMAGE_MAX_BYTES) {
    throw new Error('图片超过 8MB，无法打开')
  }
  const dir = path.join(os.tmpdir(), 'snap-memo')
  fs.mkdirSync(dir, { recursive: true })
  cleanupTempDir(dir)
  const file = path.join(dir, `img-${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`)
  fs.writeFileSync(file, buf)
  return file
}

// ---- 字体缓存与下载（中文普体 3.0 + 英文 Maple Mono，清单见 src/core/fonts.ts）----
// 字体不打进安装包：首次启动由渲染层下发清单，这里在 Node 侧下载（无 CORS）到
// 宿主 pluginData 缓存，之后每次启动直接读缓存。全部能力只在白名单约束内开放。

/** 允许缓存的字体扩展名。 */
const FONT_EXT_WHITELIST = new Set(['woff2', 'woff', 'ttf', 'otf'])
/** 单个字体文件上限：普体整字重 TTF 约 8.5MB，留足余量；同时拦截超大内容。 */
const FONT_FILE_MAX_BYTES = 32 * 1024 * 1024
/** 字体包 tarball 上限：普体 tgz 约 57MB（整包含全部字重，按需提取其中两个）。 */
const FONT_TARBALL_MAX_BYTES = 96 * 1024 * 1024
/** 下载空闲超时：60 秒无数据判定失败（慢速网络下载大文件靠"有数据就不算超时"续命）。 */
const DOWNLOAD_IDLE_TIMEOUT_MS = 60 * 1000

/** 校验字体魔数（woff2/wOFF/OTTO/TrueType）：拦截把 HTML 错误页、CDN JSON 404 当字体写入缓存。 */
function isValidFontBuffer(buf) {
  if (!buf || buf.length < 4) return false
  const head = buf.subarray(0, 4)
  return (
    head.equals(Buffer.from([0x77, 0x4f, 0x46, 0x32])) ||
    head.equals(Buffer.from([0x77, 0x4f, 0x46, 0x46])) ||
    head.equals(Buffer.from([0x4f, 0x54, 0x54, 0x4f])) ||
    head.equals(Buffer.from([0x00, 0x01, 0x00, 0x00]))
  )
}

/** 字体扩展名白名单校验（与 assertTextExt 同风格）。 */
function assertFontExt(p) {
  const ext = path.extname(p).slice(1).toLowerCase()
  if (!FONT_EXT_WHITELIST.has(ext)) {
    throw new Error(`不支持的字体类型：${ext || '(无扩展名)'}（仅支持 ${[...FONT_EXT_WHITELIST].join('/')}）`)
  }
}

/**
 * 下载 URL 内容为 Buffer：跟随 ≤5 次重定向（npmmirror tarball 会 302 到 CDN），
 * 超过 maxBytes 立即中断，60 秒无数据视为失败；非 2xx 抛带状态码的 Error。
 */
function fetchBuffer(url, maxBytes, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    let u
    try {
      u = new URL(url)
    } catch (e) {
      reject(new Error(`无效 URL：${url}`))
      return
    }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      reject(new Error(`不支持的协议：${u.protocol}`))
      return
    }
    if (redirectsLeft < 0) {
      reject(new Error('重定向次数过多'))
      return
    }
    const req = (u.protocol === 'https:' ? https : http).get(
      u,
      { headers: { 'user-agent': 'snap-memo-font-loader' } },
      (res) => {
        const status = res.statusCode || 0
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume()
          fetchBuffer(new URL(res.headers.location, u).toString(), maxBytes, redirectsLeft - 1).then(resolve, reject)
          return
        }
        if (status < 200 || status >= 300) {
          res.resume()
          reject(new Error(`HTTP ${status}`))
          return
        }
        const chunks = []
        let total = 0
        res.on('data', (chunk) => {
          total += chunk.length
          if (total > maxBytes) {
            req.destroy()
            reject(new Error(`下载内容超过 ${(maxBytes / 1048576) | 0}MB 上限`))
            return
          }
          chunks.push(chunk)
        })
        res.on('end', () => resolve(Buffer.concat(chunks)))
        res.on('error', reject)
      }
    )
    req.setTimeout(DOWNLOAD_IDLE_TIMEOUT_MS, () => {
      req.destroy(new Error('下载超时（60 秒无数据）'))
    })
    req.on('error', reject)
  })
}

/** 读取本地字体缓存：不存在 / 损坏（魔数不符）/ 超限都返回 null，由调用方转下载重建。 */
function readValidFontFile(filePath) {
  try {
    const stat = fs.statSync(filePath)
    if (!stat.isFile() || stat.size < 4 || stat.size > FONT_FILE_MAX_BYTES) return null
    const buf = fs.readFileSync(filePath)
    return isValidFontBuffer(buf) ? buf : null
  } catch (e) {
    return null
  }
}

/** 原子写入字体文件（同目录临时文件 + rename，与 writeTextFile 同策略）。 */
function writeFontFileAtomic(filePath, buf) {
  const dir = path.dirname(filePath)
  fs.mkdirSync(dir, { recursive: true })
  const tmp = path.join(dir, `.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}`)
  try {
    fs.writeFileSync(tmp, buf)
    fs.renameSync(tmp, filePath)
  } catch (e) {
    try {
      fs.unlinkSync(tmp)
    } catch (_) {
      /* 清理失败忽略 */
    }
    throw new Error(`写入字体缓存失败：${e.message}`)
  }
}

/** 读取 tar 头的定长字符串字段（NUL 截断、去尾部填充空格）。 */
function tarString(buf, start, len) {
  const end = buf.subarray(start, start + len).indexOf(0)
  return buf.toString('utf8', start, end === -1 ? start + len : end).replace(/ +$/, '')
}

/**
 * 从已解压的 tar 缓冲中按 basename 提取成员。npm tarball 成员固定带 package/ 前缀，
 * 但按 basename 匹配可同时兼容前缀差异与 ustar prefix 字段；仅取普通文件，同 basename 取第一个。
 */
function extractTarMembers(tarBuf, wantedBasenames) {
  const out = new Map()
  let offset = 0
  while (offset + 512 <= tarBuf.length) {
    const header = tarBuf.subarray(offset, offset + 512)
    if (header.every((b) => b === 0)) break
    let name = tarString(tarBuf, offset, 100)
    const prefix = tarString(tarBuf, offset + 345, 155)
    if (prefix) name = `${prefix}/${name}`
    const size = parseInt(tarString(tarBuf, offset + 124, 12), 8) || 0
    const type = String.fromCharCode(header[156] || 0x30)
    const dataStart = offset + 512
    if ((type === '0' || type === '\0') && size > 0 && dataStart + size <= tarBuf.length) {
      const base = name.split('/').pop() ?? name
      if (wantedBasenames.has(base) && !out.has(base)) {
        out.set(base, tarBuf.subarray(dataStart, dataStart + size))
      }
    }
    offset = dataStart + Math.ceil(size / 512) * 512
  }
  return out
}

/**
 * 批量确保字体文件存在并返回 base64（渲染层经 FontFace API 注册，见 src/core/fonts.ts）。
 * items: [{ path, sources }]；sources 按优先级尝试：
 * - { kind: 'tarball', url, member }：下载 npm 包 tgz 后解压提取 member（按 basename 匹配）；
 *   同一批 items 引用同一 tarball 时只下载解压一次（普体 400/600 同包）。
 * - { kind: 'file', url }：单文件直链兜底（如 jsDelivr）。
 * 已有合法缓存直接读文件返回，不联网。返回与 items 对齐的
 * [{ ok: true, base64 } | { ok: false, error }]；单个失败不影响其余。
 */
async function ensureFontFiles(items) {
  if (!Array.isArray(items)) {
    throw new Error('参数必须是数组')
  }
  // 预扫描每个 tarball 需要的成员集合：一个包只下载解压一次，一次提取全部所需字重
  const wantedByTarball = new Map()
  const normalized = []
  for (const item of items) {
    let error = null
    try {
      assertValidPath(item && item.path)
      assertFontExt(item.path)
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
    const sources = !error && Array.isArray(item.sources) ? item.sources.filter((s) => s && s.url) : []
    normalized.push({ path: item && item.path, sources, error })
    if (error) continue
    for (const src of sources) {
      if (src.kind === 'tarball') {
        const base = String(src.member || '').split('/').pop()
        if (base) {
          if (!wantedByTarball.has(src.url)) wantedByTarball.set(src.url, new Set())
          wantedByTarball.get(src.url).add(base)
        }
      }
    }
  }

  const membersCache = new Map() // tarball url → Map<basename, Buffer>
  const results = []
  for (const item of normalized) {
    if (item.error) {
      results.push({ ok: false, error: item.error })
      continue
    }
    const cached = readValidFontFile(item.path)
    if (cached) {
      results.push({ ok: true, base64: cached.toString('base64') })
      continue
    }
    let buf = null
    let lastError = '无可用下载源'
    for (const src of item.sources) {
      try {
        if (src.kind === 'tarball') {
          const base = String(src.member || '').split('/').pop()
          if (!base) throw new Error('tarball 源缺少 member')
          let members = membersCache.get(src.url)
          if (!members) {
            const gz = await fetchBuffer(src.url, FONT_TARBALL_MAX_BYTES)
            members = extractTarMembers(zlib.gunzipSync(gz), wantedByTarball.get(src.url) || new Set())
            membersCache.set(src.url, members)
          }
          buf = members.get(base) ?? null
          if (!buf) throw new Error(`字体包中未找到 ${base}`)
        } else {
          buf = await fetchBuffer(src.url, FONT_FILE_MAX_BYTES)
        }
        if (!isValidFontBuffer(buf)) throw new Error('下载内容不是有效字体文件')
        break
      } catch (e) {
        buf = null
        lastError = e instanceof Error ? e.message : String(e)
      }
    }
    if (!buf) {
      console.error('[snap-memo] 字体下载失败', item.path, lastError)
      results.push({ ok: false, error: lastError })
      continue
    }
    try {
      writeFontFileAtomic(item.path, buf)
      results.push({ ok: true, base64: buf.toString('base64') })
    } catch (e) {
      results.push({ ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  }
  return results
}

// ---- 宿主数据提取（跨插件导入：只读打开 ZTools 本地 LMDB）----
// 用途：把其他插件（如备忘快贴 memo-quick-paste）存储在宿主数据库里的文档与附件
// 只读提取出来，交给渲染层转换后走常规导入管线。约束：
// - 全程只读（lmdb readOnly + 多进程并发读），绝不写入宿主数据库；
// - 不改动、不删除、不外传任何数据，读取范围限定在指定插件命名空间前缀内；
// - 依赖宿主自带的 lmdb 模块（N-API，与宿主同进程环境，必然可加载），
//   找不到宿主安装目录或数据目录时抛带中文信息的 Error，由渲染层提示降级。

/** 校验插件名：与宿主 PLUGIN/<name>/ 命名空间约定一致的宽松白名单。 */
function assertPluginName(pluginName) {
  if (typeof pluginName !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(pluginName)) {
    throw new Error(`插件名不合法：${String(pluginName).slice(0, 40)}`)
  }
}

// ---- 诊断日志（临时排查用）----
// 宿主数据提取此前把所有探测失败静默吞掉，报错只剩一句笼统提示。这里给整条链路
// （loadHostLmdb / findZtoolsRoot / resolveAccountDbPath / readHostPluginData）加上
// console 输出，并保留最近 500 行到内存缓冲：渲染层 DevTools 控制台可随时调用
// window.__snapMemoDumpLogs() 导出全部历史（含打开 DevTools 之前的日志）。

/** 诊断日志统一前缀，便于在控制台过滤。 */
const HOSTDBG_TAG = '[snap-memo][hostdata]'
/** 内存日志环形缓冲（最近 500 行），弥补 DevTools 晚开导致控制台日志丢失。 */
const hostDbgLines = []

/** 把任意值转成可读的日志片段：Error 带名称/code 与前几行堆栈，其余 JSON 序列化。 */
function debugValue(v) {
  if (v instanceof Error) {
    const stack = typeof v.stack === 'string' ? v.stack.split('\n').slice(1, 4).join(' | ') : ''
    return `${v.name}: ${v.message}${v.code !== undefined ? ` (code=${v.code})` : ''}${stack ? ` @ ${stack}` : ''}`
  }
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v) ?? String(v)
  } catch (_) {
    return String(v)
  }
}

/** 输出一条诊断日志：控制台 + 内存缓冲各一份。 */
function hostDbg(...args) {
  const line = `${new Date().toISOString().slice(11, 23)} ${args.map(debugValue).join(' ')}`
  hostDbgLines.push(line)
  if (hostDbgLines.length > 500) hostDbgLines.shift()
  console.warn(HOSTDBG_TAG, line)
}

/** 宿主自带 lmdb 模块缓存：undefined=未探测，null=探测失败。 */
let hostLmdb = undefined

/**
 * 加载宿主安装目录自带的 lmdb 模块（宿主主进程用同一份，N-API 二进制与本 Electron 兼容）。
 * 候选：安装版 app.asar 内主入口 → 安装版免 asar 的 resources/app → 开发态
 * （resourcesPath 位于 <工程>/node_modules/electron/dist/resources，向上回退到工程 node_modules）。
 * 全部失败返回 null，调用方降级提示。
 */
function loadHostLmdb() {
  if (hostLmdb !== undefined) {
    hostDbg('loadHostLmdb 使用缓存结果:', hostLmdb ? '已加载' : 'null（此前探测失败）')
    return hostLmdb
  }
  hostLmdb = null
  try {
    hostDbg('开始探测宿主 lmdb 模块，环境:', {
      platform: process.platform,
      arch: process.arch,
      electron: process.versions && process.versions.electron,
      node: process.versions && process.versions.node,
      type: process.type,
      sandboxed: process.sandboxed,
      resourcesPath: process.resourcesPath,
      execPath: process.execPath
    })
    const { createRequire } = require('node:module')
    hostDbg('require("node:module") 可用, typeof createRequire =', typeof createRequire)
    const resources = process.resourcesPath
    if (!resources) {
      hostDbg('失败原因：process.resourcesPath 为空（非打包 Electron 环境？）')
      return hostLmdb
    }
    const candidates = [
      path.join(resources, 'app.asar', 'out', 'main', 'index.js'),
      path.join(resources, 'app', 'out', 'main', 'index.js'),
      // 开发态：<project>/node_modules/electron/dist/resources → <project>/package.json
      path.join(resources, '..', '..', '..', 'package.json')
    ]
    // 第一轮：直接加载。宿主插件页若为 file:// 页面，lmdb 的环境探测分支本就正确。
    hostLmdb = tryLoadHostLmdbCandidates(createRequire, resources, candidates, false)
    if (!hostLmdb) {
      // 第二轮：ZTools 3.x 用自定义协议加载插件页，渲染进程里 document 存在，lmdb
      // （dist/index.cjs）的环境探测走浏览器分支，把 document.baseURI（页面地址，
      // 非 file://）传给 fileURLToPath 抛 ERR_INVALID_URL_SCHEME，导致整个模块
      // 加载失败。这里临时把 Document.prototype.baseURI 覆盖为 asar 内 lmdb/dist
      // 的 file:// 地址，让其算出正确的模块目录；require 完成后立即还原。
      // 已用宿主同版本 lmdb 3.4.4 在本机验证：覆盖后可完整加载并读出数据。
      hostDbg('第一轮直接加载失败，第二轮重试：临时覆盖 baseURI 指向 asar 内 lmdb/dist')
      hostLmdb = tryLoadHostLmdbCandidates(createRequire, resources, candidates, true)
    }
    if (!hostLmdb) {
      // 两轮都失败：把 resources 顶层结构也打出来，便于比对宿主实际打包布局
      hostDbg('两轮候选均失败。resources 顶层内容：')
      try {
        hostDbg('  readdir(resources) =', fs.readdirSync(resources))
        hostDbg('  exists(app.asar) =', fs.existsSync(path.join(resources, 'app.asar')),
          'exists(app.asar.unpacked) =', fs.existsSync(path.join(resources, 'app.asar.unpacked')))
      } catch (e) {
        hostDbg('  readdir(resources) 失败:', e)
      }
    }
  } catch (e) {
    hostDbg('loadHostLmdb 外层异常:', e)
    hostLmdb = null
  }
  if (!hostLmdb) hostDbg('loadHostLmdb 最终结果：null（将在 readHostPluginData 中抛出宿主数据模块错误）')
  return hostLmdb
}

/**
 * 按候选路径逐个 require 宿主 lmdb；patchBaseUri 为 true 时先临时覆盖
 * Document.prototype.baseURI（见 loadHostLmdb 内说明），无论成败最后都还原。
 * 返回宿主 lmdb 的 open 函数或 null；每个候选的成败都写诊断日志。
 */
function tryLoadHostLmdbCandidates(createRequire, resources, candidates, patchBaseUri) {
  let restore = null
  if (patchBaseUri) {
    try {
      if (typeof document === 'undefined' || typeof Document === 'undefined') {
        hostDbg('baseURI 方案不可用：当前环境没有 document/Document')
        return null
      }
      const { pathToFileURL } = require('node:url')
      const distDir = path.join(resources, 'app.asar', 'node_modules', 'lmdb', 'dist')
      const fakeBase = pathToFileURL(distDir + path.sep).href
      const orig = Object.getOwnPropertyDescriptor(Document.prototype, 'baseURI')
      Object.defineProperty(Document.prototype, 'baseURI', { configurable: true, get() { return fakeBase } })
      restore = () => {
        if (orig) Object.defineProperty(Document.prototype, 'baseURI', orig)
        else delete Document.prototype.baseURI
      }
      hostDbg('baseURI 已临时指向:', fakeBase, '（原描述符存在 =', Boolean(orig), '）')
    } catch (e) {
      hostDbg('覆盖 baseURI 失败，放弃该方案:', e)
      return null
    }
  }
  let loaded = null
  try {
    for (const base of candidates) {
      let baseExists = null
      try {
        baseExists = fs.existsSync(base)
        hostDbg('尝试候选:', base, '候选文件存在 =', baseExists)
        const mod = createRequire(base)('lmdb')
        // CJS 下模块是命名空间对象（open 为命名导出）；兼容直接导出函数的形态
        loaded = typeof mod === 'function' ? mod : typeof mod?.open === 'function' ? mod.open : null
        if (loaded) {
          hostDbg('宿主 lmdb 加载成功，候选 =', base, '（baseURI 方案 =', patchBaseUri, '）')
          break
        }
        hostDbg('候选模块可 require 但缺少 open 导出，typeof mod =', typeof mod, 'keys =',
          mod && typeof mod === 'object' ? Object.keys(mod).slice(0, 30) : [], '，继续下一个候选')
      } catch (e) {
        hostDbg('候选加载失败:', base, '候选文件存在 =', baseExists, e)
      }
    }
  } finally {
    if (restore) {
      try {
        restore()
        hostDbg('baseURI 已还原')
      } catch (e) {
        hostDbg('还原 baseURI 失败:', e)
      }
    }
  }
  return loaded
}

/**
 * ZTools 数据根目录候选（按优先级）：
 * 3.0 布局固定在 ~/.ztools；旧版数据在系统用户数据目录的 ZTools/lmdb 下。
 */
function ztoolsRootCandidates() {
  const home = os.homedir()
  const candidates = [path.join(home, '.ztools')]
  const appData =
    process.env.APPDATA ||
    (process.platform === 'darwin'
      ? path.join(home, 'Library', 'Application Support')
      : process.platform === 'win32'
        ? path.join(home, 'AppData', 'Roaming')
        : path.join(home, '.config'))
  candidates.push(path.join(appData, 'ZTools'))
  return candidates
}

/** 返回第一个存在 lmdb 数据痕迹的根目录；都不存在返回 null。 */
function findZtoolsRoot() {
  for (const root of ztoolsRootCandidates()) {
    const lmdbRoot = path.join(root, 'lmdb')
    const traces = [
      path.join(lmdbRoot, 'device', 'data.mdb'),
      path.join(lmdbRoot, 'accounts', 'default', 'data.mdb'),
      path.join(lmdbRoot, 'data.mdb')
    ].map((p) => ({ path: p, exists: fs.existsSync(p) }))
    hostDbg('数据根候选:', root, '痕迹检查:', traces)
    if (traces.some((t) => t.exists)) return root
  }
  hostDbg('所有数据根候选都没有 lmdb 痕迹，findZtoolsRoot = null')
  return null
}

/** 与宿主 hashAccountId 一致：uid 的 sha256 前 16 位十六进制作为账号目录名。 */
function hashAccountId(uid) {
  return nodeCrypto.createHash('sha256').update(uid).digest('hex').slice(0, 16)
}

/**
 * 解析当前激活账号的 LMDB 环境目录。
 * 3.0 布局：<root>/lmdb/device/data.mdb 存在时读其中的 SYNC/current-account 决定
 * accounts/<hash> 还是 accounts/default；旧版布局回落 <root>/lmdb（扁平单库）。
 */
function resolveAccountDbPath(openLmdb, root) {
  const lmdbRoot = path.join(root, 'lmdb')
  if (!fs.existsSync(path.join(lmdbRoot, 'device', 'data.mdb'))) {
    hostDbg('无 device/data.mdb，按旧版扁平布局使用:', lmdbRoot)
    return lmdbRoot // 旧版扁平布局
  }
  let uid = null
  try {
    const env = openLmdb({ path: path.join(lmdbRoot, 'device'), readOnly: true, maxDbs: 6, compression: false })
    try {
      const main = env.openDB({ name: 'main', encoding: 'string' })
      const raw = main.get('SYNC/current-account')
      hostDbg('device 库读取 SYNC/current-account:', raw ? String(typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf8')).slice(0, 300) : '(空)')
      if (raw) {
        const doc = JSON.parse(typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf8'))
        if (doc && doc.data && typeof doc.data.uid === 'string' && doc.data.uid.trim()) {
          uid = doc.data.uid.trim()
        }
      }
    } finally {
      try {
        env.close()
      } catch (_) {
        /* 关闭失败忽略 */
      }
    }
  } catch (e) {
    hostDbg('读取 device 库 current-account 失败（回落 default 账号）:', e)
    uid = null
  }
  let chosen = null
  if (uid) {
    const byHash = path.join(lmdbRoot, 'accounts', hashAccountId(uid))
    hostDbg('当前账号 uid 存在，hash =', hashAccountId(uid), '，账号目录 data.mdb 存在 =', fs.existsSync(path.join(byHash, 'data.mdb')))
    if (fs.existsSync(path.join(byHash, 'data.mdb'))) chosen = byHash
  }
  if (!chosen) chosen = path.join(lmdbRoot, 'accounts', 'default')
  hostDbg('resolveAccountDbPath 结果:', chosen, 'data.mdb 存在 =', fs.existsSync(path.join(chosen, 'data.mdb')))
  return chosen
}

/** 单次提取的附件总字节上限（备忘快贴单图 ≤10MB；防极端数据把渲染进程撑爆）。 */
const HOST_DUMP_MAX_ATTACHMENT_BYTES = 128 * 1024 * 1024

/**
 * 只读提取一个插件在宿主数据库里的全部文档与附件。
 * 返回 { account, docs, attachments, truncated }：
 * - docs: [{ id, doc }]，id 为去掉 PLUGIN/<name>/ 前缀后的 key，doc 为解析后的文档体
 *   （已剔除墓碑 _deleted 与坏文档）；
 * - attachments: [{ id, mime, bytes }]，id 为去掉前缀后的附件文档 key，mime 来自附件
 *   元数据（缺失为空串，渲染层按魔数兜底嗅探）；超过总字节上限后停止收集并置 truncated。
 * 找不到宿主 lmdb 模块 / 数据目录，或打开数据库失败时抛带中文信息的 Error。
 */
function readHostPluginData(pluginName) {
  hostDbg('===== readHostPluginData 开始, pluginName =', pluginName, '=====')
  assertPluginName(pluginName)
  const openLmdb = loadHostLmdb()
  if (!openLmdb) {
    hostDbg('抛错：无法加载宿主数据模块（loadHostLmdb 返回 null，原因见上方日志）')
    throw new Error('无法加载宿主数据模块（需要在已安装的 ZTools 中运行）')
  }
  const root = findZtoolsRoot()
  if (!root) {
    hostDbg('抛错：未找到 ZTools 本地数据目录，候选 =', ztoolsRootCandidates())
    throw new Error('未找到 ZTools 本地数据目录')
  }
  const dbPath = resolveAccountDbPath(openLmdb, root)
  let env
  try {
    env = openLmdb({ path: dbPath, readOnly: true, maxDbs: 6, compression: false })
    hostDbg('打开数据成功:', dbPath)
  } catch (e) {
    hostDbg('抛错：打开数据库失败:', dbPath, e)
    throw new Error(`打开 ZTools 数据库失败：${e instanceof Error ? e.message : String(e)}`)
  }
  try {
    const prefix = `PLUGIN/${pluginName}/`
    hostDbg('扫描文档前缀:', prefix)
    const docs = []
    let badDocs = 0
    try {
      const main = env.openDB({ name: 'main', encoding: 'string' })
      for (const { key, value } of main.getRange({ start: prefix })) {
        if (!key.startsWith(prefix)) break
        let doc
        try {
          doc = JSON.parse(typeof value === 'string' ? value : Buffer.from(value).toString('utf8'))
        } catch (_) {
          badDocs += 1
          continue // 坏文档跳过，不拖垮整体导入
        }
        if (!doc || doc._deleted) continue
        docs.push({ id: key.slice(prefix.length), doc })
      }
      hostDbg('文档扫描完成: docs =', docs.length, '坏文档(解析失败跳过) =', badDocs)
    } catch (e) {
      hostDbg('main 库读取失败（视为无文档）:', e)
    }
    const attachments = []
    let truncated = false
    let totalBytes = 0
    try {
      const att = env.openDB({ name: 'attachment', encoding: 'binary' })
      const attPrefix = `attachment:${prefix}`
      for (const { key, value } of att.getRange({ start: attPrefix })) {
        if (!key.startsWith(attPrefix)) break
        const buf = Buffer.from(value)
        if (totalBytes + buf.length > HOST_DUMP_MAX_ATTACHMENT_BYTES) {
          truncated = true
          hostDbg('附件总字节超过上限，停止收集，truncated = true')
          break
        }
        const id = key.slice(attPrefix.length)
        let mime = ''
        try {
          const extRaw = att.get(`attachment-ext:${id}`)
          if (extRaw !== undefined) {
            const meta = JSON.parse(typeof extRaw === 'string' ? extRaw : Buffer.from(extRaw).toString('utf8'))
            if (meta && typeof meta.type === 'string') mime = meta.type
          }
        } catch (_) {
          /* 元数据缺失时渲染层按魔数嗅探 */
        }
        attachments.push({ id, mime, bytes: new Uint8Array(buf) })
        totalBytes += buf.length
      }
      hostDbg('附件扫描完成: attachments =', attachments.length, 'totalBytes =', totalBytes)
    } catch (e) {
      hostDbg('attachment 库读取失败（视为无附件）:', e)
    }
    hostDbg('===== readHostPluginData 完成 =====')
    return { account: path.basename(dbPath), docs, attachments, truncated }
  } finally {
    try {
      env.close()
    } catch (_) {
      /* 关闭失败忽略 */
    }
  }
}

if (typeof window !== 'undefined') {
  window.snapMemoFs = {
    readTextFile,
    writeTextFile,
    readClipboardText,
    readClipboardImage,
    readImageFile,
    writeTempImage,
    ensureFontFiles,
    readHostPluginData
  }
  // 诊断辅助（排查宿主数据提取用）：DevTools 控制台可直接调用。
  // - __snapMemoDumpLogs()：打印并返回全部 hostdata 诊断日志（含 DevTools 打开前的历史）；
  // - __snapMemoProbeHost()：只读快速探测 lmdb 模块与数据目录，不读取业务数据。
  window.__snapMemoDumpLogs = function () {
    for (const line of hostDbgLines) console.info(HOSTDBG_TAG, line)
    return hostDbgLines.slice()
  }
  window.__snapMemoProbeHost = function () {
    const openLmdb = loadHostLmdb()
    const root = openLmdb ? findZtoolsRoot() : null
    const dbPath = openLmdb && root ? resolveAccountDbPath(openLmdb, root) : null
    const summary = { lmdbLoaded: Boolean(openLmdb), resourcesPath: process.resourcesPath || null, root, dbPath }
    hostDbg('__snapMemoProbeHost 结果:', summary)
    return summary
  }
}

module.exports = {
  readTextFile,
  writeTextFile,
  readClipboardText,
  readClipboardImage,
  readImageFile,
  writeTempImage,
  ensureFontFiles,
  readHostPluginData
}

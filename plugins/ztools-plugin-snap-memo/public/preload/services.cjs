'use strict'

/**
 * 速贴备忘 preload：向渲染层暴露受约束的文件读写与剪贴板读取（window.snapMemoFs，
 * 见 src/env.d.ts）。约束内容：
 * - 路径必须是非空绝对路径、不含 NUL、不经过隐藏目录/隐藏文件（防 dotfile 与配置文件读写）；
 * - 读写均走扩展名白名单（json/txt/md/csv/yml/yaml），写入为同目录临时文件 + 原子重命名；
 * - 文本读取上限 16MB（防误选大文件阻塞渲染进程）；
 * - 图片读写扩展名白名单 + 8MB 上限；临时图片自动清理（24h 之前或超量）。
 * 注意：本 preload 不提供「任意文件」能力的承诺边界如上；渲染层被注入脚本攻击时的
 * 纵深防御依赖宿主沙箱（无 nodeIntegration）+ 上述约束。
 */

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

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

if (typeof window !== 'undefined') {
  window.snapMemoFs = {
    readTextFile,
    writeTextFile,
    readClipboardText,
    readClipboardImage,
    readImageFile,
    writeTempImage
  }
}

module.exports = {
  readTextFile,
  writeTextFile,
  readClipboardText,
  readClipboardImage,
  readImageFile,
  writeTempImage
}

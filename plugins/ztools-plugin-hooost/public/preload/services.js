const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { execSync } = require('node:child_process')

const APP_DIR_NAME = 'hooost'

function getDataDir() {
  const platform = os.platform()
  if (platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), APP_DIR_NAME)
  }
  return path.join(os.homedir(), 'Library', 'Application Support', APP_DIR_NAME)
}

function getHostsPath() {
  return os.platform() === 'win32'
    ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
    : '/etc/hosts'
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function getBackupsDir() {
  const dir = path.join(getDataDir(), 'backups')
  ensureDir(dir)
  return dir
}

function getPresetsPath() {
  return path.join(getDataDir(), 'presets.json')
}

function getTmpDir() {
  const dir = path.join(getDataDir(), 'tmp')
  ensureDir(dir)
  return dir
}

// 通过 window 对象向渲染进程注入 nodejs 能力
window.services = {
  getSystemInfo() {
    const platform = os.platform()
    return {
      platform: platform === 'win32' ? 'win32' : platform === 'darwin' ? 'darwin' : 'linux',
      hostsPath: getHostsPath(),
      dataDir: getDataDir(),
    }
  },

  readHosts() {
    return fs.readFileSync(getHostsPath(), { encoding: 'utf-8' })
  },

  loadPresets() {
    const filePath = getPresetsPath()
    if (!fs.existsSync(filePath)) {
      return { activePresetId: null, presets: [] }
    }
    try {
      return JSON.parse(fs.readFileSync(filePath, { encoding: 'utf-8' }))
    } catch {
      return { activePresetId: null, presets: [] }
    }
  },

  savePresets(store) {
    const filePath = getPresetsPath()
    ensureDir(path.dirname(filePath))
    fs.writeFileSync(filePath, JSON.stringify(store, null, 2), { encoding: 'utf-8' })
  },

  listBackups() {
    const dir = getBackupsDir()
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.hosts')).sort().reverse()
    return files.map(f => {
      const fullPath = path.join(dir, f)
      let stat
      try { stat = fs.statSync(fullPath) } catch { stat = null }
      // 文件名格式: 20260413-153000_dev.hosts 或 20260413-153000.hosts
      const presetMatch = f.match(/^\d{8}-\d{6}_(.+)\.hosts$/)
      return {
        filename: f,
        path: fullPath,
        createdAt: stat ? stat.mtime.toISOString() : '',
        presetName: presetMatch ? presetMatch[1] : undefined,
      }
    })
  },

  applyHosts(content, presetName) {
    const hostsPath = getHostsPath()

    // 1. 备份当前 hosts
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 15)
    const safeName = presetName ? presetName.replace(/[^a-zA-Z0-9_-]/g, '_') : 'unknown'
    const backupFile = path.join(getBackupsDir(), `${timestamp}_${safeName}.hosts`)
    fs.copyFileSync(hostsPath, backupFile)

    // 2. 写入临时文件
    const tmpFile = path.join(getTmpDir(), `hosts_${Date.now()}`)
    fs.writeFileSync(tmpFile, content, { encoding: 'utf-8' })

    // 3. 提权复制到系统 hosts
    try {
      const platform = os.platform()
      if (platform === 'win32') {
        // Windows: 使用 runas 或直接尝试复制（ZTools 本身可能已提权）
        try {
          fs.copyFileSync(tmpFile, hostsPath)
        } catch {
          // 如果普通复制失败，尝试使用管理员权限
          execSync(`copy /Y "${tmpFile}" "${hostsPath}"`, { shell: 'cmd.exe' })
        }
      } else {
        // macOS / Linux: 使用 osascript 提权
        try {
          fs.copyFileSync(tmpFile, hostsPath)
        } catch {
          execSync(`osascript -e 'do shell script "cp \\"${tmpFile}\\" \\"${hostsPath}\\"" with administrator privileges'`)
        }
      }

      // 4. 清理临时文件
      try { fs.unlinkSync(tmpFile) } catch {}

      // 5. 刷新 DNS 缓存
      try {
        if (platform === 'win32') {
          execSync('ipconfig /flushdns', { stdio: 'ignore' })
        } else {
          execSync('dscacheutil -flushcache; sudo killall -HUP mDNSResponder', { stdio: 'ignore' })
        }
      } catch {}

      return { success: true, backupPath: backupFile }
    } catch (err) {
      // 写入失败，保留临时文件以便手动恢复
      return {
        success: false,
        error: err.message || String(err),
        backupPath: backupFile,
        tmpFile,
      }
    }
  },

  restoreBackup(backupPath) {
    const hostsPath = getHostsPath()
    if (!fs.existsSync(backupPath)) {
      return { success: false, error: '备份文件不存在' }
    }

    // 先备份当前 hosts
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 15)
    const backupFile = path.join(getBackupsDir(), `${timestamp}_pre-restore.hosts`)
    try { fs.copyFileSync(hostsPath, backupFile) } catch {}

    try {
      const platform = os.platform()
      try {
        fs.copyFileSync(backupPath, hostsPath)
      } catch {
        if (platform === 'win32') {
          execSync(`copy /Y "${backupPath}" "${hostsPath}"`, { shell: 'cmd.exe' })
        } else {
          execSync(`osascript -e 'do shell script "cp \\"${backupPath}\\" \\"${hostsPath}\\"" with administrator privileges'`)
        }
      }

      // 刷新 DNS
      try {
        if (platform === 'win32') {
          execSync('ipconfig /flushdns', { stdio: 'ignore' })
        } else {
          execSync('dscacheutil -flushcache; sudo killall -HUP mDNSResponder', { stdio: 'ignore' })
        }
      } catch {}

      return { success: true }
    } catch (err) {
      return { success: false, error: err.message || String(err) }
    }
  },
}

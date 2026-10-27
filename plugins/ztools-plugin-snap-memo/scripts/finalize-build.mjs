import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
// fileURLToPath：URL.pathname 在 Windows 上是 "/D:/..." 形式，fs 识别不了（曾导致构建在 Windows 必失败）
import { fileURLToPath } from 'node:url'

const DIST = fileURLToPath(new URL('../dist', import.meta.url))
const RELEASE = join(DIST, '..', 'release', 'snap-memo')

/** 汇总目录内所有文件的大小（KB）。 */
function totalSize(dir) {
  let size = 0
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    size += st.isDirectory() ? totalSize(p) : st.size
  }
  return size
}

if (!existsSync(join(DIST, 'plugin.json'))) {
  console.error('[finalize] dist/plugin.json 缺失，构建可能未包含 public/ 目录')
  process.exit(1)
}
if (!existsSync(join(DIST, 'preload', 'services.cjs'))) {
  console.error('[finalize] dist/preload/services.cjs 缺失：没有 preload，剪贴板/文件能力将静默降级')
  process.exit(1)
}

// 版本一致性：plugin.json 与 package.json 必须同版本（防止发布“旧版本号的新功能”）
const pluginJson = JSON.parse(readFileSync(join(DIST, 'plugin.json'), 'utf8'))
const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'))
if (pluginJson.version !== packageJson.version) {
  console.error(`[finalize] 版本不一致：plugin.json=${pluginJson.version} package.json=${packageJson.version}`)
  process.exit(1)
}

// 发布产物剥离开发配置（development.main 指向本机 dev server，不应进官方仓库）
const publishJson = { ...pluginJson }
delete publishJson.development

// 重建发布目录：先清空再拷贝，避免历史 hash 产物无限累积（旧版曾积累 5MB 死文件）
rmSync(RELEASE, { recursive: true, force: true })
cpSync(DIST, RELEASE, { recursive: true })
writeFileSync(join(RELEASE, 'plugin.json'), JSON.stringify(publishJson, null, 2) + '\n', 'utf8')
cpSync(fileURLToPath(new URL('../src/assets/logo.svg', import.meta.url)), join(RELEASE, 'logo.svg'))

const files = readdirSync(DIST)
console.log(`[finalize] dist 文件数: ${files.length}，总计 ${(totalSize(DIST) / 1024).toFixed(1)} KB`)
console.log(`[finalize] 发布目录: ${RELEASE}（已剥离 development 配置）`)

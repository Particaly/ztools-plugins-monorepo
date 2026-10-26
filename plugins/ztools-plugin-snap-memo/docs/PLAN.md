# 速贴备忘（snap-memo）· 阶段 A 方案

> 目标：在 ZTools 搜索栏唤起，毫秒级检索已保存的备忘/常用片段，回车直接粘贴到当前应用。
> 设计关键词：键盘优先、零学习成本、快、稳、克制、好看。

## 1. API 能力核实表

依据（按可信度排序）：
- 本地 `@ztools-center/ztools-api-types@1.0.3`（含 `ztools.api.d.ts` 与 `API_STATUS.md`，同步自 uTools 7.2.0，2025-12-12）
- ZTools 主仓库源码（github.com/ZToolsCenter/ZTools，已拉取核对子输入框与主题注入实现）
- 本集合内在生产使用的插件（scripty / database-viewer / diffffff / f-provider）的实际调用

| 计划使用的 API | 结论 | 依据 | 降级方案 |
|---|---|---|---|
| `onPluginEnter` / `onPluginOut` / `outPlugin` | ✅ 可用，覆盖式 setter（只能注册一次） | API_STATUS「已完全实现」；diffffff 注释明确"覆盖式 setter"；scripty/database-viewer 在用 | 不需要 |
| `setSubInput` / `setSubInputValue` / `subInputFocus` / `subInputBlur` | ✅ 可用 | API_STATUS「已完全实现」；主窗口源码 `src/main/api/plugin/ui.ts` 有完整 IPC 实现 | 运行时特性检测；不可用则用页面内搜索框（行为一致，统一 query 状态） |
| 子输入框聚焦时的按键 | ✅ 已核实源码：宿主把 **↑/↓/Tab/Enter（含修饰键）** 拦截后以输入事件转发给插件页面；←/→ 不转发（光标移动）；字母/数字/空格进入子输入框文本 | `src/renderer/src/App.vue` `handleArrowKeydown`/`handleKeydown` + `SearchBox.vue` | 页面获得焦点时（点击列表、编辑器内）全部快捷键原生可用；两套路径共用同一 window keydown 处理器 |
| `Escape` | ⚠️ 宿主实现"分步退出"（清子输入框 → 清粘贴内容 → 隐藏窗口） | 主窗口 `handleKeydown` 源码 + e2e `plugin-esc-hide.spec.ts` | 插件页内 Esc 仍按"弹窗 → 清搜索 → 交给宿主退出"逐层处理；与宿主冲突时优先宿主（已满足规范要求） |
| `Cmd/Ctrl+D`、`Cmd/Ctrl+Q` | ⚠️ 宿主保留（分离插件 / 终止插件） | 主窗口源码 | "复制条目"改用 `Mod+Shift+D` 为主绑定，`Mod+D` 作为浏览器开发态别名 |
| `setExpendHeight` | ✅ 可用 | API_STATUS「已完全实现」 | 特性检测；不可用则固定高度布局 |
| `hideMainWindow` / `showMainWindow` | ✅ 可用 | API_STATUS；ui.ts 实现 | 不需要 |
| `copyText` | ✅ 可用 | API_STATUS；f-provider/diffffff 在用 | `navigator.clipboard.writeText` |
| `hideMainWindowPasteText` | ✅ 作为首选 | 类型定义存在；f-provider 实际在用（带 try/catch） | 降级链见下 |
| `simulateKeyboardTap` | ⚠️ 类型存在、未确认实现 | API_STATUS 未列出 | 仅作降级链第二级，运行时特性检测，失败进第三级 |
| 粘贴降级链 | 设计即降级链 | — | ①`hideMainWindowPasteText` ②`copyText`+`hideMainWindow`+`simulateKeyboardTap(Cmd/Ctrl+V)` ③仅 `copyText`+Toast「已复制，请手动粘贴」 |
| 读取剪贴板文本（`{clipboard}` 占位符、恢复剪贴板） | ⚠️ 渲染层无 API（`getCopyedFiles` 仅文件） | 类型定义核对 | preload 里 `require('electron').clipboard.readText()`（受控封装、判空）；浏览器 mock 用 `navigator.clipboard.readText()`；都失败则占位符解析为空串并 Toast 提示 |
| `db.put/get/remove/bulkDocs/allDocs(前缀)`、`dbStorage` | ✅ 可用 | API_STATUS「完整的同步/异步 API」；diffffff/webdav-sync 在用 dbStorage，scripty 在用 db | 浏览器 mock 用 localStorage（仅开发态） |
| `setFeature` / `removeFeature` / `getFeatures`（动态触发词） | ✅ 可用 | API_STATUS「动态 Feature API 已完全实现」 | 特性检测；不可用则编辑器中隐藏"触发词"字段 |
| `showOpenDialog` / `showSaveDialog` / `getPath` | ✅ 可用 | API_STATUS | 浏览器 mock 用 `<input type=file>` / Blob 下载 |
| `showNotification` | ✅ 可用 | API_STATUS | 页内 Toast |
| `isDarkColors` / `isMacOS` / `isWindows` / `isLinux` | ✅ 可用 | API_STATUS | `prefers-color-scheme` + UA 判断 |
| 宿主主题色 | ✅ 宿主向插件页注入 `:root { --plugin-primary-color }` | 主仓库 `src/main/core/pluginTheme.ts` 源码 | `var(--plugin-primary-color, #4f6ef7)` 回退；明暗用 `isDarkColors()` + `matchMedia` 双保险 |
| plugin.json `features[].platform` | ⚠️ d.ts 有、JSON Schema 无此字段 | ztools.schema.json 核对 | 省略该字段（即全平台），三平台都兼容 |
| `over` 型指令（选中文本入口） | ✅ 可用 | schema cmds type 枚举含 `over`；f-provider 实际在用 | 不需要 |
| `onMainPush` | 不使用 | — | 用关键词 + over + 动态触发词已覆盖需求，降低复杂度 |

参考插件 `memo-quick-paste`（官方仓库）核对结论：uTools 官方移植，bundle 约 1.4MB，支持文本/图片/文件。本项目差异化：纯文本轻量快、拼音搜索、占位符、可测试的纯函数内核、明暗主题与可访问性。

## 2. 目录结构与模块划分

沿用本集合既有插件（scripty / database-viewer / diffffff）的目录约定（`ztools-plugin-cli` 在 npm 上不存在，404，见假设清单）：

```
rerecord/
├─ public/
│  ├─ plugin.json            # ZTools 插件清单（$schema 校验）
│  ├─ logo.png               # 正方形图标（SVG 源文件在 src/assets/logo.svg）
│  └─ preload/services.cjs    # CJS preload：受控 fs 读写 + 剪贴板读取
├─ src/
│  ├─ core/                  # 纯函数内核（无 Vue/DOM 依赖，Vitest 覆盖）
│  │  ├─ types.ts            # Memo/Group/Settings 等领域模型
│  │  ├─ id.ts               # nanoid 封装 + 时间戳前缀
│  │  ├─ placeholders.ts     # 占位符解析（{date}/{clipboard}/{input:..}/\{..} 转义）
│  │  ├─ search.ts           # 分词、打分、高亮区间
│  │  ├─ pinyin.ts           # 拼音索引（pinyin-pro，LRU 缓存）
│  │  ├─ frecency.ts         # 使用频率×新近度评分
│  │  ├─ sanitize.ts         # 脏数据容错（单条坏数据不影响列表）
│  │  ├─ migration.ts        # schemaVersion 迁移注册表
│  │  ├─ transfer.ts         # 导入导出（合并/覆盖策略、预览计数、文本/MD/CSV）
│  │  └─ seed.ts             # 首次运行的示例数据
│  ├─ platform/              # 平台适配层（ztools 宿主 + 浏览器 mock 双实现）
│  ├─ store/                 # repository（存储适配）+ appStore（reactive 状态与动作）
│  ├─ composables/           # useToast / useTheme / useLifecycle / useHotkeys
│  ├─ components/            # 自研组件（MemoList/EditorPanel/... 全部内联 SVG 图标）
│  ├─ i18n/zh-CN.ts          # 全部用户可见文案
│  └─ styles/                # CSS 变量主题（明/暗）+ 基础样式
├─ tests/                    # Vitest 单元测试（core 纯函数）
├─ index.html / vite.config.ts / vitest.config.ts / tsconfig.json / eslint.config.js
└─ README.md / CHANGELOG.md / LICENSE / MANUAL-TEST.md
```

分层规则：`core/` 不得 import Vue 或 platform；`store/` 依赖 core+platform；组件只依赖 store 与 i18n。

## 3. 数据模型与迁移策略

- 文档划分（遵守"禁止把全部数据塞进一个大文档"）：
  - 每条备忘一个文档：`sm/memo/<id>`（正文含行内图片标记 `{img:<slotId>}`，图片元数据在 `images[]`）
  - 每张图片一个桩文档：`sm/att/<slotId>`（仅挂附件的空文档，像素不进同步正文；宿主 postAttachment 要求文档已存在）
  - 分组集合一个文档：`sm/groups`（分组是少量有序元数据）
  - 设置一个文档：`sm/settings`
  - 批量操作前快照：`sm/backup`（仅保留最近一份）
  - 轻量键值（dbStorage）：`sm/draft`（编辑草稿）、`sm/seeded`（首启标记）
- 图片与旧结构迁移：v1 单图结构（附件挂 memo 文档、imageHash 等单值字段）在 `sanitize` 读取时升级为 `images[0]`（槽 ID 约定复用 memoId，正文补写首图标记）；宿主路径在 `loadAll` 里把旧附件物理搬迁到桩文档并剥离 memo 文档附件（幂等），读取路径同时保留 memo 文档附件回退，搬迁失败不影响加载。
- 迁移机制：读取的每个文档先过 `sanitize.ts` 容错归一（字段级默认值、类型纠正、坏文档隔离返回 null），再按 `schemaVersion` 走 `migration.ts` 的步骤注册表（0→1→…），纯函数、可单测、向前容忍（未知更高版本按当前结构尽力读取）。
- 单文档容量：ZTools 未在文档中标明 db 单文档上限（风险项）。策略：内容 > 64KB 保存时 Toast 提醒、> 256KB 拒绝保存并说明原因；导出文件整体走 preload fs，不受 db 限制。

## 4. 假设清单与风险点

**假设（自行取默认值）**
1. `ztools-plugin-cli` 在 npm 不存在（404）→ 采用本集合已上线插件的目录结构作为脚手架事实标准。
2. 插件 ID 用 `snap-memo`（官方仓库 plugins/ 下无同名目录，已核对仓库树）；开发目录为 rerecord，发布时整体复制为 `plugins/snap-memo/`。
3. 快捷键中 `Mod`：macOS=Cmd，其余=Ctrl；`Cmd+D`/`Cmd+Q` 为宿主保留键，"复制条目"主绑定 `Mod+Shift+D`。
4. 子输入框模式下，Alt+数字、Space 等按键仅在页面获得焦点后生效（宿主只转发 ↑↓/Tab/Enter）；点击列表任意处即可把焦点交还页面。README 与界面提示栏会写明。
5. 拼音检索用 `pinyin-pro`（打包后约 +300KB，为主要依赖体积，README 说明）；不引入 Fuse.js，打分自实现以精确控制拼音/字段权重/frecency。
6. 状态管理不引 Pinia（轻量 reactive store 即可，减少启动开销）。
7. 不使用 vue-router，视图切换由 store 状态驱动，懒加载编辑器/设置/数据页组件。
8. i18n 仅简体中文，但全部文案集中在一个字典模块，预留 key 结构。

**风险点**
- `hideMainWindowPasteText` 在不同前台应用（终端、管理员权限窗口、IDE）的粘贴可靠性 —— 已有三层降级链 + 失败 Toast；真实环境验证列入 MANUAL-TEST.md。
- `simulateKeyboardTap` 未确认 ZTools 已实现 —— 仅作二级降级，且运行时检测。
- preload 沙箱对 `require('electron')` 的可用性 —— 受控 try/catch，失败时 `{clipboard}` 占位符置空并提示，其余功能不受影响。
- 宿主 Esc 分步退出与插件内逐层退出的边界 —— 插件先消费（关弹窗/清搜索），未消费的交给宿主，符合"冲突时优先宿主"。
- db 单文档大小上限未知 —— 超长内容提醒/拒绝（见上）。

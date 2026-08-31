<script setup lang="ts">
// FND-004 App Shell：三段式容器布局骨架（工具栏 / 双栏工作台 / 底部操作区）。
// FND-005：双栏接入 workbench store，并完成生命周期接线
// （onPluginEnter 聚焦左编辑器、onPluginOut 持久化未保存输入，见 usePluginLifecycle）。
// UI-001：双栏已替换为 CodeMirror 6 编辑器组件（components/InputEditor.vue），
// 数据源仍是 store（stores/workbench.ts），聚焦接口（focusLeftEditor）签名不变。
// UI-002：pane 头部新增「打开文件」按钮（useFileLoad），并挂载全局反馈组件
// （ZToast / ZConfirmDialog，供 useFileLoad 的错误提示与覆盖确认使用）。
// UI-003：每侧 pane 成为拖放目标（useDropLoad）——文件拖入走 preload 读路径、
// 文本拖入直接覆盖该侧，悬停时显示拖拽覆盖层（虚线框 + 半透明遮罩 + 文案）。
// UI-004：对比触发机制接线 —— 「查找差异」主按钮 + ⌘/Ctrl+Enter 全局快捷键
// （window 捕获阶段）+ 工具栏右侧「实时对比」开关（400ms 防抖 watch）+
// 底部最小结果摘要条（result-summary，UI-010 升级为完整统计条）。
// UI-005：工具栏重排为「标题 | 视图/精度/语言 | 选项开关 | 实时对比+设置」，
// 视图与选项状态归 viewStore（stores/view.ts），结果态归 diffStore ——
// 新增「选项变化自动重跑」watch（有结果立即重跑）与「实时对比默认值」
// 启动注入（onMounted），设置弹窗（SettingsDialog.vue）由齿轮按钮触发。
// UI-006：工作台切换为「输入态 / 结果态」双态 —— 存在成功结果且 resultMode
// 时渲染结果视图；工具栏行尾新增「返回编辑」（仅 UI 层切回输入态、不清
// diffStore.result）。显式触发（主按钮 / ⌘/Ctrl+Enter）run 成功后自动进入
// 结果态；实时防抖与选项自动重跑属后台刷新，不改变当前态（避免编辑中被拽回
// 结果视图）。双态状态机由 UI-011 升级为三态（见 UI-011 条目）。
// UI-007：结果态按 viewStore.viewMode 分流 —— 并排渲染 SplitDiffView、
// 统一渲染 UnifiedDiffView（单栏 +/−/空格 行 + hunk 头条，组件文件头有全量说明）。
// UI-010：底部摘要条升级为完整统计条（+N/−M/~K/H 处差异 徽标）+ hunk 导航
// 按钮组（▲ 上一处 / 位置 2/5 / ▼ 下一处）+ F3/Shift+F3 全局快捷键；导航态
// 归 stores/nav.ts（键盘与按钮同一出口），result 变化时 watch 重置定位。
// UI-011：结果态保留编辑 —— 结果视图行内容格点击（并排 = 左右内容格各自
// 侧别、统一 = del 行→左 / add 行→右 / equal 行→左）进入「保留编辑态」
// （edit-from-result）：result 缓存不清空、聚焦被点侧编辑器并按行号定位光标
// （InputEditor.focusLine）；顶部编辑提示条提供「重新对比」（run + 切回结果
// 态）与「返回结果」（不重算直接切回）。三态状态机与全部转换见脚本区
// 「结果态开关与保留编辑状态机」大注释；结果态错误块兜底（ok:false 不白屏，
// 完整错误态归 UI-013）。
// UI-012：合并更改 —— 两个结果视图 hunk 首行前的「合并控制条」emit
// applyHunk（hunk 下标 + 方向），handleApplyHunk 调 core/merge.ts 的
// applyHunk 把该 hunk 一侧内容写入另一侧（setLeftText / setRightText）后
// diffStore.run() 重算刷新（后台刷新路径：不碰 appMode，结果态保持、
// 保留编辑态照常重算；应用后该 hunk 消失属预期）。
// UI-013：状态与反馈补全 ——
// ① 空输入：runDiffWithEmptyFeedback 在调用侧检测两侧全空（与 store 空态
//    短路同条件）时 ZToast info，三条触发路径（显式 / 实时防抖 / 选项重跑）
//    统一走该包装；store 保持纯状态机、clear() 语义不变；
// ② 两侧相同：isIdenticalResult（成功 + 统计/hunk 全零）时结果视图顶部
//    常驻提示条 .same-notice（main.css），结果视图照常渲染可浏览；
// ③ 引擎错误：错误块按类别具体化（too-large 带实际/上限详情、invalid-regex
//    带 pattern 与「打开设置」直达、internal 原文直出），错误结果落地瞬间
//    ZToast error 一次（result watch），完整详情常驻错误块 / 底部摘要条；
// ④ 加载态：重算进行中且已有旧结果时工作台顶部不确定进度条（.result-progress，
//    main.css，纯感知优化）；主按钮「对比中…」维持原有反馈。
// UI-014：操作便捷项 —— 工具栏新增「示例数据」动作下拉（中文示例 / 代码示例，
// 载入前覆盖确认、载入后清旧结果回输入态、不自动对比）与「交换 / 清空 /
// 复制原始 / 复制更改后」四个小按钮：交换在有结果时自动重算刷新（后台刷新
// 路径）、清空带防误弹确认并落回输入态、复制走宿主 copyText 优先 + 剪贴板
// 降级的双路径。位置选择与各动作的状态交互决策见脚本区 UI-014 大注释块。
// INT-002：导出能力 —— 工具栏新增「导出」动作下拉（PDF / HTML，与示例数据
// 同款 ZSelect 动作菜单模式）：PDF 走 window.print()（Electron 打印对话框
// 自带「另存为 PDF」，roadmap §4 的无网导出路径，打印样式见 main.css 的
// @media print 块）；HTML 由 core/exporters.ts 组装单文件内联样式文档，宿主
// 环境经 services.pickSaveFile + writeTextFile 落盘（新增第 5 个桥接方法），
// 浏览器 dev 降级为 Blob 下载兜底。无结果 / ok:false 时导出入口禁用（任务 D）。
// INT-003：复制差异报告 —— 工具栏新增「复制报告」动作下拉（unified patch /
// Markdown / HTML 三种格式到剪贴板，对应官网「分享链接」的无网本地化）：
// patch / Markdown 由 core/reporters.ts 纯函数组装（HTML 复用 buildExportHtml，
// 与落盘导出共用同一构建出口 buildResultExportHtml），复制走 useCopy 的宿主
// copyText 优先 + 剪贴板降级链（从 UI-014 的实现抽取共享）。无结果 / ok:false
// 时入口随「导出」一并禁用；unified patch 在两侧无差异时 toast info 引导。
// INT-004：本地历史（「已保存差异」）—— 保存出口是 diffStore.result 的 watch
// （结果 ok 时调 historyStore.saveFromResult()，自动保存关闭时 store 内跳过；
// 显式对比 / 实时防抖 / 选项重跑 / 合并重算四条路径的 ok 结果统一经过该
// watch，节流与去重在 store / 模型层完成）；工具栏行尾新增「历史」按钮
// （带条目数徽标）打开历史侧栏 HistoryDrawer（ZDrawer 右侧滑出）：搜索 /
// 恢复 / 删除 / 清空；恢复经 handleRestoreHistory 编排 —— restore 写回文本
// / 选项 / 语言并重算，成功后关闭抽屉并切结果态（与 runAndShowResult 同
// 语义，详见该函数注释）。
// INT-005：文件编码支持 —— 两侧 pane 头部「打开文件」按钮旁各渲染一个全局
// 「打开编码」选择器（UTF-8 默认 / GBK / UTF-16）：决策取全局单值（两侧
// 选择器绑定同一 ref，改一侧另一侧同步），理由是用户通常连续导入同源文件，
// 每侧独立编码徒增心智负担。「打开文件」与拖入文件两条载入链路均按该编码
// 解码（getter 每次载入时求值）；GBK 等编码遇非法字节序列不抛错，按
// TextDecoder 标准以 U+FFFD 替换符呈现乱码，选择器 tooltip 提示切换编码重试；
// 选择在两次载入间保持（App 级 ref 会话态，不持久化 —— 未列入 INT-007 的
// 持久化范围，见 stores/settings.ts）。
// INT-006：剪贴板载入 —— 两侧 pane 头部各加「粘贴」小按钮（读剪贴板写入该
// 侧：空剪贴板 toast info「剪贴板为空」、目标侧已有内容时覆盖确认「覆盖未
// 保存内容」（与「打开文件」语义一致）、不自动对比不碰 appMode）；工具栏
// 便捷项组加「粘贴并对比」快捷路径（目标侧决策：两侧均空 → 左侧 / 仅一侧
// 空 → 空侧 / 两侧均非空 → 左侧 + 覆盖确认，写入后立即 runAndShowResult 与
// 主按钮同语义进结果态；剪贴板空 toast info 且不触发对比）；⌘/Ctrl+Shift+V
// 全局快捷键（捕获阶段，与 ⌘/Ctrl+Enter / F3 同一监听器）。读取降级链
// ztools services → navigator.clipboard、单侧粘贴流程与目标侧决策抽在
// composables/useClipboardLoad.ts（决策表见该文件头注释）。
// INT-007：设置持久化 —— 设置的载入与写回编排归 stores/settings.ts（纯模型
// 在 core/settingsModel.ts）：模块 import 求值时一次性从 dbStorage（key
// 'diff.settings'，经 schemaVersion 迁移路由）恢复「默认精度 / 默认选项 /
// 视图与语言 / 上下文行数 / 实时对比默认值 / 自定义忽略规则 / 自动保存历史
// 开关」并回写 viewStore 与 historyStore.autoSave，此后字段变更即时写回。
// 本文件只需 side-effect import 触发模块初始化 —— ESM 依赖模块求值早于组件
// setup 与 onMounted，保证下方 onMounted 的「实时对比默认值注入」读到的是
// 恢复后的持久化值而非缺省 false。
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
// UI 组件层（Scandi 重构）：本地轻量组件 + reka-ui 原语，ztools-ui 组件已全部
// 移除（仅 main.ts 保留其 useZtoolsTheme 做宿主亮暗同步）。
import UiButton from './components/ui/UiButton.vue'
import UiConfirmDialog from './components/ui/UiConfirmDialog.vue'
import UiDrawer from './components/ui/UiDrawer.vue'
import UiIcon from './components/ui/UiIcon.vue'
import UiInput from './components/ui/UiInput.vue'
import UiSegmented from './components/ui/UiSegmented.vue'
import UiSelect from './components/ui/UiSelect.vue'
import UiSwitch from './components/ui/UiSwitch.vue'
import UiToastHost from './components/ui/UiToastHost.vue'
import { useToast } from './composables/useToast'
import { useConfirmDialog } from './composables/useConfirm'
import InputEditor from './components/InputEditor.vue'
import HistoryDrawer from './components/HistoryDrawer.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import SplitDiffView from './components/SplitDiffView.vue'
import UnifiedDiffView from './components/UnifiedDiffView.vue'
import { SAMPLES } from './data/samples'
import type { SamplePair } from './data/samples'
import { workbenchStore } from './stores/workbench'
import { diffStore } from './stores/diff'
import { historyStore } from './stores/history'
import { navStore } from './stores/nav'
import {
  LANGUAGE_OPTIONS,
  PRECISION_OPTIONS,
  diffGutterWidthPx,
  viewStore,
} from './stores/view'
// INT-007：设置持久化的初始化入口（side-effect import —— import 求值即完成
// dbStorage 载入与各 store 回写，编排与降级策略见 stores/settings.ts 文件头）。
import './stores/settings'
import { isDiffOk } from './core/types'
import type { DiffError, DiffResultOk, DiffPrecision } from './core/types'
import type { HistoryItem } from './core/historyModel'
import { applyHunk } from './core/merge'
import type { MergeDirection } from './core/merge'
import { buildExportHtml } from './core/exporters'
import { buildMarkdownReport, buildUnifiedPatch } from './core/reporters'
import { usePluginLifecycle } from './composables/usePluginLifecycle'
import { useFileLoad, type FileEncoding } from './composables/useFileLoad'
import { useDropLoad } from './composables/useDropLoad'
import { useCopy } from './composables/useCopy'
import {
  readClipboardTextOrNotify,
  resolvePasteCompareTarget,
  useClipboardLoad,
  writeTextIntoSide,
} from './composables/useClipboardLoad'

/** 左栏 InputEditor 组件实例 ref：onPluginEnter 时经其 exposed focus() 聚焦内部 EditorView */
const leftEditorRef = ref<InstanceType<typeof InputEditor> | null>(null)

/** 右栏 InputEditor 组件实例 ref：UI-011 结果态点击右侧行内容格时聚焦 / 定位用 */
const rightEditorRef = ref<InstanceType<typeof InputEditor> | null>(null)

/** 聚焦左编辑器：交由 usePluginLifecycle 在 onPluginEnter 时调用 */
function focusLeftEditor(): void {
  leftEditorRef.value?.focus()
}

// 生命周期接线：恢复草稿 / onPluginEnter 聚焦 / onPluginOut 持久化
// （内部已 try/catch 静默降级，浏览器 dev 环境无 ztools 全局也不会抛错）
usePluginLifecycle(focusLeftEditor)

/*
 * 全局反馈（UI-002 → Scandi 重构）：useToast / useConfirmDialog 来自本地
 * composables（模块级单例状态，API 与原 ztools-ui 完全一致）。渲染端：
 * UiToastHost / UiConfirmDialog 各自内部读取单例，App 只需挂载组件、
 * 无需再手工绑定 props（原 v-model:visible / @confirm 接线随组件移除）。
 * 状态驱动方不变：useFileLoad / useDropLoad / useClipboardLoad 与 App 的
 * success / confirm 动作共用同一单例。
 */
const { toastState, info: toastInfo, error: toastError, success: toastSuccess } = useToast()
const { confirm } = useConfirmDialog()

// 剪贴板复制单出口（INT-003 抽取共享）：UI-014 的「复制原始 / 复制更改后」
// 与 INT-003 的「复制报告」三个动作共用同一条宿主优先降级链（见 useCopy.ts）
const { copyText } = useCopy()

/*
 * 「打开编码」（INT-005）：全局单值 —— 两侧 pane 头部各渲染一个选择器，
 * 绑定同一 ref（改一侧另一侧同步），理由：用户通常连续导入同源文件，两侧
 * 独立编码徒增心智负担。App 级 ref 即可（纯会话态：两次载入间保持、刷新/
 * 重开复位，不持久化 —— 未列入 INT-007 的持久化范围，故不进 store）。
 * 改值不直接触发任何读取，只在下一次「打开文件」/ 拖入文件时经 getter 生效。
 */
const fileEncoding = ref<FileEncoding>('utf-8')

/**
 * 编码选择器候选：UI 仅暴露三项（顺序即展示顺序，UTF-8 默认在前）；
 * 'utf-16be' 是 preload API 级能力不进 UI（BE 文件极少，UI 保持精简）。
 */
const ENCODING_SELECT_OPTIONS: { label: string; value: FileEncoding }[] = [
  { label: 'UTF-8', value: 'utf-8' },
  { label: 'GBK', value: 'gbk' },
  { label: 'UTF-16', value: 'utf-16' },
]

/** 编码选择器回调：与精度/语言下拉同款字面量收窄，拒绝越界载荷 */
function setFileEncoding(value: string): void {
  if (value === 'utf-8' || value === 'gbk' || value === 'utf-16') {
    fileEncoding.value = value
  }
}

// 「打开文件」载入链路（UI-002）：取消/失败/无 services 降级均在内部消化；
// INT-005：读取编码取当前全局「打开编码」（getter 每次打开时求值，不取快照）
const { openFileInto } = useFileLoad(() => fileEncoding.value)

/** 左侧 pane 头部「打开文件」按钮回调（openFileInto 恒 resolve，无需等待结果） */
function openLeftFile(): void {
  void openFileInto('left')
}

/** 右侧 pane 头部「打开文件」按钮回调 */
function openRightFile(): void {
  void openFileInto('right')
}

/*
 * ============================================================================
 * 剪贴板载入（INT-006）：单侧「粘贴」+ 工具栏「粘贴并对比」快捷路径。
 *
 * 读取降级链（useClipboardLoad，单侧粘贴与粘贴并对比共用）：ztools
 * services.readClipboardText 优先（宿主注入，剪贴板空/失败返回空串，语义见
 * env.d.ts）；浏览器 dev / preview 无 window.services 时降级
 * navigator.clipboard.readText()（首次调用有权限弹窗，拒绝/非安全上下文抛
 * 错）。空串 → toast info「剪贴板为空」；降级路径读取失败 → toast info
 * 「无法读取剪贴板」。两种情况统一以 null 返回给调用方（反馈已在
 * readClipboardTextOrNotify 内补齐），调用方静默结束即可。
 *
 * 单侧粘贴（pane 头部「粘贴」按钮）：固定目标侧，读取 → 该侧已有内容时弹
 * 覆盖确认（文案与「打开文件」一致）→ 写入该侧并清来源文件名（内容不再
 * 来自文件，语言检测回到内容启发式，与文本拖入一致）。不自动对比、不碰
 * appMode（与「打开文件」同策略：实时对比开启时由防抖 watch 自然承接）。
 *
 * 「粘贴并对比」（工具栏便捷项 + ⌘/Ctrl+Shift+V，共用 handlePasteAndCompare）：
 * 快捷路径 —— 读取 → 目标侧决策（决策表见 useClipboardLoad.resolvePasteCompareTarget）
 * → 写入后立即 runAndShowResult()（与主按钮同语义：成功进结果态、失败呈现
 * 结果态错误块、空态短路回输入态）。剪贴板空 → toast info 且不触发对比。
 * ============================================================================
 */
const { pasteIntoSide } = useClipboardLoad()

/** 左侧 pane 头部「粘贴」按钮回调（空剪贴板/取消覆盖等出口在链路内部消化） */
function pasteLeftClipboard(): void {
  void pasteIntoSide('left')
}

/** 右侧 pane 头部「粘贴」按钮回调 */
function pasteRightClipboard(): void {
  void pasteIntoSide('right')
}

/**
 * 「粘贴并对比」（INT-006 快捷路径唯一编排：工具栏按钮与
 * ⌘/Ctrl+Shift+V 共用本出口）。
 *
 * 状态交互决策：
 * - isRunning 期间忽略（与 handleApplyHunk 同策略）：本动作先写文本后
 *   runAndShowResult()，对比进行中放行会撞上 run() 的重入守卫，出现
 *   「文本已改、结果未刷新」的中间态；
 * - 剪贴板空 / 读取失败：readClipboardTextOrNotify 已 toast info 并返回
 *   null，此处静默结束且不触发对比（快捷路径不该把用户拽进一次空对比）；
 * - 覆盖确认只在「两侧均非空」（目标 = 左侧「原始文本」）时弹（决策表见
 *   resolvePasteCompareTarget；仅一侧空时写入空侧无数据丢失、两侧均空时
 *   无可覆盖内容，均不打扰）；用户取消 → 原两侧内容不变、不对比；
 * - 大文本不预拦截：超 DIFF_LIMITS 的剪贴板内容照常写入，由对比时的
 *   too-large 错误链路兜底（错误块 + 底部摘要条 + ZToast error）——写入
 *   本身无上限，在此预拦截需复刻引擎阈值，双份上限易漂移；
 * - runAndShowResult 为函数声明（提升），前向引用安全（同 summarizeError
 *   惯例）：实际调用发生在用户交互时，setup 早已完成。
 */
async function handlePasteAndCompare(): Promise<void> {
  if (diffStore.isRunning) return
  const text = await readClipboardTextOrNotify()
  if (text === null) return
  const target = resolvePasteCompareTarget(workbenchStore.leftText, workbenchStore.rightText)
  if (target.needOverwriteConfirm) {
    const confirmed = await confirm({
      title: '粘贴并对比',
      message: `将覆盖「${target.overwriteSideName}」，继续？`,
      type: 'warning',
      confirmText: '覆盖并对比',
      cancelText: '取消',
    })
    if (!confirmed) return
  }
  writeTextIntoSide(target.side, text)
  // 与主按钮同语义的显式触发路径：成功进结果态 / 失败呈现结果态错误块 /
  // 空态短路回输入态（转换表见上方状态机大注释）。
  await runAndShowResult()
}

/*
 * 拖拽载入（UI-003）：每侧 pane 的拖拽绑定（事件处理器 + 覆盖层可见性）。
 * 文件拖入走 preload 读路径（复用 useFileLoad 抽出的 readFileIntoStore），
 * 文本拖入与「粘贴等价」直接覆盖该侧；载入语义为直接覆盖、不弹覆盖确认
 * （与「打开文件」按钮的确认语义区分，理由见 useDropLoad.ts 文件头注释）。
 * 事件绑定阶段（capture 接管 drop/dragover、冒泡观察 dragstart/dragend）
 * 见模板内各 pane 的注释。INT-005：文件拖入同样按当前全局「打开编码」解码
 * （与「打开文件」按钮共用同一 getter，drop 时求值）。
 */
const { left: leftDrop, right: rightDrop } = useDropLoad(() => fileEncoding.value)

/*
 * 编辑器语言（INT-001）：两侧编辑器共用「本次对比」的生效语言 ——
 * viewStore.effectiveLanguage 在 auto 时已含 detectLanguagePair 检测结果
 * （plaintext 兜底），手动指定语言时原样透传。传给两个 InputEditor 的
 * language prop（动态 compartment 重配，见 InputEditor 注释）。
 */
const editorLanguage = computed(() => viewStore.effectiveLanguage)

/*
 * ============================================================================
 * 对比触发机制（UI-004）：三条触发路径共用 diffStore.run() ——
 * 1.「查找差异」主按钮（action-bar 居中，显式触发的主交互）；
 * 2. ⌘/Ctrl+Enter 全局快捷键（window 捕获阶段监听，见 onGlobalKeydown）；
 * 3.「实时对比」开关开启后的 400ms 防抖 watch（见下方实时对比段）。
 * 结果展示不在本任务范围（视图归 UI-006/007）：底部仅放一行最小摘要条
 * （result-summary）让交互可感知，UI-010 升级为完整统计条。
 * ============================================================================
 */

/*
 * ============================================================================
 * 结果态开关与保留编辑状态机（UI-006 引入输入/结果双态，UI-011 升级为三态）：
 * appMode 是唯一状态源（App 本地 ref，刻意不进 store —— 纯 UI 态、无跨组件
 * 消费方；「result 缓存」由 diffStore.result 天然承载）。三个状态与全部转换：
 *
 *   input（双栏编辑器，现状）
 *     ├─ 主按钮 / ⌘+Enter（run 成功）─────→ result（现状语义）
 *     └─ 主按钮 / ⌘+Enter（失败/空态短路）→ input（留在原态，底部摘要条提示）
 *   result（结果视图，现状）
 *     ├─ 工具栏「返回编辑」───────────────→ edit-from-result(null)（不清 result、不聚焦侧）
 *     └─ 结果视图行内容格点击 editSide ───→ edit-from-result(side, lineNo?)
 *   edit-from-result（保留编辑：result 缓存不清空，顶部提示条 + 双栏编辑器）
 *     ├─ 提示条「重新对比」───────────────→ result（run；失败呈现结果态错误块）
 *     ├─ 提示条「返回结果」───────────────→ result（不重算直接切回）
 *     └─ 主按钮 / ⌘+Enter ───────────────→ 同「重新对比」（显式触发语义优先）
 *
 * 不切态的后台路径（UI-005 既有策略，verify 保持）：实时防抖与「选项变化
 * 自动重跑」两条路径直接 diffStore.run()、不碰 appMode —— 保留编辑态里
 * result 静默更新、仍停在编辑态（重新对比 / 返回结果时看到的都是最新结果）；
 * result 变化触发的 navStore.reset()（既有 watch）语义不受影响：重算重置
 * 导航、「返回结果」不重算则导航位置保留。
 *
 * 「失焦重算」的取舍（roadmap「失焦/手动触发重算」按「或」理解）：不做编辑
 * 器 blur 监听重算 —— blur 与「点击提示条按钮」「点击另一侧内容格」等动作
 * 的先后次序天然竞争（先 blur 后 click，失焦重算会与切态动作叠加），手动
 * 「重新对比」按钮为主路径，失焦场景由「实时对比」开关承担（编辑停顿 400ms
 * 自动重算，既有防抖 watch），收益不足以抵消竞态复杂度。
 * ============================================================================
 */
type WorkbenchMode = 'input' | 'result' | 'edit-from-result'

const appMode = ref<WorkbenchMode>('input')

/** 是否处于结果态：结果视图 / 错误块与工具栏「返回编辑」的显示条件 */
const inResultMode = computed(() => appMode.value === 'result')

/** 是否渲染结果视图：结果态 + 结果存在 + 成功通道（失败走错误块、空回编辑器） */
const showResultView = computed(() => {
  const result = diffStore.result
  return inResultMode.value && result !== null && isDiffOk(result)
})

/*
 * 结果态错误块（UI-011 兜底，完整错误态呈现归 UI-013）：保留编辑态发起的
 * 重新对比可能因文本增长触发 too-large 等失败 —— 若只按 ok 渲染，结果态会
 * 回落到编辑器，看起来「点了没反应」；错误块明确呈现原因，工具栏「返回编辑」
 * 在错误态下仍可达（回编辑态修正后重试）。
 */
const showResultError = computed(() => {
  const result = diffStore.result
  return inResultMode.value && result !== null && !isDiffOk(result)
})

/*
 * 无差异判定（UI-013「两侧相同」）：对比成功、且统计与 hunk 全零（无新增 /
 * 删除 / 修改对、无差异块）即「两侧规范化后等价」。totalRows > 0 保证确实
 * 存在可浏览的 equal 行（双栏编辑器全空的输入已被 run() 空态短路拦下，此处
 * 再兜一道防御）；hunks.length === 0 时 collapses 亦为空数组（ENG-008 只在
 * hunk 之间折叠），属正常形态 —— 视图照常渲染全部 equal 行，可浏览、可展开。
 */
const isIdenticalResult = computed(() => {
  const result = diffStore.result
  if (result === null || !isDiffOk(result)) return false
  const stats = result.stats
  return (
    stats.totalRows > 0 &&
    result.hunks.length === 0 &&
    stats.addedLines === 0 &&
    stats.removedLines === 0 &&
    stats.modifiedPairs === 0
  )
})

/*
 * 感知加载态（UI-013）：重算进行中且已有旧结果（结果视图 / 错误块 / 保留编辑
 * 态都算）→ 结果区顶部显示不确定进度条。compareFull 是同步计算、单次很快，
 * 进度条纯为感知优化（无真实进度）；首次对比（result 为 null）不显示 ——
 * 那时还在输入态，主按钮「对比中…」已承担进行中反馈。
 */
const showResultProgress = computed(() => diffStore.isRunning && diffStore.result !== null)

/*
 * 空输入反馈（UI-013）：diffStore.run() 对「两侧全空」做空态短路（clear() 后
 * 静默返回，见 stores/diff.ts）—— store 层刻意不持 UI 依赖（纯状态机），反馈
 * 在调用侧补：本包装在调用 run() 前按与 store 短路一致的条件（两侧文本均为空
 * 串）检测空态，命中即 ZToast info 引导输入，随后照常调 run() —— store 的
 * 短路分支会执行 clear()，「空输入不产生结果、清掉旧结果」的原有语义原样
 * 保留，本层只补提示、不改行为。
 *
 * 三条触发路径（显式主按钮/快捷键、实时防抖、选项自动重跑）统一走本包装：
 * - 显式路径点击「查找差异」却没输入 → toast 是主反馈（此前毫无回应）；
 * - 实时/选项两条后台路径把旧结果静默清掉时，toast 解释「结果为何消失」。
 * 刻意先检测后调用（而非 run() 后以 result === null 推断空态短路）：run()
 * 有重入守卫，isRunning 期间的并发调用会原样返回、不触碰 result —— 以
 * result 反推会把「首次对比进行中的并发触发」误判为空态（此时 result 尚为
 * null），先检测无此歧义（isRunning 时两侧必非空，空态检测天然不会误报）。
 */
function runDiffWithEmptyFeedback(): Promise<void> {
  if (workbenchStore.leftText === '' && workbenchStore.rightText === '') {
    toastInfo('请先输入要对比的文本')
  }
  return diffStore.run()
}

/**
 * 显式触发对比（主按钮 / ⌘+Enter / 编辑提示条「重新对比」共用）。run() 后
 * 按结果与当前态落位（完整转换表见上方状态机大注释）：
 * - 空态短路（两侧全空，result 为 null）→ 回输入态：空文本无结果可看，
 *   保留编辑态发起时同样成立（编辑器本来就挂着，仅收掉提示条）；反馈
 *   （ZToast info）由 runDiffWithEmptyFeedback 在调用侧补；
 * - 成功 → 结果态；
 * - 失败（ok:false）→ 输入态显式触发保持现状（留在输入态、底部摘要条提示 +
 *   错误 Toast，见 result watch，UI-006 语义）；已不在输入态（编辑态 / 结果态
 *   发起）→ 切到结果态由错误块呈现，避免编辑态点击「重新对比」后语义悬空。
 */
async function runAndShowResult(): Promise<void> {
  await runDiffWithEmptyFeedback()
  const result = diffStore.result
  if (result === null) {
    appMode.value = 'input'
    return
  }
  if (isDiffOk(result)) {
    appMode.value = 'result'
    return
  }
  if (appMode.value !== 'input') {
    appMode.value = 'result'
  }
}

/*
 * 保留编辑态的进入与退出（UI-011 核心转换）：
 * - enterEditFromResult：result 缓存不清空（「返回结果」不重算、底部统计与
 *   导航以旧结果为底）。side 非空时在 nextTick 后聚焦该侧编辑器 —— 结果态
 *   下编辑器整体卸载（模板 v-if 分支切换），须等重挂载完成才能拿到组件实例；
 *   携带 lineNo 时光标定位到该行行首并 scrollIntoView（定位精度取舍见
 *   InputEditor.focusLine 注释），空占位格 / 「返回编辑」入口无行号仅聚焦；
 * - handleEditSide：两个结果视图 editSide 事件的统一入口（并排 = 左右内容格
 *   各自侧别；统一 = del→左 / add→右 / equal→左，映射理由见各组件文件头）；
 * - backToResultFromEdit：不重算直接回结果态。防御：保留编辑期间实时防抖
 *   可能把两侧清空触发空态短路（result 置 null），此时无结果可回、落回输入态。
 */
/** 编辑提示条目标侧：进入保留编辑态时记录（null = 经「返回编辑」进入，未指定侧） */
const editFocusSide = ref<'left' | 'right' | null>(null)

/** 是否处于保留编辑态（编辑提示条的显示条件） */
const editingFromResult = computed(() => appMode.value === 'edit-from-result')

/**
 * 进入保留编辑态：记录目标侧（供提示条文案）后切态；side 非空时经 nextTick
 * 聚焦 / 定位该侧编辑器（取舍见上方保留编辑段注释）。
 */
function enterEditFromResult(side: 'left' | 'right' | null, lineNo?: number): void {
  editFocusSide.value = side
  appMode.value = 'edit-from-result'
  if (side === null) return
  void nextTick(() => {
    const editor = side === 'left' ? leftEditorRef.value : rightEditorRef.value
    if (editor === null) return
    if (lineNo === undefined) {
      editor.focus()
    } else {
      editor.focusLine(lineNo)
    }
  })
}

/** 结果视图行内容格点击（SplitDiffView / UnifiedDiffView 的 editSide 事件） */
function handleEditSide(side: 'left' | 'right', lineNo?: number): void {
  enterEditFromResult(side, lineNo)
}

/*
 * 合并更改（UI-012）：两个结果视图的合并控制条 emit applyHunk（hunk 下标 +
 * 方向）的统一入口。语义 = 把 result.hunks[hunkIndex] 按方向应用到另一侧：
 * core/merge.ts 的 applyHunk 以「当前编辑器文本（workbench）+ 当前结果
 * （result.rows / hunk）」为输入返回新的双侧文本 → setLeftText /
 * setRightText 写回编辑器数据源 → diffStore.run() 重算刷新。
 *
 * - 后台刷新路径：不碰 appMode —— 结果态保持（重算后新结果原位刷新）、
 *   保留编辑态照常重算（与实时防抖 / 选项重跑同策略，见状态机大注释）；
 *   应用后目标 hunk 消失属预期（重算刷新，navStore 由 result watch 重置）；
 * - isRunning 守卫：run() 有重入守卫，但「applyHunk 写文本发生在 run() 之前」
 *   —— 若对比进行中放行，文本会被写入而本次 run() 被重入守卫吞掉，出现
 *   「文本已改、结果未刷新」的中间态；对比中直接忽略本次点击（按钮无禁用
 *   态，点击是细粒度轻操作，忽略比禁用更顺滑）；
 * - 输入与 rows 不同步（用户在保留编辑态改文本未重跑）时 applyHunk 内部
 *   仍按区间执行（调用方契约见 merge.ts 文件头），此处无需预校验。
 */
async function handleApplyHunk(hunkIndex: number, direction: MergeDirection): Promise<void> {
  if (diffStore.isRunning) return
  const result = diffStore.result
  if (result === null || !isDiffOk(result)) return
  const hunk = result.hunks[hunkIndex]
  if (hunk === undefined) return
  const next = applyHunk(
    { left: workbenchStore.leftText, right: workbenchStore.rightText },
    result.rows,
    hunk,
    direction,
  )
  workbenchStore.setLeftText(next.left)
  workbenchStore.setRightText(next.right)
  await diffStore.run()
}

/** 提示条「返回结果」：不重算直接切回结果态（result 为 null 的防御见上方注释） */
function backToResultFromEdit(): void {
  appMode.value = diffStore.result === null ? 'input' : 'result'
}

/** 工具栏「返回编辑」：进入保留编辑态但不聚焦特定侧（editFromResult(null)） */
function backToEditing(): void {
  enterEditFromResult(null)
}

/** 提示条文案：按进入编辑态时点按的侧别指向（「返回编辑」入口未指定侧则泛指） */
const editNoticeText = computed(() => {
  if (editFocusSide.value === 'left') return '正在编辑「原始文本」'
  if (editFocusSide.value === 'right') return '正在编辑「更改后文本」'
  return '正在编辑输入文本'
})

/** 结果态错误块的原因文案（与底部摘要条共用 summarizeError；函数声明提升，前向引用安全） */
const resultErrorText = computed(() => {
  const result = diffStore.result
  if (result === null || isDiffOk(result)) return ''
  return summarizeError(result.error)
})

/** 「查找差异」主按钮回调（显式触发路径之一，成功后进入结果态） */
function handleFindDiff(): void {
  void runAndShowResult()
}

/*
 * 按钮运行态的取舍：isRunning 时同时「禁用 + 文案换为『对比中…』」。
 * 禁用是防指针重入的硬保证，文案是进行中感知的补充；两者叠加零成本，
 * 且 store.run() 内部还有 isRunning 重入守卫兜底键盘 / 防抖路径。
 */
const findDiffLabel = computed(() => (diffStore.isRunning ? '对比中…' : '查找差异'))

/*
 * ⌘/Ctrl+Enter 全局快捷键（UI-004）：挂在 window 的【捕获阶段】——
 * CodeMirror 6 的 keymap 在编辑器 DOM 上以冒泡处理按键，捕获阶段先于其
 * 触发，保证焦点在编辑器内也能命中；CM 默认 keymap 不含 Mod-Enter，
 * 本监听也不会与其冲突（若未来 CM 侧绑定同键，捕获先行仍保证触发）。
 * 与宿主快捷键的冲突面刻意收窄：只认 (meta|ctrl)+Enter 这一个组合，
 * 不吃单键、不认 Shift/Alt 变体，ZTools 宿主亦无该组合的默认占用。
 * 命中后 preventDefault + stopPropagation：本组合语义完全归「对比」所有。
 *
 * F3 / Shift+F3 全局快捷键（UI-010，同一捕获监听内分支）：hunk 导航的
 * 键盘路径，语义走 navStore（与统计条按钮同一出口，见 stores/nav.ts）。
 * 必须 preventDefault：浏览器给 F3 绑定的默认行为是「查找下一个」
 * （Chrome / Edge / Firefox 一致），Shift+F3 在部分浏览器（如 Firefox）
 * 还承担「反方向查找」，不拦截会弹出 / 扰动页面查找框；stopPropagation
 * 与 ⌘/Ctrl+Enter 同理，语义完全归「差异导航」所有。无结果 / 无 hunk 时
 * goNext / goPrev 内部 no-op，无需在此判态。
 *
 * ⌘/Ctrl+Shift+V 全局快捷键（INT-006，同一捕获监听内分支）：「粘贴并
 * 对比」快捷路径（语义走 handlePasteAndCompare，与工具栏按钮同一出口）。
 * 冲突面评估：
 * - 编辑器内：CodeMirror 默认 keymap 不含 Mod-Shift-V（本插件仅挂
 *   historyKeymap，见 InputEditor.vue）；Chromium 把该组合绑定为「粘贴为
 *   纯文本」，但 CodeMirror 的粘贴本就只取纯文本（富文本进编辑器即被
 *   剥离），编辑器内该原生行为与 Ctrl+V 等价 —— 接管后无功能损失；
 * - 宿主：ZTools 宿主侧是否有该组合占用无法在本任务内验证（不打开宿主），
 *   与 REL-001「快捷键冲突验证」衔接走查；风险面与 ⌘/Ctrl+Enter 同型
 *   （修饰组合键 + 单键，不吃单键）；
 * - 命中即 preventDefault + stopPropagation：语义完全归「粘贴并对比」
 *   所有（不触发原生粘贴为纯文本）。e.key 同时接受 'v'/'V'（Shift 按下
 *   时 Chromium 上报 'V'，CapsLock 组合下为 'v'）。
 *
 * Escape 说明（Scandi 重构后）：确认弹窗 / 设置弹窗 / 历史抽屉的 Esc 关闭
 * 均由 reka-ui 的 AlertDialog / Dialog 内建（DismissableLayer 层级栈保证
 * 叠加场景只关最上层，「历史抽屉上的清空确认」等组合不再需要本监听代管），
 * 原先补齐 ZConfirmDialog 能力缺口的手工 Esc 分支随之移除。
 */
function onGlobalKeydown(e: KeyboardEvent): void {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    e.stopPropagation()
    // 显式触发路径：成功后进入结果态（与主按钮同语义，见 runAndShowResult）。
    void runAndShowResult()
    return
  }
  if (e.key === 'F3') {
    e.preventDefault()
    e.stopPropagation()
    // Shift 修饰 = 反方向（对齐主流编辑器「Shift+F3 上一处」惯例）。
    if (e.shiftKey) navStore.goPrev()
    else navStore.goNext()
    return
  }
  // ⌘/Ctrl+Shift+V：「粘贴并对比」快捷路径（INT-006；冲突面评估见上方
  // 快捷键段注释）。isRunning / 空剪贴板等状态守卫在 handlePasteAndCompare
  // 内部（与工具栏按钮完全同一路径）。
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'v' || e.key === 'V')) {
    e.preventDefault()
    e.stopPropagation()
    void handlePasteAndCompare()
  }
}

onMounted(() => {
  // 第三参 true = capture：见上方快捷键段的捕获阶段说明。
  window.addEventListener('keydown', onGlobalKeydown, true)
  /*
   * UI-005：「实时对比默认值」注入（一次性）。viewStore.realtimeDefault
   * 是设置弹窗里的偏好默认值，App 启动（本 onMounted）时写入本次会话的
   * diffStore.realtime —— 之后两者各自独立：会话内拨动工具栏开关不改写
   * 默认值（默认值只表达「下次启动从什么状态开始」）。刻意不补跑对比：
   * 与「开启时刻不立即对比，等下一次编辑进入防抖节奏」的既有策略一致。
   */
  diffStore.realtime = viewStore.realtimeDefault
  /*
   * UI-015：窄窗观察接线。ResizeObserver 回调首次 observe 时即同步触发一次，
   * 初始宽度状态无需手动补算；写入前比较（同值不写）避免 reactive 无谓触发。
   * 容器宽度恒等于结果视图可用宽度（.workbench 不再设最小宽度，见样式区
   * FND-005/UI-015 段注释）。ResizeObserver 在本插件运行环境恒存在（Electron
   * Chromium / 现代 dev 浏览器），缺失时静默跳过 —— 降级只是不生效，不报错。
   */
  if (typeof ResizeObserver !== 'undefined' && workbenchEl.value !== null) {
    narrowObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? workbenchEl.value?.clientWidth ?? 0
      const narrow = width > 0 && width < NARROW_WINDOW_THRESHOLD_PX
      if (viewStore.narrowWindow !== narrow) viewStore.narrowWindow = narrow
    })
    narrowObserver.observe(workbenchEl.value)
  }
})

onBeforeUnmount(() => {
  // 移除捕获监听（须与注册时的 capture 标志一致）；同时清掉实时对比的
  // pending 防抖定时器，防止卸载后的幽灵回调。
  window.removeEventListener('keydown', onGlobalKeydown, true)
  clearRealtimeTimer()
  // 断开窄窗观察器（UI-015）
  narrowObserver?.disconnect()
  narrowObserver = null
})

/*
 * 实时对比（UI-004）：开关状态存 diffStore.realtime（默认 false，理由见
 * stores/diff.ts 字段注释）。开启时 watch 两侧文本（字符串按值变化即触发，
 * 不需要 deep），每次变化重置 400ms 防抖定时器，静默期后调 run() ——
 * 防抖把「连续输入」折叠为一次对比，400ms 在跟手与省算力之间取平衡。
 * 输入在 lastOptions / contextLines 之外无其他参数，run() 自带空态短路
 * 与重入守卫，防抖回调无需额外判断。
 */
const REALTIME_DEBOUNCE_MS = 400

/** 实时对比的 pending 防抖定时器（null = 无 pending；卸载 / 关闭开关时清掉） */
let realtimeTimer: ReturnType<typeof setTimeout> | null = null

function clearRealtimeTimer(): void {
  if (realtimeTimer !== null) {
    clearTimeout(realtimeTimer)
    realtimeTimer = null
  }
}

watch(
  () => [workbenchStore.leftText, workbenchStore.rightText],
  () => {
    // 开关关闭时不计时（watch 常驻，实时性由本开关判断承载）。
    if (!diffStore.realtime) return
    clearRealtimeTimer()
    realtimeTimer = setTimeout(() => {
      realtimeTimer = null
      // 后台刷新路径：直接 run()，不碰 appMode（保留编辑态里 result 静默
      // 更新、仍停在编辑态；态切换语义见状态机大注释）。空输入反馈由
      // runDiffWithEmptyFeedback 统一补充（UI-013）。
      void runDiffWithEmptyFeedback()
    }, REALTIME_DEBOUNCE_MS)
  },
)

// 关闭「实时对比」时清掉 pending 定时器：关闭即停止自动触发，不补跑
// （开启时刻有未消化的编辑也不立即对比，等下一次编辑再进入防抖节奏）。
watch(
  () => diffStore.realtime,
  (on) => {
    if (!on) clearRealtimeTimer()
  },
)

/*
 * ============================================================================
 * 工具栏控件（UI-005）：视图/精度/语言三个选择器写入 viewStore 的处理器。
 * 用显式处理器而非 v-model：ztools-ui 的 ZSelect / ZTabs 更新事件载荷是宽类型
 * （SelectModelValue = string | number | null | 数组），而 store 字段是窄字面量
 * 联合 —— 在处理器里做字面量校验收窄，拒绝越界值（不落数据库式 cast）。
 * ============================================================================
 */

/** 视图分段控件候选（并排 / 统一）：value 语义见 setViewMode */
const VIEW_MODE_OPTIONS: { label: string; value: string }[] = [
  { label: '并排', value: 'split' },
  { label: '统一', value: 'unified' },
]

/**
 * 视图分段控件回调：非 'unified' 一律归一为 'split'（两值控件，天然兜底）。
 * UI-015 窄窗语义：窄窗内用户主动点「并排」= 坚持使用并排（keepSplitInNarrow，
 * 本episode内不再自动降级并显示建议提示）；点「统一」或窗口已宽 = 清除坚持
 * 标志（恢复 autoUnified 的正常判定）。
 */
function setViewMode(value: string): void {
  const mode: 'split' | 'unified' = value === 'unified' ? 'unified' : 'split'
  viewStore.viewMode = mode
  viewStore.keepSplitInNarrow = mode === 'split' && viewStore.narrowWindow
}

/** 精度下拉回调：仅接受 DiffPrecision 四个字面量，其余载荷忽略 */
function setPrecision(value: string): void {
  if (value === 'smart' || value === 'line' || value === 'word' || value === 'char') {
    viewStore.precision = value as DiffPrecision
  }
}

/** 语言下拉回调：字符串载荷直接透传（高亮消费归 INT-001） */
function setLanguage(value: string): void {
  viewStore.language = value
}

/** 设置弹窗显隐：工具栏齿轮按钮触发（弹窗本体见 components/SettingsDialog.vue） */
const settingsOpen = ref(false)

/*
 * ============================================================================
 * 小窗口降级布局（UI-015，roadmap §3.1「小窗口下并排视图自动降级为上下排列
 * 或提示用统一视图」的实现口径）：
 * - 观察：ResizeObserver 观察 .workbench 容器宽度（ZTools 主面板宽度由宿主
 *   管理、可能很窄；容器宽度即结果视图的真实可用宽度），低于
 *   NARROW_WINDOW_THRESHOLD_PX（620px）时写 viewStore.narrowWindow = true；
 * - 降级：narrowWindow 且用户未坚持并排时 viewStore.autoUnified = true，
 *   effectiveViewMode 接管为 'unified'（并排视图在小窗下左右两列内容格各
 *   只剩百余 px，不可用；统一视图单栏仍可读）。viewMode 本身【不被改写】
 *   —— 窗口变宽后自动回到用户原选视图，用户选择与自动降级可区分；
 * - 用户坚持：窄窗内用户在分段控件主动点回「并排」→ viewStore.keepSplitInNarrow
 *   = true（本episode内不再自动降级、选择生效），结果视图顶部显示可关闭的
 *   「窗口较窄，建议使用统一视图」轻提示条（.narrow-notice，一次性 —— 关闭
 *   后本episode不再出现，窗口变宽再变窄会重置）；自动降级同样有轻提示
 *   （「已自动切换为统一视图」）告知视图变化原因；
 * - 方案取舍：自动降级 + 可关闭提示 + 尊重用户坚持（而非强制降级）—— 强制
 *   降级会让「我就要在窄窗看并排」的用户失去选择权；提示条承担告知义务。
 * ============================================================================
 */

/** 窄窗降级阈值（px）：结果工作台容器宽度低于该值时并排自动降级为统一 */
const NARROW_WINDOW_THRESHOLD_PX = 620

/** 工作台容器模板 ref：窄窗观察目标（宽度 = 结果视图的真实可用宽度） */
const workbenchEl = ref<HTMLElement | null>(null)

/** 窄窗观察器（onMounted 建立、onBeforeUnmount 断开；环境缺失时静默跳过） */
let narrowObserver: ResizeObserver | null = null

/** 窄窗提示条关闭态：关闭后本episode不再出现（窗口退出窄窗时重置） */
const narrowNoticeDismissed = ref(false)

/*
 * ============================================================================
 * 左侧可折叠侧边栏（UI-016：顶部工具栏改为左侧侧边栏，样式对齐参考稿
 * 「浅色面板 + 分组列表 + 顶部折叠按钮」）：折叠态为纯会话级 UI 态
 * （不进 store、不持久化 —— 与「窄窗坚持」等偏好语义有本质区别，侧边栏
 * 收合是浏览时的临时姿势，重开插件回到展开态最可预期）。两个出口：
 * - 展开态：侧边栏头部的 `‹` 折叠按钮收起（留下窄轨 `.sidebar-rail`
 *   上的 `›` 按钮可重新展开，窄轨不占位不挡编辑区）；
 * - 窄窗自动收起：进入窄窗（narrowWindow 变 true，窗口确实被宿主压
 *   窄）时主动收起侧边栏，把水平空间让给编辑器 / 结果视图 —— 窄窗下
 *   固定 244px 的侧边栏会让双栏编辑器每侧只剩百余 px，不可用；仅「进入
 *   窄窗」时自动收起一次，不自动展开（宽窗回来时保持用户当前姿势 ——
 *   用户主动收起在宽窗里也该被尊重），窄窗内用户仍可手动重新展开。

 */

const sidebarCollapsed = ref(false)

/** 折叠 / 展开侧边栏：头部 `‹` 按钮与窄轨 `›` 按钮的共用出口 */
function toggleSidebar(): void {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

/*
 * 侧边栏窄窗自动收起（UI-016）：只在「进入窄窗」的沿边触发——
 * narrowWindow 变 true 时收起；（退出窄窗不展开，理由见上方大注释；用户
 * 在窄窗内手动重新展开后，若窗口在窄阈附近抖动、再次进入窄窗，会
 * 再度自动收起 —— 与「进入窄窗」的既定语义一致，可接受阈值内代价）。
 */
watch(
  () => viewStore.narrowWindow,
  (narrow) => {
    if (narrow) sidebarCollapsed.value = true
  },
)

/**
 * 结果视图行号列宽（UI-015「宽随位数自适应」）：按结果总行数位数映射
 * （≤3 位 40px / 4–5 位 52px / ≥6 位 64px，映射见 view.ts 的
 * diffGutterWidthPx），以 `--gutter-w` 注入 .result-stage —— 两个结果视图的
 * 行号列 grid 模板与记号列 sticky 偏移经各自的局部变量引用同一来源，
 * 保证两视图行号列宽恒一致。无结果 / 错误结果时按 0 行取最小档。
 */
const gutterWidthPx = computed(() => {
  const result = diffStore.result
  const totalRows = result !== null && isDiffOk(result) ? result.stats.totalRows : 0
  return diffGutterWidthPx(totalRows)
})

/** 窄窗提示条文案：用户坚持并排 → 建议语；自动降级 → 说明语 */
const narrowNoticeText = computed(() =>
  viewStore.keepSplitInNarrow ? '窗口较窄，建议使用统一视图' : '窗口较窄，已自动切换为统一视图',
)

/**
 * 窄窗提示条显示条件（结果态 + 窄窗 + 未关闭）：
 * - 自动降级生效（autoUnified 且用户原选是 split）→ 说明语；
 * - 用户窄窗内坚持并排（keepSplitInNarrow）→ 建议语；
 * - 窄窗但用户本就选了统一 → 不提示（没有视图被改变）。
 */
const narrowNoticeVisible = computed(() => {
  if (!showResultView.value || !viewStore.narrowWindow || narrowNoticeDismissed.value) {
    return false
  }
  return viewStore.keepSplitInNarrow || (viewStore.autoUnified && viewStore.viewMode === 'split')
})

/**
 * 错误块的「打开设置」（UI-013，invalid-regex 专属动作）：设置弹窗开合态
 * （settingsOpen）就在本组件，直接置 true 即可 —— 无需给 SettingsDialog
 * 暴露 open 方法或提升开合态（最小改动）。用户修正规则后，App 的选项
 * watch 会自动重跑，非法规则补完合法的那一刻结果自然恢复。
 */
function openErrorSettings(): void {
  settingsOpen.value = true
}

/*
 * ============================================================================
 * 操作便捷项（UI-014）：示例数据 / 交换两侧 / 清空 / 复制原始（更改后）文本。
 *
 * 位置选择（任务给定「action-bar 左区或工具栏」二选一，取工具栏）：五个控件
 * 合计约 350px，action-bar 左列在结果态还要容纳统计条（1fr 列宽在窄窗下会
 * 互相挤压、统计条被裁切）；工具栏的 flex-wrap 小窗降级（分组按序换行）是
 * 既有且更安全的溢出策略，且工具栏在三种工作台状态（输入 / 结果 / 保留编辑）
 * 下恒在 —— 便捷项在结果态下同样可达（交换 → 结果原地重算刷新、清空 → 回
 * 输入态、复制照常可用），不因切态失去入口。
 *
 * 三个会写文本的动作（示例 / 交换 / 清空）共用同一状态交互底线：
 * - isRunning 期间忽略点击（与 handleApplyHunk 同策略）：这些动作先写文本
 *   后（可能）触发 run()，对比进行中放行会撞上 run() 的重入守卫，出现
 *   「文本已改、结果未刷新」的中间态；点击是细粒度轻操作，忽略比禁用更
 *   顺滑，窗口极小（同步计算 + 一轮 nextTick）；
 * - 破坏性动作（清空 / 覆盖载入）弹 ZConfirmDialog 走既有内联挂载组件；
 *   非破坏性动作（交换 / 复制）不弹确认。
 * ============================================================================
 */

/** 示例数据下拉的当前值：动作菜单语义 —— 选中即回弹为 null，触发器恒显占位文案 */
const sampleValue = ref<string | null>(null)

/** 示例数据下拉候选：value 到 SAMPLES 条目的映射见 handleSampleSelect */
const SAMPLE_SELECT_OPTIONS: { label: string; value: string }[] = [
  { label: '中文示例', value: 'zh' },
  { label: '代码示例', value: 'code' },
]

/**
 * 示例数据下拉回调：本下拉是「动作菜单」而非状态选择器 —— 无论是否真正
 * 载入，先把手头 model-value 回弹为 null，让触发器立刻恢复「示例数据」
 * 占位文案（控件只表达「发起一次载入」，不持久化选择状态）。value 按
 * SAMPLE_SELECT_OPTIONS 映射到 SAMPLES 条目后交给 loadSampleIntoInputs
 * 执行（防御：未知值直接忽略，不载入）。
 */
function handleSampleSelect(value: string): void {
  sampleValue.value = null
  const sample = value === 'zh' ? SAMPLES[0] : value === 'code' ? SAMPLES[1] : undefined
  if (sample === undefined) return
  void loadSampleIntoInputs(sample)
}

/**
 * 载入一组示例到两侧输入（示例数据下拉的唯一执行路径）。
 *
 * @param sample 目标示例条目（left → 原始文本、right → 更改后文本）
 *
 * 状态交互决策：
 * - isRunning 期间忽略点击（理由见 UI-014 大注释块）；
 * - 覆盖确认：任一侧非空即弹 ZConfirmDialog（沿用 useFileLoad 的确认流程
 *   惯例：await confirm() 由 App 挂载的 ZConfirmDialog 兑现），用户取消 →
 *   保留原输入静默结束；两侧全空 → 直接载入不打扰；
 * - 载入后【不自动对比】：保持「显式触发」语义 —— 尚无结果时等主按钮 /
 *   ⌘+Enter；实时对比开启时由既有 400ms 防抖 watch 自然触发重算；
 * - 载入同时清掉旧结果并落回输入态（取舍）：被覆盖的原输入已不存在，旧
 *   结果不可再由输入复现，结果态 / 保留编辑态若继续展示会成为「对应不上
 *   任何一侧文本」的悬空结果；回输入态让载入的示例直接可见（结果态下载入
 *   若原地不动，用户看不到示例已被载入）。
 */
async function loadSampleIntoInputs(sample: SamplePair): Promise<void> {
  if (diffStore.isRunning) return
  if (workbenchStore.leftText !== '' || workbenchStore.rightText !== '') {
    const confirmed = await confirm({
      title: '载入示例',
      message: '载入示例将覆盖当前输入？',
      type: 'warning',
      confirmText: '覆盖载入',
      cancelText: '取消',
    })
    if (!confirmed) return
  }
  workbenchStore.setLeftText(sample.left)
  workbenchStore.setRightText(sample.right)
  // INT-001：示例内容无文件来源，清空两侧文件名（语言检测回到内容启发式）
  workbenchStore.setLeftFileName('')
  workbenchStore.setRightFileName('')
  diffStore.clear()
  appMode.value = 'input'
}

/**
 * 交换两侧文本（UI-014）：左 → 右、右 → 左。
 *
 * 状态交互决策：
 * - 不弹确认：交换完全可逆（再点一次即还原），确认框只会添堵；
 * - isRunning 期间忽略点击（理由见 UI-014 大注释块）；
 * - 先 set 再 run 的顺序不能反：diffStore.run() 从 workbench 现值读取对比
 *   输入（见 stores/diff.ts），先 run 会拿到交换前的旧文本；
 * - 已有结果（result !== null）→ 立即 run() 自动重算刷新，与「选项变化
 *   自动重跑」同一「有结果即重跑」策略：结果态 / 保留编辑态原地刷新、
 *   不碰 appMode（后台刷新路径，语义见状态机大注释）；尚无结果则只换文本
 *   不触发计算 —— 避免用户还在编排输入时被意外拉进一次（可能大文本的）
 *   对比，实时对比开启时由防抖 watch 自然承接。
 */
async function handleSwapSides(): Promise<void> {
  if (diffStore.isRunning) return
  // INT-001：交换经 workbenchStore.swapSides()，文本与来源文件名一起互换
  // （语言检测的扩展名线索跟着内容走）
  workbenchStore.swapSides()
  if (diffStore.result !== null) {
    await diffStore.run()
  }
}

/**
 * 清空两侧输入（UI-014）。
 *
 * 状态交互决策：
 * - isRunning 期间忽略点击（理由见 UI-014 大注释块）；
 * - 确认框的防误弹（任务指定）：任一侧非空才弹 ZConfirmDialog「清空两侧
 *   输入？」，两侧已空时直接执行不弹 —— 空态下清空是无副作用的幂等操作，
 *   弹窗纯属骚扰；
 * - 执行 = 两侧文本置空 + diffStore.clear() + 落回输入态：store 的 clear()
 *   只清结果不动输入（见 stores/diff.ts），文本置空在 App 层完成；结果一并
 *   清空（空输入不该有结果可看），且 result 变 null 后结果态 / 保留编辑态
 *   失去展示物，显式落回输入态避免 appMode 与 result 脱节 —— 与显式对比的
 *   空态短路路径（runAndShowResult 对 result === null 回输入态）语义一致。
 */
async function handleClearInputs(): Promise<void> {
  if (diffStore.isRunning) return
  if (workbenchStore.leftText !== '' || workbenchStore.rightText !== '') {
    const confirmed = await confirm({
      title: '清空输入',
      message: '清空两侧输入？',
      type: 'warning',
      confirmText: '清空',
      cancelText: '取消',
    })
    if (!confirmed) return
  }
  // INT-001：清空经 workbenchStore.clearSides()，文本置空 + 来源文件名清空
  workbenchStore.clearSides()
  diffStore.clear()
  appMode.value = 'input'
}

/**
 * 复制文本并给出统一反馈（INT-003 抽取）：复制成功 → toast success（文案由
 * 调用方给定），两条剪贴板路径都失败 → toast error（含原始 message），沿用
 * useFileLoad 的错误文案惯例。UI-014 的「复制原始 / 复制更改后」与 INT-003
 * 的三个「复制报告」动作共用本出口，成功 / 失败反馈格式保持一致；剪贴板
 * 写入本体在 useCopy（宿主 copyText 优先 + navigator.clipboard 降级）。
 *
 * @param text 待复制文本
 * @param successMessage 成功 toast 文案（如 '已复制' / '已复制 Markdown 报告'）
 */
async function copyWithToast(text: string, successMessage: string): Promise<void> {
  try {
    await copyText(text)
    toastSuccess(successMessage)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    toastError(`复制失败：${message}`)
  }
}

/**
 * 复制一侧文本（UI-014）：「复制原始 / 复制更改后」两个小按钮共用。
 *
 * @param side 目标侧：'left' 复制原始文本、'right' 复制更改后文本
 *
 * 状态交互决策：纯读操作，不触碰对比状态机与 appMode，三种工作台状态下
 * 均可执行，也无 isRunning 顾虑（不写文本、不触发对比）。空侧不发起复制
 * （复制空串无意义且「已复制」反馈会误导），ZToast info 引导；成功 / 失败
 * 反馈统一走 copyWithToast（INT-003 抽取，与复制报告动作同款文案惯例）。
 */
async function handleCopySide(side: 'left' | 'right'): Promise<void> {
  const label = side === 'left' ? '原始文本' : '更改后文本'
  const text = side === 'left' ? workbenchStore.leftText : workbenchStore.rightText
  if (text === '') {
    toastInfo(`「${label}」为空，没有可复制的内容`)
    return
  }
  await copyWithToast(text, '已复制')
}

/*
 * ============================================================================
 * 导出（INT-002）：「导出」动作下拉（PDF / HTML）—— 复用「示例数据」的
 * ZSelect 动作菜单模式（UI-014：无独立 dropdown-menu 组件，动作下拉选中即
 * 回弹占位态，控件只表达「发起一次导出」而非持久选择）。
 *
 * 入口位置：工具栏便捷项组（.toolbar-quick）行尾 —— 与 roadmap §3.1 布局稿
 * 「… ⚙ 导出」一致；三种工作台状态（输入 / 结果 / 保留编辑）下工具栏恒在，
 * 导出入口不因切态消失（可用性由 exportDisabled 把守）。
 *
 * 两条导出路径（roadmap §2.2 #20「无网络依赖」的落地）：
 * - 导出 PDF：window.print() —— ZTools 是 Electron，Chromium 打印对话框的
 *   目的地自带「另存为 PDF」，配合 main.css 的 @media print 样式（隐藏工具
 *   栏等非结果元素、保留 --diff-* 配色、分页友好）即得无网 PDF；
 * - 导出 HTML：buildExportHtml（core/exporters.ts，纯函数、单测覆盖）组装
 *   单文件内联样式文档后落盘 —— 宿主环境走 services.pickSaveFile +
 *   services.writeTextFile（preload 第 5 个桥接方法，参数校验 + 冻结导出），
 *   浏览器 dev / preview 无 window.services 时降级为 Blob 下载兜底。
 * ============================================================================
 */

/** 导出动作下拉的当前值：动作菜单语义 —— 选中即回弹为 null（同示例数据下拉） */
const exportValue = ref<string | null>(null)

/** 导出动作下拉候选：value 到导出动作的映射见 handleExportSelect */
const EXPORT_SELECT_OPTIONS: { label: string; value: string }[] = [
  { label: '导出 PDF', value: 'pdf' },
  { label: '导出 HTML', value: 'html' },
]

/**
 * 导出入口可用性（任务 D）：无结果（result === null）或结果为 ok:false
 * （对比失败，错误结果没有可导出的内容）时禁用。成功结果（含「两侧相同」
 * 的全 equal 结果）恒可导出 —— 存档本身是有意义的。
 * INT-003：「复制报告」下拉共用本闸门（变量名沿用 INT-002，语义为「没有
 * 可分享的成功结果」）。
 */
const exportDisabled = computed(() => {
  const result = diffStore.result
  return result === null || !isDiffOk(result)
})

/**
 * 取当前成功结果（导出与复制报告共用的兜底闸门）：无结果 / ok:false 时返回
 * null。入口禁用（exportDisabled）把守主要路径，此处兜底防御（禁用前一瞬
 * 间打开的浮层等边界），各动作处理器无需重复判断。
 */
function requireOkResult(): DiffResultOk | null {
  const result = diffStore.result
  return result !== null && isDiffOk(result) ? result : null
}

/**
 * 导出动作下拉回调：先把手头 model-value 回弹为 null（触发器立刻恢复
 * 「导出」占位文案，语义见示例数据下拉 handleSampleSelect），再按 value
 * 分发到对应导出动作；未知值直接忽略（防御）。
 */
function handleExportSelect(value: string): void {
  exportValue.value = null
  if (value === 'pdf') {
    void handleExportPdf()
  } else if (value === 'html') {
    void handleExportHtml()
  }
}

/** 两位数补零（导出时间文案 / 导出文件名时间戳共用） */
function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** 导出时间文案（本地时区 YYYY-MM-DD HH:mm:ss）：渲染进导出文档头部与标题 */
function formatExportedAt(date: Date): string {
  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
    ` ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
  )
}

/** 导出文件名时间戳（本地时区 YYYYMMDD-HHmmss）：见 buildExportFileName */
function formatExportFileStamp(date: Date): string {
  return (
    `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}` +
    `-${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`
  )
}

/**
 * 导出默认文件名建议：diff-YYYYMMDD-HHmmss.html。
 * 说明：宿主 services.pickSaveFile() 是 v1 最小签名（无 defaultPath 参数），
 * 系统保存对话框无法预填文件名，由用户自行命名 —— 该建议名只在浏览器 dev
 * 的 Blob 下载兜底路径（a.download）生效。
 */
function buildExportFileName(date: Date): string {
  return `diff-${formatExportFileStamp(date)}.html`
}

/**
 * 导出 PDF（window.print() 路径，roadmap §4）：ZTools 是 Electron 渲染层，
 * print 对话框含「另存为 PDF」目的地，无网完成导出；打印内容由 main.css 的
 * @media print 块裁剪（去工具栏 / 编辑器区等非结果元素、保留 --diff-* 配
 * 色、.diff-row 分页不跨行断开）。
 *
 * - 打印前切到结果视图：输入态 / 保留编辑态发起时先置 appMode = 'result'
 *   （打印对象是差异结果而非编辑器），await nextTick 等结果视图 DOM 上屏
 *   再唤起打印，避免打印到切态前的旧文档；
 * - 无结果 / ok:false 时直接忽略（入口已随 exportDisabled 禁用，此处兜底；
 *   与任务「打印前建议切到结果视图（若在输入态点导出 → 无 result 时按钮
 *   禁用/提示）」的禁用分支对应）；
 * - 已知边界（记录）：结果视图的虚拟滚动（UI-009）只把可视窗口行留在 DOM，
 *   print 输出为当前已渲染行 —— 大 diff 的完整存档请用「导出 HTML」。
 */
async function handleExportPdf(): Promise<void> {
  if (exportDisabled.value) return
  if (appMode.value !== 'result') {
    appMode.value = 'result'
    await nextTick()
  }
  window.print()
}

/**
 * 组装当前结果的导出 HTML（INT-002 落盘导出与 INT-003 复制 HTML 报告共用
 * 同一构建出口，保证两种 HTML 分享形态内容一致）：rows / stats 取自当前
 * 成功结果，meta 记录导出时间 / 当前生效视图模式 / 生效语言。
 */
function buildResultExportHtml(result: DiffResultOk): string {
  return buildExportHtml({
    left: workbenchStore.leftText,
    right: workbenchStore.rightText,
    rows: result.rows,
    stats: result.stats,
    meta: {
      exportedAt: formatExportedAt(new Date()),
      // effectiveViewMode（UI-015）：窄窗自动降级时按「实际看到的视图」导出；
      // effectiveLanguage（INT-001）：auto 已解析为检测结果，导出文档如实记录。
      viewMode: viewStore.effectiveViewMode,
      language: viewStore.effectiveLanguage,
    },
  })
}

/**
 * 导出 HTML（单文件落盘路径）：buildResultExportHtml（复用 buildExportHtml，
 * INT-003 起与「复制 HTML 报告」共用同一构建出口）组装单文件内联样式文档
 * 后按环境分流 ——
 * - ZTools 宿主（window.services 可用）：pickSaveFile() 弹系统保存对话框，
 *   用户取消（返回 null）静默结束；确认后 writeTextFile(path, html) 以
 *   UTF-8 同步写入（失败抛中文错误）→ toast success「已导出」，任何失败
 *   toast error（含原始 message），沿用 useFileLoad 的错误文案惯例；
 * - 浏览器 dev / preview（无 window.services，typeof 探测不抛错）：Blob
 *   下载兜底（downloadHtmlViaBlob）—— dev 环境导出能力保持可用。
 */
async function handleExportHtml(): Promise<void> {
  const result = requireOkResult()
  if (result === null) return
  const html = buildResultExportHtml(result)
  // services 探测：dev 浏览器无 preload 注入（window.services 为 undefined），
  // typeof 属性探测不抛错（不引用未定义标识符，沿 env.d.ts 的声明收紧类型）。
  const services =
    typeof window.services === 'object' && window.services !== null ? window.services : null
  if (services !== null && typeof services.writeTextFile === 'function') {
    try {
      const path = services.pickSaveFile()
      if (path === null) return // 用户取消保存对话框 → 静默结束
      services.writeTextFile(path, html)
      toastSuccess('已导出')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toastError(`导出失败：${message}`)
    }
    return
  }
  // 浏览器 dev 降级：Blob 下载兜底（无 services 写不了本地文件系统）。
  downloadHtmlViaBlob(html)
  toastSuccess('已导出')
}

/**
 * Blob 下载兜底（浏览器 dev / preview）：导出 HTML 包成 text/html Blob，
 * 经临时 objectURL + a.download 触发浏览器下载（文件名用 buildExportFileName
 * 的默认名建议），完成后立刻 revoke 释放。任务给定「Blob 下载兜底」选择 ——
 * 相比仅提示「导出需在 ZTools 中使用」，dev 环境的导出主链路保持可用。
 */
function downloadHtmlViaBlob(html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = buildExportFileName(new Date())
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/*
 * ============================================================================
 * 复制差异报告（INT-003）：「复制报告」动作下拉 —— 与「导出」下拉同款
 * ZSelect 动作菜单模式（UI-014：选中即回弹占位态），位置在「复制原始 /
 * 复制更改后」按钮组与「导出」下拉之间（前两者同为复制语义、后者同为
 * 分享语义，居中承接两种语义）。
 *
 * 三种格式（对应官网「分享链接」的无网本地化，全部纯前端、零网络依赖）：
 * - unified patch：buildUnifiedPatch（core/reporters.ts，纯函数 + 单测）——
 *   git diff 同构文本，可贴进 issue / code review / 标准 patch 工具；两侧
 *   无差异时 patch 无内容可给（buildUnifiedPatch 返回空串），动作改道
 *   toast info 引导而非复制空文本；
 * - Markdown 报告：buildMarkdownReport（core/reporters.ts，纯函数 + 单测）
 *   —— 统计 + 逐行差异表格，全 equal 时报告自带简化说明（复制照常执行）；
 * - HTML 报告：复用 buildExportHtml（经 buildResultExportHtml，与落盘导出
 *   同一构建出口，保证两种 HTML 分享形态内容一致）。
 *
 * 可用性：与「导出」下拉共用 exportDisabled 闸门（无结果 / ok:false 时
 * 禁用，变量名沿用 INT-002）；处理器内再以 requireOkResult 兜底防御。
 * ============================================================================
 */

/** 复制报告动作下拉的当前值：动作菜单语义 —— 选中即回弹为 null（同导出下拉） */
const reportCopyValue = ref<string | null>(null)

/** 复制报告动作下拉候选：value 到复制动作的映射见 handleCopyReportSelect */
const REPORT_COPY_SELECT_OPTIONS: { label: string; value: string }[] = [
  { label: '复制 unified patch', value: 'patch' },
  { label: '复制 Markdown 报告', value: 'markdown' },
  { label: '复制 HTML 报告', value: 'html' },
]

/**
 * 复制报告动作下拉回调：先把手头 model-value 回弹为 null（触发器立刻恢复
 * 「复制报告」占位文案，语义同导出下拉 handleExportSelect），再按 value
 * 分发到对应复制动作；未知值直接忽略（防御）。
 */
function handleCopyReportSelect(value: string): void {
  reportCopyValue.value = null
  if (value === 'patch') {
    void handleCopyPatchReport()
  } else if (value === 'markdown') {
    void handleCopyMarkdownReport()
  } else if (value === 'html') {
    void handleCopyHtmlReport()
  }
}

/**
 * 复制 unified patch：buildUnifiedPatch 组装（rows / hunks / stats 取自当前
 * 成功结果，meta 注入两侧来源文件名 —— 未加载文件时为空串，交由 reporters
 * 的缺省命名 a/original / b/modified）。两侧无差异（hunks 空）时不复制
 * （patch 无内容可给），toast info 引导；成功 toast success「已复制
 * unified patch」，失败 toast error（copyWithToast 统一出口）。
 */
async function handleCopyPatchReport(): Promise<void> {
  const result = requireOkResult()
  if (result === null) return
  if (result.hunks.length === 0) {
    toastInfo('两侧无差异，无需复制')
    return
  }
  const patch = buildUnifiedPatch({
    rows: result.rows,
    hunks: result.hunks,
    stats: result.stats,
    meta: {
      // 来源文件名（INT-001）：加载过文件时作为 patch 头标题；空串转
      // undefined 落到 reporters 的缺省命名（a/original / b/modified）。
      leftTitle: workbenchStore.leftFileName || undefined,
      rightTitle: workbenchStore.rightFileName || undefined,
    },
  })
  await copyWithToast(patch, '已复制 unified patch')
}

/**
 * 复制 Markdown 报告：buildMarkdownReport 组装（rows / stats 取自当前成功
 * 结果，生成时间与导出时间共用 formatExportedAt 的文案口径）。全 equal 时
 * 报告为简化说明（reporters 内决策），复制动作照常执行；成功 / 失败反馈
 * 与复制 patch 同款（copyWithToast 统一出口）。
 */
async function handleCopyMarkdownReport(): Promise<void> {
  const result = requireOkResult()
  if (result === null) return
  const markdown = buildMarkdownReport({
    rows: result.rows,
    stats: result.stats,
    meta: { generatedAt: formatExportedAt(new Date()) },
  })
  await copyWithToast(markdown, '已复制 Markdown 报告')
}

/**
 * 复制 HTML 报告：buildResultExportHtml（复用 buildExportHtml，与落盘导出
 * 同一构建出口）组装完整单文件文档后复制到剪贴板；成功 / 失败反馈同上。
 */
async function handleCopyHtmlReport(): Promise<void> {
  const result = requireOkResult()
  if (result === null) return
  await copyWithToast(buildResultExportHtml(result), '已复制 HTML 报告')
}

/*
 * ============================================================================
 * 本地历史（INT-004）：保存出口 + 历史侧栏接线。
 *
 * 保存出口（唯一）：下方对 diffStore.result 的 watch —— run() 产出 ok 结果的
 * 瞬间调 historyStore.saveFromResult()（autoSave 关闭时 store 内直接跳过）。
 * 刻意挂 watch 而非在各触发函数里补调用：显式对比（runAndShowResult）、实时
 * 防抖、选项自动重跑、合并重算（handleApplyHunk）、交换后重算五条路径全部
 * 以「result 落地」收口，watch 单点覆盖、不会漏挂新增路径；失败结果 / 空态
 * 短路（result 为 null 或 ok:false）不产生历史。去重（同输入只置顶更新一条）
 * 与节流（同身份键 3s 内跳过写盘）分别在 core/historyModel.ts 与
 * stores/history.ts 完成，此处不感知。
 *
 * 侧栏：工具栏行尾「历史」按钮（条目数徽标）开关 historyDrawerOpen；恢复链
 * 见 handleRestoreHistory。ctx：恢复触发的新结果同样经过保存 watch —— 身份
 * 键与被恢复条目相同，去重只置顶更新该条，不会膨胀。
 * ============================================================================
 */

/** 历史侧栏显隐：工具栏「历史」按钮打开，遮罩 / Esc / 关闭钮 / 恢复后自动收起 */
const historyDrawerOpen = ref(false)

watch(
  () => diffStore.result,
  (result) => {
    if (result !== null && isDiffOk(result)) {
      historyStore.saveFromResult()
    }
  },
)

/**
 * 历史侧栏「恢复」（HistoryDrawer restore 事件的统一编排）：
 * 1. historyStore.restore(item) —— 写回 workbench 双侧文本、viewStore 选项
 *    与上下文行数、语言，随后 await diffStore.run() 重算（restore 内部完
 *    成，返回是否得到 ok 结果）；
 * 2. 关闭抽屉（无论成败 —— 恢复动作已消费，停在抽屉里没有下一步）；
 * 3. 切态与 runAndShowResult 同语义：ok → 结果态浏览恢复的差异；失败 /
 *    空态短路 → 已不在输入态时切结果态呈现错误块（与「保留编辑态重新对比
 *    失败」同路径），仍在输入态保持现状 —— 失败原因的即时反馈由既有 result
 *    watch 的 ZToast error 承担，重算期间主按钮「对比中…」承担进行中反馈。
 */
async function handleRestoreHistory(item: HistoryItem): Promise<void> {
  const restored = await historyStore.restore(item)
  historyDrawerOpen.value = false
  if (restored) {
    appMode.value = 'result'
    return
  }
  if (appMode.value !== 'input') {
    appMode.value = 'result'
  }
}

/*
 * ============================================================================
 * 选项变化自动重跑（UI-005 决策）：「忽略空白 / 忽略大小写 / 忽略空行 /
 * 上下文行数 / 自定义忽略规则」中任一影响引擎输入的选项变化后 ——
 * - 已有对比结果（result !== null）→ 立即重跑一次，让结果即时反映新选项：
 *   翻转开关的用户意图显然是「看看忽略后的差异」，旧结果继续展示会误导；
 *   且此刻引擎输入与上次成功对比一致，成本与实时对比同量级，run() 自带
 *   空态短路 / 重入守卫兜底。
 * - 尚无结果 → 不触发：避免用户还在编辑输入时因调开关而意外发起一次
 *   （可能是大文本的）计算；选项在下次「查找差异」/ 快捷键 / 实时防抖
 *   时自然生效。
 * 取舍说明：渲染类开关（viewMode / showCollapsed / wrapLongLines）与
 * language 只影响视图（UI-006/007/008 / INT-001 消费）、precision 由
 * ENG-004 缓存重投影承接，均不进本 watch，也不进 compareFull 的输入。
 * 启用中的规则存在非法正则（enabledRulesValid === false）时跳过重跑：
 * 编辑到一半的正则不把既有好结果顶成 invalid-regex 错误态，等补完合法后
 * 本 watch 随下一次变更自然触发。弹窗内改动同样经过本 watch —— 单一重跑
 * 出口，不在 SettingsDialog 重复接线。
 * ============================================================================
 */
watch(
  () => ({
    ignoreWhitespace: viewStore.ignoreWhitespace,
    ignoreCase: viewStore.ignoreCase,
    ignoreEmptyLines: viewStore.ignoreEmptyLines,
    contextLines: viewStore.contextLines,
    // 规则数组按值快照（内容/开关变化都能被 getter 依赖捕获并触发回调）
    rules: viewStore.ignoreRules.map((rule) => ({
      id: rule.id,
      pattern: rule.pattern,
      flags: rule.flags,
      enabled: rule.enabled,
    })),
  }),
  () => {
    if (diffStore.result === null || diffStore.isRunning) return
    if (!viewStore.enabledRulesValid) return
    // 后台刷新路径：直接 run()，不碰 appMode（保留编辑态里 result 静默更新、
    // 仍停在编辑态；态切换语义见状态机大注释）。空输入反馈由
    // runDiffWithEmptyFeedback 统一补充（UI-013）。
    void runDiffWithEmptyFeedback()
  },
)

/*
 * ============================================================================
 * 底部统计条与 hunk 导航（UI-010，升级自 UI-004 的最小占位摘要条）：
 * - 成功 → 统计徽标行：「+N」（--diff-add-text）/「−M」（--diff-del-text）/
 *   有修改对时追加「~K」徽标（modifiedPairs，compareFull 骨架恒为 0、配对
 *   语义自 UI-006 起可达非零，展示层按有无徽标处理）+「H 处差异」（hunkCount）；
 * - 失败 → 错误摘要一行（too-large → 文件过大、invalid-regex → 正则无效、
 *   internal → 对比失败），完整错误态呈现归 UI-013；
 * - 右列导航按钮组（▲ 上一处 / 位置 2/5 / ▼ 下一处）：键盘（F3/Shift+F3）
 *   与按钮都走 navStore（单一出口，见 stores/nav.ts），此处只判可用性与
 *   位置文案；
 * - result 变化（重跑 / 清空 / 空态短路）→ 旧定位失效，watch 调
 *   navStore.reset()（任务指定的重置接线位置）。
 * ============================================================================
 */
watch(
  () => diffStore.result,
  () => {
    navStore.reset()
  },
)

/*
 * 窄窗提示条的「一次性」（UI-015）：窗口退出窄窗时重置关闭态 —— 下一episode
 * （再次变窄）提示重新可达；episode 内关闭后不再打扰。
 */
watch(
  () => viewStore.narrowWindow,
  (narrow) => {
    if (!narrow) narrowNoticeDismissed.value = false
  },
)

/*
 * 错误结果的短 Toast（UI-013）：错误结果落地的瞬间 ZToast error 一次，短暂
 * 引导视线；完整原因与后续动作由常驻的错误块（结果态）与底部摘要条承担，
 * toast 只提示「发生了」，不重复详情。挂在 result watch 上与触发来源解耦
 * —— 显式触发 / 实时防抖 / 选项重跑 / 合并后重算任何路径产生的错误结果都
 * 会经过这里；成功结果与空态短路（result 置 null）不触发。
 */
watch(
  () => diffStore.result,
  (result) => {
    if (result !== null && !isDiffOk(result)) {
      toastError(`对比失败：${summarizeError(result.error)}`)
    }
  },
)

function summarizeError(error: DiffError): string {
  switch (error.kind) {
    case 'too-large':
      return '文本超过大小/行数限制'
    case 'invalid-regex':
      return '忽略规则包含非法正则'
    default:
      return '对比失败'
  }
}

/** 字节数 → MB 文案（1 位小数；引擎上限 5MB 量级、实际值可更大，MB 足够） */
function formatBytesAsMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** 行数 → 千分位文案（10 万行级别的大数字加千分位分隔符更可读） */
function formatLineCount(lines: number): string {
  return `${lines.toLocaleString('en-US')} 行`
}

/*
 * 结果态错误块的完整呈现模型（UI-013）：按错误类别给出具体主文案 + 追加
 * 详情行 + 动作开关；无错误结果时为 null（模板不渲染）。文案策略：
 * - too-large：主文案「文本超过大小/行数限制，请缩减后重试」+ 大小 / 行数
 *   两维度的「实际 / 上限」详情行（MB 换算 1 位小数、行数千分位）。引擎
 *   checkPairLimits 恒带上全部四个字段（见 core/guards.ts），缺省守卫仅
 *   防御；「返回编辑」不在此重复 —— 工具栏按钮在错误态下本就可达；
 * - invalid-regex：主文案带出错 pattern + 「去设置修正」提示行 +
 *   openSettings 动作开关（弹窗开合态 settingsOpen 就在 App.vue，错误块
 *   的「打开设置」按钮直接置 true 即可，无需给 SettingsDialog 加接口）；
 * - internal：引擎原文 message 直出，不加工。
 */
const resultErrorView = computed(() => {
  const result = diffStore.result
  if (result === null || isDiffOk(result)) return null
  const error = result.error
  switch (error.kind) {
    case 'too-large': {
      const details: string[] = []
      if (error.limitBytes !== undefined && error.actualBytes !== undefined) {
        details.push(
          `文本大小 ${formatBytesAsMb(error.actualBytes)} / 上限 ${formatBytesAsMb(error.limitBytes)}`,
        )
      }
      if (error.limitLines !== undefined && error.actualLines !== undefined) {
        details.push(
          `文本行数 ${formatLineCount(error.actualLines)} / 上限 ${formatLineCount(error.limitLines)}`,
        )
      }
      return {
        kind: 'too-large' as const,
        text: '文本超过大小/行数限制，请缩减后重试',
        details,
        openSettings: false,
      }
    }
    case 'invalid-regex':
      return {
        kind: 'invalid-regex' as const,
        text: `忽略规则包含非法正则：${error.pattern}`,
        details: ['非法规则不会参与本次对比，请在设置中修正后重新对比'],
        openSettings: true,
      }
    case 'internal':
      return { kind: 'internal' as const, text: error.message, details: [], openSettings: false }
  }
})

const resultSummary = computed(() => {
  const r = diffStore.result
  if (r === null) return null
  // 用 isDiffOk 类型守卫判别（工程 strictNullChecks 关闭，布尔判别元的
  // 否定分支不自动收窄，守卫的肯定/否定双分支收窄均有效）。
  if (isDiffOk(r)) {
    return {
      ok: true as const,
      added: r.stats.addedLines,
      removed: r.stats.removedLines,
      // 修改对数量：> 0 时统计条才追加「~K」徽标（0 时徽标无信息量，隐藏）。
      modified: r.stats.modifiedPairs,
      hunks: r.stats.hunkCount,
    }
  }
  return { ok: false as const, text: summarizeError(r.error) }
})

/** 导航按钮可用性：无成功结果 / 没有任何差异块时禁用（hunks 为空无处可跳） */
const navDisabled = computed(() => {
  const summary = resultSummary.value
  return summary === null || !summary.ok || summary.hunks === 0
})

/**
 * 导航位置文案：「2/5」（currentIndex + 1 / hunkCount，1-based 展示）；
 * 未定位（-1）或无差异块显示「—」。
 */
const navPositionText = computed(() => {
  const summary = resultSummary.value
  if (summary === null || !summary.ok || summary.hunks === 0 || navStore.currentIndex < 0) {
    return '—'
  }
  return `${navStore.currentIndex + 1}/${summary.hunks}`
})
</script>

<template>
  <div class="app-shell">
<!--
      UI-016 侧边栏布局：顶部工具栏整体迁入左侧可折叠侧边栏
      （对齐参考稿「浅色面板 + 分组列表 + 顶部折叠按钮」）：
      - 分组结构：选项开关（四个 ZSwitch toggle 行）→ 视图（分段控件）→
        比对精度 / 语法高亮（ZSelect 下拉）→ 操作（动作下拉 + 按钮格）；
      - 底部操作区：「实时对比」开关行 + 「设置」入口 + 结果态「返回编辑」；
      - 「历史」入口与折叠按钮在侧边栏头部（徽标复用 INT-004 样式）；
      - 折叠：头部 `‹` 收起，窄轨 `›` 展开；窄窗进入时自动收起
        （见脚本区 UI-016 大注释）。样式见本文件样式区 UI-016 段。
    -->
    <div class="app-body">
    <aside
      class="sidebar"
      :class="{ 'is-collapsed': sidebarCollapsed }"
      aria-label="对比选项"
    >
      <div class="sidebar-inner">
        <!--
          UI-016 侧边栏头部：品牌「工具」+「历史」入口（徽标复用 INT-004
          的 .history-button 样式）+ 折叠按钮（`‹` 收起，窄轨 `›` 展开，
          见 sidebar-rail。折叠态为会话级 UI 态（见脚本区大注释）。
        -->
        <div class="sidebar-header">
          <span class="sidebar-brand">
            <UiIcon name="window" :size="15" class="sidebar-brand-icon" />
            文本对比
          </span>
          <UiButton
            variant="secondary"
            class="history-button sidebar-history"
            title="已保存差异历史"
            @click="historyDrawerOpen = true"
          >
            历史
            <span
              v-if="historyStore.items.length > 0"
              class="history-button-count"
            >{{ historyStore.items.length }}</span>
          </UiButton>
          <button
            type="button"
            class="sidebar-collapse"
            aria-label="折叠侧边栏"
            title="折叠侧边栏"
            @click="toggleSidebar"
          >
            <UiIcon name="chevron-left" :size="15" />
          </button>
        </div>
        <div class="sidebar-body">
          <!--
            选项开关组：四个开关为左文右钮的 UiSwitch 行（对齐参考稿的 toggle
            列表）；两个引擎开关 + 两个渲染开关，v-model 直写 viewStore
            （「忽略空白 / 忽略大小写」变化经脚本区 watch 自动重跑）。
          -->
          <div class="sidebar-section" role="group" aria-label="对比选项">
            <div class="sidebar-option-row">
              <span class="sidebar-option-label">忽略空白</span>
              <UiSwitch v-model="viewStore.ignoreWhitespace" aria-label="忽略空白" />
            </div>
            <div class="sidebar-option-row">
              <span class="sidebar-option-label">忽略大小写</span>
              <UiSwitch v-model="viewStore.ignoreCase" aria-label="忽略大小写" />
            </div>
            <div class="sidebar-option-row">
              <span class="sidebar-option-label">折叠未变更</span>
              <UiSwitch v-model="viewStore.showCollapsed" aria-label="折叠未变更" />
            </div>
            <div class="sidebar-option-row">
              <span class="sidebar-option-label">换行</span>
              <UiSwitch v-model="viewStore.wrapLongLines" aria-label="换行" />
            </div>
          </div>

          <!-- 视图分组：分段控件吃满侧边栏宽度 -->
          <div class="sidebar-section" role="group" aria-label="视图模式">
            <h2 class="sidebar-section-title">视图</h2>
            <!--
              视图模式分段控件：并排 / 统一（value 处理器见 setViewMode）。
              回显消费 effectiveViewMode：窄窗自动降级时控件如实反映「当前看到
              的视图」，用户点选走 setViewMode（窄窗内点并排 = 坚持并排）。
            -->
            <UiSegmented
              :model-value="viewStore.effectiveViewMode"
              :options="VIEW_MODE_OPTIONS"
              aria-label="视图模式"
              @update:model-value="setViewMode"
            />
          </div>

          <div class="sidebar-section" role="group" aria-label="对比精度">
            <h2 class="sidebar-section-title">比对精度</h2>
            <UiSelect
              :model-value="viewStore.precision"
              :options="PRECISION_OPTIONS"
              aria-label="比对精度"
              @update:model-value="setPrecision"
            />
          </div>

          <div class="sidebar-section" role="group" aria-label="对比语言">
            <h2 class="sidebar-section-title">语法高亮</h2>
            <UiSelect
              :model-value="viewStore.language"
              :options="LANGUAGE_OPTIONS"
              aria-label="语法高亮语言"
              @update:model-value="setLanguage"
            />
          </div>

      <!--
         操作分组（UI-016）：原「操作便捷项」组迁入侧边栏 —— 动作下拉
         （示例数据 / 复制报告 / 导出，选中即回弹占位态）满宽排布，
         四个小按钮（粘贴并对比 / 交换 / 清空 / 复制原始 / 复制更改后）
         两列网格布局；三个写文本的动作在对比进行中忽略点击（可用性语义与
         导出 / 复制报告共用 exportDisabled 闸门，见脚本区 INT-002/003
         与 UI-014 大注释）。INT-006「粘贴并对比」与 ⌘/Ctrl+Shift+V
         共用 handlePasteAndCompare。
      -->

            <div class="sidebar-section" role="group" aria-label="操作便捷项">
        <h2 class="sidebar-section-title">操作</h2>
        <div class="sidebar-quick">
        <UiSelect
          :model-value="sampleValue"
          :options="SAMPLE_SELECT_OPTIONS"
          placeholder="示例数据"
          aria-label="载入示例数据"
          @update:model-value="handleSampleSelect"
        />
        <!--
          INT-006「粘贴并对比」快捷路径：与 ⌘/Ctrl+Shift+V 共用
          handlePasteAndCompare（isRunning / 空剪贴板 / 覆盖确认等守卫都在
          该处理器内，按钮不需要禁用态 —— 与其他便捷小按钮同策略）。
        -->
        <UiButton
          variant="secondary"
          title="粘贴剪贴板到空侧并立即对比（⌘/Ctrl+Shift+V）；两侧均有内容时覆盖「原始文本」前会确认"
          @click="handlePasteAndCompare"
        >
          粘贴并对比
        </UiButton>
        <div class="sidebar-quick-grid">
        <UiButton
          variant="secondary"
          title="交换左右两侧文本"
          @click="handleSwapSides"
        >
          交换
        </UiButton>
        <UiButton
          variant="secondary"
          title="清空两侧输入"
          @click="handleClearInputs"
        >
          清空
        </UiButton>
        <UiButton
          variant="secondary"
          title="复制原始文本到剪贴板"
          @click="handleCopySide('left')"
        >
          复制原始
        </UiButton>
        <UiButton
          variant="secondary"
          title="复制更改后文本到剪贴板"
          @click="handleCopySide('right')"
        >
          复制更改后
        </UiButton>
        </div>
        <!-- 复制报告动作下拉（INT-003）：分发见 handleCopyReportSelect，可用性与「导出」共用 exportDisabled -->
        <UiSelect
          :model-value="reportCopyValue"
          :options="REPORT_COPY_SELECT_OPTIONS"
          placeholder="复制报告"
          aria-label="复制差异报告"
          :disabled="exportDisabled"
          @update:model-value="handleCopyReportSelect"
        />
        <!-- 导出动作下拉（INT-002）：分发见 handleExportSelect，可用性见 exportDisabled -->
        <UiSelect
          :model-value="exportValue"
          :options="EXPORT_SELECT_OPTIONS"
          placeholder="导出"
          aria-label="导出差异结果"
          :disabled="exportDisabled"
          @update:model-value="handleExportSelect"
        />
</div>
      </div>
        <div class="sidebar-footer">
          <!--
            侧边栏底部：结果态「返回编辑」出口 + 「实时对比」开关行
            （左文右钮同选项行样式）+ 「设置」入口（齿轮图标 + 文字）。
          -->
          <UiButton
            v-if="inResultMode && diffStore.result !== null"
            variant="secondary"
            class="sidebar-block-btn"
            @click="backToEditing"
          >
            返回编辑
          </UiButton>
          <div class="sidebar-footer-row">
            <span class="sidebar-option-label">实时对比</span>
            <UiSwitch v-model="diffStore.realtime" aria-label="实时对比" />
          </div>
          <UiButton
            variant="secondary"
            class="sidebar-block-btn sidebar-settings-btn"
            aria-label="设置"
            title="设置"
            @click="settingsOpen = true"
          >
            设置
            <UiIcon name="settings" :size="14" class="sidebar-gear" />
          </UiButton>
        </div>
      </div>
      </div>
    </aside>

    <!--
      UI-016 折叠窄轨：侧边栏收起后留下的细条（不参与布局内容），
      `›` 按钮点开重新展开侧边栏（与头部 `‹` 按钮互逆）。
    -->
    <div v-if="sidebarCollapsed" class="sidebar-rail" aria-hidden="true">
      <button
        type="button"
        class="sidebar-rail-toggle"
        aria-label="展开侧边栏"
        title="展开侧边栏"
        @click="sidebarCollapsed = false"
      >
        <UiIcon name="chevron-right" :size="15" />
      </button>
    </div>

    <!-- 主区（UI-016）：工作台 + 底部操作区从 app-shell 列内迁入本列 -->
    <div class="app-main">

    <!--
      UI-011 编辑提示条（edit-from-result 态专属）：告知当前编辑侧 + 两个出口
      按钮。样式走 token（.edit-notice，见 main.css 的 UI-011 段）；「重新对比」
      与主按钮 / ⌘+Enter 同走 runAndShowResult（run 成功切回结果态、失败呈现
      结果态错误块、空态短路回输入态），「返回结果」不重算直接切回（完整转换
      表见脚本区状态机大注释）。
    -->
    <div v-if="editingFromResult" class="edit-notice" role="status">
      <span class="edit-notice-text">{{ editNoticeText }}</span>
      <div class="edit-notice-actions">
        <UiButton
          variant="primary"
          :disabled="diffStore.isRunning"
          @click="runAndShowResult"
        >
          重新对比
        </UiButton>
        <UiButton variant="secondary" @click="backToResultFromEdit">
          返回结果
        </UiButton>
      </div>
    </div>

    <!--
      中部工作台（UI-006 起为输入态 / 结果态切换，UI-011 起为三态）：
      - 结果态（showResultView）渲染在 .result-stage 包裹层内（UI-013）：
        顶部可选「两侧相同」常驻提示条（isIdenticalResult），下方按视图模式
        分流（UI-006/007）：viewMode = 'split' 渲染并排视图（SplitDiffView），
        viewMode = 'unified' 渲染统一视图（UnifiedDiffView，单栏 +/−/空格 行 +
        hunk 头条，数据管道与渲染结构见组件文件头）；两者共用 .result-view
        的 flex 尺寸收缩约定；行内容格点击经 editSide 事件进入保留编辑态
        （UI-011）；hunk 合并控制条经 applyHunk 事件应用更改并重算（UI-012）；
      - 结果态失败通道（showResultError）：错误块呈现类别主文案 + 追加详情
        （too-large 的实际/上限等）+ 动作（invalid-regex 的「打开设置」，
        UI-013）；工具栏「返回编辑」仍可达，落地瞬间的短引导由 ZToast error
        承担（result watch）；
      - 输入态与保留编辑态：原有双栏编辑器结构原样保留（切态时编辑器整体
        卸载 / 重挂载，文本以 workbench store 为唯一真源不受影响；保留编辑态
        下顶部有编辑提示条，聚焦 / 定位由 enterEditFromResult 驱动）。
    -->
    <main ref="workbenchEl" class="workbench">
      <!--
        感知加载态（UI-013）：重算进行中且已有旧结果时，工作台顶部的不确定
        进度条（absolute 覆盖、不参与布局，样式见 main.css）。compareFull
        同步执行很快，纯感知优化；首次对比（无旧结果）不显示，由主按钮
        「对比中…」承担反馈。
      -->
      <div v-if="showResultProgress" class="result-progress" aria-hidden="true"></div>
      <!--
        结果态包裹层（UI-013）：顶部承载「两侧相同」常驻提示条，下方按视图
        模式分流结果视图。提示条只在该包裹层出现（结果态 + 成功结果），样式
        （.same-notice / .result-stage）见 main.css 与本文件样式区。
      -->
      <div v-if="showResultView" class="result-stage" :style="{ '--gutter-w': `${gutterWidthPx}px` }">
        <!--
          窄窗提示条（UI-015）：小窗口降级的轻量告知 —— 自动降级时说明原因、
          用户坚持并排时给出建议；可关闭（一次性，见脚本区 narrowNoticeVisible）。
          样式（.narrow-notice）见 main.css，与 .same-notice 同族。
        -->
        <div v-if="narrowNoticeVisible" class="narrow-notice" role="status">
          <span class="narrow-notice-text">{{ narrowNoticeText }}</span>
          <button
            type="button"
            class="narrow-notice-close"
            aria-label="关闭提示"
            @click="narrowNoticeDismissed = true"
          >×</button>
        </div>
        <!--
          无差异提示条（UI-013）：判定条件见 isIdenticalResult。取舍：用常驻
          提示条而非 ZToast —— 「两侧相同」不是需要消失的瞬时事件，而是结果
          的持续属性，常驻条与结果同生同灭、不遮挡可浏览的 equal 行。
        -->
        <div v-if="isIdenticalResult" class="same-notice" role="status">
          ✓ 两侧文本相同，可继续浏览或返回编辑
        </div>
        <!--
          视图分流按 effectiveViewMode（UI-015）：窄窗自动降级时接管为统一
          视图（viewMode 不被改写，窗口变宽自动还原，见脚本区降级大注释）。
        -->
        <SplitDiffView
          v-if="viewStore.effectiveViewMode === 'split'"
          class="result-view"
          @edit-side="handleEditSide"
          @apply-hunk="handleApplyHunk"
        />
        <UnifiedDiffView
          v-else
          class="result-view"
          @edit-side="handleEditSide"
          @apply-hunk="handleApplyHunk"
        />
      </div>
      <!--
        结果态错误块（UI-013 强化）：标题 + 具体主文案（按错误类别，见
        resultErrorView）+ 追加详情行（too-large 的实际/上限等）+ 动作区
        （invalid-regex 提供「打开设置」直达修正）。工具栏「返回编辑」在
        错误态下仍可达（too-large 的回退出口）；落地瞬间的短引导由 result
        watch 的 ZToast error 承担，本块常驻完整详情。
      -->
      <div v-else-if="showResultError" class="result-error" role="alert">
        <p class="result-error-title">对比失败</p>
        <p class="result-error-text">{{ resultErrorView?.text ?? resultErrorText }}</p>
        <p
          v-for="line in resultErrorView?.details ?? []"
          :key="line"
          class="result-error-detail"
        >
          {{ line }}
        </p>
        <div v-if="resultErrorView?.openSettings" class="result-error-actions">
          <UiButton variant="secondary" @click="openErrorSettings">
            打开设置
          </UiButton>
        </div>
      </div>
      <template v-else>
      <!--
        UI-001：左栏 CodeMirror 6 编辑器（原始文本）。v-model 直写 store.leftText。
        UI-003：整个 pane（header + 编辑器区域）是拖放目标——drop/dragover/
        dragenter/dragleave 绑在 capture 阶段（pane 是 CodeMirror contentDOM
        的祖先，需抢在其内置 drop handler 之前接管：原生实现会用 FileReader
        直读文件、文本只插入光标处，均与本侧载入语义冲突，见 useDropLoad.ts）；
        dragstart/dragend 绑在冒泡阶段，仅观察拖拽是否源自编辑器内部。
      -->
      <section
        class="editor-pane"
        aria-label="原始文本"
        @dragenter.capture="leftDrop.onDragEnter"
        @dragover.capture="leftDrop.onDragOver"
        @dragleave.capture="leftDrop.onDragLeave"
        @drop.capture="leftDrop.onDrop"
        @dragstart="leftDrop.onDragStart"
        @dragend="leftDrop.onDragEnd"
      >
        <div class="pane-header">
          <span class="pane-title">原始文本</span>
          <div class="pane-header-actions">
            <!--
              INT-005：全局「打开编码」选择器（两侧绑定同一 fileEncoding，
              决策见脚本区注释）。title 为原生 tooltip：GBK 等编码对非法字节
              序列按 TextDecoder 标准以替换符呈现不抛错，乱码时用户在此切换
              编码重新载入。外层定宽 span 控制触发器宽度（88px）。
            -->
            <span class="pane-encoding">
              <UiSelect
                :model-value="fileEncoding"
                :options="ENCODING_SELECT_OPTIONS"
                title="打开文件与拖入文件的解码编码；若出现乱码请切换编码"
                aria-label="文件解码编码"
                @update:model-value="setFileEncoding"
              />
            </span>
            <!-- UI-002：打开文件（次级样式），走 useFileLoad 降级安全链路 -->
            <UiButton variant="secondary" @click="openLeftFile">
              打开文件
            </UiButton>
            <!--
              INT-006：粘贴（次级样式）—— 读剪贴板写入本侧：空剪贴板
              toast info「剪贴板为空」、本侧已有内容弹覆盖确认（与「打开文件」
              语义一致）、不自动对比；降级链与确认流程见 useClipboardLoad。
            -->
            <UiButton
              variant="secondary"
              title="粘贴剪贴板文本到「原始文本」"
              @click="pasteLeftClipboard"
            >
              粘贴
            </UiButton>
          </div>
        </div>
        <div class="pane-body">
          <InputEditor
            ref="leftEditorRef"
            v-model="workbenchStore.leftText"
            side="left"
            label="原始文本"
            placeholder="粘贴或输入原始文本，也可拖入文件"
            :language="editorLanguage"
          />
        </div>
        <!--
          UI-003 拖拽覆盖层：外部拖入悬停时显示（isDragOver 由 dragenter/
          dragleave 深度计数驱动，见 useDropLoad.ts）。pointer-events: none
          让覆盖层不参与拖拽命中测试——事件目标始终是 pane 自身子树，覆盖层
          自身的插入不会扰动 enter/leave 计数（防闪烁配套措施）。
        -->
        <div v-if="leftDrop.isDragOver" class="drop-overlay" aria-hidden="true">
          <span class="drop-overlay-label">松开载入到「原始文本」</span>
        </div>
      </section>

      <div class="pane-divider" aria-hidden="true"></div>

      <!--
        UI-001：右栏 CodeMirror 6 编辑器（更改后文本）。
        UI-003：拖放绑定与覆盖层同左栏（说明见左栏注释）。
      -->
      <section
        class="editor-pane"
        aria-label="更改后文本"
        @dragenter.capture="rightDrop.onDragEnter"
        @dragover.capture="rightDrop.onDragOver"
        @dragleave.capture="rightDrop.onDragLeave"
        @drop.capture="rightDrop.onDrop"
        @dragstart="rightDrop.onDragStart"
        @dragend="rightDrop.onDragEnd"
      >
        <div class="pane-header">
          <span class="pane-title">更改后文本</span>
          <div class="pane-header-actions">
            <!-- INT-005：全局「打开编码」选择器（同左栏，两侧同值，tooltip 见左栏注释） -->
            <span class="pane-encoding">
              <UiSelect
                :model-value="fileEncoding"
                :options="ENCODING_SELECT_OPTIONS"
                title="打开文件与拖入文件的解码编码；若出现乱码请切换编码"
                aria-label="文件解码编码"
                @update:model-value="setFileEncoding"
              />
            </span>
            <!-- UI-002：打开文件（次级样式），走 useFileLoad 降级安全链路 -->
            <UiButton variant="secondary" @click="openRightFile">
              打开文件
            </UiButton>
            <!-- INT-006：粘贴（同左栏，写入本侧；语义见左栏注释与 useClipboardLoad） -->
            <UiButton
              variant="secondary"
              title="粘贴剪贴板文本到「更改后文本」"
              @click="pasteRightClipboard"
            >
              粘贴
            </UiButton>
          </div>
        </div>
        <div class="pane-body">
          <InputEditor
            ref="rightEditorRef"
            v-model="workbenchStore.rightText"
            side="right"
            label="更改后文本"
            placeholder="粘贴或输入更改后文本，也可拖入文件"
            :language="editorLanguage"
          />
        </div>
        <!-- UI-003 拖拽覆盖层（同左栏，pointer-events: none 防命中扰动） -->
        <div v-if="rightDrop.isDragOver" class="drop-overlay" aria-hidden="true">
          <span class="drop-overlay-label">松开载入到「更改后文本」</span>
        </div>
      </section>
      </template>
    </main>

    <!--
      UI-010 底部操作区：三列 grid（1fr auto 1fr）保证主按钮恒居中。
      左列 = 统计徽标条（+N/−M/~K/H 处差异 pill，错误时为错误摘要）；
      右列 = hunk 导航按钮组（▲ 上一处 / 位置 / ▼ 下一处），键盘路径为
      F3/Shift+F3（见 onGlobalKeydown），两者都走 navStore 单一出口。
    -->
    <footer class="action-bar">
      <div class="action-bar-side">
        <div
          v-if="resultSummary !== null"
          class="result-summary"
          :class="resultSummary.ok ? 'is-ok' : 'is-error'"
          role="status"
        >
          <template v-if="resultSummary.ok">
            <span class="stat-pill is-add">+{{ resultSummary.added }}</span>
            <span class="stat-pill is-del">−{{ resultSummary.removed }}</span>
            <span v-if="resultSummary.modified > 0" class="stat-pill is-mod">~{{ resultSummary.modified }}</span>
            <span class="stat-pill is-count">{{ resultSummary.hunks }} 处差异</span>
          </template>
          <template v-else>{{ resultSummary.text }}</template>
        </div>
      </div>
      <UiButton
        variant="primary"
        size="medium"
        :disabled="diffStore.isRunning"
        @click="handleFindDiff"
      >
        {{ findDiffLabel }}
      </UiButton>
      <div class="action-bar-side action-bar-side-end">
        <!--
          hunk 导航组（UI-010）：仅在成功结果时渲染；hunks 为空（无差异）时
          按钮禁用（任务指定「禁用」而非隐藏 —— 保持统计条布局稳定）。位置
          文案 2/5（1-based）或未定位「—」见 navPositionText。
        -->
        <div
          v-if="resultSummary !== null && resultSummary.ok"
          class="hunk-nav"
          role="group"
          aria-label="差异块导航"
        >
          <UiButton
            variant="secondary"
            :disabled="navDisabled"
            title="上一处差异（Shift+F3）"
            @click="navStore.goPrev"
          >
            <span class="hunk-nav-arrow" aria-hidden="true">▲</span>上一处
          </UiButton>
          <span class="hunk-nav-position" aria-live="polite">{{ navPositionText }}</span>
          <UiButton
            variant="secondary"
            :disabled="navDisabled"
            title="下一处差异（F3）"
            @click="navStore.goNext"
          >
            下一处<span class="hunk-nav-arrow" aria-hidden="true">▼</span>
          </UiButton>
        </div>
      </div>
    </footer>
    </div>
    </div>
  </div>

  <!--
    全局反馈（Scandi 重构后）：UiToastHost / UiConfirmDialog 各自读取本地
    composables 的模块级单例状态并渲染，无需 props 接线。Toast / 确认框均为
    fixed 定位（z-index 23000 / 22100），挂载位置不影响布局；确认弹窗的
    Esc / 焦点圈定 / 焦点还原由 reka-ui AlertDialog 内建。
  -->
  <UiToastHost />
  <UiConfirmDialog />

  <!-- UI-005：设置弹窗（上下文行数 / 自定义忽略规则 / 实时对比默认值） -->
  <SettingsDialog v-model:show="settingsOpen" />

  <!--
    INT-004：历史侧栏（UiDrawer 自带 body teleport，挂载位置不影响布局）。
    show 走 v-model（遮罩 / Esc / 关闭钮 / 恢复后自动收起经 update:show 回写）；
    restore 事件的编排见脚本区 handleRestoreHistory。
  -->
  <HistoryDrawer v-model:show="historyDrawerOpen" @restore="handleRestoreHistory" />
</template>


<style scoped>
/*
 * ============================================================================
 * Scandi 版式（2026-08 北欧极简重构）：
 * 「亚麻桌面上放纸卡」—— 页面底为暖亚麻白（--bg-color），工作台里的编辑器
 * 与结果视图是两张纸卡（--surface 白面 + 发丝边 + 1px 轻阴影 + 大圆角），
 * 侧边栏是桌面左缘的浅色工具墙。全部颜色消费 main.css 令牌，无硬编码色值。
 * ============================================================================
 */

/*
 * FND-005 窗口最小尺寸与滚动策略：
 * .workbench 不设最小宽度 —— 允许容器真实收缩，App 以 ResizeObserver 观察
 * 其宽度，低于 620px 时并排结果视图自动降级为统一视图（见脚本区降级大注释）；
 * .app-shell 纵向 overflow: hidden（无页面级滚动，滚动只发生在 CodeMirror
 * 编辑器 / diff 视图内部）；横向 overflow-x: auto 作为最后防线。
 */
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  overflow-x: auto;
  background-color: var(--bg-color, #f7f5f1);
  color: var(--text-color, #2e2c28);
}

/*
 * ============================================================================
 * 左侧可折叠侧边栏：浅色工具墙 + 分组（小标题）+ 顶部折叠按钮。
 * 结构：.app-body（横向 flex）内 = 侧边栏 + 窄轨（折叠时）+ 主区
 * （.app-main：工作台 + 底部操作区）。
 * - 折叠：.sidebar 宽度 248px（--sidebar-w）→ 收起为 0（.is-collapsed），
 *   内容经 .sidebar-inner 固定宽不换行挤压 → 过渡期内联控件不被挤变形；
 * - 窄窗自动收起见脚本区 UI-016 大注释（不自动展开）。
 * ============================================================================
 */
.app-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: stretch;
}

.sidebar {
  --sidebar-w: 248px;
  flex: none;
  width: var(--sidebar-w);
  overflow: hidden;
  border-right: 1px solid var(--border-color, #e8e4dc);
  background-color: var(--bg-color, #f7f5f1);
  transition: width 0.18s var(--ease-quiet), border-color 0.18s var(--ease-quiet);
}

.sidebar.is-collapsed {
  width: 0;
  border-right-color: transparent;
}

.sidebar-inner {
  width: var(--sidebar-w);
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* 头部：品牌 +「历史」+ 折叠按钮 */
.sidebar-header {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--divider-color, #edeae3);
}

/* 品牌「文本对比」：图标 + 文字，flex:1 把「历史」/ 折叠推到右 */
.sidebar-brand {
  flex: 1 1 auto;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.2px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.sidebar-brand-icon {
  flex: none;
  color: var(--primary-color, #4e7a60);
}

/* 折叠按钮：扁平图标钮（chevron），hover 轻底色 */
.sidebar-collapse {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: var(--radius-s, 6px);
  background: transparent;
  color: var(--text-secondary, #8a8377);
  cursor: pointer;
  transition: background-color 0.12s var(--ease-quiet), color 0.12s var(--ease-quiet);
}

.sidebar-collapse:hover {
  background-color: var(--hover-bg, #f2f0ea);
  color: var(--text-color, #2e2c28);
}

.sidebar-collapse:focus-visible {
  outline: 1.5px solid var(--primary-color);
  outline-offset: 1px;
}

/* 主体：纵向滚动（侧边栏内控件高度超出时内滚，不撑破面板） */
.sidebar-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* 分组：小标题 + 控件列；组间以发丝分隔线 + 呼吸间距区隔 */
.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--divider-color, #edeae3);
}

/* 分组小标题：弱灰小字 + 略宽字距（安静的分类标记，不加图形装饰） */
.sidebar-section-title {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.6px;
  color: var(--text-secondary, #8a8377);
}

/* 开关行：标签居左、开关居右 */
.sidebar-option-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 26px;
  font-size: 12px;
  color: var(--text-color, #2e2c28);
}

.sidebar-option-label {
  font-size: 12px;
}

/* 便捷项列：控件满宽 + 四个小按钮两列网格 */
.sidebar-quick {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sidebar-quick-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

/* 满宽按钮：快捷列里的块按钮（class 透传到 UiButton 根） */
.sidebar-block-btn {
  width: 100%;
}

/* 侧边栏底部：实时对比开关行 + 设置（返回编辑随结果态出现，见模板 v-if） */
.sidebar-footer {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid var(--divider-color, #edeae3);
}

.sidebar-footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 26px;
}

.sidebar-settings-btn {
  justify-content: center;
}

.sidebar-gear {
  color: var(--text-secondary, #8a8377);
}

/* 折叠窄轨：收起后的细条（v-if 渲染，宽度固定不占编辑区空间） */
.sidebar-rail {
  flex: none;
  width: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-right: 1px solid var(--border-color, #e8e4dc);
  background-color: var(--bg-color, #f7f5f1);
}

/* 窄轨展开钮：扁平图标钮，顶部悬挂（hover/焦点态同头部折叠钮） */
.sidebar-rail-toggle {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-top: 10px;
  padding: 0;
  border: none;
  border-radius: var(--radius-s, 6px);
  background: transparent;
  color: var(--text-secondary, #8a8377);
  cursor: pointer;
  transition: background-color 0.12s var(--ease-quiet), color 0.12s var(--ease-quiet);
}

.sidebar-rail-toggle:hover {
  background-color: var(--hover-bg, #f2f0ea);
  color: var(--text-color, #2e2c28);
}

.sidebar-rail-toggle:focus-visible {
  outline: 1.5px solid var(--primary-color);
  outline-offset: 1px;
}

/* 主区（工作台 + 底部操作区列）：占满侧边栏右侧剩余空间 */
.app-main {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/*
 * 中部工作台：纸卡容器。padding + gap 构成「桌面留白」，子卡（编辑器 /
 * 结果视图）互不贴边。min-height: 0 保证子区域可收缩并内部滚动；
 * position: relative 是感知加载态进度条（.result-progress，main.css）的
 * 定位上下文。
 */
.workbench {
  flex: 1 1 auto;
  display: flex;
  gap: 12px;
  min-height: 0;
  padding: 12px 16px;
  position: relative;
}

/*
 * 结果态包裹层：纸卡（白面 + 发丝边 + 大圆角 + 轻阴影）。顶部承载「两侧
 * 相同」等提示条（卡内首行），下方结果视图占满剩余空间（滚动容器在
 * .result-view 内部）。overflow: hidden 让圆角裁掉行底色直角。
 */
.result-stage {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color, #e8e4dc);
  border-radius: var(--radius-l, 12px);
  background-color: var(--surface, #ffffff);
  box-shadow: var(--shadow-1);
  overflow: hidden;
}

/* 结果视图：占满工作台（单一滚动容器在组件内部） */
.result-view {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

/*
 * 结果态错误块：纸卡内居中呈现失败原因（标题 + 类别主文案 + 追加详情行 +
 * 动作区）；标题陶土红、正文次级暖灰，安静不刺眼。
 */
.result-error {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 24px;
  text-align: center;
}

.result-error-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--danger-color, #b3563e);
}

.result-error-text {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary, #8a8377);
}

/* 错误块追加详情行：比主文案再弱一档，等宽字体承载「大小 / 上限」数字 */
.result-error-detail {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 12px;
  color: color-mix(in srgb, var(--text-secondary, #8a8377) 85%, transparent);
}

/* 错误块动作区：与文案拉开间距 */
.result-error-actions {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/*
 * 编辑器 pane：纸卡（同 .result-stage 的白面 + 发丝边 + 圆角 + 轻阴影）。
 * 两卡之间的呼吸感由 .workbench 的 gap 提供（原 1px 分隔线取消）。
 * position: relative 是拖拽覆盖层（.drop-overlay）的定位上下文。
 */
.editor-pane {
  flex: 1 1 50%;
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
  border: 1px solid var(--border-color, #e8e4dc);
  border-radius: var(--radius-l, 12px);
  background-color: var(--surface, #ffffff);
  box-shadow: var(--shadow-1);
  overflow: hidden;
}

/* pane 头部：标题居左、按钮居右（发丝下边线，卡内首行） */
.pane-header {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 10px 5px 14px;
  font-size: 12px;
  line-height: 20px;
  border-bottom: 1px solid var(--divider-color, #edeae3);
}

/* 标题弱化：opacity 只作用于文案本身，避免连带按钮一起变淡 */
.pane-title {
  color: var(--text-color, #2e2c28);
  opacity: 0.72;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* pane 头部右侧动作组：编码选择器 + 打开文件 + 粘贴 */
.pane-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

/* 编码选择器外层定宽（88px）：候选最长「UTF-16」+ 箭头足够 */
.pane-encoding {
  flex: none;
  display: inline-flex;
  width: 88px;
  min-width: 0;
}

/* 编辑器挂载区域：内容自身滚动（CodeMirror 的 .cm-scroller） */
.pane-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

/*
 * 拖拽覆盖层：半透明暖白遮罩 + 主色虚线框 + 居中主色徽标文案。
 * pointer-events: none 是防闪烁的配套措施（覆盖层不参与拖拽命中测试，
 * 其插入 / 移除不会扰动 enter/leave 深度计数）。
 */
.drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 2px dashed color-mix(in srgb, var(--primary-color, #4e7a60) 70%, transparent);
  border-radius: inherit;
  background-color: color-mix(in srgb, var(--surface, #ffffff) 85%, transparent);
  pointer-events: none;
}

.drop-overlay-label {
  padding: 6px 14px;
  border-radius: var(--radius-m, 8px);
  font-size: 13px;
  font-weight: 600;
  color: var(--primary-color, #4e7a60);
  background-color: color-mix(in srgb, var(--primary-color, #4e7a60) 10%, var(--surface, #ffffff));
  box-shadow: var(--shadow-1);
}

/*
 * 底部操作区：三列 grid（1fr auto 1fr）保证主按钮恒居中。
 * 左列 = 统计徽标条（+N/−M/~K/H 处差异 pill，错误时为错误摘要）；
 * 右列 = hunk 导航按钮组（▲ 上一处 / 位置 / ▼ 下一处）。
 */
.action-bar {
  flex: none;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-top: 1px solid var(--border-color, #e8e4dc);
  background-color: var(--bg-color, #f7f5f1);
}

/* 左右列容器：min-width: 0 允许统计条在窄窗下收缩裁切，不挤偏居中按钮 */
.action-bar-side {
  min-width: 0;
  display: flex;
  align-items: center;
}

.action-bar-side-end {
  justify-content: flex-end;
}

/* 统计条容器：小字号一行，轻底圆角（错误摘要为陶土红文案） */
.result-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  white-space: nowrap;
  padding: 3px 10px;
  border-radius: var(--radius-m, 8px);
  font-size: 12px;
  background-color: var(--hover-bg, #f2f0ea);
}

.result-summary.is-error {
  color: var(--danger-color, #b3563e);
  font-weight: 600;
}

/*
 * 统计徽标：pill 形 + 等宽字体（数字对齐、与 diff 视图同字体族）。
 * 各徽标底色由自身文字色透明化派生（color-mix）—— 浅色是淡彩、深色是暗彩，
 * 随 token 自动适配主题，无硬编码色值。
 */
.stat-pill {
  flex: none;
  padding: 1px 8px;
  border-radius: 999px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
}

.stat-pill.is-add {
  color: var(--diff-add-text, #3f6d4b);
  background-color: color-mix(in srgb, var(--diff-add-text, #3f6d4b) 10%, transparent);
}

.stat-pill.is-del {
  color: var(--diff-del-text, #96482f);
  background-color: color-mix(in srgb, var(--diff-del-text, #96482f) 10%, transparent);
}

/* ~K 修改对徽标：浅雾蓝（信息语义，与 hunk 头同族色相） */
.stat-pill.is-mod {
  color: var(--accent-blue, #5e86a8);
  background-color: color-mix(in srgb, var(--accent-blue, #5e86a8) 10%, transparent);
}

/* 「H 处差异」计数徽标：中性弱化，让 +/− 数字成为视觉重心 */
.stat-pill.is-count {
  color: var(--text-secondary, #8a8377);
  background-color: color-mix(in srgb, var(--text-secondary, #8a8377) 12%, transparent);
  font-family: inherit;
  font-weight: 500;
}

/*
 * hunk 导航组（右列）：▲/▼ 按钮 + 位置文案。位置用等宽字体与
 * tabular-nums，跳转时数字宽度稳定不抖动。
 */
.hunk-nav {
  display: flex;
  align-items: center;
  gap: 6px;
}

.hunk-nav-arrow {
  font-size: 10px;
  line-height: 1;
}

.hunk-nav-position {
  min-width: 36px;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary, #8a8377);
  overflow: hidden;
  white-space: nowrap;
}
</style>

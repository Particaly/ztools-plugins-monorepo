# Home Editor 模块化迁移 Roadmap

> 文档定位：本文件用于规划 `src/views/home/index.vue` 的模块化、解耦化、生命周期化迁移。
>
> 范围：仅覆盖 Home Editor 编辑器运行时与相关工作流，不覆盖业务功能扩展立项。
>
> 现状判断：当前已经完成了一些 composable 拆分，但 `index.vue` 仍承担了编辑器主控职责，包括 Fabric 画布生命周期、文档与画板切换、历史记录、选区同步、直接编辑、导入导出、快捷键、预览/检查/图层等多个领域，导致状态边界不清、依赖方向混杂、文件持续膨胀。

---

## 1. 迁移目标

本次迁移的核心目标不是“继续把函数搬出去”，而是把编辑器改造成**壳层 + 运行时 + 模块**的结构。

### 1.1 最终目标

1. `src/views/home/index.vue` 退化为页面壳层，只负责：
   - 组件布局
   - 事件绑定
   - 将 UI 事件转发给编辑器命令
   - 从编辑器选择器中读取展示数据
2. 编辑器核心由 `EditorRuntime` 统一管理生命周期：
   - create
   - mount
   - canvas ready
   - document ready
   - dispose
3. 每个模块只负责一个明确领域，避免跨领域直接读写彼此内部状态。
4. 任何新功能优先落到模块内部，而不是继续回填到 `index.vue`。
5. 最终形成可持续演进的松散耦合结构，而不是把一个万行文件拆成几个互相缠绕的千行文件。

### 1.2 成功标准

迁移完成后，应满足以下标准：

- `index.vue` script 目标控制在 **1000 ~ 1500 行以内**。
- 画布初始化、事件绑定、销毁不再散落在视图组件中。
- 文档、画板、历史、选区、直接编辑、导入导出、快捷键等具备独立模块边界。
- 模块之间通过显式上下文、命令接口、只读选择器或受控事件通信，不允许无边界互相调用内部 helper。
- 任一模块可以单独定位、替换、扩展，不需要通读整个编辑器文件。
- 每一轮迁移都能保持现有功能可用，禁止大爆炸重写。

---

## 2. 非目标与约束

### 2.1 非目标

以下内容不属于本轮 roadmap 的目标：

- 不重写现有 UI 组件体系。
- 不替换 Fabric / PathKit 技术栈。
- 不顺带做大规模视觉改版。
- 不因为架构调整而同时引入大量新功能。
- 不追求“绝对通用”的编辑器框架，优先服务当前项目。

### 2.2 约束

- 必须采用**渐进式迁移**，每个任务结束后都应能独立运行。
- 迁移过程中优先保持现有行为一致，避免用户可见回归。
- 高复杂区域（点编辑、线段编辑、端点吸附、万花筒、布尔预览）禁止一次性整块重写。
- 所有模块化改造都要以“谁拥有状态、谁负责生命周期、谁暴露命令”为准，不以“文件大小平均分配”为准。

---

## 3. 目标架构

## 3.1 分层模型

建议将编辑器重构为以下 5 层：

### A. Shell View 层

建议保留 `src/views/home/index.vue` 作为壳层组件，仅负责：

- 页面布局
- 组件插槽与 props 传递
- `v-model` / UI 事件转发
- 连接运行时暴露出的 selectors / commands

### B. Runtime 层

负责编辑器启动与关闭的统一编排：

- 创建共享上下文
- 注册模块
- 驱动 mounted / unmounted 生命周期
- 按顺序初始化 canvas / document / listeners
- 统一 dispose 顺序

### C. State / Context / Services 层

沉淀编辑器共享基础设施：

- `EditorContext`：模块可访问的共享上下文
- `EditorStore`：统一状态容器
- `EditorServices`：文件系统、剪贴板、窗口事件、通知等外部能力封装
- `EditorCommands`：对 UI 暴露的稳定命令接口
- `EditorSelectors`：对 UI 暴露的只读派生状态

### D. Domain Modules 层

按领域划分模块，例如：

- canvas
- workspace（document / artboard / history / draft）
- selection
- direct-edit
- assets-import
- export-delivery
- shortcuts
- inspection-preview
- layers

### E. Adapter / Bridge 层

将模块内部状态投影给面板组件：

- PropertiesPanel adapter
- LayersPanel adapter
- PreviewPanel adapter
- ChecksPanel adapter
- HomeTopBar adapter

这一层的职责是“给 UI 提供稳定数据形状”，而不是承载业务本体。

## 3.2 生命周期模型

建议统一为以下生命周期：

1. **create runtime**：创建共享 store / services / refs
2. **register modules**：注册各领域模块
3. **mount runtime**：建立全局监听与运行时资源
4. **canvas ready**：Fabric canvas 可用，允许模块绑定 canvas 事件
5. **document ready**：初始快照、草稿恢复、首个文档可用
6. **dispose**：按相反顺序释放事件、计时器、canvas、临时对象

## 3.3 通信约束

模块之间应优先采用以下通信方式：

1. **selectors**：读取其他模块公开的只读状态
2. **commands**：调用其他模块公开的显式命令
3. **lifecycle hooks**：在统一阶段做注册和清理
4. **受控事件**：仅在确有必要时使用 typed event channel

禁止继续扩散以下模式：

- 一个模块直接写另一个模块的 reactive 对象
- 大量 `syncXxx / refreshXxx / applyXxx` 跨模块散射传参
- 通过页面顶层变量隐式共享内部状态

---

## 4. 建议目录结构

以下是建议方向，可在实施时微调：

```text
src/views/home/
  index.vue
  editor/
    runtime/
      createEditorRuntime.ts
      editorContext.ts
      editorServices.ts
      editorLifecycle.ts
      editorTypes.ts
    state/
      editorStore.ts
      editorSelectors.ts
      editorCommands.ts
    modules/
      canvas/
      workspace/
      selection/
      direct-edit/
      assets-import/
      export-delivery/
      shortcuts/
      inspection-preview/
      layers/
    adapters/
      useHomeTopBarAdapter.ts
      usePropertiesPanelAdapter.ts
      useLayersPanelAdapter.ts
      usePreviewPanelAdapter.ts
      useChecksPanelAdapter.ts
```

原则：

- `runtime` 负责生命周期；
- `state` 负责共享状态与对外接口；
- `modules` 负责具体领域；
- `adapters` 负责把领域模型翻译给 Vue 组件。

---

## 5. 迁移原则

### 5.1 以纵向切片迁移，不做大爆炸重写

每个任务都应选择一个完整职责切片，迁走后立即收口，不保留“双主控”。

### 5.2 先立边界，再搬代码

优先建立模块契约、生命周期和命令接口，再迁移具体逻辑；否则只是换个目录继续耦合。

### 5.3 以状态所有权为拆分依据

谁拥有状态，谁负责：

- 初始化
- 更新
- 清理
- 对外暴露读写接口

### 5.4 每迁一次都做回归验证

每个任务完成后至少验证：

- 画布可正常初始化
- 选区与属性面板同步正常
- 撤销重做不损坏
- 打开 / 保存 / 自动草稿正常
- 导入 / 导出主流程正常
- 直接编辑主路径正常

### 5.5 不以 composable 数量为目标

目标是降低耦合，不是增加文件数。一个模块可以由多个文件组成，但必须拥有清晰边界。

---

## 6. 任务总览

| 编号 | 任务 | 优先级 | 状态 | 依赖 | 核心产出 |
| --- | --- | --- | --- | --- | --- |
| T4.1 | 建立 EditorRuntime 与模块生命周期骨架 | P0 | 未开始 | - | runtime、module contract、统一 mount/dispose |
| T4.2 | 收敛共享状态、命令与选择器边界 | P0 | 未开始 | T4.1 | editor store、commands、selectors |
| T4.3 | 拆出 Canvas Kernel 模块 | P0 | 未开始 | T4.1、T4.2 | canvas 初始化、事件绑定、主题、缩放、自适应 |
| T4.4 | 重组 Workspace 模块 | P0 | 未开始 | T4.2、T4.3 | document / artboard / history / draft 统一归口 |
| T4.5 | 拆出 Selection / Inspector / Layers 投影模块 | P1 | 未开始 | T4.2、T4.3 | active object、属性投影、图层同步 |
| T4.6 | 拆出 Direct Edit 交互模块 | P1 | 未开始 | T4.3、T4.5 | 点编辑、线段编辑、端点吸附、万花筒编辑 |
| T4.7 | 拆出 Assets / Import 工作流模块 | P1 | 未开始 | T4.3、T4.4 | SVG、图片、Iconify、模板、用户素材导入 |
| T4.8 | 拆出 Export / Clipboard / Shortcut 工作流模块 | P1 | 未开始 | T4.4、T4.7 | 导出、复制、快捷键、弹窗编排 |
| T4.9 | 收口 Shell 层并完成回归治理 | P0 | 未开始 | T4.1-T4.8 | `index.vue` 瘦身、死代码清理、稳定性验证 |

---

## 7. 详细任务拆分

### T4.1 建立 EditorRuntime 与模块生命周期骨架

- **优先级**：P0
- **状态**：未开始
- **完成日期**：-
- **目标**：先把“谁负责启动与销毁编辑器”这件事从 `index.vue` 中抽离出来，建立统一运行时骨架。
- **建议拆分**：
  - 定义 `EditorContext`、`EditorServices`、`EditorModule`、`EditorRuntime` 基础类型
  - 建立模块注册机制与初始化顺序
  - 将 `onMounted` / `onBeforeUnmount` 主编排迁入 runtime
  - 将全局资源清理流程统一到 runtime dispose
- **验收标准**：
  - 页面组件不再直接负责编辑器整体初始化与销毁
  - runtime 可以明确控制 mounted / dispose 顺序
  - build 通过，现有页面可正常打开编辑器
- **计划产出**：
  - `editor/runtime/*`
  - 首页壳层最小化 bootstrap 接线

### T4.2 收敛共享状态、命令与选择器边界

- **优先级**：P0
- **状态**：未开始
- **完成日期**：-
- **依赖**：T4.1
- **目标**：把目前散落在页面中的共享 refs、computed、helper 调用，收拢为统一的 store / commands / selectors 边界。
- **建议拆分**：
  - 梳理哪些状态属于 canvas、workspace、selection、dialogs、preview、checks
  - 建立只读 selectors，避免 UI 直接消费底层对象细节
  - 建立 commands 层，替代模板直接调用大量内部函数
  - 为模块间通信建立明确的最小公共接口
- **验收标准**：
  - 页面模板不再直接依赖大量内部 helper
  - 至少形成一套统一的 `commands` 和 `selectors` 暴露面
  - 新模块接入时不需要继续往页面顶层塞全局变量
- **计划产出**：
  - `editor/state/editorStore.ts`
  - `editor/state/editorCommands.ts`
  - `editor/state/editorSelectors.ts`

### T4.3 拆出 Canvas Kernel 模块

- **优先级**：P0
- **状态**：未开始
- **完成日期**：-
- **依赖**：T4.1、T4.2
- **目标**：抽离 Fabric canvas 相关基础设施，让“画布本身”成为独立模块，而不是页面私有实现细节。
- **建议拆分**：
  - 迁移 canvas 创建、销毁、尺寸同步、背景同步、主题同步
  - 迁移 resize / fit-in-view / ruler / pixel-grid / keyline 基础编排
  - 迁移对象 added / removed / moving / rotating 等基础事件绑定
  - 迁移对齐辅助线与 canvas 级监听初始化
- **验收标准**：
  - `fabricCanvas` 的创建、销毁和基础监听由 canvas 模块统一负责
  - 页面或其他模块通过 context 获取 canvas 能力，而非持有初始化细节
  - 缩放、自适应、主题、网格、安全区行为保持可用
- **计划产出**：
  - `editor/modules/canvas/*`

### T4.4 重组 Workspace 模块

- **优先级**：P0
- **状态**：未开始
- **完成日期**：-
- **依赖**：T4.2、T4.3
- **目标**：将现有 document / artboard / history / draft 统一收口，形成一个真正拥有工作区状态的模块。
- **建议拆分**：
  - 将 `useHomeDocument`、`useHomeArtboards` 从“回调拼装”升级为 workspace 内部子域
  - 统一 new / open / save / autosave / restore-draft / snapshot / undo / redo 生命周期
  - 将 project load / save 后的 canvas 恢复流程收敛为 workspace 标准入口
  - 明确 workspace 对外暴露的只读状态与命令接口
- **验收标准**：
  - 文档、画板、历史、草稿不再依赖大量页面回调注入
  - 打开工程、切换画板、撤销重做仍保持稳定
  - workspace 能独立解释“当前文档状态”而不是由页面拼装
- **计划产出**：
  - `editor/modules/workspace/*`

### T4.5 拆出 Selection / Inspector / Layers 投影模块

- **优先级**：P1
- **状态**：未开始
- **完成日期**：-
- **依赖**：T4.2、T4.3
- **目标**：把“当前选中了什么、面板应该显示什么、图层列表如何同步”从页面中拆出去。
- **建议拆分**：
  - 迁移 active object、objProps、selection mode、右侧面板派生状态
  - 迁移图层列表构建、搜索、右键菜单状态、可操作性判断
  - 将面板展示数据改为由 adapter/selectors 统一投影
  - 将对齐、分布、布尔可用性、轮廓转换可用性等判断内聚
- **验收标准**：
  - PropertiesPanel、LayersPanel 的核心数据不再从页面零散拼接
  - 选区变更时，属性面板和图层面板同步仍正确
  - canXxx 类型判断收敛到 selection / adapter 层
- **计划产出**：
  - `editor/modules/selection/*`
  - `editor/modules/layers/*`
  - `editor/adapters/usePropertiesPanelAdapter.ts`
  - `editor/adapters/useLayersPanelAdapter.ts`

### T4.6 拆出 Direct Edit 交互模块

- **优先级**：P1
- **状态**：未开始
- **完成日期**：-
- **依赖**：T4.3、T4.5
- **目标**：把当前最重的直接编辑逻辑单独模块化，控制复杂度扩散。
- **建议拆分**：
  - 迁移点编辑、线段编辑、控制点、marquee、gesture state
  - 迁移端点吸附、曲线控制、箭头编辑等直接编辑工具链
  - 迁移万花筒编辑源与实例同步的交互编排
  - 明确 direct-edit 对 selection / canvas / workspace 的依赖边界
- **验收标准**：
  - 页面层不再持有 point / segment 编辑核心状态机
  - 点编辑、线段编辑、拖拽框选、控制点交互行为保持一致
  - 模块内部能独立完成 mount / sync / dispose
- **计划产出**：
  - `editor/modules/direct-edit/*`

### T4.7 拆出 Assets / Import 工作流模块

- **优先级**：P1
- **状态**：未开始
- **完成日期**：-
- **依赖**：T4.3、T4.4
- **目标**：把所有“把外部内容带入画布”的流程统一成资产导入模块。
- **建议拆分**：
  - 迁移 SVG 文件导入、SVG 文本导入、拖拽导入、图片导入
  - 迁移 Iconify 搜索与插入
  - 迁移模板插入、用户素材插入/保存/删除
  - 收敛导入后标准流程：归一化、命名、元数据补齐、选中、快照
- **验收标准**：
  - 导入路径统一，不再各自维护一套“加入画布后处理逻辑”
  - 模板、用户素材、Iconify、文件导入都可复用同一后处理链路
  - 页面只负责触发命令，不负责拼装导入细节
- **计划产出**：
  - `editor/modules/assets-import/*`

### T4.8 拆出 Export / Clipboard / Shortcut 工作流模块

- **优先级**：P1
- **状态**：未开始
- **完成日期**：-
- **依赖**：T4.4、T4.7
- **目标**：把“从编辑器输出内容”和“驱动用户操作”的工作流拆成独立模块。
- **建议拆分**：
  - 迁移 SVG / PNG / ZIP / 套装导出编排
  - 迁移复制为 SVG / PNG、剪贴板读写
  - 迁移快捷键配置加载、匹配、应用与冲突处理
  - 收敛导出弹窗、粘贴弹窗、快捷键抽屉等 UI 工作流命令
- **验收标准**：
  - 导出、复制、快捷键流程不再依赖页面内部私有函数网络
  - 顶栏与弹窗通过 commands 驱动工作流
  - 快捷键与导出逻辑可独立维护与扩展
- **计划产出**：
  - `editor/modules/export-delivery/*`
  - `editor/modules/shortcuts/*`
  - 对应 adapter / workflow bridge

### T4.9 收口 Shell 层并完成回归治理

- **优先级**：P0
- **状态**：未开始
- **完成日期**：-
- **依赖**：T4.1-T4.8
- **目标**：在模块都具备明确归属后，彻底把 `index.vue` 收口成壳层，并建立稳定回归基线。
- **建议拆分**：
  - 删除迁移后的死代码、重复 helper、过渡桥接代码
  - 收敛页面层仅保留模板、adapter 和 command 绑定
  - 为核心工作流补充 smoke checklist / 手工验证清单
  - 评估是否需要补充最小自动化测试入口
- **验收标准**：
  - `index.vue` 不再承担编辑器主控职责
  - `index.vue` script 显著下降到目标范围
  - 主流程验证通过：新建、打开、保存、草稿恢复、导入、导出、画板切换、撤销重做、点编辑、布尔运算、轮廓转换
- **计划产出**：
  - 壳层化后的 `index.vue`
  - 回归检查清单

---

## 8. 建议实施节奏

建议按 3 个里程碑推进，而不是按文件数量推进：

### 里程碑 M1：先把运行时框架立住

- T4.1 建立 EditorRuntime 与模块生命周期骨架
- T4.2 收敛共享状态、命令与选择器边界
- T4.3 拆出 Canvas Kernel 模块

**预期结果**：编辑器已经不再由 `index.vue` 直接驱动生命周期，后续迁移有了稳定承载层。

### 里程碑 M2：迁出核心工作区和核心交互

- T4.4 重组 Workspace 模块
- T4.5 拆出 Selection / Inspector / Layers 投影模块
- T4.6 拆出 Direct Edit 交互模块

**预期结果**：最复杂、最容易继续膨胀的核心领域完成边界收口。

### 里程碑 M3：迁出外围工作流并收口页面壳层

- T4.7 拆出 Assets / Import 工作流模块
- T4.8 拆出 Export / Clipboard / Shortcut 工作流模块
- T4.9 收口 Shell 层并完成回归治理

**预期结果**：页面层只剩 UI 壳层，后续新增功能优先落到模块内部。

---

## 9. 推荐执行顺序

如果从现在开始正式进入架构迁移，建议顺序严格按以下推进：

1. T4.1 建立 EditorRuntime 与模块生命周期骨架
2. T4.2 收敛共享状态、命令与选择器边界
3. T4.3 拆出 Canvas Kernel 模块
4. T4.4 重组 Workspace 模块
5. T4.5 拆出 Selection / Inspector / Layers 投影模块
6. T4.6 拆出 Direct Edit 交互模块
7. T4.7 拆出 Assets / Import 工作流模块
8. T4.8 拆出 Export / Clipboard / Shortcut 工作流模块
9. T4.9 收口 Shell 层并完成回归治理

不建议调整为“先拆导入导出、后立 runtime”，否则只会把现有耦合复制到新文件里。

---

## 10. 实施时的额外要求

每完成一个任务，建议同步补充以下内容：

- 主要改动文件
- 状态边界调整说明
- 新增 commands / selectors / module 接口
- 手工验证清单
- 遗留问题与下一步影响

建议后续如果要长期维护该迁移，可在任务完成后将本文件中的任务状态与完成记录持续更新。

# icon-creator

一个用于制作和导出图标的 ZTools 插件。编辑器基于 Vue 3、FabricJS 和 PathKit 构建，支持基础形状、文字、图片、图层管理、撤销重做、PNG/SVG 导出，以及矢量布尔运算。内置 MCP 工具，可让 AI 对正在打开的编辑器进行任意操作（见下方「MCP 支持」）。

## 功能

- 画布编辑
  - 新建画布
  - 画布尺寸预设
  - 背景色设置
  - 缩放查看
- 元素创建
  - 内置基础图形
  - 文字预设
  - 图片导入
- 对象编辑
  - 移动、缩放、旋转
  - 填充色、描边色、描边宽度
  - 渐变填充（线性渐变、径向渐变）
  - 透明度
  - 阴影效果（投影、内阴影）
  - 模糊效果
  - 高级变换（水平翻转、垂直翻转、倾斜）
  - 样式复制与粘贴
  - 对象锁定（锁定位置、锁定尺寸、完全锁定）
  - 锁定、解锁
  - 删除对象
- 图层管理
  - 图层列表
  - 上移、下移、置顶、置底
  - 显示/隐藏
  - 锁定/解锁（支持多种锁定模式）
  - 图层搜索
  - 锁定状态图标显示
- 编组能力
  - 成组
  - 解组
- 撤销重做
  - 基于 Fabric JSON 快照
  - 布尔运算按单次事务记录
- 导出
  - 导出 SVG
  - 导出 PNG
- 布尔运算
  - 并集
  - 交集
  - 差集
  - 异或

## 快捷键

### 编辑操作
- `Ctrl/Cmd + Z` - 撤销
- `Ctrl/Cmd + Shift + Z` 或 `Ctrl/Cmd + Y` - 重做
- `Ctrl/Cmd + C` - 复制对象
- `Ctrl/Cmd + V` - 粘贴对象
- `Ctrl/Cmd + X` - 剪切对象
- `Delete` 或 `Backspace` - 删除选中对象

### 样式操作
- `Ctrl/Cmd + Shift + C` - 复制样式
- `Ctrl/Cmd + Shift + V` - 粘贴样式

### 分组操作
- `Ctrl/Cmd + G` - 成组
- `Ctrl/Cmd + Shift + G` - 解组

### 图层操作
- `Ctrl/Cmd + ]` - 上移一层
- `Ctrl/Cmd + [` - 下移一层
- `Ctrl/Cmd + Shift + ]` - 置顶
- `Ctrl/Cmd + Shift + [` - 置底

### 对象操作
- `Ctrl/Cmd + D` - 复制并粘贴（原位复制）
- `Ctrl/Cmd + A` - 全选

## 布尔运算说明

布尔运算由 PathKit/Skia PathOps 执行，FabricJS 负责画布交互和渲染。

支持对象：

- 矩形
- 圆形
- 三角形
- 多边形
- 直线
- Path 图形

暂不支持：

- 文字对象
- 图片对象
- 成组对象

规则：

- 至少需要选中 2 个可运算对象。
- 差集以当前选区中最底层对象作为 base，其余对象作为 cutter。
- 直线、开放路径等无填充面积对象会通过描边轮廓参与运算。
- 运算结果为空时不会修改画布。

## 技术栈

- Vue 3
- Vite
- TypeScript
- FabricJS
- PathKit WASM
- ztools-ui
- Iconify
- Sass

## 项目结构

```text
.
├── public/
│   ├── logo.png
│   ├── plugin.json
│   └── preload/
│       └── services.js
├── src/
│   ├── App.vue
│   ├── main.ts
│   ├── env.d.ts
│   ├── pathkit.d.ts
│   ├── router/
│   └── views/
│       └── home/
│           ├── index.vue
│           ├── editorCatalog.ts
│           ├── mcp/
│           │   ├── mcpGatewayTypes.ts
│           │   ├── mcpOperations.ts
│           │   ├── mcpGatewayController.ts
│           │   ├── createMcpEditorGateway.ts
│           │   └── createHomeMcpModule.ts
│           ├── fabric/
│           │   └── shapeFactories.ts
│           └── geometry/
│               ├── booleanOps.ts
│               ├── fabricToPathKit.ts
│               ├── pathkit.ts
│               └── pathKitToFabric.ts
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.js
```

## 核心模块

### `src/views/home/index.vue`

编辑器主界面，负责：

- Fabric 画布初始化
- 对象选中和属性同步
- 图层操作
- 撤销重做
- 图片导入
- PNG/SVG 导出
- 布尔运算 UI 接入

### `src/views/home/editorCatalog.ts`

编辑器目录元数据，包含：

- 基础图形列表
- 图形默认尺寸
- CSS 预览类型
- 文字预设
- 画布尺寸预设

### `src/views/home/fabric/shapeFactories.ts`

Fabric 原生图形工厂。所有内置图形都由 Fabric 对象或代码内 Path 创建，不再依赖外部 SVG 资源。

### `src/views/home/geometry/pathkit.ts`

PathKit WASM 懒加载模块，负责初始化和缓存 PathKit 实例。

### `src/views/home/geometry/fabricToPathKit.ts`

将 Fabric 对象转换为 PathKit Path，并处理：

- 填充区域
- 描边轮廓
- 开放路径描边转轮廓
- `strokeUniform` 描边规则
- 对象变换矩阵

### `src/views/home/geometry/booleanOps.ts`

布尔运算入口，负责：

- 校验选区
- 按 Fabric 图层顺序排序
- 执行 union/intersect/subtract/xor
- 生成结果对象
- 替换源对象
- 保持图层和选区状态

### `src/views/home/geometry/pathKitToFabric.ts`

将 PathKit 运算结果转换回 Fabric Path。

## 开发

安装依赖：

```bash
npm install
```

启动开发服务：

```bash
npm run dev
```

构建生产版本：

```bash
npm run build
```

构建产物输出到 `dist/`。

## ZTools 配置

插件配置位于：

```text
public/plugin.json
```

当前触发命令：

```text
图标
```

开发模式入口：

```text
http://localhost:5173
```

## Preload 服务

Preload 能力位于：

```text
public/preload/services.js
```

当前主要用于：

- 保存 SVG 文件
- 保存 PNG 图片
- 读取本地文件能力扩展

前端类型声明位于：

```text
src/env.d.ts
```

## 注意事项

- 编辑器不再支持 SVG 文件导入和 SVG 代码编辑器。
- SVG 导出仍然保留，基于 Fabric `toSVG()` 输出。
- 图片可以导入和导出，但不参与布尔运算。
- 文字暂不支持转轮廓，因此不参与布尔运算。
- PathKit WASM 通过 Vite `?url` 加载，构建后会输出 wasm 资源。

## 验证清单

修改编辑器相关代码后建议执行：

```bash
npm run build
```

重点回归：

- 添加基础形状
- 添加文字
- 导入图片
- 修改填充、描边、透明度
- 移动、缩放、旋转
- 成组、解组
- 图层排序
- 删除对象
- 撤销、重做
- 导出 PNG
- 导出 SVG
- 矩形与圆形的并集、交集、差集、异或
- 直线与闭合图形的布尔运算

## MCP 支持

本插件通过 ZTools 内置的 MCP 服务对外暴露编辑器操作能力，AI 客户端（Claude Desktop、Cursor、Claude Code 等）可以直接对正在打开的图标编辑器进行任意操作。

### 开启方式

1. 在 ZTools 设置中启用 MCP 服务（默认端口 `36579`，开启后会生成 API Key）。
2. 确保本插件已安装且未被禁用 MCP 工具暴露。
3. 在 AI 客户端中配置 MCP 接入（Streamable HTTP 模式）：

```json
{
  "mcpServers": {
    "ztools": {
      "type": "http",
      "url": "http://127.0.0.1:36579/mcp?key=<你的APIKey>"
    }
  }
}
```

> 工具调用会自动唤起 ZTools 中的图标创建工具窗口（后台预加载），无需提前手动打开编辑器。

### 工具说明

插件对外暴露一个工具 `icon-creator_command_dispatcher`（实际名称以宿主聚合为准），通过 `operation` 参数路由到具体操作：

```json
{
  "operation": "add_shape",
  "args": { "shape": "circle", "x": 256, "y": 256, "width": 200, "height": 200 }
}
```

返回结构统一为 `{ ok: boolean, message?: string, data?: object }`。

### 操作清单

| 分类 | 操作 |
| --- | --- |
| 查询 | `get_overview` `list_objects` `get_object` `get_selection` `get_selection_svg` `list_artboards` `list_history` |
| 画布设置 | `resize_canvas` `set_canvas_background` `set_pixel_grid` `set_keyline` |
| 添加对象 | `add_shape` `add_text` `insert_svg` `insert_iconify_icon` `insert_icon_template` `apply_icon_template` |
| 选区 | `select_objects` `select_all` |
| 对象操作 | `set_object_props` `move_layer` `set_object_visible` `set_object_locked` `duplicate_objects` `delete_objects` `flip_object` `group_objects` `ungroup_object` |
| 历史 | `undo` `redo` `jump_to_history` |
| 工程文档 | `new_document` `save_project` `get_project_json` `load_project_json` |
| 画板 | `switch_artboard` `add_artboard` `delete_artboard` `rename_artboard` |
| 导出 | `export_svg_text` `export_png_data_url` `export_svg_file` `export_png_file` |
| 视图 | `set_viewport` |

常用参数示例：

```json
{"operation": "add_text", "args": {"text": "Hello", "preset": "title", "fill": "#2563eb"}}
{"operation": "insert_iconify_icon", "args": {"iconName": "mdi:home"}}
{"operation": "set_object_props", "args": {"objectId": "editor-object-1", "props": {"fill": "#ff0000", "angle": 45, "strokeWidth": 4}}}
{"operation": "export_png_file", "args": {"size": 512, "fileName": "my-icon", "transparentBackground": true}}
{"operation": "export_svg_text", "args": {}}
```

对象 `id` 通过 `list_objects` / `get_overview` 获取（形如 `editor-object-1`）；形状名可用短名（`circle`）或全名（`base-circle`）。

### 实现结构

```text
src/views/home/mcp/
├── mcpGatewayTypes.ts        # 网关能力接口与数据结构定义
├── mcpOperations.ts          # operation 路由表与参数校验（MCP 协议层）
├── mcpGatewayController.ts   # ztools.registerTool 挂载与生命周期
├── createMcpEditorGateway.ts # 编辑器能力适配（纯函数桥接）
└── createHomeMcpModule.ts    # 编辑器运行时生命周期模块
```

- MCP 协议层（操作名、参数、错误结构）与编辑器实现解耦，编辑器内部重构不影响对外契约。
- 操作名只增不改，保证已编排的 AI 工作流稳定。
- 编辑器窗口未就绪时调用返回友好错误（`ok: false`），不会中断 MCP 连接。

## License

MIT

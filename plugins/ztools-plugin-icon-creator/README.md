# icon-creator

一个用于制作和导出图标的 ZTools 插件。编辑器基于 Vue 3、FabricJS 和 PathKit 构建，支持基础形状、文字、图片、图层管理、撤销重做、PNG/SVG 导出，以及矢量布尔运算。

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
  - 透明度
  - 锁定、解锁
  - 删除对象
- 图层管理
  - 图层列表
  - 上移、下移、置顶、置底
  - 显示/隐藏
  - 锁定/解锁
  - 图层搜索
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

## License

MIT

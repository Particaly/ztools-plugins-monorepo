# 贡献指南

感谢你对图标编辑器项目的关注！本文档将帮助你了解如何参与项目开发。

## 开发环境

### 前置要求
- Node.js >= 16
- npm >= 8
- 代码编辑器（推荐 VS Code）

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

开发服务器会在 `http://localhost:5173` 启动。

### 构建生产版本
```bash
npm run build
```

构建产物输出到 `dist/` 目录。

## 项目架构

### 目录结构
```
src/
├── views/home/              # 编辑器主界面
│   ├── index.vue           # 主组件
│   ├── useHomeEditorRuntime.ts  # 核心编辑器逻辑
│   ├── editorCatalog.ts    # 形状、文字、画布预设
│   ├── types.ts            # TypeScript 类型定义
│   ├── components/         # UI 组件
│   │   ├── panels/        # 面板组件（属性、图层等）
│   │   ├── modals/        # 模态对话框
│   │   └── ...
│   ├── fabric/            # Fabric.js 相关
│   │   ├── objectMetadata.ts  # 对象元数据管理
│   │   ├── shapeFactories.ts  # 形状工厂
│   │   └── ...
│   ├── editor/            # 编辑器模块
│   │   └── modules/       # 功能模块（导出、布尔运算等）
│   └── geometry/          # 几何运算
│       ├── booleanOps.ts  # 布尔运算
│       ├── pathkit.ts     # PathKit WASM 加载
│       └── ...
```

### 核心模块说明

#### `useHomeEditorRuntime.ts`
编辑器核心逻辑，包含：
- Fabric 画布初始化和管理
- 对象选中、移动、缩放、旋转等基础操作
- 撤销/重做历史管理
- 图层操作（上移、下移、显示/隐藏等）
- 样式管理（填充、描边、渐变等）
- 高级功能（阴影、模糊、蒙版、锁定等）

核心响应式状态：
- `fabricCanvas` - Fabric 画布实例
- `activeObject` - 当前选中的对象
- `objProps` - 当前对象的属性（位置、大小、样式等）
- `layers` - 图层列表

#### `fabric/objectMetadata.ts`
定义对象的扩展元数据类型：
- 渐变相关：`FillGradientMetadata`
- 阴影和模糊：`ShadowEffectsMetadata`
- 蒙版相关：`ClippingMaskMetadata`
- 万花筒：`KaleidoscopeMetadata`
- 锁定相关：通过 Fabric 原生属性实现

所有自定义属性都需要添加到 `SERIALIZED_OBJECT_PROPS` 数组中以支持保存和加载。

#### `fabric/shapeFactories.ts`
提供创建各种形状的工厂函数：
- 基础形状：矩形、圆形、三角形、多边形等
- 箭头形状：单向、双向箭头
- 复杂形状：星形、心形、拱形等

所有形状都是通过 Fabric 原生对象或可编辑路径创建，不依赖外部 SVG 资源。

#### `geometry/booleanOps.ts`
基于 PathKit (Skia PathOps) 实现的布尔运算：
- `performBooleanOperation` - 执行布尔运算的主入口
- 支持并集、交集、差集、异或
- 自动处理对象变换矩阵和描边轮廓
- 结果转换回 Fabric 对象

## 添加新功能

### 添加新形状
1. 在 `editorCatalog.ts` 中添加形状定义：
```typescript
export type ShapeId = 
  | 'base-rectangle'
  | 'base-your-shape'  // 新增

const basicShapeItems = [
  // ...
  { id: 'base-your-shape', label: '你的形状', defaultWidth: 100, defaultHeight: 100 }
]

export const shapePreviewPaths: Record<ShapeId, string> = {
  // ...
  'base-your-shape': 'M 10 10 L 50 50 ...'  // SVG 路径用于预览
}
```

2. 在 `shapeFactories.ts` 中实现形状创建函数：
```typescript
function createYourShape(item: ShapeLibraryItem) {
  // 使用 Fabric 原生对象或可编辑路径创建形状
  return editablePolygon([...points], item)
}

export function createShapeByLibraryId(id: ShapeId, item: ShapeLibraryItem) {
  switch (id) {
    // ...
    case 'base-your-shape':
      return createYourShape(item)
  }
}
```

### 添加对象元数据
如果需要为对象添加新的自定义属性：

1. 在 `objectMetadata.ts` 中定义类型：
```typescript
export type YourMetadata = {
  yourProperty?: string
  yourValue?: number
}
```

2. 添加到序列化属性列表：
```typescript
export const SERIALIZED_OBJECT_PROPS = [
  // ...
  'yourProperty',
  'yourValue'
] as const
```

3. 提供辅助函数：
```typescript
export function getYourMetadata(obj: FabricObject | null | undefined): YourMetadata | null {
  if (!obj) return null
  return obj as YourMetadata
}

export function applyDefaultYourMetadata(obj: FabricObject | null | undefined) {
  const target = getYourMetadata(obj)
  if (!target) return
  
  target.yourProperty = target.yourProperty ?? 'default'
  target.yourValue = normalizeFiniteNumber(target.yourValue, 0)
}
```

### 添加属性面板控件
在 `PropertiesPanel.vue` 中添加新的控件：

```vue
<div class="prop-group">
  <label>你的属性</label>
  <ZInput
    size="small"
    :model-value="objProps.yourProperty"
    @update:model-value="objProps.yourProperty = String($event)"
    @change="applyYourProperty"
  />
</div>
```

在 `useHomeEditorRuntime.ts` 中实现逻辑：
```typescript
function applyYourProperty() {
  const obj = activeObject.value
  if (!obj) return
  
  const metadata = getYourMetadata(obj)
  if (metadata) {
    metadata.yourProperty = objProps.yourProperty
  }
  
  obj.dirty = true
  fabricCanvas?.requestRenderAll()
  snapshot()
}
```

## 代码规范

### TypeScript
- 使用 TypeScript 编写所有代码
- 为函数参数和返回值添加类型注解
- 避免使用 `any`，必要时使用 `unknown` 或 `AnyFabricObject`
- 使用 `const` 优先于 `let`

### Vue 组件
- 使用 `<script setup>` 语法
- 使用 Composition API
- Props 和 Emits 使用 TypeScript 类型定义
- 避免在模板中编写复杂逻辑，提取为 computed 或方法

### 命名约定
- 文件名：`kebab-case`
- 组件名：`PascalCase`
- 函数和变量：`camelCase`
- 常量：`UPPER_SNAKE_CASE`
- 类型：`PascalCase`

### 注释
- 为复杂逻辑添加注释说明
- 使用 JSDoc 为公共函数添加文档
- 注释应简洁明了，说明"为什么"而不只是"做什么"

## 提交规范

### Commit Message 格式
```
<type>(<scope>): <subject>

<body>

<footer>
```

类型（type）：
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整（不影响功能）
- `refactor`: 重构（既不是新功能也不是修复）
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建工具或辅助工具的变动

示例：
```
feat: 新增剪切蒙版功能

- 新增剪切蒙版支持，可选中两个对象创建蒙版关系
- 使用 Fabric.js clipPath 实现非破坏性裁切
- 在属性面板添加创建蒙版和释放蒙版按钮
```

## 测试

### 手动测试清单
添加新功能后，请确保以下基础功能仍然正常：

- [ ] 创建和编辑基础形状
- [ ] 添加文字
- [ ] 导入图片
- [ ] 移动、缩放、旋转对象
- [ ] 修改填充色、描边色
- [ ] 成组/解组
- [ ] 图层排序
- [ ] 撤销/重做
- [ ] 保存和加载工程
- [ ] 导出 PNG/SVG
- [ ] 布尔运算

### 性能测试
- 创建 50+ 个对象测试性能
- 测试大图片（2000x2000+）的导入和导出
- 测试复杂路径的布尔运算

## 调试技巧

### 查看对象属性
在浏览器控制台中：
```javascript
// 获取选中的对象
const obj = window.__fabricCanvas?.getActiveObject()
console.log(obj)

// 查看对象的元数据
console.log(obj.editorObjectId)
console.log(obj.shadowEffects)
console.log(obj.fillGradientStops)
```

### 查看画布状态
```javascript
// 获取所有对象
const objects = window.__fabricCanvas?.getObjects()
console.log(objects)

// 导出画布为 JSON
const json = window.__fabricCanvas?.toJSON()
console.log(json)
```

### 性能分析
使用浏览器的 Performance 工具分析渲染性能：
1. 打开 DevTools → Performance
2. 开始录制
3. 执行操作（移动对象、布尔运算等）
4. 停止录制并分析

## 常见问题

### Q: 修改对象属性后画布没有更新？
A: 确保调用了 `obj.dirty = true` 和 `fabricCanvas.requestRenderAll()`。

### Q: 自定义属性保存后丢失？
A: 检查是否将属性添加到了 `SERIALIZED_OBJECT_PROPS` 数组中。

### Q: 如何调试 PathKit 布尔运算？
A: 在 `booleanOps.ts` 中添加 console.log，输出 PathKit 路径的 SVG 字符串：
```typescript
const svgPath = pkPath.toSVGString()
console.log(svgPath)
```

### Q: Fabric 对象的变换矩阵是什么？
A: 变换矩阵包含对象的位置、缩放、旋转、倾斜等信息。使用 `obj.calcTransformMatrix()` 获取。

## 发布流程

1. 确保所有测试通过
2. 更新版本号（`package.json`）
3. 更新 CHANGELOG（如果有）
4. 提交代码并创建 tag
5. 构建生产版本
6. 发布到 ZTools 插件仓库

## 获取帮助

- 查看现有代码和文档
- 阅读 [Fabric.js 文档](http://fabricjs.com/docs/)
- 阅读 [PathKit 文档](https://github.com/google/skia-pathops)
- 提交 Issue 描述问题

感谢你的贡献！

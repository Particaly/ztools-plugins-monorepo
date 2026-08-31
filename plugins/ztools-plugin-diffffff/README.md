# diffffff



## 开发

```bash
npm install
npm run dev
```

开发页面默认运行在 `http://localhost:5173`，ZTools 从
`public/plugin.json` 的 `development.main` 加载该页面。

## 构建

```bash
npm run build
```

构建脚本会完成类型检查和 Vite 页面构建，产物输出到根目录 `dist/`；`public/` 中的
清单、Logo 与 preload 会被 Vite 原样拷入 `dist/`，因此 `dist/` 就是完整插件包，
可直接整体导入 ZTools：

- `plugin.json`
- `logo.png`
- `preload/` 及其 CommonJS 声明
- `index.html` 和 `assets/` 前端资源

`public/plugin.json` 保持 `main: index.html`，与 `dist/` 内的清单一致，插件以
`dist/` 为安装包根目录时该入口直接可用。

## 真实 ZTools 测试

```bash
npm run test:e2e
```

测试会使用安装版 ZTools 和隔离数据目录加载构建产物 `dist/`，验证插件可安装、
页面已真实绘制并保存 WebContentsView 截图。按插件需求继续在
`tests/e2e/plugin.spec.js` 中增加业务断言。

## 结构

```text
public/                    插件清单、Logo 与 preload 源（构建时原样拷入 dist/）
dist/                      最终插件包（清单、Logo、preload、index.html 与前端资源）
src/                       Vue 页面源码
```

默认生成精简项目。需要保留 Hello、读文件和写文件示例时，在创建项目时传入
`--examples`。

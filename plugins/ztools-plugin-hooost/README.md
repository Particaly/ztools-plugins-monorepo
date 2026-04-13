# hooost

> 本地 hosts 环境管理工具 —— ZTools 插件

hooost 是一个 ZTools 插件，用于管理本地 hosts 文件，支持 Windows / macOS 双平台。你可以创建多套预设环境（如开发、测试、生产），一键切换，随时回滚。

## 功能特性

- **预设环境管理** — 创建、编辑、复制、删除多套 hosts 预设
- **一键切换** — 快速应用某套预设到系统 hosts
- **安全受控** — 只管理 hooost 受控区块内的条目，不会覆盖你手动添加的其他 hosts 配置
- **自动备份** — 每次切换前自动备份当前 hosts，可随时恢复
- **条目启停** — 单个 hosts 条目可以启用/禁用，无需删除
- **跨平台** — 兼容 Windows 和 macOS，自动识别系统 hosts 路径
- **DNS 刷新** — 应用预设后自动刷新系统 DNS 缓存

## 工作原理

hooost 在系统 hosts 文件中维护一段受控区块：

```text
# >>> hooost managed start
# preset: dev
127.0.0.1    api.local.test
127.0.0.1    admin.local.test
# <<< hooost managed end
```

切换环境时，只替换这段受控区块的内容，受控区块外的用户手写配置全部原样保留。

## 使用说明

1. 在 ZTools 中输入 `hosts`、`切换hosts` 或 `管理hosts` 进入插件
2. 点击「+ 新建」创建一个预设
3. 编辑预设名称和 IP/域名映射条目
4. 点击「应用」将该预设写入系统 hosts
5. 需要切换时，选择另一套预设并应用
6. 出问题时，可在右侧备份列表中恢复到之前的状态

## 权限说明

修改系统 hosts 文件需要管理员权限：

- **Windows** — 可能需要以管理员身份运行 ZTools
- **macOS** — 会弹出系统授权对话框，输入密码即可

## 项目结构

```
.
├── public/
│   ├── logo.png              # 插件图标
│   ├── plugin.json           # 插件配置
│   └── preload/
│       ├── package.json      # Preload 运行时配置
│       └── services.js       # Node.js 后端服务（hosts 读写、备份等）
├── src/
│   ├── main.ts               # 入口
│   ├── main.css              # 全局样式
│   ├── App.vue               # 根组件
│   ├── env.d.ts              # 类型声明
│   ├── types/
│   │   └── hosts.ts          # 数据类型定义
│   ├── lib/
│   │   └── hosts.ts          # 受控区块解析/合并纯函数
│   └── components/
│       ├── PresetList.vue     # 预设列表
│       ├── PresetEditor.vue   # 预设编辑器
│       └── HostsPreview.vue   # 系统信息与备份
├── index.html
├── vite.config.js
├── tsconfig.json
├── package.json
└── README.md
```

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build
```

开发服务器在 `http://localhost:5173` 启动，ZTools 会自动加载开发版本。

## 开源协议

MIT License

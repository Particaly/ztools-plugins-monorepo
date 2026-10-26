# ZTools Plugins Monorepo

所有 ZTools 插件的统一仓库。各插件源码位于 `plugins/` 目录下，每个插件保留原独立仓库的完整提交历史。

## 插件列表

| 插件 | 目录 | 说明 |
| --- | --- | --- |
| ztools-webdav-sync | [`plugins/ztools-webdav-sync`](plugins/ztools-webdav-sync) | 基于 WebDAV 的多设备文件夹同步，支持坚果云 / Nextcloud / 群晖等 |
| ztools-plugin-hooost | [`plugins/ztools-plugin-hooost`](plugins/ztools-plugin-hooost) | Hosts 编辑插件 |
| ztools-plugin-icon-creator | [`plugins/ztools-plugin-icon-creator`](plugins/ztools-plugin-icon-creator) | 图标生成插件 |
| ztools-plugin-diffffff | [`plugins/ztools-plugin-diffffff`](plugins/ztools-plugin-diffffff) | 文本对比插件 |
| ztools-plugin-text-copy | [`plugins/ztools-plugin-text-copy`](plugins/ztools-plugin-text-copy) | 文本复制插件 |
| ztools-plugin-ip-switcher | [`plugins/ztools-plugin-ip-switcher`](plugins/ztools-plugin-ip-switcher) | IP 切换插件 |
| ztools-plugin-swap-file | [`plugins/ztools-plugin-swap-file`](plugins/ztools-plugin-swap-file) | 局域网文件分享，浏览器即可浏览 / 下载 / 上传 |

## 迁移说明

各插件于 2026-10 从独立仓库（`Particaly/ztools-plugin-*` 等）迁移合并入本仓库。历史已重写到各自子目录下，查看某个插件的完整历史：

```bash
git log --oneline -- plugins/<插件目录>
```

原独立仓库自此不再接收更新，新开发请在本仓库对应插件目录内进行。

迁移过渡期如需从原仓库拉取增量改动：

```bash
git remote add <名称> https://github.com/Particaly/<原仓库>.git
git fetch <名称>
git merge --allow-unrelated-histories <名称>/main
```

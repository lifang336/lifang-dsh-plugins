# AGENTS.md — DSH 插件学习与开发

本工作区用于学习和开发 DeepSeek Harness（DSH）插件。

## 先做两件事

1. `dsh` 不在 `PATH`。先设变量：

   ```sh
   DSH="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"
   ```

2. 动手写插件前，用 `skill` 工具加载 `cordis-plugin-development`。
   它给出安装流程、可复制的模板和排查顺序。

   另外两个技能按需加载：`editing-cordis-compositions`（改 agent preset）、
   `cordis-composition-reference`（patch 方言与可安装包清单）。

## 目录

```
plugins/                   所有插件。一个目录 = 一个独立可安装的 npm 包
.agents/skills/            项目级技能，DSH 自动扫描
.agents/skills.lock.json   技能的来源与校验和
docs/dsh-notes.md          本机实测细节：环境、验证回路、全部坑
backups/                   本机 profile 快照，不入 git
```

本仓库是单体仓库，公开在 GitHub 上，名字 `lifang-dsh-plugins`。
插件之间不共享代码。某个插件要独立发布时，用
`git subtree split --prefix=plugins/<名字>` 拆出，历史保留。

## 插件模型

插件 = 一个 npm 包 + 一份 bundle patch。

- `lib/index.js` 导出 `name`、`inject`、`Config`、`apply`。
  只用命名导出，写 `export default` 会让加载器丢掉 `inject`。
- `inject` 列出依赖的 service。`apply` 用到 `ctx.tools`，就必须写 `'tools'`。
- `cordis.patch.yml` 是 bundle 层，顶层是 YAML 数组。
  `package.json` 的 `dsh.bundle.patch` 指向它。
- patch 三种形态：`{insert: [...]}` 插入新行；
  `{id, name, config}` 覆盖已有行，`config` 整体替换、不深合并；`{id, disabled}` 启停。

## 改完代码就跑

```sh
P=~/code/dsh-plugins/plugins/<插件目录>
ID=<插件 dev patch 里的 id>

"$DSH" --profile headless --patch "$P/dev.patch.yml" --dump-config        | grep -A4 "$ID"
"$DSH" --profile headless --patch "$P/dev.patch.yml" --dump-config-schema | grep -A5 "$ID"
```

两条都过，才算配置和语法没坏。**这些命令要 Full access。** 原因见 `docs/dsh-notes.md`。

跑 CLI 一律用 `headless`。`desktop` 只能由 Electron 管理，CLI 读不了它。

## 三个坑

这三条失败时都不出声，所以先记住。

1. 日志用 `console.error`。`ctx.logger` 的四个级别都不输出。
2. 不要手写 profile 文件，也不要在 profile 目录跑 pnpm。用 `dsh plugin add` 安装。
3. 本会话没有 `plugin_manager` 和 `cordis_inspect_query` 工具。走 CLI 路径。

## 工作方式

- 先做最小可运行版本，再优化。第一次安装成功前，不写预览 HTML 或设计变体。
- 修完观察到的缺陷就收尾，不做推测性的变体或可选功能。
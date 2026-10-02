# DSH 本机实测笔记

`AGENTS.md` 的配套细节。按需读取，不要整篇加载。

本文件的内容都在本机实测过。未经实测的推论已标注。

## 环境事实

| 项目 | 值 |
|---|---|
| DSH 版本 | `0.2.0-rc.2` |
| DSH 应用 | `/Applications/DeepSeek Harness.app` |
| CLI | `/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh` |
| `$DSH_HOME` | `/Users/mac/.dsh` |
| 当前 profile | `desktop`（Web GUI，仅 Electron 可管理） |
| 可用 profile | `desktop`、`headless`、`web` |
| 宿主包目录 | `/Users/mac/.dsh/profiles/node_modules/@deepseek-ai/`（240 个包，软链到 npx 缓存） |
| npx 缓存副本 | `/Users/mac/.npm/_npx/1e7f6d9597241db0/node_modules/@deepseek-ai/` |
| Node | `24.18.1` |
| GitHub CLI | `/opt/homebrew/bin/gh` 2.102.0（`brew install gh`） |

`dsh` 不在 `PATH` 中。

## 目录结构

```
dsh-plugins/                        单体仓库，公开：lifang-dsh-plugins
├── AGENTS.md                       工作区总纲（每次请求注入，保持精简）
├── docs/dsh-notes.md               本文件
├── docs/third-party/               第三方内容的许可证与归属声明
├── plugins/                        所有插件。一个目录 = 一个独立 npm 包
│   └── hello-dsh/                  最小可运行插件样板
│       ├── lib/index.js            插件本体：name / inject / Config / apply
│       ├── cordis.patch.yml        bundle 层：正式安装后由 profile 加载
│       ├── dev.patch.yml           开发 overlay：不安装，用 --patch 直接挂
│       ├── package.json            包清单：dsh.bundle.patch 指向 bundle 层
│       ├── README.md               样板的详细说明与实测记录
│       └── node_modules/@deepseek-ai/  软链到宿主包，供开发期解析
└── .agents/
    ├── skills/                     项目级技能（DSH 自动扫描）
    │   ├── cordis-plugin-development/      官方
    │   ├── editing-cordis-compositions/    官方
    │   ├── cordis-composition-reference/   官方
    │   ├── github/                         第三方：dsh-github-skills
    │   ├── gh-address-comments/            第三方
    │   ├── gh-fix-ci/                      第三方
    │   └── gh-publish/                     第三方
    └── skills.lock.json            技能的来源、版本与校验和
```

## 技能

全部放在 `.agents/skills/`，任何 profile 都能用。来源、版本与校验和见
`.agents/skills.lock.json`。

### 官方（三个）

来自 `@deepseek-ai/dsh-agent-preset@0.1.7-rc.2`。它们原先只由 `cordis`
（creator）preset 通过 `skill-filesystem` 挂载。

| 技能 | 何时加载 |
|---|---|
| `cordis-plugin-development` | 新增、启用、禁用、安装、配置或调试插件、bundle、页面、面板、工具、MCP 连接时 |
| `editing-cordis-compositions` | 创建、修改或校验 agent preset 及其他 Cordis composition 时 |
| `cordis-composition-reference` | 需要 Loader patch 方言，或需要「哪些包可安装、各自提供什么」时 |

### 第三方（四个）

来自 `dsh-github-skills@0.2.1`（Apache-2.0，**非** DeepSeek 官方）。原包以 bundle
插件形式注册这四个技能；本仓库改为复制成项目级技能，内容未做改动。上游衍生自
OpenAI Codex 的 GitHub 插件，署名与许可证随技能放在各自 `licenses/` 子目录，
另在 `docs/third-party/dsh-github-skills/` 留一份。

| 技能 | 何时加载 |
|---|---|
| `github` | 仓库 / issue / PR 的通用分诊。没有更专门的技能匹配时走这里 |
| `gh-address-comments` | 处理 PR 评审意见、未解决的 review thread |
| `gh-fix-ci` | 查或修 GitHub Actions 的失败检查 |
| `gh-publish` | 推分支、开 PR、发布改动 |

这四个技能用 `gh` CLI，也可以用本地 `git`。`gh` 已装：`/opt/homebrew/bin/gh`
（`brew install gh`）。用之前先 `gh auth login`。

### 技能目录的三条规则

1. 扫描根是 `<项目根>/.dsh/skills`（rank 100）和 `<项目根>/.agents/skills`（rank 200）。
   项目根是含 `.git` 的最近祖先；不存在 `.git` 时用当前工作目录。
2. 只发现 `<根>/<名字>/SKILL.md` 和 `<根>/<名字>.md`。更深的 `SKILL.md` 不会被发现。
3. 技能目录**顶层**的 `.md` 文件会被当作技能解析。笔记不要放进 `.agents/skills/`，
   否则 DSH 会警告 `missing YAML frontmatter` 并忽略它。

技能发现是热的：新增、改名、删除都会进入下一次目录，不需要重启。

### 再同步

DSH 升级后，用 `.agents/skills.lock.json` 里的 `resync` 命令重新复制，再用 `verify` 校验。

## 验证回路

由浅入深。前一级失败时，不要进入下一级。

```sh
DSH="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"
P=~/code/dsh-plugins/plugins/hello-dsh

# ① 层叠加：确认那行进了配置树。不执行插件代码。
"$DSH" --profile headless --patch "$P/dev.patch.yml" --dump-config | grep -A4 hello-dsh-dev

# ② 模块导入 + Config schema：确认能 import、schema 能解析。不启动应用、不调模型。
"$DSH" --profile headless --patch "$P/dev.patch.yml" --dump-config-schema | grep -A5 hello-dsh-dev

# ③ 真实运行：确认工具注册成功、模型能调到。
"$DSH" --profile headless --patch "$P/dev.patch.yml" \
  "调用 hello_echo 工具，text 传「插件跑通了」，times=2。只回复工具返回值。"

# ④ 正式安装到 profile，之后不带 --patch 启动也会加载。
"$DSH" plugin --profile headless add "$P"
```

第 ③ 步的 stderr 会打印 `[hello-dsh] loaded (...)`。这是「插件是否被加载」的确认信号。
第 ③ 步的预期输出是 `你好｜插件跑通了 插件跑通了`（见 `plugins/hello-dsh/README.md`）。

### 沙箱要求：四步都要 Full access

这不是插件的问题。

- ①②③ 会启动 profile。`prepareProfile` 每次都重写
  `~/.dsh/profiles/<name>/cordis.yml`。原因写在代码注释里：整棵树都是 patch 层，
  而 Loader 会把当前树回写进这个文件；不重写会导致下次启动重复叠加每个 bundle 的 insert。
  在 workspace-write 文件策略下报：

  ```
  EPERM: operation not permitted, open '/Users/mac/.dsh/profiles/headless/cordis.yml'
  ```

- ④ 不重写 `cordis.yml`（`dsh plugin` 走 `@deepseek-ai/dsh-plugin-manager/operations`）。
  它在 profile 目录里跑 pnpm 并改该目录的 `package.json`。
  当前的 workspace-write 策略拒绝一切工作区外的写入，所以 ④ 也会被挡住，
  但报错形态不同。

只读的替代做法：用文件读取工具直接看 `lib/index.js` 和 patch 文件。

## 已知坑

写法有分工：`AGENTS.md` 只放「失败时不出声」的触发条件，也就是那三条。
这里是完整清单，含报错原文和修法。改一条坑时，两处一起看。

1. **`ctx.logger` 不输出。** 据 `hello-dsh` 实测记录，本机默认配置下
   `ctx.logger('x')` 的 `debug`/`info`/`warn`/`error` 都不进 stderr。
   要确认加载，用 `console.error`。原因未查明。
2. **`desktop` profile 不能由 CLI 读取。**
   `dsh --profile desktop --dump-config` 报
   `profile "desktop" is managed exclusively by the Electron application`。
   要跑 CLI 验证，请用 `headless` 或 `web`。
3. **开发期要软链宿主包。** 插件源码 `import` 宿主包时，Node 从插件目录向上找
   `node_modules`。缺链接就报模块找不到。补法：

   ```sh
   cd ~/code/dsh-plugins/plugins/hello-dsh
   mkdir -p node_modules/@deepseek-ai
   for p in dsh-tools schemastery cordis dsh-session; do
     ln -sfn ~/.dsh/profiles/node_modules/@deepseek-ai/$p node_modules/@deepseek-ai/$p
   done
   ```

   正式安装后不需要这样做：pnpm 会把包放进 `~/.dsh/profiles/<profile>/node_modules/`。
4. **`--patch` 里的相对路径锚定在 patch 文件旁。** 所以 `dev.patch.yml` 写
   `name: ./lib/index.js` 就能指向源文件。改代码不用重装，也不用打包。
5. **不要手写 profile 文件。** 不要直接改 `~/.dsh/profiles/<profile>/package.json`、
   `cordis.yml` 或 `cordis.patch.yml`，也不要在该目录跑 pnpm。
   用 `dsh plugin --profile <name> add <路径>` 完成安装。
6. **插件模块只用命名导出。** 写了 `export default` 会让加载器丢掉 `inject`。

## 模型侧工具现状

本次会话中，模型侧**没有** `plugin_manager` 和 `cordis_inspect_query` 工具（已实测）。
官方技能假定这两个工具存在：

- `cordis_inspect_query` 查 Service 方法、Event 模式、Config JSON Schema、Client Slots 和主题令牌。
- `plugin_manager` 的 `install_bundle` 动作负责安装 bundle。

因此本工作区以 CLI 路径为准。一旦这两个工具可用，优先用它们：
`cordis_inspect_query` 不需要审批，且它的结果决定下一步。

## 查资料的正确顺序

1. **包本体**：`/Users/mac/.dsh/profiles/node_modules/@deepseek-ai/<包名>/`。
   `README.md` 讲用途；`lib/index.js` 和 `lib/types/**/*.d.ts` 是构建产物，带 JSDoc。
   装的包里没有 `src/`。
2. **配置树**：`"$DSH" --profile <name> --dump-config`（需要 Full access）。
3. **随包发布的 patch**：
   `@deepseek-ai/dsh-base/cordis.patch.yml` 定义 host 平面行；
   `@deepseek-ai/dsh-web-app/cordis.patch.yml` 定义 Web 行并禁用一部分；
   `@deepseek-ai/dsh-web-app/presets/{standard,ptc,minimal,cordis}.patch.yml`
   列出各 preset 启用的行。默认 preset 是 `standard`。
4. **桌面版的应用代码在 `app.asar` 里。** shell 命令打不开它。文件读取工具可以读。
   npx 缓存副本可以用 shell 读，适合做代码级排查。
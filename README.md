# lifang-dsh-plugins

我自用和学习的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）插件仓库。

形式是**单体仓库**：`plugins/` 下一个目录一个插件，每个插件都是独立可安装的
npm 包。插件之间不共享代码。某个插件要单独发布时，用
`git subtree split --prefix=plugins/<名字>` 拆出去，历史保留。

## 目录

```
plugins/                          所有插件。一个目录 = 一个独立 npm 包
plugins/hello-dsh/                最小可运行样板
.agents/skills/                   项目级技能，DSH 自动扫描
.agents/skills.lock.json          技能的来源、版本与校验和
docs/dsh-notes.md                 本机实测细节：环境、验证回路、已知坑
docs/third-party/                 第三方内容的许可证与归属
AGENTS.md                         给 Agent 的工作区总纲
```

## 插件

| 插件 | 包名 | 说明 |
|---|---|---|
| [hello-dsh](plugins/hello-dsh/) | `dsh-plugin-hello` | 最小可运行样板。注册一个 `hello_echo` 工具，演示 `name` / `inject` / `Config` / `apply` 四件套 |

## 技能

`.agents/skills/` 里装了 7 个项目级技能。DSH 打开本工作区时自动扫描，不需要重启。

**官方（3）**，来自 `@deepseek-ai/dsh-agent-preset`（MIT）：

| 技能 | 用途 |
|---|---|
| `cordis-plugin-development` | 写、装、配、调 DSH 插件 |
| `editing-cordis-compositions` | 改 agent preset 与其他 Cordis composition |
| `cordis-composition-reference` | Loader patch 方言；可安装包清单 |

**第三方（4）**，来自 [`dsh-github-skills`](https://github.com/Starfie1d1272/dsh-github-skills)
（Apache-2.0，非 DeepSeek 官方）：

| 技能 | 用途 |
|---|---|
| `github` | 仓库 / issue / PR 的通用分诊 |
| `gh-address-comments` | 处理 PR 评审意见 |
| `gh-fix-ci` | 查或修 GitHub Actions 的失败检查 |
| `gh-publish` | 推分支、开 PR |

这四个技能内容未做改动。它们衍生自 OpenAI Codex 的 GitHub 插件，
署名与许可证随技能放在各自的 `licenses/` 子目录，另见
[docs/third-party/dsh-github-skills/](docs/third-party/dsh-github-skills/)。

## 开发环境

```sh
# dsh 不在 PATH
DSH="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"

# 验证插件（由浅入深，前一级过了再进下一级）
P=~/code/dsh-plugins/plugins/hello-dsh
"$DSH" --profile headless --patch "$P/dev.patch.yml" --dump-config        | grep -A4 hello-dsh-dev
"$DSH" --profile headless --patch "$P/dev.patch.yml" --dump-config-schema | grep -A5 hello-dsh-dev
```

`gh` 用 `brew install gh` 安装，用之前先 `gh auth login`。

细节、报错原文和坑都在 [docs/dsh-notes.md](docs/dsh-notes.md)。

## 许可证

本仓库自己的插件代码：见各插件目录。

第三方内容保留原许可证：

- `.agents/skills/{cordis-plugin-development,editing-cordis-compositions,cordis-composition-reference}`
  —— `@deepseek-ai/dsh-agent-preset`，MIT。
- `.agents/skills/{github,gh-address-comments,gh-fix-ci,gh-publish}`
  —— `dsh-github-skills`，Apache-2.0，衍生自 OpenAI Codex GitHub 插件。
  完整署名见 [docs/third-party/dsh-github-skills/THIRD_PARTY_NOTICES.md](docs/third-party/dsh-github-skills/THIRD_PARTY_NOTICES.md)。

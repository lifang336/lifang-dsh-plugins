# dsh-plugin-hello

最小可运行的 DeepSeek Harness 插件样板：注册一个 `hello_echo` 工具，演示
`name` / `inject` / `Config` / `apply` 四件套。

配套教程见 Obsidian Vault：`学习/AI与Agent/DSH 插件开发入门（Java 程序员视角）.md`

## 目录结构

```
plugins/hello-dsh/
├── package.json            插件包清单（dsh.bundle.patch 指向下面的 patch）
├── lib/index.js            插件本体
├── cordis.patch.yml        「bundle 层」——正式安装后由 profile 加载
├── dev.patch.yml           「开发 overlay」——不安装，命令行直接挂
└── node_modules/@deepseek-ai/   开发期指向宿主提供的包（见下）
```

## 三级验证回路

```sh
DSH="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"
P=~/code/dsh-plugins/plugins/hello-dsh

# ① 层叠加：确认那行进了配置树（不执行任何代码）
"$DSH" --profile headless --patch "$P/dev.patch.yml" --dump-config | grep -A4 hello-dsh-dev

# ② 模块导入 + Config schema：确认代码能 import、schema 能解析（不启动应用、不调模型）
"$DSH" --profile headless --patch "$P/dev.patch.yml" --dump-config-schema | grep -A5 hello-dsh-dev

# ③ 真实跑一次：确认工具真的注册成功、模型能调到
"$DSH" --profile headless --patch "$P/dev.patch.yml" \
  "调用 hello_echo 工具，text 传「插件跑通了」，times=2。只回复工具返回值。"
# 实测输出：你好｜插件跑通了 插件跑通了
```

第 ③ 步的 stderr 会打印 `[hello-dsh] loaded (...)` —— 这就是「插件到底有没有被加载」的确认信号。

> 为什么用 `console.error` 而不是 `ctx.logger`：实测本机默认配置下
> `ctx.logger('x').debug/info/warn/error` 四个级别都不会输出到 stderr，只有 `console.error` 可见。

## 开发期的 node_modules

插件源码 `import { defineTool } from '@deepseek-ai/dsh-tools'`，Node 会从插件所在目录
向上找 `node_modules`。开发期用软链接指向宿主已经提供的那一份：

```sh
mkdir -p node_modules/@deepseek-ai
for p in dsh-tools schemastery cordis dsh-session; do
  ln -sfn ~/.dsh/profiles/node_modules/@deepseek-ai/$p node_modules/@deepseek-ai/$p
done
```

正式安装（`dsh plugin --profile <name> add <路径>`）后，pnpm 会把包放进
`~/.dsh/profiles/<profile>/node_modules/`，Node 向上走到 `~/.dsh/profiles/node_modules/`
就能解析到 `@deepseek-ai/*`，不再需要手工软链。

## 正式安装到某个 profile

```sh
cd ~/code/dsh-plugins/plugins/hello-dsh
"$DSH" plugin --profile headless add ./
```

成功后 DSH 会自动把 `dsh-plugin-hello` 追加进
`~/.dsh/profiles/headless/package.json` 的 `dsh.profile.bundles` 列表末尾。
之后不带 `--patch` 启动也会加载它。

卸载：`"$DSH" plugin --profile headless remove dsh-plugin-hello`

## 改代码

`dev.patch.yml` 里 `name: ./lib/index.js` 直接指向源文件，改完保存、重跑命令即可，
不需要重新安装，也不需要打包。

# 交接：DSH Codex 订阅登录插件

给新会话（creator 模式）的开工 prompt。以下内容在 2026-10-03 的会话里实测过。

---

## 任务

在 `~/code/dsh-plugins/plugins/` 新增一个 DSH 插件，让**桌面版**能通过
ChatGPT Plus/Pro 订阅登录，并使用 openai-codex 模型。

### 验收

1. 桌面版能完成一次 Codex 登录，之后存在 `llm-pi-ai/openai-codex` 凭据记录。
2. 模型选择器能选到 Codex 模型，并成功发出一次请求。
3. 全程不用手动编辑 `~/.dsh/.credentials.yaml`。

### 做法要求

- **最小可运行优先。** 先做「一个入口 + 登录 + 把验证码和 URL 显示给人看」。
  跑通再谈 provider 卡片按钮之类的 UI。
- 先加载 `cordis-plugin-development` 技能，再动手。

---

## 已验证的事实（不用重新调研）

### 1. 能力已经存在，缺的只是入口

`@deepseek-ai/dsh-llm-pi-ai`（entry id `llm-pi-ai`）包装 pi-ai 的 catalog provider。
它在 `lib/index.js` 的 `registerPiAiFlows(ctx, auth)`（约 2453 行）里，
**为每个带登录的 catalog provider 注册授权流程，与配置无关**：

```js
ctx.authorization.registerFlow({
  key: recordKeyFor(providerId),        // → llm-pi-ai/openai-codex
  label: provider.name,
  methods: [first, ...rest],            // oauth 优先，可能还有 api-key
  async run(session) {
    const models = createModels(auth)
    models.setProvider(provider)
    const type = session.method === 'oauth' ? 'oauth' : 'api_key'
    await models.login(providerId, type, {
      signal: session.signal,
      notify: (event) => relay(event, session),
      prompt: (prompt) => session.prompt(restate(prompt)),
    })
  },
})
```

`relay()` 把 pi-ai 的事件翻成 seam 的词汇，全部走 `session.notify`：

| pi-ai 事件 | notify 内容 |
|---|---|
| `info` | `message` + `links[0].url` |
| `auth_url` | `message`（或 "Open this page..."）+ `url` |
| `device_code` | "Enter this code..." + `verificationUri` + `userCode` |
| `progress` | `message` |
| 其他 | "Signing in…" |

`restate()` 把 prompt 翻成 `select` / `secret` / `text`，并透传 prompt 自己的 `signal`。

**所以插件不需要自己注册流程，只需要有人调用 `begin()`，并提供一个把
notice / prompt 送给人看的 interaction。**

### 2. `ctx.authorization` 的 API

来自 `@deepseek-ai/dsh-authorization`。纯宿主服务。

```ts
// 注册方
const dispose = ctx.authorization.registerFlow({ key, label, methods, run })

// 会话对象（传给 run）
session.notify({ message, url?, code? })   // 单向，永不携带密钥
session.prompt({ kind: 'text'|'secret'|'select', message, options?, placeholder?, signal? })
session.method                              // 'oauth' | 'api-key'
session.signal

// 调用方
ctx.authorization.list()                    // 所有流程 + inFlight
ctx.authorization.describe(key)
ctx.authorization.begin(key, { method?, interaction })  // → { status: 'authorized' | 'cancelled' }
ctx.authorization.cancel(key)
```

错误码：`NO_FLOW`、`ALREADY_IN_FLIGHT`、`NOT_COMMITTED`、`UNKNOWN_METHOD`。

两条关键语义：

- **interaction 跟着请求走，不在注册表里。** 谁发起 `begin()`，谁负责
  把 prompt 送到人面前。headless 调用方提供一个「一律拒绝」的 interaction。
- 流程必须在 `run()` 返回前用 `ctx.credentials` 提交记录，否则 seam 报
  `NOT_COMMITTED`。`authorized` 一定意味着记录真的写进去了。

### 3. 凭据记录格式

```js
import { credentialKey } from '@deepseek-ai/dsh-credentials'
const key = credentialKey('llm-pi-ai', 'openai-codex')

await ctx.credentials.modifyRecord(key, () => Promise.resolve({
  kind: 'grant',
  payload: { type: 'oauth', access, refresh, expires, accountId },
}))
```

`expires` 是**毫秒**时间戳。DSH 会在快到期时自动刷新。

### 4. 关键结论：客户端目前调不到 `begin()`

`@deepseek-ai/dsh-authorization` 的 package.json 只导出 `.`、`./invariant`、
`./types`、`./src/*` —— **没有 typert Remote**。

桌面版设置里的登录不是走这个 seam，而是走专用的
`@deepseek-ai/dsh-api-account-controller`（Remote 命名空间
`getState` / `startSignIn` / `cancelSignIn` / `watch` …），转发给
`dsh-deepseek-account-platform`。

**所以 client 插件今天无法直接调 `authorization.begin()`。** 这就是任务里说的
「流程注册了但没人调用」。可行入口有三种：

| 入口 | 说明 | 代价 |
|---|---|---|
| 宿主侧命令 / 工具 | 命令或模型工具里调 `begin()`，把 notice 发进会话 | 最小，先做这个 |
| 新写一个 Remote 控制器 | 仿 `dsh-api-account-controller`，让客户端能调 | 大，但才是「正确」的修法 |
| provider-card 槽按钮 | `settings.models.provider-card` 注册 UI | 需要先有 Remote 才点得动 |

### 5. 可用的扩展点（若之后要做 UI）

来自 `@deepseek-ai/dsh-client-ui-settings-models`：

- `settings.models.provider-card`（keyed 槽）：渲染在每张显示 directory 行的卡片里
  —— 已保存行的卡片、首次运行设置态、add-provider 草稿。以
  `entryKey = settingsNs` 派发，owner props 带该行的 `ConfigurableProviderView`、
  configured 状态和已确认的 api-key 凭据状态。手写草稿卡片在保存前不派发。
- `settings.models.footer`（list 槽）：渲染在所有行和 add 控件之后。
- `settings.models.sign-in`：目前只有 DeepSeek 账号注册了。

注册方式：`ctx.slots.inject` + 对该包 `/client` 入口的**类型导入**。

### 6. 还需要一条路由

`openai-codex: {}`。设置文档里 pi-ai provider 的 key 留空 = 无凭据引用 =
走 provider 原生认证（OAuth）。这就是要的效果。

---

## 环境事实

| 项目 | 值 |
|---|---|
| DSH 版本 | `0.2.0-rc.2` |
| CLI | `/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh` |
| `$DSH_HOME` | `/Users/mac/.dsh` |
| 工作区 | `~/code/dsh-plugins`（公开仓库 `lifang336/lifang-dsh-plugins`，MIT） |
| 宿主包（开发用） | `/Users/mac/.dsh/host-packages/node_modules/@deepseek-ai/` |

`dsh` 不在 `PATH`。跑 CLI 一律用 `--profile headless`；`desktop` 只能由
Electron 管理，CLI 读不了。

App 的包在 `app.asar` 里。**shell、node、pnpm、glob、grep 都打不开它。**
唯一可行的读法是让 Host 进程自己去读：

```sh
ELECTRON_RUN_AS_NODE=1 "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness" \
  your-script.mjs      # 脚本里用 node:fs 正常读 app.asar 内的路径
```

App 内置版本（对齐用）：cordis `4.0.4`、schemastery `3.18.4`、
dsh-tools / dsh-session / dsh-llm-pi-ai 均 `0.2.0-rc.2`。

---

## 已经修好的环境问题（重要）

`~/.dsh/profiles/node_modules/@deepseek-ai/` 原有 240 条软链，全部指向
npx 缓存 `~/.npm/_npx/1e7f6d9597241db0/`。**该缓存已被清空，240 条全部失效。**
症状是插件 `import '@deepseek-ai/...'` 全断，`--dump-config-schema` 里插件那行
报 `"status": "error"`，stderr 说 `Cannot find package`。

已修：宿主包改装到 `~/.dsh/host-packages/`，失效链接指回新位置，已验证可解析。
修法原文见 `docs/dsh-notes.md` 的「已知坑」第 3 条。

**如果 creator 模式下的工具也报模块找不到，先想这里。**

---

## 本工作区的规矩

- 日志只用 `console.error`。`ctx.logger` 四个级别在本机都不输出。
- 不要手写 profile 文件，不要在 profile 目录跑 pnpm。用 `dsh plugin add`
  （creator 模式下用 `plugin_manager` 的 `install_bundle`）。
- 插件模块**只用命名导出**。写 `export default` 会让加载器丢掉 `inject`。
- `--patch` 里的相对路径锚定在 patch 文件旁，所以 `name: ./lib/index.js` 直接
  指向源文件，改代码不用重装。
- 仓库约定：`plugins/<名字>/` = 一个独立可安装的 npm 包。仓库是单体仓库，
  插件之间不共享代码。

验证回路（前一级过了再进下一级）：

```sh
DSH="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"
P=~/code/dsh-plugins/plugins/<插件目录>
ID=<dev patch 里的 id>

"$DSH" --profile headless --patch "$P/dev.patch.yml" --dump-config        | grep -A4 "$ID"
"$DSH" --profile headless --patch "$P/dev.patch.yml" --dump-config-schema | grep -A5 "$ID"
```

---

## 可选：先验证链路（不是交付物）

临时把 `~/.codex/auth.json` 里的 token 桥接成一条 grant 记录，确认请求能通。

**注意**：它与 Codex CLI 共用同一个 refresh token，两边会互相踢下线。
只用来验证，验完就撤。

---

## 建议的第一步

在 creator 模式下，先做「宿主侧入口」这一条最小路径：

1. 用 `cordis_inspect_query` 确认 `authorization` 服务的 `begin()` 签名、
   `interaction` 的确切形状，以及 `credentials.modifyRecord` 的类型。
2. 查 `llm-pi-ai/openai-codex` 这个 key 的流程是否已存在
   （`ctx.authorization.describe(key)`）。
3. 写插件：一个入口（命令或工具），调 `begin()`，interaction 把
   `notify` 的 message / url / code 送到会话里；`prompt` 先用「拒绝」占位，
   跑通再看 Codex 的登录到底需不需要人工输入。
4. `plugin_manager` 装进 desktop profile，验证。

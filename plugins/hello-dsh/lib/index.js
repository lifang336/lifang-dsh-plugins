/**
 * dsh-plugin-hello —— 最小可运行的 DSH 插件样板
 *
 * 一个 Cordis 插件就是一个 ESM 模块，导出四个成员：
 *
 *   name   插件唯一标识（日志、诊断、HMR 用）
 *   inject 依赖的 service 名数组；这些 service 就绪后才会调用 apply
 *   Config 配置 schema（schemastery）；加载器在 apply 之前校验并填默认值
 *   apply  唯一入口，注册能力的动作都写在这里
 *
 * 注意：只有命名导出，没有 default export。写了 export default 反而会让加载器
 * 丢掉 inject（官方 dsh-tool-todo 的 README 明确警告过这一点）。
 */

import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'

/** 插件唯一标识。 */
export const name = 'hello-dsh'

/**
 * 声明依赖。apply 里用到 ctx.tools，就必须在这里写 'tools'，
 * 否则 ctx.tools 是 undefined —— 等价于 Spring 里漏写 @Autowired。
 */
export const inject = ['tools']

/**
 * 配置 schema。字段没有 .default() 就是必填，缺了直接拒绝加载。
 * 加载器校验通过后，apply 拿到的是已经填好默认值的普通对象。
 */
export const Config = z.object({
  greeting: z.string().default('你好'),
  upperCase: z.boolean().default(false),
})

/**
 * 插件入口。所有 service 就绪后调用一次。
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {{ greeting: string, upperCase: boolean }} config
 */
export function apply(ctx, config = {}) {
  const greeting = config.greeting ?? '你好'
  const forceUpper = config.upperCase === true

  // 「我的插件到底有没有被加载？」—— 用 console.error 打标记，它一定会出现在 stderr。
  //
  // 注意：ctx.logger('hello-dsh').info/warn/error 在本机默认配置下**不会**输出到 stderr
  // （实测四个级别全被过滤）。想快速确认加载，用 console.error。
  console.error(`[hello-dsh] loaded (greeting=${greeting}, upperCase=${String(forceUpper)})`)

  // register() 返回精确的 disposer；Cordis 也会把它挂到当前 fiber 上，
  // 插件被卸载或热重载时自动清理。等价于 @PreDestroy，但不需要你手动登记。
  ctx.tools.register(
    defineTool({
      // 模型看到的工具名。snake_case 是惯例。
      name: 'hello_echo',
      description:
        'Echo the given text back. Use this to verify that the hello-dsh plugin is loaded and working.',

      // 参数 schema：注意这是 JSON-Schema 风格的普通对象字面量，
      // 不是 zod 链式调用。必填标在属性内部（required: true），
      // 而不是外层的 required: [] 数组。
      parameters: {
        text: {
          type: 'string',
          required: true,
          description: 'The text to echo back.',
        },
        times: {
          type: 'integer',
          description: 'How many times to repeat. Defaults to 1.',
        },
        loud: {
          type: 'boolean',
          description: 'Whether to upper-case the result. Defaults to false.',
        },
      },

      // 输出契约。schema 必填且被强制执行：execute 的返回值必须匹配它。
      // 注意 object 必须显式声明 additionalProperties，没有默认值。
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            echo: { type: 'string', required: true },
            count: { type: 'integer', required: true },
          },
        },
        // render 是纯函数：把校验后的规范值转成模型看到的 ContentBlock[]。
        render: (_args, value) => [{ type: 'text', text: value.echo }],
      },

      // execute 返回的是「规范 JSON 值」，不是给模型看的文本。
      // 文本由上面的 render 决定 —— 这是 Java 程序员最容易搞混的一点。
      async execute(args, exec) {
        if (exec.signal?.aborted) throw new Error('hello_echo aborted')

        const times = args.times ?? 1
        const upper = args.loud ?? forceUpper
        const body = upper ? args.text.toUpperCase() : args.text
        const echo = Array.from({ length: times }, () => body).join(' ')

        return { echo: `${greeting}｜${echo}`, count: times }
      },

      // 只有返回字面量 true 才允许与兄弟工具调用并行，否则独占。
      isConcurrencySafe: () => true,
    }),
  )
}

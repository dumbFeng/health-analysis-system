# AI 配置

项目现在统一使用 `AI_PROVIDER_CHAIN` 配置所有 AI provider。旧的 `OPENAI_API_KEY`、`MINIMAX_API_KEY`、`GEMINI_API_KEY` 等变量仍然兼容，但不再推荐作为主配置方式。

## 推荐格式

```env
AI_PROVIDER_CHAIN=[{"provider":"gemini","model":"gemini-2.5-flash","apiKey":"your_gemini_key","baseUrl":""},{"provider":"minimax","model":"MiniMax-M2.5","apiKey":"your_minimax_key","baseUrl":"https://api.minimaxi.com/v1"},{"provider":"openai","model":"gpt-5.4-mini","apiKey":"your_openai_key","baseUrl":"https://api.openai.com/v1"}]
```

字段说明:

- `provider`: 支持 `gemini`、`minimax`、`openai`
- `model`: 当前 provider 使用的模型名
- `apiKey`: 当前 provider 的 API key
- `baseUrl`: 当前 provider 的 API 地址；没有自定义地址时填空字符串

## 执行顺序

`AI_PROVIDER_CHAIN` 是数组，系统会按顺序尝试 provider。

例如下面配置会优先尝试 Gemini，失败后再尝试 MiniMax:

```env
AI_PROVIDER_CHAIN=[{"provider":"gemini","model":"gemini-2.5-flash","apiKey":"your_gemini_key","baseUrl":""},{"provider":"minimax","model":"MiniMax-M2.5","apiKey":"your_minimax_key","baseUrl":"https://api.minimaxi.com/v1"}]
```

## 单 provider 示例

只使用 Gemini:

```env
AI_PROVIDER_CHAIN=[{"provider":"gemini","model":"gemini-2.5-flash","apiKey":"your_gemini_key","baseUrl":""}]
```

只使用 MiniMax:

```env
AI_PROVIDER_CHAIN=[{"provider":"minimax","model":"MiniMax-M2.5","apiKey":"your_minimax_key","baseUrl":"https://api.minimaxi.com/v1"}]
```

只使用 OpenAI:

```env
AI_PROVIDER_CHAIN=[{"provider":"openai","model":"gpt-5.4-mini","apiKey":"your_openai_key","baseUrl":"https://api.openai.com/v1"}]
```

## 注意事项

- `.env.local` 里的 `AI_PROVIDER_CHAIN` 必须是单行 JSON。
- JSON 字符串里的双引号不能省略。
- 修改 `.env.local` 后需要重启服务。
- 本地开发重启 `npm run dev`。
- 服务器使用 `pm2 restart health-analysis-system`。

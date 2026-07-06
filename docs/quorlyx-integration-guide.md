# Quorlyx 接入说明

## 结论

`carp-ybb` 静态前台已通过 `QuorlyxEmbed` 接入 Quorlyx；会话走 `/wp-json/quorlyx/v1/ask-ai`，依赖 `chatToken` + `wp_rest` nonce。

## 后台怎么用

WordPress 后台会新增 `Quorlyx` 菜单，重点入口是 `Settings -> Chatbot -> Variation A`。

需要配置的核心项：

- `Enable Chat Widget`
- `AI Provider`
- `API Key`
- `Model`
- `Bot Name`
- `Welcome Message`
- `Knowledge Base` 来源
- 浮动按钮位置/样式

Quorlyx 还支持：

- Conversations
- Submissions
- Content Insights
- Triggers
- Goals

## 前台怎么连

Quorlyx 的标准前台接法不是直接拼外部 AI API，而是：

1. 前台拿到 `restUrl`
2. 前台拿到短期 `chatToken`
3. 发送消息到 `POST /wp-json/quorlyx/v1/ask-ai`
4. 需要历史时调用 `POST /wp-json/quorlyx/v1/get-history`

请求头里要带：

- `X-WP-Nonce`
- `X-Quorlyx-Chat-Token`

Quorlyx 自带前端脚本就是这样做的。

## 现在的站点状态

静态前台通过 `components/chat/QuorlyxEmbed.tsx` 加载 Quorlyx：

1. `GET /wp-json/ybb/v1/quorlyx-bootstrap`（MU 插件 `ybb-quorlyx-embed.php`）
2. 注入 `style.min.css`、行内样式、`#quorlyx-root`、`quorlyxVars`
3. 加载 `frontend.min.js`，会话走 **YBB 代理** `POST /wp-json/ybb/v1/quorlyx/ask-ai`（绕过静态页无法通过 `wp_rest` cookie nonce 的限制）

原 `ChatWidget`（假 UI / localStorage）已移除。

## 后台前提

- WordPress 插件 **Quorlyx** 必须 **已启用**
- **Settings → Chatbot → Variation A** 中勾选 **Enable Chat Widget**
- 配置 AI Provider / API Key / Welcome Message

## 现有部署脚本

当前仓库已有 Quorlyx 自动化初始化链路：

- `deploy/setup-quorlyx.php`
- `scripts/deploy_quorlyx.py`
- `scripts/configure-quorlyx-grsai.py`

这条链路会：

- 上传 Quorlyx 插件到 `wp-content/plugins/quorlyx`
- 激活插件
- 写入 Variation A：**OpenAI-Compatible (Custom URL)** + `https://grsaiapi.com/v1` + `gpt-5.5`
- API Key 从 `D:\dev\workspace\scripts\_ssh-probe\payload\config.yaml` 的 `lyncr.api_key` 读取（与 GRSAI 生图同源）

**生产推荐（不用 Lyncr 中转）：**

| 项 | 值 |
|----|-----|
| AI Provider | OpenAI-Compatible (Custom URL) |
| API Base URL | `https://grsaiapi.com/v1` |
| Model | `gpt-5.5` |
| API Key | `config.yaml` → `lyncr.api_key` |

## 风险点
- 静态前台不会自动拥有 WordPress 的 `wp_footer` 注入能力。
- 只改 `ChatWidget` 外观，不接 Quorlyx API，后台不会产生真实会话数据。


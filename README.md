# dsh-system-notifications

**系统通知**（System notifications）插件：当对话回合结束或 agent 开始等待你时——授权请求、`ask-user` 提问或计划审核——即使页面在后台，浏览器也会弹出 **OS 级通知**，让你不会错过。

这是一个 **DeepSeek Harness 社区插件**（GitHub topic: `dsh-plugin`），以独立仓库发布，独立于官方 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 仓库。

## 功能

- **回合结束提醒** — 页面隐藏时，会话 agent 停止工作（`running` true→false）→ 弹"对话结束"通知。
- **待处理交互提醒** — 出现授权、提问或计划审核等待 → 弹"需要授权 / 需要回答 / 需要审核计划"通知。
- **仅后台触发** — 只有 `document.hidden` 时才弹通知，你在看页面时不会被干扰。
- **通用设置开关** — 设置 → 通用新增"系统通知"行，含启用开关和"开启系统通知"权限按钮（浏览器权限需要用户手势，按钮即入口），样式与其他偏好行一致。开关状态持久化在 `localStorage`。
- **排除子代理活动** — 内部编排回合不弹通知。

插件只监听浏览器端会话列表快照的**实时状态变化**，刷新和重连不会重放旧通知。

## 安装

在你的 dsh 配置（如 `cordis.yml`）中加入本插件：

```yaml
- id: ui-notifications
  name: '@deepseek-ai/dsh-client-ui-notifications'
```

安装依赖（需要与官方 dsh 客户端包同版本系，当前基于 `0.1.0-rc.x`）：

```sh
pnpm add @deepseek-ai/dsh-client-ui-notifications
```

然后在 dsh web GUI 的 设置 → 通用 中打开"系统通知"开关，并点击"开启系统通知"授予浏览器通知权限。

## 开发

```sh
pnpm install
pnpm --filter @deepseek-ai/dsh-client-ui-notifications bundle   # 构建 browser bundle
pnpm run test:gui                                               # 客户端测试
```

## 已知限制

- **仅浏览器 Web Notifications** — 原生桌面客户端需要自己的通知通道；本插件不超出网页范围。
- **单通道设计** — 尚无按类型（回合结束 vs 授权）的细分开关，行内只有一个总开关，后续可扩展。
- **权限由浏览器管理** — 若用户在浏览器中拒绝权限，插件无法再次弹请求；设置行会引导到浏览器设置。

## 许可

MIT

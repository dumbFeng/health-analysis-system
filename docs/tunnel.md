# 更稳定的本地隧道方案

这个项目默认跑在 `3000` 端口。为了让隧道代理更稳定地转发，本地启动脚本已经改成监听 `0.0.0.0`。

## 推荐顺序

1. 日常临时预览: `cloudflared`
2. 需要固定域名 / 长时间演示: Cloudflare named tunnel
3. 已经在用 Tailscale 团队网络: `tailscale funnel`

不太建议继续依赖 `npx` 临时拉起的隧道工具，原因通常有两类:

- 每次都是一次性进程，地址和链路都不稳定
- 免费临时域名经常被共享，WebSocket、长连接、静态资源加载更容易抖动

## 本地启动

开发模式:

```bash
npm run dev
```

生产模式预览:

```bash
npm run build
npm run start
```

如果你只是给别人看页面，优先用生产模式预览，再挂隧道。这样比把 `next dev` 直接暴露出去更稳。

## 一键分享脚本

项目里已经补了两个快捷命令:

```bash
npm run share:dev
npm run share:prod
```

区别:

- `share:dev` 会启动 `next dev`，适合边改边给别人看
- `share:prod` 会先构建再启动 `next start`，更适合稳定演示

如果只是想把已经跑起来的本地服务挂出去，也可以直接用:

```bash
npm run tunnel:quick
```

这三个脚本都依赖本机已经安装 `cloudflared`。

macOS 常见安装方式:

```bash
brew install cloudflared
```

## 方案一: cloudflared quick tunnel

适合快速分享，不需要注册临时域名。

```bash
cloudflared tunnel --url http://127.0.0.1:3000
```

建议:

- 演示页面时优先配合 `npm run build && npm run start`
- 如果页面依赖流式返回或 SSE，这个模式不适合长期使用

## 方案二: Cloudflare named tunnel

这是更推荐的长期方案。优点是:

- 域名固定
- `cloudflared` 是常驻 agent，不是每次用 `npx` 临时下载执行
- 更适合反复给测试、产品、客户访问

典型流程:

```bash
cloudflared tunnel login
cloudflared tunnel create health-demo
cloudflared tunnel route dns health-demo demo.your-domain.com
cloudflared tunnel run health-demo
```

把公网域名映射到本地服务时，常见配置目标是:

```text
http://127.0.0.1:3000
```

## 方案三: Tailscale Funnel

如果你和访问者本来就在 Tailscale 生态里，这个体验也很好。命令很直接:

```bash
tailscale funnel localhost:3000
```

限制也要注意:

- 需要先满足 Tailscale Funnel 的账号和 tailnet 条件
- 它更适合已有 Tailscale 环境，不适合零准备直接分享给外部用户

## 什么时候会出现“页面打开了但元素不完整”

这类现象通常不是前端代码本身坏了，而是下面几种链路问题:

- HTML 到了，但静态资源请求失败
- HMR / WebSocket 连接断断续续
- 反向代理对长连接或流式响应支持不完整
- 本地是 `next dev`，首次编译和增量编译期间资源返回不稳定

所以更稳的组合通常是:

```bash
npm run build
npm run start
cloudflared tunnel --url http://127.0.0.1:3000
```

## 我给你的实际建议

如果你的目标是“现在就稳定地给别人看页面”:

```bash
npm run build
npm run start
cloudflared tunnel --url http://127.0.0.1:3000
```

如果你的目标是“之后经常要发给别人测”:

- 直接上 Cloudflare named tunnel
- 给这个项目配一个固定二级域名
- 本地只负责 `npm run start`

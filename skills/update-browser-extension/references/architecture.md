# 架构索引

## 目录职责

| 路径 | 职责 |
|---|---|
| `public/manifest.json` | Manifest V3 权限、主机范围、内容脚本顺序、侧边栏入口 |
| `public/background.js` | Service Worker；右键菜单、账号连接、侧边栏打开、页面消息协调 |
| `public/content/shared.js` | 文本归一化、JD 去噪、JSON-LD、字段校验、候选合并和响应转换 |
| `public/content/adapters/*.js` | 招聘平台独立岗位提取规则 |
| `public/content/actions.js` | 表单回填与受控投递入口，不承担岗位解析 |
| `public/content/launcher.js` | Shadow DOM 悬浮入口，只负责打开侧边栏和触发当前岗位识别 |
| `public/content.js` | 适配器编排和内容脚本消息监听 |
| `src/App.vue` | 侧边栏 Agent 流程与用户状态 |
| `src/api.js` | 官网、后端和 AI 接口封装 |
| `tests/extractor.test.mjs` | 岗位提取、防串岗和去噪回归 |
| `tests/launcher.test.mjs` | 悬浮入口消息、状态和重复注入生命周期回归 |
| `tests/launcher-preview.html` | 不进入构建产物的悬浮入口人工视觉验收页 |
| `prd/AI简历浏览器扩展-PRD.md` | 当前唯一插件产品需求事实 |

## 运行链路

```text
招聘网页
  -> launcher / 右键 / 侧边栏按钮
  -> background service worker
  -> 按 manifest 顺序注入 content modules
  -> 平台 adapter + structured JobPosting
  -> shared normalize / validate / merge
  -> storage.session pendingJob
  -> Vue Side Panel
  -> backend extension API / AI match
  -> extension_saved_job
  -> 网页端“我的收藏”
```

## 提取策略

1. `structured.js` 收集页面中的 `JobPosting` JSON-LD。
2. 当前域名的平台适配器只在明确岗位容器中提取字段。
3. `shared.js` 对标题一致性、字段格式、JD 长度和噪音边界进行校验。
4. 平台候选和结构化候选仅在岗位标题一致时合并。
5. 两者不可用时，`generic.js` 只在语义岗位容器足够明确时回退；否则返回错误。

## 模块边界

- 不在 `App.vue` 写 DOM 选择器。
- 不在平台适配器调用后端或操作侧边栏。
- 不在 `background.js` 复制清洗与平台识别逻辑。
- 不在 `actions.js` 自动点击最终提交按钮。
- Manifest 和 `CONTENT_FILES` 的文件顺序必须完全一致，由契约脚本检查。

# 当前状态

更新日期：2026-09-28
扩展版本：2.0.0  
浏览器要求：Chrome 116+，Manifest V3  
分发方式：官网 ZIP 下载后以开发者模式加载 `dist` 目录

## 已实现

- Vue 3 + Ant Design Vue 侧边栏，工具栏图标、右键菜单和按需注入的招聘页面悬浮入口均可打开。
- 已登录网页账号可通过一次性授权码连接插件；插件只保存受限访问令牌。
- 用户点击工具栏图标、右键菜单、页面悬浮入口或侧边栏识别按钮后读取当前岗位；未触发时不注入招聘站点脚本、不观察或轮询页面。标签切换和页面导航只清除旧岗位上下文，SPA 内容变化由用户手动刷新识别。
- 提取岗位、公司、城市、详细地址、薪资、技能、完整 JD、平台和原岗位链接。
- 基于用户选定简历执行岗位匹配，展示分数、优势、缺口、建议和沟通开场白。
- 收藏岗位并回流网页端“我的收藏”；同一完整原岗位地址再次收藏时更新已有记录，不按 pathname 合并查询参数中的不同岗位。侧边栏会同步当前岗位收藏状态，可二次确认后原地取消收藏。
- 受控回填申请表；BOSS 等平台可打开可见的“立即沟通/立即投递”入口，但不自动完成最终提交。
- 支持 Chrome 右键识别、收藏和回填快捷操作。

## 平台覆盖

| 平台 | 适配器 |
|---|---|
| BOSS 直聘 | `public/content/adapters/zhipin.js` |
| 前程无忧 51job | `public/content/adapters/51job.js` |
| 智联招聘 | `public/content/adapters/zhaopin.js` |
| 猎聘 | `public/content/adapters/liepin.js` |
| 拉勾 | `public/content/adapters/lagou.js` |
| 58 同城、赶集 | `public/content/adapters/classifieds.js` |
| 应届生求职 | `public/content/adapters/yingjiesheng.js` |
| 标准 JobPosting | `public/content/adapters/structured.js` |
| 未知页面保守回退 | `public/content/adapters/generic.js` |

## 环境与命令

- 开发环境：`VITE_APP_ORIGIN=http://localhost:5173`，`VITE_API_ORIGIN=http://localhost:8000`。
- 生产环境：网页与 API 均使用 `https://aijianli.tech`。
- 开发构建监听：`npm run dev:watch`。
- 开发构建：`npm run build:dev`。
- 生产构建：`npm run build`。
- 提取回归：`npm run test:extractor`。
- 悬浮入口回归：`npm run test:launcher`。
- 契约检查：`npm run check:contracts`。

## 已知限制

- 招聘网站 DOM 改版后，平台适配器可能需要同步调整；不确定时应失败提示，不应猜错字段。
- 招聘站点权限由用户手势授予的 `activeTab` 临时提供；Manifest 或动态注入文件列表变化后必须在 `chrome://extensions/` 重新加载。
- 插件不绕过登录、验证码、风控、反爬限制，也不后台批量抓取岗位。
- 插件不会替用户点击最终提交或自动发送聊天消息。

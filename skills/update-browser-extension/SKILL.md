---
name: update-browser-extension
description: >-
  AI 简历浏览器扩展的显式全量审计、开发与知识同步流程。仅当用户请求中独立出现
  `--更新插件` 时使用：开发前读取插件 PRD、架构、消息与数据契约和当前状态，完成后同步
  PRD、知识引用与维护记录并执行完整检查。未包含 `--更新插件` 的普通修复、样式调整、
  功能开发、代码审查或 `--更新` 项目级维护不得触发本 Skill。
---

# 更新 AI 简历浏览器扩展

只把本 Skill 用作 `--更新插件` 的全量维护入口。插件根目录是本 Skill 的上两级目录，唯一当前 PRD 为 `prd/AI简历浏览器扩展-PRD.md`。

## 触发边界

- 只将请求中独立出现的 `--更新插件` 视为触发条件。
- 用户只发送 `--更新插件`：审计代码和知识并同步过时内容，不主动增加产品功能。
- 用户在需求后附加 `--更新插件`：先加载完整知识，再实现需求，最后同步 PRD 与维护记录。
- 不把 `--更新插件` 解释为发布、上传商店、部署线上、操作生产数据库、自动投递或删除数据的授权。
- 项目级 `--更新` 与插件级 `--更新插件` 相互独立；同时出现时分别遵循对应流程。

## 开始前

按顺序执行：

1. 读取 `prd/AI简历浏览器扩展-PRD.md`。
2. 读取本 Skill 的 `references/current-state.md`、`architecture.md` 和 `contracts.md`。
3. 运行 `node skills/update-browser-extension/scripts/project_snapshot.mjs` 获取当前代码快照。
4. 运行 `npm run check:contracts`，在修改前发现版本、内容脚本顺序或消息契约漂移。
5. 根据请求追踪最小完整链路，不无目的加载前后端全部源码。

可执行代码、Manifest 和后端路由是事实来源。它们与 PRD 或 Skill 引用冲突时，应修正文档，不得为了迎合旧文档破坏正确代码。

## 追踪链路

- 悬浮入口：`public/content/launcher.js -> runtime message -> public/background.js -> chrome.sidePanel -> src/App.vue`。
- 岗位识别：`content.js -> platform adapter -> shared.js normalize/validate/merge -> background -> App.vue`。
- 收藏：`App.vue -> src/api.js -> backend /api/extension/jobs -> extension_saved_job -> web SavedJobsPanel`。
- 账号连接：`App.vue -> background OPEN_CONNECT -> /extension/connect -> auth/exchange -> storage.local`。
- 回填与投递：`App.vue -> background -> content/actions.js -> 当前招聘页面`；必须保留用户最终确认。

## 实现约束

- 保持 Manifest V3、Vue 3、Vite、Ant Design Vue 和 Lucide 的现有技术栈。
- 后台协调、平台解析、共享清洗、页面动作、悬浮入口和侧边栏 UI 必须分模块，禁止重新揉成单文件。
- 每个招聘平台使用独立适配器；优先标准 `JobPosting`，再使用平台精确选择器，最后才允许严格语义回退。
- 不以 `document.body.innerText` 作为岗位详情；标题不一致时不得合并公司、薪资或 JD。
- 内容脚本注入网页 UI 时使用 Shadow DOM 或等价隔离方式，不覆盖宿主网站的全局样式。
- `chrome.sidePanel.open()` 必须由明确用户手势触发；不得在后台无交互弹出。
- 保存来源 URL 时去除追踪参数但保留可返回的岗位地址；同一岗位再次识别应更新原收藏。
- 不记录账号密码、验证码、招聘网站会话、整页内容或无关公司/招聘官模块。
- 新增或修改的关键逻辑必须添加简洁中文注释，说明职责、边界或兼容原因，不写逐句翻译语法的注释。
- UI 要检查窄侧边栏和招聘页面桌面布局，避免横向滚动、遮挡主要按钮或与网站样式冲突。

## 同步 PRD

每次 `--更新插件` 都检查 PRD，以下事实变化时必须更新对应章节：

- 产品定位、用户流程、功能范围或非目标。
- 支持平台、权限、内容脚本、消息类型或浏览器最低版本。
- 岗位字段、后端接口、存储键、环境变量或账号连接方式。
- 用户可见文案、主要入口、收藏、分析、回填或投递边界。
- 构建、安装、更新、测试方式和已知限制。

PRD 只描述已经实现或明确标记为规划中的能力。不得把路线图写成当前可用功能，也不得删除历史需求而不说明替代关系。

## 完成后

1. 重新运行项目快照并核对变更后的事实。
2. 运行 `npm run check:contracts`。
3. 运行 `npm run test:extractor`；岗位提取规则变化时补充对应平台回归样例。
4. 运行 `npm run test:launcher`；悬浮入口交互或生命周期变化时同步更新测试。
5. 运行 `npm run build:dev` 和 `npm run build`。
6. 涉及实际交互时，在 Chrome 开发者模式重新加载扩展，检查悬浮入口、侧边栏、岗位切换与收藏流程。
7. 更新发生事实变化的 Skill 引用和唯一 PRD。
8. 向 `references/change-log.md` 追加本次日期、代码变化、知识变化、验证结果与未验证项，不改写历史记录。
9. 再次运行 Skill 结构校验。

## 交付

说明用户可见变化、修改的模块、PRD 与知识同步内容、执行的检查、需要用户手动重新加载扩展的原因，以及仍受招聘网站页面改版影响的风险。未同步 PRD 或维护记录时，不得声称 `--更新插件` 已完成。

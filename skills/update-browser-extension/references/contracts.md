# 消息与数据契约

## Runtime 消息

| 类型 | 方向 | 作用 |
|---|---|---|
| `OPEN_SIDE_PANEL_FROM_PAGE` | launcher -> background | 用户点击悬浮入口，打开侧边栏并刷新当前岗位 |
| `OPEN_CONNECT` | App -> background | 打开官网一次性账号授权流程 |
| `CAPTURE_CURRENT_JOB` | App -> background | 识别活动标签页当前岗位 |
| `AUTOFILL_PAGE` | App -> background | 回填当前申请页面 |
| `DELIVER_CURRENT_JOB` | App -> background | 打开平台投递入口或回填表单 |
| `EXTRACT_JOB` | background -> content | 执行岗位适配器编排 |
| `AUTOFILL_FORM` | background -> content | 执行字段映射与回填 |
| `DELIVER_JOB` | background -> content | 执行受控投递入口动作 |

## 岗位对象

内容脚本返回给侧边栏使用 camelCase：

```json
{
  "sourceTitle": "高级前端工程师",
  "company": "示例科技有限公司",
  "location": "深圳-南山区",
  "address": "深圳市南山区示例大厦",
  "salary": "20-30K·14薪",
  "skills": ["Vue", "TypeScript"],
  "jdText": "岗位职责与任职要求全文",
  "sourceUrl": "https://招聘平台/岗位详情",
  "sourcePlatform": "BOSS直聘",
  "sourceOriginal": "BOSS直聘"
}
```

收藏接口 `POST /api/extension/jobs` 使用 snake_case：

```text
source_url, title, company, location, address, salary, skills,
source_platform, source_original, jd_text, resume_id, match_result, status
```

## 后端接口

| 方法 | 路径 | 用途 |
|---|---|---|
| `POST` | `/api/extension/auth/exchange` | 一次性授权码换插件访问令牌 |
| `GET` | `/api/extension/bootstrap` | 简历列表与默认简历 |
| `GET` | `/api/extension/resumes/:resumeId/autofill` | 获取受控回填数据 |
| `GET` | `/api/extension/jobs` | 收藏列表 |
| `GET` | `/api/extension/jobs/:jobId` | 收藏完整详情 |
| `POST` | `/api/extension/jobs` | 新增或按清洗后的完整原岗位地址更新收藏；岗位 ID 查询参数必须保留 |
| `POST` | `/api/extension/jobs/:jobId/analyze` | 网页端重新分析本人收藏岗位 |
| `DELETE` | `/api/extension/jobs/:jobId` | 插件或网页端取消本人收藏，不改变招聘网站状态 |
| `POST` | `/api/ai/match` | 当前简历与岗位匹配分析 |

## Chrome 存储

| 区域/键 | 内容 |
|---|---|
| `storage.local.extensionSession` | 插件受限访问令牌 |
| `storage.session.pendingJob` | 当前识别岗位 |
| `storage.session.activeJobTabId` | 当前岗位所属标签页；切换标签时用于清除旧岗位上下文 |
| `storage.session.pendingAction` | 右键菜单待执行的 `save` 或 `analyze` |
| `storage.session.pendingAutofill` | 待执行回填的活动标签页信息 |
| `storage.session.pageActionError` | 页面动作错误提示 |

不得存储招聘网站密码、Cookie、验证码或完整浏览历史。

## 权限边界

- `sidePanel`：显示 Vue Agent。
- `scripting`、`activeTab`：用户触发后临时在当前岗位页执行适配器；招聘站点不声明常驻脚本或主机权限。
- `contextMenus`：右键快捷动作。
- `identity`：一次性网页授权回调。
- `storage`：插件会话与临时岗位状态。
- `tabs`：获取活动页面和打开网页端收藏/编辑器。

增加新平台时必须同时更新平台适配器、背景支持域名判断、回归样例、PRD 与本契约；招聘域名不加入常驻 `content_scripts` 或 `host_permissions`。
